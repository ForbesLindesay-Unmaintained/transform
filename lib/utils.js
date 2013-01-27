
exports.endsWith = endsWith;
function endsWith(str, ending) {
  return str.substr(-ending.length) === ending;
}

exports.replaceEnd = replaceEnd;
function replaceEnd(str, oldEnding, newEnding) {
  return endsWith(str, oldEnding) ?
    (str.substr(0, str.length - oldEnding.length) + newEnding) : str;
}

exports.parallelMap = parallelMap;
function parallelMap(items, fn, cb) {
  var operations = items.length;
  if (0 === operations) cb(null, items);
  for (var i = 0; i < items.length; i++) {
    (function (i) {
      fn(items[i], function (err, res) {
        if (err) return cb(err);
        items[i] = res;
        if (0 === --operations) cb(null, items);
      });
    }(i));
  }
}

exports.serialForEach = serialForEach;
function serialForEach(items, fn, cb) {
  if (0 === items.length) fn(null);
  var i = 0;
  function next(err) {
    if (err) return cb(err);
    if (i === items.length) return cb(null);
    fn(items[i++], next);
  }
  next();
}