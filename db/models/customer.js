const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');
var ObjectId = require('mongodb').ObjectID;

let CustomerSchema = new mongoose.Schema({
	name: { type: String, required: true, minlenght: 2, trim: true },
	debt: { type: Number, default: 0 },
	password: { type: String, minlength: 6, trim: true },
	phoneNumber: { type: String, trim: true, unique: false, required: true },
	parent: {type: ObjectId, ref: 'User'},
	code: { type: String, trim: true },
	register_completed: { type: Boolean, required: true },
	is_login: { type: Boolean, required: true },
	groups: {type: Array}
});

CustomerSchema.methods.toJSON = function(){
	let Customer = this;
	let CustomerObject = Customer.toObject();
	return _.pick(CustomerObject, ['_id','name','debt','phoneNumber','parent','register_completed','groups']);
}

CustomerSchema.index({ _id: 1, parent: 1 }, { unique: true });

CustomerSchema.methods.generateAuthToken = function(){
	let customer = this;
	let access = 'customerToken';
	let token = jwt.sign({_id: (customer._id), access}, process.env.JWT_SECRET).toString();
	return token
}
CustomerSchema.statics.findByToken = function(token){
	let Customer = this;
	let decoded;
	try {
	  decoded = jwt.verify(token, process.env.JWT_SECRET);
	} catch(err) {
		return Promise.reject();
	}
	if(decoded.access === 'customerToken'){
		return Customer.findOne({
			'_id': decoded._id
		});
	}else{
		return Promise.reject();
	}
}
CustomerSchema.statics.findByCredentials = function(phoneNumber, password){
	Customer = this;
	return Customer.findOne({phoneNumber}).then((customer) => {
		if(!customer){
			return Promise.reject();
		}
		return new Promise((resolve, reject) => {
			bcrypt.compare(password, customer.password, (err, res) => {
				if(res){
					resolve(customer);
				}else{
					reject();
				}
			});
		});
	});
}
CustomerSchema.pre('save', function(next){
	let customer = this;
	if(customer.isModified('password')){
		bcrypt.genSalt(10, (err, salt) => {
			bcrypt.hash(customer.password, salt, (err, hash) => {
				customer.password = hash;
				next();
			});
		});
	}else{
		next();
	}
});
CustomerSchema.pre('findOneAndUpdate', function(next){
	let customer = this;
	if(customer._update['password']){
		bcrypt.genSalt(10, (err, salt) => {
			bcrypt.hash(customer._update['password'], salt, (err, hash) => {
				customer._update['password'] = hash;
				next();
			});
		});
	}else{
		next();
	}
});

CustomerSchema.plugin(mongoosePaginate);
let Customer = mongoose.model('Customer', CustomerSchema);

module.exports = {Customer}