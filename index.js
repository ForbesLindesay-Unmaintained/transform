var debug = require('debug')('transform');

var wrench = require('wrench');
var fs = require('fs');

var path = require('path');
var join = path.join;
var dirname = path.dirname;

exports = module.exports = transform;

var Transform = exports.Transform = require('./lib/transform');

var cacheID = 0;
function transform(source) {
  return {
    using: function (transformer) {
      var args = Array.prototype.slice.call(arguments);
      var grep;
      var dest = '';
      function create() {
        if (transformer instanceof Transform) {
          if (dest) {
            transformer.destination = dest;
          } else {
            dest = transformer.destination;
          }
          if (grep) {
            transformer.grep(grep);
          }
          return transformer;
        } else {
          if (!dest) {
            dest = join(__dirname, 'cache', '' + cacheID++);
            wrench.rmdirSyncRecursive(dest, true);
          }
          var t = new Transform(source, dest);
          if (grep) t.grep(grep);
          if (typeof transformer === 'function') {
            transformer(t);
          }
          return t;
        }
      }
      return {
        grep: function (filter) {
          grep = filter;
          return this;
        },
        statically: function (destination) {
          dest = destination;
          compile(create());
          try {
            return require('express').static(dest);
          } catch (ex) {
            try {
              return require('connect').static(dest);
            } catch (ex) {
              return function (req, res, next) { next(); };
            }
          }
        },
        dynamically: function () {
          return middleware(create());
        },
        to: function (destination) {
          if (process.env.NODE_ENV && process.env.NODE_ENV != 'development') {
            return this.statically(destination);
          } else {
            return this.dynamically(destination);
          }
        }
      }
    }
  }
}

function compile(transformer) {
  wrench.readdirSyncRecursive(transformer.source)
    .forEach(function (file) {
      if (!fs.statSync(join(transformer.source, file)).isDirectory()) {
        debug('render: ' + file);
        transformer.renderFrom(file, function (err, res) {
          if (err) return console.warn(err.stack);
          for (var i = 0; i < res.length; i++)
            debug('write: ' + res[i]);
        });
      }
    });
}

function middleware(transformer) {
  var url = require('url');
  var mime = require('mime');
  return function (req, res, next) {
    var path = url.parse(req.url).pathname;
    res.setHeader('Content-Type', mime.lookup(path));
    debug('render: ' + path);
    transformer.renderTo(path, function (err, text) {
      if (err && err.code === 'ENOENT') return next();
      if (err) return next(err);
      res.end(text);
    });
  }
}