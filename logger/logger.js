var logger = require('morgan');
const chalk = require ('chalk');

// console logs for each request
logger.token('remote-addr', function (req) {
    return req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
});
logger.token('user-id', function (req) {
    if(req.user && req.user._id){return req.user._id;}else{return "Unauthorized 🧐"}
});
logger.token('status', function (req, res) {
    if(res.statusCode >= 400){return chalk.red.bold(res.statusCode) + " 🥵"}else{return chalk.green.bold(res.statusCode) + " 🥳"}
});
logger.token('url', function (req, res) {
    return chalk.yellow.bold(req.originalUrl)
});
logger.token('date', (req, res, tz) => {
    return new Date().toLocaleString("en-NZ");
})
logger.token('body', (req, res) => {
    if(res.statusCode >= 400){
        return chalk.yellow.bold("\nReq Body 🚀: ") + JSON.stringify(req.body);
    }else{
        return " "
    }
})
logger.token('resp-body', (req, res) => {
    if(res.statusCode >= 400){
        return chalk.yellow.bold("\nRes Body 🛩 : ") + JSON.stringify(res.__morgan_body_response);
    }else{
        return " "
    }
})

module.exports = {logger};