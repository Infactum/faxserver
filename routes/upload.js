var formidable = require('formidable'),
    config = require('../config'),
    logger = require('log4js').getLogger('uploader'),
    faxProducer = require('../lib/faxProducer');

function upload(req, res) {
    var form = new formidable.IncomingForm();
    form.uploadDir = config.get('FAX:uploadDir');
    form.parse(req, function (err, fields, files) {
        if (err) {
            logger.error('Can\'t parse POST upload.\n' + err);
        } else if (!fields.number || !files.file || files.file.size == 0) {
            if (!fields.number) {
                logger.error('Can\'t find field "number" in POST upload.')
            }
            if (!files.file || files.file.size == 0) {
                logger.error('Can\'t find field "file" in POST upload.')
            }
        } else {
            faxProducer.addFaxToQueue(fields.number, files.file.path);
        }
        res.end();
    });
}

exports.upload = upload;