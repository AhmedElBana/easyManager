var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser'); 
var logger = require('morgan');

var usersRouter = require('./routes/users');
var staffRouter = require('./routes/staff');
var branchRouter = require('./routes/branch');
var categoryRouter = require('./routes/category')
var subCategoryRouter = require('./routes/subCategory')
var featureRouter = require('./routes/feature')
var productGroupRouter = require('./routes/productGroup')
var productRouter = require('./routes/product')
var custom_productRouter = require('./routes/custom_product')
var transferRouter = require('./routes/transfer')
var orderRouter = require('./routes/order')
var promoRouter = require('./routes/promo')
var customerRouter = require('./routes/customer')
var storeRouter = require('./routes/store')

var app = express();

// console logs for each request
logger.token('remote-addr', function (req) {
    return req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
});
logger.token('remote-addr', function (req) {
    return req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
});
logger.token('user-id', function (req) {
    return req.user._id;
});
app.use(logger(':method :url :status \n:remote-addr || :user-id || :date[iso] || :res[content-length] bytes :response-time ms \n-----------------------------------------------------------------------------------------'));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

let {mongoose} = require('./db/mongoose');
//enable CORS
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Access-Token, Uid, x-auth");
    next();
});

//console.log(JSON.parse(process.env['permisitions']));

app.use(express.static(path.join(__dirname, 'public')));

//app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', express.static('uploads'));

app.use('/api/users', usersRouter);
app.use('/api/staff', staffRouter);
app.use('/api/branch', branchRouter);
app.use('/api/category', categoryRouter);
app.use('/api/subCategory', subCategoryRouter);
app.use('/api/feature', featureRouter);
app.use('/api/productGroup', productGroupRouter);
app.use('/api/product', productRouter);
app.use('/api/custom_product', custom_productRouter);
app.use('/api/transfer', transferRouter);
app.use('/api/order', orderRouter);
app.use('/api/promo', promoRouter);
app.use('/api/customer', customerRouter)
app.use('/api/store', storeRouter)

module.exports = app;
