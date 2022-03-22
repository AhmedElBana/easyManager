var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser'); 
var morganBody = require('morgan-body');
var bodyParser = require('body-parser');
var session = require('express-session');
const ADMINJS = require('./admin/admin');
const LOGGER = require('./logger/logger');
const active_routes = require('./routes/active_routes');

var app = express();
app.use(bodyParser.json());
let sessionOptions = {
    secret: process.env['cookie_secret'],
    // resave: false,
    // saveUninitialized: true,
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24 * 30, //30 day
        //secure: true
    }
}
app.use(session(sessionOptions));

// use adminJs
app.use(ADMINJS.adminJs.options.rootPath, ADMINJS.router);

app.use(bodyParser.json());
// use logger
app.use(LOGGER.logger(
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
app.use('/assets', express.static('assets'));

// use active routes
active_routes.map((current_route)=>{
    app.use(current_route.path, current_route.route);
})

module.exports = app;
