// var adminsRouter = require('./routes/admin');
var usersRouter = require('./users');
var staffRouter = require('./staff');
var branchRouter = require('./branch');
var categoryRouter = require('./category')
var subCategoryRouter = require('./subCategory')
var featureRouter = require('./feature')
var productGroupRouter = require('./productGroup')
var productRouter = require('./product')
var custom_productRouter = require('./custom_product')
var transferRouter = require('./transfer')
var orderRouter = require('./order')
var promoRouter = require('./promo')
var customerRouter = require('./customer')
var customerGroupRouter = require('./customerGroup')
var storeRouter = require('./store')
var paymentRouter = require('./payment')

const active_routes = [
    // {'path': '/api/admin', 'route': adminsRouter},
    {'path': '/api/users', 'route': usersRouter},
    {'path': '/api/staff', 'route': staffRouter},
    {'path': '/api/branch', 'route': branchRouter},
    {'path': '/api/category', 'route': categoryRouter},
    {'path': '/api/subCategory', 'route': subCategoryRouter},
    {'path': '/api/feature', 'route': featureRouter},
    {'path': '/api/productGroup', 'route': productGroupRouter},
    {'path': '/api/product', 'route': productRouter},
    {'path': '/api/custom_product', 'route': custom_productRouter},
    {'path': '/api/transfer', 'route': transferRouter},
    {'path': '/api/order', 'route': orderRouter},
    {'path': '/api/promo', 'route': promoRouter},
    {'path': '/api/customer', 'route': customerRouter},
    {'path': '/api/customerGroup', 'route': customerGroupRouter},
    {'path': '/api/store', 'route': storeRouter},
    {'path': '/api/payment', 'route': paymentRouter},
];

module.exports = active_routes;