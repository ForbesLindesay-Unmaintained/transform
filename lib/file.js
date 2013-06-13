var zlib = require('zlib');
var crypto = require('crypto');

var transformers = require('transformers');
var Promise = require('promise');

var settings = require('./settings');

module.exports = transform;
function transform(name, path, options) {
  options = settings(name).normalize(options);
  var transformer = transformers[name];
  function compile() {
    var opts = {};
    Object.keys(options)
      .forEach(function (key) {
        opts[key] = options[key];
      });
    opts.cache = false; //skip internal cache
    return transformer.renderFile(path, opts)
      .then(function (src) {
        return gzip(src)
          .then(function (gzipped) {
            return {
              src: new Buffer(src),
              gzip: gzipped,
              md5: md5(src)
            }
          });
      })
  }

  var result;
  if (options.cache) {
    result = compile();
  }

  return function (req, res, next) {
    (result || compile())
      .then(function (compiled) {
        var tag = compiled.md5;
        var src = compiled.src;
        var gzipped = compiled.gzip;
        try {

          // vary
          if (!res.getHeader('Vary')) {
            res.setHeader('Vary', 'Accept-Encoding');
          } else if (!~res.getHeader('Vary').indexOf('Accept-Encoding')) {
            res.setHeader('Vary', res.getHeader('Vary') + ', Accept-Encoding');
          }
          if (/\..+/.test(req.path))
            res.type(req.path.replace(/^.*(\.[^\.]+)$/, '$1'));
          //res.setHeader('content-type', 'text/javascript');

          //check old etag
          if (req.headers['if-none-match'] === tag) {
            res.statusCode = 304;
            res.end();
            return;
          }

          //add new etag
          res.setHeader('ETag', tag);
          //res.setHeader('Last-Modified', start);

          //add cache-control
          if (options.cache) {
            res.setHeader('Cache-Control', options.cache);
          }

          //add gzip
          if (options.gzip && supportsGzip(req)) {
            res.setHeader('Content-Encoding', 'gzip');
            src = gzipped;
          }

          //set content-length (src must always be a buffer)
          res.setHeader('Content-Length', src.length);

          //send content
          if ('HEAD' === req.method) res.end();
          else res.end(src);
        } catch (ex) {
          if (!res.headerSent) {
            try { return next(err); } catch (ex) {}
          }
          console.error(ex.stack || ex.message || e);
        }
      }, next);
  };
}


function md5(str) {
  return crypto.createHash('md5').update(str).digest("hex");
}
function gzip(str) {
  return new Promise(function (resolve, reject) {
    zlib.gzip(str, function (err, res) {
      if (err) return reject(err);
      else return resolve(res);
    });
  })
}
function supportsGzip(req) {
  return req.headers && req.headers['accept-encoding'] && req.headers['accept-encoding'].indexOf('gzip') != -1;
}