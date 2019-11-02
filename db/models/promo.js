const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');

let PromoSchema = new mongoose.Schema({
	name: { type: String, required: true, minlenght: 2, trim: true },
	// DOL(discount on limit)
	type: { type: String, trim: true, required: true },
	limit: { type: Number, min: 0, required: true },
	// value/percentage
	discountType: { type: String, trim: true, required: true },
	discountValue: { type: Number, min: 0, required: true },
	createdDate: { type: Date, required: true, trim: true },
	startDate: { type: Date, required: true, trim: true },
	endDate: { type: Date, required: true, trim: true },
	validTimesPerCustomer: { type: Number, min: 0, required: true },
	// All/SELECTED
	customerType: { type: String, trim: true, required: true },
	customers: { type: Array, required: true },
	sms: { type: Boolean, required: true },
	active: { type: Boolean, required: true },
	creator_id: { type: String, trim: true, required: true },
	parent: { type: String, trim: true, required: true }
});

PromoSchema.methods.toJSON = function(){
	let Promo = this;
	let PromoObject = Promo.toObject();
	return _.pick(PromoObject, ['_id','name','type','limit','discountType','discountValue','createdDate','startDate','endDate','validTimesPerCustomer','customerType','customers','sms','creator_id','active','parent']);
}
PromoSchema.index({ name: 1, parent: 1 }, { unique: true });

PromoSchema.plugin(mongoosePaginate);
let Promo = mongoose.model('Promo', PromoSchema);

module.exports = {Promo}