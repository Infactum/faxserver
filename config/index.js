var fs = require('fs'),
    path = require('path'),
    nconf = require('nconf');

nconf.use('file', { file: path.join(__dirname, 'config.json') });

module.exports = nconf;