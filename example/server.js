var transform = require('../');
var express = require('express');
var app = express();

var jade = transform('jade');
jade.settings.development('pretty', true);
jade.settings.production('debug', false);
var coffee = transform('coffee-script');

app.get('/client.js', coffee('./client.coffee', {minify: false}));
app.get('/client.min.js', coffee('./client.coffee', {minify: true}));
app.get('/', jade('./index.jade'));

app.listen(3000);