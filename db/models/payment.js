const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');
var ObjectId = require('mongodb').ObjectID;

let PaymentSchema = new mongoose.Schema({
	type: { type: String, required: true, trim: true, enum: ['in','out'] },
	sub_type: { type: String, required: true, trim: true, enum: ['order','return','debts','others'] },
	method: { type: String, required: true, trim: true, enum: ['cash','card'] },
	status: { type: String, required: true, trim: true, enum: ['success','canceled'] }, 
	name: { type: String, required: true, minlenght: 2, trim: true },
	branch: {type: ObjectId, ref: 'Branch'},
	amount: { type: Number, min: 0, required: true },
	created_at: { type: Date, required: true, trim: true },
	created_from: {type: ObjectId, ref: 'User'},
	customer: {type: ObjectId, ref: 'Customer'},
	order: {type: ObjectId, ref: 'Order'},
	parent: { required: true, type: String, trim: true }
});

PaymentSchema.methods.toJSON = function(){
	let Payment = this;
	let PaymentObject = Payment.toObject();
	return _.pick(PaymentObject, ['_id','type','sub_type','method','status','name','branch','amount','created_at','created_from','customer','order','parent']);
}

PaymentSchema.index({ _id: 1, parent: 1 }, { unique: true });

PaymentSchema.plugin(mongoosePaginate);
let Payment = mongoose.model('Payment', PaymentSchema);

module.exports = {Payment}