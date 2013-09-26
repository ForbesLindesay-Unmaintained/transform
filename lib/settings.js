var ms = require('ms');

module.exports = settings;
module.exports.mode = process.env.NODE_ENV || 'development';

var cache = {};
function settings(transformer) {
  if (cache['key:' + transformer]) return cache['key:' + transformer];
  var exports = setter();

  exports.production = setter();
  exports.production.cache = true;
  exports.production.minify = true;
  exports.production.gzip = true;

  exports.development = setter();
  exports.development.cache = false;
  exports.development.minify = false;
  exports.development.gzip = false;

  exports.normalize = normalize;
  function normalize(options) {
    var defaults = exports[module.exports.mode] || (exports[module.exports.mode] = setter());
    options = options || {};

    Object.keys(defaults)
      .forEach(function (key) {
        if (options[key] === null || options[key] === undefined) {
          options[key] = defaults[key];
        }
      });
    Object.keys(exports)
      .forEach(function (key) {
        if (key !== 'production' && key !== 'development' && key !== 'normalize' && (options[key] === null || options[key] === undefined)) {
          options[key] = exports[key];
        }
      });


    if (typeof options.cache === 'string' && ms(options.cache)) {
      options.cache = 'public, max-age=' + Math.floor(ms(options.cache)/1000);
    } else if (options.cache === true) {
      options.cache = 'public, max-age=60';
    } else if (typeof options.cache === 'number') {
      options.cache = 'public, max-age=' + Math.floor(options.cache/1000);
    } else if (typeof options.cache === 'object') {
      options.cache = (options.cache.private ? 'private' : 'public') + ', max-age='
                    + Math.floor(ms(options.cache.maxAge.toString())/1000);
    }

    return options;
  }

  return cache['key:' + transformer] = exports;
}

function setter(obj) {
  obj = obj || set;
  function set(key) {
    if (arguments.length === 2) {
      obj[key] = arguments[1];
      return this;
    } else if (typeof key === 'object') {
      Object.keys(key)
        .forEach(function (k) {
          obj[k] = key[k];
        });
      return this;
    } else {
      return obj[key];
    }
  }
  return set;
}
