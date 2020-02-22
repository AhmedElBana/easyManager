const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');

let StoreSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		minlenght: 2,
		trim: true
	},
	language: {
		//en/ar
		type: String,
		trim: true,
		required: true
	},
	phoneNumber: {
		type: String,
		trim: true,
		unique: true,
		required: true
	},
	imagesStorageLimit: {
		type: Number,
		min: 0,
		required: true
	},
	imagesStorage: {
		type: Number,
		min: 0,
		required: true
	},
	availableEmails: {
		type: Number,
		min: 0,
		required: true
	},
	usedEmails: {
		type: Number,
		min: 0,
		required: true
	},
	availableSMS: {
		type: Number,
		min: 0,
		required: true
	},
	usedSMS: {
		type: Number,
		min: 0,
		required: true
	},
	returnOrederAllowed: {
		type: Boolean, 
		required: true
	},
	returnOrederDays: {
		type: Number,
		min: 0,
		required: true
	},
	returnAnyBranch: {
		type: Boolean, 
		required: true
	},
	parent: {
		type: String,
		trim: true,
		unique: true
	}
});

StoreSchema.methods.toJSON = function(){
	let Store = this;
	let StoreObject = Store.toObject();
	return _.pick(StoreObject, ['_id','name','language','phoneNumber','imagesStorageLimit','imagesStorage','availableEmails','usedEmails','availableSMS','usedSMS','returnOrederAllowed','returnOrederDays','returnAnyBranch','parent']);
}

StoreSchema.plugin(mongoosePaginate);
let Store = mongoose.model('Store', StoreSchema);

module.exports = {Store}