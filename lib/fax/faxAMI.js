var faxDB   = require('./faxDB'),
    logger  = require('log4js').getLogger('faxAMI'),
    namiLib = require('nami'),
    config  = require('../../config');

var nami = new namiLib.Nami(config.get('AMI'));

nami.logger.setLevel(config.get('logLevel'));

function start() {
    faxDB.getFirstQueuedFaxUDID(onFirstQueuedFaxUDID);
    nami.open();
}

function onFirstQueuedFaxUDID(err,udid) {
    if (err) {
        logger.error('Failed to get queued fax info. Retry in 60 seconds.\n' + err);
        setTimeout(function() {
            faxDB.getFirstQueuedFaxUDID(onFirstQueuedFaxUDID);
        },60000);
    } else {
        faxDB.getFaxData(udid, onFaxData);
        faxDB.getFirstQueuedFaxUDID(onFirstQueuedFaxUDID);
    }
}

function onFaxData(err,faxData) {
    if (err) {
        logger.error('Failed to get fax data:\n' + err);
    } else {
        originateCall(faxData);
    }
}

function originateCall (fax) {

    action = new namiLib.Actions.Originate();
    action.Channel = 'Local/' + fax.phone + '@OutgoingFaxInit';

    action.Context = 'OutgoingFaxInit';
    action.Exten = 'router';
    action.Async = 'true';
    action.Priority = '1';
    action.variables = {
        'UUID': fax.uuid,
        'MAX_PARALLELISM': config.get('FAX:maxParallelism'),        
        'DATA': config.get('FAX:storageDir') + fax.uuid + '.tiff'
    };

    logger.debug('Originating call %s to number %s (try %s)',fax.uuid,fax.phone,fax.retry+1);
    nami.send(action);
}

nami.on('namiEventUserEvent', function(event) {
    if (event.userevent == 'Fax') {
        var status = event.status.toUpperCase();
        var uuid = event.uuid;
        logger.debug('Fax %s: %s',uuid,status);
        switch (status) {
            case 'CALL PICKUP SUCCESS':
                break;
            case 'CALL PICKUP FAILED':
                faxDB.incFaxFailure(uuid);
                break;
            case 'FAX SEND FAILED':
                faxDB.incFaxFailure(uuid);
                break;
            case 'CALL SUSPENDED':
                faxDB.suspendFax(uuid);
                break;
            case 'FAX SEND SUCCESS':
                faxDB.setFaxSuccess(uuid);
                break;
            default:
        }
    }
});

module.exports.start = start;