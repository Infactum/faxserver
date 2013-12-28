var redis = require('redis'),
    redisIO = redis.createClient(),
    redisListener = redis.createClient(),
    logger = require('log4js').getLogger('FaxDB'),
    config = require('../config'),
    async = require('async'),
    emitter = {};

var translation = require('../translate/' + config.get('language'));

var FaxDB = {
    addFaxData: addFaxData,
    getFaxData: getFaxData,
    getFirstQueuedFaxUDID: getFirstQueuedFaxUDID,
    incFaxFailure: incFaxFailure,
    suspendFax: suspendFax,
    setFaxSuccess: setFaxSuccess,
    getCurrentState: getCurrentState,
    setEmitter: function() {
        emitter = arguments[0];
    }
};

function sendUpdateToClients() {
    emitter.emit('updateFaxDataTable');
}

function addFaxData(uuid, phone) {
    var multi = redisIO.multi();
    multi.set('fax:' + uuid + ':phone', phone);
    multi.set('fax:' + uuid + ':date', new Date().getTime());
    multi.set('fax:' + uuid + ':retry', 0);
    multi.rpush('fax:send', uuid);
    multi.exec(function(err) {
        if (err) throw err;
        logger.debug('fax %s for %s added to DB', uuid, phone);
        sendUpdateToClients();
    });
}

function getFaxData(uuid, callback) {
    var multi = redisIO.multi();
    multi.get('fax:' + uuid + ':phone');
    multi.get('fax:' + uuid + ':retry');
    multi.get('fax:' + uuid + ':date');
    multi.exec(function(err,replies) {
        var fax = {
            uuid: uuid,
            phone: replies[0],
            retry: parseInt(replies[1]),
            date: new Date(parseInt(replies[2]))
        };
        callback(err,fax);
    });
}

function getFirstQueuedFaxUDID(callback) {
    redisListener.blpop('fax:send',0,function(err, result) {
        if (err) {
            callback(err);
        } else {
            redisIO.zadd('fax:processing',new Date().getTime(),result[1]);
            callback(err, result[1]);
        }
    });
}

function incFaxFailure(uuid) {
    redisIO.incr('fax:' + uuid + ':retry', function(err,result) {
        if (err) throw err;
        if (parseInt(result) < config.get('FAX:maxRetry')) {
            suspendFax(uuid);
        } else {
            setFaxFailure(uuid);
        }
        sendUpdateToClients();
    });
}

function suspendFax(uuid) {
    var multi = redisIO.multi();
    multi.zrem('fax:processing', uuid);
    var remindTime = new Date().getTime() + config.get('FAX:retryInterval') * 1000;
    multi.zadd('fax:delayed', remindTime, uuid);
    multi.exec(function(err) {
        if (err) throw err;
        logger.debug('Fax %s suspended', uuid);
        sendUpdateToClients();
    });
}

function setFaxSuccess(uuid) {
    var multi = redisIO.multi();
    multi.zrem('fax:processing', uuid);
    multi.zadd('fax:success', new Date().getTime(), uuid);
    multi.exec(function(err) {
        if (err) throw err;
        logger.debug('Fax %s marked as successful', uuid);
        sendUpdateToClients();
    });
}

function setFaxFailure(uuid) {
    var multi = redisIO.multi();
    multi.zrem('fax:processing', uuid);
    multi.zadd('fax:failed', new Date().getTime(), uuid);
    multi.exec(function(err) {
        if (err) throw err;
        logger.debug('Fax %s marked as failed', uuid);
        sendUpdateToClients();
    });
}

function processDelayedFaxes() {
    var currentTime = new Date().getTime();
    redisIO.zrangebyscore('fax:delayed','-inf',currentTime, function(err,results) {
        if (err) throw err;
        if (results.length > 0) {
            var multi = redisIO.multi();
            for (var i=0; i<results.length; i++) {
                multi.rpush('fax:send', results[i]);
            }
            multi.zremrangebyscore('fax:delayed','-inf',currentTime);
            logger.debug('Moving %s calls to queue',results.length);
            multi.exec(function(err){
                if (err) logger.error('Error processing delayed calls:\n' + err);
            });
            sendUpdateToClients();
        }
    });
}

/**
 * Returns object with current fax state
 * through async chain:
 * 1. Get fax info from processing/fail/delay/success queues
 * 2. Adds detailed information for them
 *
 * @param callback
 */
function getCurrentState(callback) {
    stateRequestWaterfall(function(err,result) {
        async.mapSeries(result, addFaxInfo, callback);
    });
}

function addFaxInfo(item, callback) {
    async.waterfall([
        function(asyncCallback) {
            getFaxData(item.uuid,asyncCallback)
        },
        function(fax,asyncCallback) {
            var faxWithInfo = {
                uuid: item.uuid,
                phone: fax.phone,
                date: fax.date,
                status: item.status,
                statusTimeStamp: item.statusTimeStamp,
                retry: fax.retry
            };
            asyncCallback(null, faxWithInfo);
        }
    ],callback);
}

function stateRequestWaterfall(callback) {
    async.waterfall([
        function (asyncCallback) {
            stateRequestSeries(asyncCallback);
        },
        function (arg1, asyncCallback) {
            parseStateSeriesInfo(arg1, asyncCallback)
        }
    ],callback);
}

function stateRequestSeries(callback) {
    var series = {};
    series[translation.faxStates.processing] = function(asyncCallback) {
        redisIO.zrange('fax:processing',0,-1,'WITHSCORES',asyncCallback)
    };
    series[translation.faxStates.delayed] = function(asyncCallback) {
        redisIO.zrange('fax:delayed',0,-1,'WITHSCORES',asyncCallback)
    };
    series[translation.faxStates.failed] = function(asyncCallback) {
        redisIO.zrange('fax:failed',0,-1,'WITHSCORES',asyncCallback)
    };
    series[translation.faxStates.success] = function(asyncCallback) {
        redisIO.zrange('fax:success',0,-1,'WITHSCORES',asyncCallback)
    };
    async.series(series,callback);
}

function parseStateSeriesInfo(info, callback) {
    var state = [];
    for (var prop in info) {
        if (info.hasOwnProperty(prop)) {
            var statusArray = info[prop];
            for (var i=0; i<statusArray.length; i+=2) {
                state.push({uuid: statusArray[i], status: prop, statusTimeStamp: new Date(parseInt(statusArray[i+1]))})
            }
        }
    }
    callback(null,state);
}

setInterval(processDelayedFaxes, config.get('FAX:delayedProcessingInterval') * 1000);

module.exports = FaxDB;

//TODO: clean up redis from old fax data