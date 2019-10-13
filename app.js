var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser'); 
var logger = require('morgan');

var usersRouter = require('./routes/users');
var staffRouter = require('./routes/staff');

var app = express();

app.use(logger('dev'));
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

console.log(JSON.parse(process.env['permisitions']));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/users', usersRouter);
app.use('/api/staff', staffRouter);

module.exports = app;
