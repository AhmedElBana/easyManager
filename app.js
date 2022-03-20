const AdminJS = require('adminjs');
const AdminJSExpress = require('@adminjs/express');
const AdminJSMongoose = require('@adminjs/mongoose')
const bcrypt = require('bcryptjs');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser'); 
var logger = require('morgan');
var morganBody = require('morgan-body');
var bodyParser = require('body-parser');
const chalk = require ('chalk');
var session = require('express-session');


var adminsRouter = require('./routes/admin');
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
var customerGroupRouter = require('./routes/customerGroup')
var storeRouter = require('./routes/store')
var paymentRouter = require('./routes/payment')

var app = express();
app.use(bodyParser.json());
let sessionOptions = {
    secret: 'keyboard cat',
    // resave: false,
    // saveUninitialized: true,
    // cookie: { secure: true }
}
app.use(session(sessionOptions));

//setup admin
AdminJS.registerAdapter(AdminJSMongoose)

let { Store } = require('./db/models/store');
let { Admin } = require('./db/models/admin');
let { User } = require('./db/models/user');
let { Order } = require('./db/models/order');
let { Customer } = require('./db/models/customer');
let { Branch } = require('./db/models/branch');
let { Payment } = require('./db/models/payment');
const admin_locale = {
    translations: {
      labels: {
        loginWelcome: 'Tradket',
      },
      messages: {
        loginWelcome: 'welcome to tradket admin panel',
      },
    },
  };
const contentParent = {
    name: 'Auth',
    icon: 'Accessibility',
}
const adminJs = new AdminJS({
    databases: [],
    rootPath: '/admin',
    locale: admin_locale,
    branding: {
        companyName: 'Tradket',
        softwareBrothers: false,
        logo: 'https://tradket.com/static/media/logo.287bcb16.png',
    },
    resources: [
        { resource: Store, options: { listProperties: ['_id', 'name','parent', 'availableSMS','usedSMS', 'imagesStorageLimit', 'imagesStorage', 'phoneNumber','returnOrederAllowed','returnOrederDays','returnAnyBranch'] } },
        { resource: Admin, 
            options: { 
                listProperties: ['name', 'email','active'],
                properties: {
                    _id: {
                        isVisible: { list: false, filter: true, show: true, edit: false }
                    },
                    permissions: {
                        isVisible: { list: false, filter: false, show: true, edit: true }
                    },
                    active: {
                        isVisible: { list: true, filter: true, show: true, edit: true }
                    },
                    password: {
                        type: 'string',
                        isVisible: {list: false, edit: true, filter: false, show: false}
                    },
                },
                parent: contentParent,
                actions: {
                    new: {isAccessible: ({ currentAdmin }) => currentAdmin && currentAdmin.permissions.includes("can create admin")},
                    edit: {isAccessible: ({ currentAdmin }) => currentAdmin && currentAdmin.permissions.includes("can edit admin")},
                    delete: {isAccessible: ({ currentAdmin }) => currentAdmin && currentAdmin.permissions.includes("can delete admin")},
                }
            }
        },
        { resource: User, 
            options: { 
                listProperties: ['name', 'email', 'phoneNumber', 'type', 'parent'],
                properties: {
                    _id: {
                      isVisible: { list: false, filter: true, show: true, edit: false }
                    },
                    active: {
                        isVisible: { list: false, filter: true, show: true, edit: true }
                    },
                    password: {
                      isVisible: { list: false, filter: false, show: false, edit: false }
                    },
                    code: {
                        isVisible: { list: false, filter: false, show: true, edit: true }
                    },
                    is_login: {
                        isVisible: { list: false, filter: false, show: true, edit: true }
                    },
                    type: {
                        availableValues: [
                            {value: 'admin', label: 'Admin'},
                            {value: 'staff', label: 'Staff'},
                        ],
                    },
                },
                parent: contentParent
            }
        },
        Order, Customer, Branch, Payment]
});
//const router = AdminJSExpress.buildRouter(adminJs)
const router = AdminJSExpress.buildAuthenticatedRouter(adminJs, 
    {
        authenticate: async (email, password) => {
            const user = await Admin.findOne({ email })
            if (user) {
                const matched = await bcrypt.compare(password, user.password)
                if (matched) {
                    if(user.active){
                        return user
                    }else{
                        return false
                    }
                }
            }
            return false
        }
    },
);
app.use(adminJs.options.rootPath, router);

app.use(bodyParser.json());

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
//app.use(logger(':method :url \nStatus: :status || :res[content-length] bytes :response-time ms || User ID: :user-id || Date: :date[iso] \nUser IP: :remote-addr || :user-agent \n-----------------------------------------------------------------------------------------'));
app.use(logger(
`:method :url
Status: :status || :res[content-length] bytes :response-time ms || User ID: :user-id || Date: :date[iso] \nUser IP: :remote-addr || :user-agent :body :resp-body
-------------------------------------------------------------------------------------------------------------------------------------`
));
morganBody(app, {
    noColors: true,
    skip: (req, res) => true,
  });


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

app.use('/api/admin', adminsRouter);
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
app.use('/api/customer', customerRouter);
app.use('/api/customerGroup', customerGroupRouter);
app.use('/api/store', storeRouter)
app.use('/api/payment', paymentRouter)

module.exports = app;
