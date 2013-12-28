var config = require('../config');

exports.index = function (req, res) {
    res.render('index', {translation: require('../translate/' + config.get('language'))});
};