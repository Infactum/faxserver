var config = require('../config'),
    translation = require('../translate/' + config.get('language'));

function getTranslation(req,res) {
    res.writeHead(200, { 'Content-Type': 'application/json'});
    res.end(JSON.stringify(translation.dataTables, undefined, 2));
}

module.exports.getTranslation = getTranslation;