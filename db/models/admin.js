const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');
var ObjectId = require('mongodb').ObjectID;

let AdminSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		minlenght: 2,
		trim: true
	},
	password: {
		type: String,
		required: true,
		minlength: 6,
		trim: true
	},
	email: {
		type: String,
		required: true,
		trim: true,
		minlenght: 1,
		unique: true,
		validate: {
          validator: (value) => {
            return validator.isEmail(value);
          },
          message: '{VALUE} is not a valid email!'
        }
	},
	permissions: {
		required: true,
		type: Array
	},
	active: {
		type: Boolean,
		required: true
	}
});

AdminSchema.methods.toJSON = function(){
	let Admin = this;
	let AdminObject = Admin.toObject();
	return _.pick(AdminObject, ['_id','name','email','permissions','active']);
}

AdminSchema.methods.generateAuthToken = function(){
	let admin = this;
	let access = 'adminToken';
	let token = jwt.sign({_id: (admin._id), access}, process.env.JWT_SECRET).toString();
	return token
}
AdminSchema.statics.findByToken = function(token){
	let Admin = this;
	let decoded;
	try {
	  decoded = jwt.verify(token, process.env.JWT_SECRET);
	} catch(err) {
		return Promise.reject();
	}
	if(decoded.access === 'adminToken'){
		return Admin.findOne({
			'_id': decoded._id
		});
	}else{
		return Promise.reject();
	}
}
AdminSchema.statics.findByCredentials = function(email, password){
	Admin = this;
	return Admin.findOne({email}).then((admin) => {
		if(!admin){
			return Promise.reject();
		}
		return new Promise((resolve, reject) => {
			bcrypt.compare(password, admin.password, (err, res) => {
				if(res){
					resolve(admin);
				}else{
					reject();
				}
			});
		});
	});
}
AdminSchema.statics.findByCredentials_identifier = function(identifier, password){
	Admin = this;
	return Admin.findOne({"email": identifier}).then((admin) => {
		if(!admin){
			return Promise.reject();
		}
		return new Promise((resolve, reject) => {
			bcrypt.compare(password, admin.password, (err, res) => {
				if(res){
					resolve(admin);
				}else{
					reject();
				}
			});
		});
	});
}
AdminSchema.pre('save', function(next){
	let admin = this;
	if(admin.isModified('password')){
		bcrypt.genSalt(10, (err, salt) => {
			bcrypt.hash(admin.password, salt, (err, hash) => {
				admin.password = hash;
				next();
			});
		});
	}else{
		next();
	}
});
AdminSchema.pre('findOneAndUpdate', function(next){
	let admin = this;
	if(admin._update['password']){
		bcrypt.genSalt(10, (err, salt) => {
			bcrypt.hash(admin._update['password'], salt, (err, hash) => {
				admin._update['password'] = hash;
				next();
			});
		});
	}else if(admin._update['$set']['password']){
		bcrypt.genSalt(10, (err, salt) => {
			bcrypt.hash(admin._update['$set']['password'], salt, (err, hash) => {
				admin._update['$set']['password'] = hash;
				next();
			});
		});
	}else{
		next();
	}
});

AdminSchema.plugin(mongoosePaginate);
let Admin = mongoose.model('Admin', AdminSchema);

module.exports = {Admin}