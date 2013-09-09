var callsite = require('callsite');
var nResolve = require('resolve').sync;
var transformers = require('transformers');

var path = require('path');
var fs = require('fs');

var file = require('./lib/file');
var settings = require('./lib/settings');

var normalize = path.normalize;
var resolve = path.resolve;
var dirname = path.dirname;
var stat = fs.statSync;

exports = module.exports = transform;
function transform(transformerName, engine) {
  if (engine) transformers[transformerName].engine = engine
  load(transformers[transformerName]);
  function transformer(path, options) {
    if (resolve(path) === normalize(path)) {
      path = normalize(path);
    } else {
      path = nResolve(path, {basedir: directory()});
    }
    return file(transformerName, path, options);
  }
  transformer.settings = settings(transformerName);
  return transformer;
}

function load(transformer) {
  if (transformer.engine) return transformer.engine;
  for (var i = 0; i < transformer.engines.length; i++) {
    try {
      var res = transformer.engines[i] === '.' ?
        null
        :
        (transformer.engine = require(nResolve(transformer.engines[i], {basedir: directory()})));
      transformer.engineName = transformer.engines[i];
      return res;
    } catch (ex) {
      if (transformer.engines.length === 1) {
        throw ex;
      }
    }
  }
  throw new Error('In order to apply the transform ' + transformer.name + ' you must install one of '
                  + transformer.engines.map(function (e) { return '"' + e + '"'; }).join());
}

function directory(exclude) {
  var stack = callsite();
  for (var i = 0; i < stack.length; i++) {
    var filename = stack[i].getFileName();
    if (filename !== __filename && (!exclude || (exclude.indexOf(filename) === -1)))
      return dirname(filename);
  }
  throw new Error('Could not resolve directory');
}
