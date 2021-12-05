const mongoose = require('mongoose');

mongoose.set('useCreateIndex', true);
mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/easyManager', { useNewUrlParser: true, useUnifiedTopology: true });

module.exports = {mongoose}