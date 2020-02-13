const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');

let OrderSchema = new mongoose.Schema({
	customer_id: { type: String, required: true, minlenght: 2, trim: true },
	customer_name: {type: String,required: true,minlenght: 2,trim: true},
	customer_phoneNumber: {type: String,trim: true,required: true},
	products: { type: Array, required: true },
	bill: { type: Array, required: true },
	subTotal: { type: Number, min: 0, required: true },
	total: { type: Number, min: 0, required: true },
	promo: { type: Boolean, required: true },
	promo_id: { type: String, minlenght: 2, trim: true },
	discountValue: { type: Number, min: 0, required: true },
	createdDate: { type: Date, required: true, trim: true },
	branch_id: { type: String, required: true, minlenght: 2, trim: true },
	creator_id: { type: String, trim: true, required: true },
	canceled: { type: Boolean, required: true },
	canceledDate: { type: Date, trim: true },
	parent: { type: String, trim: true, required: true },
});

OrderSchema.methods.toJSON = function(){
	let Order = this;
	let OrderObject = Order.toObject();
	return _.pick(OrderObject, ['_id','customer_id','customer_name','customer_phoneNumber','products','bill','subTotal','total','promo','promo_id','discountValue','createdDate','branch_id','creator_id','canceled','canceledDate','parent']);
}

OrderSchema.plugin(mongoosePaginate);
let Order = mongoose.model('Order', OrderSchema);

module.exports = {Order}