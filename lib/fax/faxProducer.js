var config  = require('../../config'),
    exec    = require('child_process').exec,
    fs      = require('fs'),
    uuidLib = require('node-uuid'),
    path    = require('path'),
    logger  = require('log4js').getLogger('faxProducer'),
    faxDB   = require('./faxDB');

function addFaxToQueue(phone, filePath) {
    var uuid = uuidLib.v4();
    var resultPath = path.join(config.get('FAX:storageDir'), uuid + '.tiff');
    var command = config.get('FAX:gsCommand') + ' -q -dNOPAUSE -dBATCH -sDEVICE=tiffg4 '
            + '-sPAPERSIZE=letter -sOutputFile=' + resultPath + ' ' + filePath;
    logger.debug(command);
    exec(command,function(err) {
        if (err) {
            logger.error('Processing fax to ' + phone + ' failed:\n' + err);
        } else {
            faxDB.addFaxData(uuid, phone);
            cleanUp(filePath);
        }
    });
}

function cleanUp(filePath) {
    fs.unlink(filePath, function(err) {
        if (err) {
            logger.warn('Clean up failed:\n' + err);
        }
    });
}

exports.addFaxToQueue = addFaxToQueue;