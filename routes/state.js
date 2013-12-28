var faxDB = require('../lib/faxDB');

function faxState(req,res) {
    faxDB.getCurrentState(function(err,result) {
        if (err) throw err;

        for (var key in result) {
            if (result.hasOwnProperty(key)) {
                result[key].date = dateToShortFormat(result[key].date);
                result[key].statusTimeStamp = dateToShortFormat(result[key].statusTimeStamp);
            }
        }
        var state = {
            aaData: result,
            aaSorting: [[2, 'asc']]
        };

        res.writeHead(200, { 'Content-Type': 'application/json'});
        res.end(JSON.stringify(state, undefined, 2));
    });
}

function dateToShortFormat(date) {
    return date.getDate() + '/' +
           date.getMonth() + '/' +
           date.getFullYear() + ' ' +
           date.toLocaleTimeString();
}

module.exports.faxState = faxState;