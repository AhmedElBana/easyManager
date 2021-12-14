const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);
const mongoosePaginate = require('mongoose-paginate-v2');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');
var ObjectId = require('mongodb').ObjectID;

let OrderSchema = new mongoose.Schema({
	_id: Number,
	type: { type: String, trim: true, required: true, enum: ['order','return']},
	status: { type: String, trim: true, required: true, enum: ['success','canceled','returned']},
	method: { type: String, required: true, trim: true, enum: ['cash','card'] },
	customer: {type: ObjectId, ref: 'Customer'},
	products: { type: Array },
	custom_products: { type: Array },
	bill: { type: Array, required: true },
	subTotal: { type: Number, min: 0, required: true },
	total: { type: Number, min: 0, required: true },
	payed: { type: Number, default: 0 },
	debt: { type: Number, default: 0 },
	promo: { type: Boolean, required: true },
	promo_id: { type: String, minlenght: 2, trim: true },
	discountValue: { type: Number, min: 0, required: true },
	createdDate: { type: Date, required: true, trim: true },
	branch_id: {type: ObjectId, ref: 'Branch'},
	creator_id: {type: ObjectId, ref: 'User'},
	parentOrder: { type: String, trim: true },
	prevOrderSubTotal: { type: Number , min: 0},
	prevOrderDiscountValue: { type: Number , min: 0},
	prevOrderTotal: { type: Number , min: 0},
	returnNote: { type: String, trim: true },
	parent: {type: ObjectId, ref: 'User'},
}, { _id: false });

OrderSchema.methods.toJSON = function(){
	let Order = this;
	let OrderObject = Order.toObject();
	return _.pick(OrderObject, ['_id','type','status','method','customer','products','custom_products','bill','prevOrderSubTotal','prevOrderDiscountValue','prevOrderTotal','subTotal','discountValue','total','payed','debt','promo','promo_id','createdDate','branch_id','creator_id','parentOrder','returnNote','parent']);
}

OrderSchema.plugin(mongoosePaginate);
OrderSchema.plugin(AutoIncrement);

let Order = mongoose.model('Order', OrderSchema);

module.exports = {Order}