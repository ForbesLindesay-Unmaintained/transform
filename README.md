# transform

The ultimate transformation/build/compilation middleware/command line/etc. system for node.js

For a list of supported languages, check out [transformers](https://github.com/ForbesLindesay/transformers).  Here are a few highlights:

 - coffee-script
 - less
 - stylus
 - sass
 - js (pass through except for minify option)
 - css (pass through except for minify option)

You also get the following functionality for free:

 - minification automatically enabled for production (for JavaScript, CSS and JSON outputs)
 - gzip automatically enabled for production
 - etags for caching automatically enabled for produciton

If you think I've missed something, be sure to open an issue or submit a pull request.

## Installation

First install the `transform` library:

    $ npm install transform

Then make sure you also install whichever transform(s) you depend on, e.g.

    $ npm install jade coffee-script

## Usage

To get a transform, just pass the name of the transform, e.g.:

```js
var coffee = require('transform')('coffee-script');
var jade = require('transform')('jade');
```

To serve a file with default options, just give it a file name:

```js
app.get('/client.js', coffee('./client.coffee'));
app.get('/', jade('./index.jade'));
```

File paths are always resolved relative to the calling file using node's "require" algorithm.

By default, files are minified (if they result in JavaScript, JSON or CSS), cached and gzipped in production, but not in development.

You can change these settings on a case by case basis, e.g.

```js
app.get('/client.js', coffee('./client.coffee', {minify: false}));
app.get('/client.min.js', coffee('./client.coffee', {minify: true}));
```

You can change options for all environments, or just specific ones:

```js
jade.settings('self', true);
jade.settings.development('pretty', true);
jade.settings.production('debug', false);
```

## License

  MIT