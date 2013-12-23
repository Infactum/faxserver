var logger = require('log4js').getLogger('socket.io'),
    path = require('path');

var LogWrapper = function () {
    this.logger = logger;
};
LogWrapper.prototype.error = function () {
    this.logger.error.apply(this.logger, arguments);
};
LogWrapper.prototype.warn = function () {
    this.logger.warn.apply(this.logger, arguments);
};
LogWrapper.prototype.info = function () {
    this.logger.info.apply(this.logger, arguments);
};
LogWrapper.prototype.debug = function () {
    this.logger.debug.apply(this.logger, arguments);
};

module.exports = new LogWrapper;