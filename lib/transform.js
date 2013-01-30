var fs = require('fs');
var join = require('path').join;

var utils = require('./utils');
var endsWith = utils.endsWith;
var replaceEnd = utils.replaceEnd;
var parallelMap = utils.parallelMap;
var serialForEach = utils.serialForEach;

var transformers;

module.exports = Transform;
function Transform(source, destination) {
  this.source = source;
  this.transforms = [];
  this.destination = destination;
}

Transform.prototype.add = function add(start, end, transformer, options) {
  options = options || {};
  options.cache = false;
  this.transforms.push({forward: toPathMutator(start, end), backward: toPathMutator(end, start), transformer: toTransformFunction(transformer, options)});
};

//Generate all possible transformations that could generate a file from path
Transform.prototype.forward = function forward(path) {
  var self = this;

  var transformations = [
    {
      input: join(this.source, path),
      transformation: [],
      output: join(this.destination, path)
    }
  ];
  this.transforms.forEach(function (transform) {
    var newTransformations = [];
    transformations.forEach(function (transformation) {
      var output;
      if (output = transform.forward(transformation.output)) {
        if (output === transformation.output) {
          transformation.transformation.push(transform);
        } else {
          newTransformations.push({
            input: transformation.input,
            transformation: transformation.transformation.concat(transform),
            output: output
          });
        }
      }
    });
    transformations = transformations.concat(newTransformations);
  });

  return transformations.filter(function (t) {
    return t.transformation.length && self.testGrep(t.input);
  });
};

//Generate all possible transformations that could output a file to path
Transform.prototype.backward = function backward(path) {
  var self = this;

  var transformations = [
    {
      input: join(this.source, path),
      transformation: [],
      output: join(this.destination, path)
    }
  ];
  this.transforms.reverse().forEach(function (transform) {
    var newTransformations = [];
    transformations.forEach(function (transformation) {
      var input;
      if (input = transform.backward(transformation.input)) {
        if (input === transformation.input) {
          transformation.transformation.unshift(transform);
        } else {
          newTransformations.push({
            input: input,
            transformation: [transform].concat(transformation.transformation),
            output: transformation.output
          });
        }
      }
    });
    transformations = transformations.concat(newTransformations);
  });

  this.transforms.reverse();

  return transformations.filter(function (t) {
    return t.transformation.length && self.testGrep(t.input);
  });
}

//generate the output `text` from an output filename
Transform.prototype.renderTo = function renderTo(output, cb) {
  render(this.backward(output), function (err, res) {
    if (err) return cb(err);
    var successful = res.filter(function (r) { return !r[0]; });
    var failed = res.filter(function (r) { return r[0]; });
    if (successful.length === 1) {
      cb(null, successful[0][2]);
    } else if (successful.length > 1) {
      cb(new Error(output + ' could be the result of compiling more than one different file, transform doesn\'t support non-determinism.'));
    } else {
      if (failed.some(isNotNotFound)) {
        failed = failed.filter(isNotNotFound);
      }
      if (failed.length > 1) {
        for (var i = 0; i < failed.length; i++) {
          console.log('Error compiling "' + failed[i][1].input + '":');
          console.error(failed[i][0].stack || failed[i][0].message || failed[i][0]);
        }
      }
      if (failed.some(isError)) {
        failed = failed.filter(isError);
        failed[0][0].message = 'Error compiling "' + failed[0][1].input + '":\n' + failed[0][0].message;
      }
      if (failed.length === 0) {
        failed[0] = [new Error('ENOENT: File not found')];
        failed[0][0].code = 'ENOENT';
      }
      return cb(failed[0][0]);
    }
  });

  function isError(e) {
    return e[0] instanceof Error;
  }
  function isNotNotFound(e) {
    return !(e[0].code === 'ENOENT');
  }
}
//generate a collection `[{filename, text}, ...]` of output files from the input file and transformations
Transform.prototype.renderFrom = function renderFrom(input, cb) {
  var outputs = {};
  render(this.forward(input), function (err, results) {
    var failed = results.filter(function (r) { return r[0]; });
    if (failed.length) {
      if (failed.length > 1) {
        for (var i = 0; i < failed.length; i++) {
          console.log('Error compiling "' + failed[i][1].input + '" to "' + failed[i][1].output + '":');
          console.error(failed[i][0].stack || failed[i][0].message || failed[i][0]);
        }
      }
      if (failed[0][0] instanceof Error)
        failed[0][0].message = 'Error compiling "' + failed[0][1].input + '":\n' + failed[0][0].message;
      return cb(failed[0][0]);
    }
    parallelMap(results, function (result, cb) {
      if (outputs['filename: ' + result[1].output]) {
        return cb(new Error(result[1].input + ' compiled to more than one different file with a destination of ' + result[0][1].output));
      }
      outputs['filename: ' + result[1].output] = true;
      return fs.writeFile(result[1].output, result[2], function (err) {
        if (err && err.code === 'ENOENT') {
          require('wrench').mkdirSyncRecursive(require('path').dirname(result[1].output));
          return fs.writeFile(result[1].output, result[2], function (err) {
            if (err) return cb(err);
            else return cb(null, result[1].output);
          });
        }
        if (err) return cb(err);
        else return cb(null, result[1].output);
      });
    }, cb);
  });
}

Transform.prototype.grep = function (filter) {
  if (typeof filter === 'function') {
    this.grepFilter = filter;
  } else if (filter instanceof RegExp) {
    this.grepFilter = function (input) {
      return filter.test(input);
    };
  } else if (typeof filter === 'object' && object.not instanceof RegExp) {
    this.grepFilter = function (input) {
      return !filter.not.test(input);
    };
  } else {
    throw new Error('Filter is of unexpected type: ' + typeof filter);
  }
};

Transform.prototype.testGrep = function (input) {
  if (this.grepFilter)
    return this.grepFilter(input);
  else
    return true;
};



function render(transformations, cb) {
  parallelMap(transformations, function (route, cb) {
    fs.readFile(route.input, 'utf8', function (err, text) {
      if (err) return cb(null, [err, route, text]);
      serialForEach(route.transformation, function (transformation, cb) {
        transformation.transformer(text, route.input, function (err, res) {
          if (err) return cb(err);
          text = res;
          cb(null);
        });
      }, function (err) {
        cb(null, [err, route, text]);
      });
    });
  }, cb);
}

function toTransformFunction(transformer, options) {
  if (typeof transformer === 'function') {
    return transformer;
  } else if (typeof transformer === 'string') {
    var name = transformer;
    transformers = transformers || require('transformers');
    options = typeof options === 'object' ? options : {};
    return function (text, filename, cb) {
      options.filename = filename;
      transformers[name].render(text, options, cb);
    }
  } else if (Array.isArray(transformer) && transformer.length === 2 && typeof transformer[0] === 'string' && typeof transformer[1] === 'object') {
    return toTransformFunction(transformer[0], transformer[1]);
  } else if (Array.isArray(transformer)) {
    transformer = transformer.map(toTransformFunction);
    return function (text, filename, cb) {
      var i = 0;
      function next(err, text) {
        if (err) return cb(err);
        if (i === transformer.length) return cb(null, text);
        transformer[i++](text, filename, next);
      }
      next(null, text);
    };
  }
}

function toPathMutator(start, end) {
  if (typeof start === 'function') {
    return start;
  } else if (typeof start === 'string' && typeof end === 'string') {
    return function (input) {
      if (endsWith(input, start)) {
        return replaceEnd(input, start, end);
      } else {
        return null;
      }
    }
  } else if (start instanceof RegExp) {
    return function (input) {
      if (start.test(input)) {
        return input.replace(start, end);
      } else {
        return null;
      }
    }
  }

  return function () {
    return null;
  }
}