var redis           = require('redis'),
    redisIO         = redis.createClient(),
    redisListener   = redis.createClient(),
    logger          = require('log4js').getLogger('faxDB'),
    config          = require('../../config'),
    async           = require('async'),
    events          = require('events'),
    emitter         = require('./emitter');

redisIO.on('error', function() {
    logger.error('redisIO connection problem');
});

redisIO.on('ready', function() {
    logger.info('redisIO client ready');
});

redisListener.on('error', function() {
    logger.error('redisListener connection problem');
});

redisListener.on('ready', function() {
    logger.info('redisListener client ready');
});

var faxDB = {
    addFaxData: addFaxData,
    getFaxData: getFaxData,
    getFirstQueuedFaxUDID: getFirstQueuedFaxUDID,
    incFaxFailure: incFaxFailure,
    suspendFax: suspendFax,
    setFaxSuccess: setFaxSuccess,
    getCurrentState: getCurrentState
};

function addFaxData(uuid, phone) {
    var multi = redisIO.multi();
    multi.set('fax:' + uuid + ':phone', phone);
    multi.set('fax:' + uuid + ':date', new Date().getTime());
    multi.set('fax:' + uuid + ':retry', 0);
    multi.rpush('fax:send', uuid);
    multi.exec(function(err) {
        if (err) {
            logger.error('Failed to add fax:\n' + err);
        } else {
            logger.debug('fax %s for %s added to DB', uuid, phone);
            emitter.emit('update');
        }
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
        callback.call(this,err,fax);
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
        if (err) {
            logger.error('failed to inc retry for ' + uuid);
        } else if (parseInt(result) < config.get('FAX:maxRetry')) {
            suspendFax(uuid);
        } else {
            setFaxFailure(uuid);
        }
        emitter.emit('update');
    });
}

function suspendFax(uuid) {
    var multi = redisIO.multi();
    multi.zrem('fax:processing', uuid);
    var remindTime = new Date().getTime() + config.get('FAX:retryInterval') * 1000;
    multi.zadd('fax:delayed', remindTime, uuid);
    multi.exec(function(err) {
        if (err) {
            logger.error('Failed to suspend fax:\n' + err);
        } else {
            logger.debug('Fax %s suspended', uuid);
            emitter.emit('update');
        }
    });
}

function setFaxSuccess(uuid) {
    var multi = redisIO.multi();
    multi.zrem('fax:processing', uuid);
    multi.zadd('fax:success', new Date().getTime(), uuid);
    multi.exec(function(err) {
        if (err) {
            logger.error('Failed to mark fax as successful:\n' + err);
        } else {
            logger.debug('Fax %s marked as successful', uuid);
            emitter.emit('update');
        }
    });
}

function setFaxFailure(uuid) {
    var multi = redisIO.multi();
    multi.zrem('fax:processing', uuid);
    multi.zadd('fax:failed', new Date().getTime(), uuid);
    multi.exec(function(err) {
        if (err) {
            logger.error('Failed to mark fax as failed:\n' + err);
        } else {
            logger.debug('Fax %s marked as failed', uuid);
            emitter.emit('update');
        }
    });
}

function processDelayedFaxes() {
    var currentTime = new Date().getTime();
    redisIO.zrangebyscore('fax:delayed','-inf',currentTime, function(err,results) {
        if (err) {
            logger.error('Failed processing delayed faxes:\n' + err);
        } else {
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
                emitter.emit('update');
            }
        }
    });
}

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
    async.series({
        "Обрабатывается": function(asyncCallback) {
            redisIO.zrange('fax:processing',0,-1,'WITHSCORES',asyncCallback)
        },
        "Отложен": function(asyncCallback) {
            redisIO.zrange('fax:delayed',0,-1,'WITHSCORES',asyncCallback)
        },
        "Не удалось доставить": function(asyncCallback) {
            redisIO.zrange('fax:failed',0,-1,'WITHSCORES',asyncCallback)
        },
        "Доставлен успешно": function(asyncCallback) {
            redisIO.zrange('fax:success',0,-1,'WITHSCORES',asyncCallback)
        }
    },callback);
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

module.exports = faxDB;