var config = require('./config'),
    log4js = require('log4js'),
    logger = log4js.getLogger('App');

log4js.setGlobalLogLevel(config.get('logLevel'));

var path = require('path');

var http = require('http'),
    express = require('express'),
    app = express(),
    server = http.createServer(app),
    io = require('socket.io').listen(server, {
        logger: require('./lib/socketioLogWrapper')
    });

var faxAMI = require('./lib/faxAMI');

app.set('port', config.get('port'));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(express.favicon(path.join(__dirname, 'public/favicon.ico')));
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));
app.use(log4js.connectLogger(logger, {level: 'auto', format: ':status :method :url' }));

if ('development' == app.get('env')) {
    logger.info('Running in DEV mode');
    app.use(express.errorHandler());
    app.locals.pretty = true;
}

app.get('/', require('./routes').index);
app.get('/state', require('./routes/state').faxState);
app.get('/translate', require('./routes/translate').getTranslation);
app.post('/upload', require('./routes/upload').upload);

server.listen(app.get('port'), function () {
    logger.info('Express server listening on port ' + app.get('port'));
});

require('./lib/faxDB').setEmitter(io.sockets);

faxAMI.start();

