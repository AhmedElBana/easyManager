const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');
var ObjectId = require('mongodb').ObjectID;

let OrderSchema = new mongoose.Schema({
	type: { type: String, trim: true, required: true, enum: ['Order','Return']},
	customer: {type: ObjectId, ref: 'Customer'},
	products: { type: Array },
	custom_products: { type: Array },
	bill: { type: Array, required: true },
	subTotal: { type: Number, min: 0, required: true },
	total: { type: Number, min: 0, required: true },
	promo: { type: Boolean, required: true },
	promo_id: { type: String, minlenght: 2, trim: true },
	discountValue: { type: Number, min: 0, required: true },
	createdDate: { type: Date, required: true, trim: true },
	branch_id: {type: ObjectId, ref: 'Branch'},
	creator_id: {type: ObjectId, ref: 'User'},
	canceled: { type: Boolean, required: true },
	canceledDate: { type: Date, trim: true },
	returned: { type: Boolean, required: true },
	returnedDate: { type: Date, trim: true },
	parentOrder: { type: String, trim: true },
	prevOrderSubTotal: { type: Number , min: 0},
	prevOrderDiscountValue: { type: Number , min: 0},
	prevOrderTotal: { type: Number , min: 0},
	amount_out: { type: Number , min: 0},
	amount_in: { type: Number , min: 0},
	returnNote: { type: String, trim: true },
	parent: { type: String, trim: true, required: true },
});

OrderSchema.methods.toJSON = function(){
	let Order = this;
	let OrderObject = Order.toObject();
	return _.pick(OrderObject, ['_id','type','customer','products','custom_products','bill','prevOrderSubTotal','prevOrderDiscountValue','prevOrderTotal','subTotal','discountValue','amount_out','amount_in','total','promo','promo_id','createdDate','branch_id','creator_id','canceled','canceledDate','returned','returnedDate','parentOrder','returnNote','parent']);
}

OrderSchema.plugin(mongoosePaginate);
let Order = mongoose.model('Order', OrderSchema);

module.exports = {Order}