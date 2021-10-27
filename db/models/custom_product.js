const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');

let Custom_productSchema = new mongoose.Schema({
	_id: { type: String, trim: true },
	name: { type: String, required: true, minlenght: 2, trim: true },
	price: { type: Number, min: 0, required: true },
	quantity: { type: Number, min: 0, required: true },
	//{"material_id": quantity}
	material: { type:  mongoose.Schema.Types.Mixed, of: String },
	//accepted/inprogress/ready/delivered
	status: { type: String, required: true, minlenght: 2, trim: true },
	created_at: { type: Date, required: true, trim: true },
	deadline: { type: Date, required: true, trim: true },
	accepted_at: { type: Date, required: true, trim: true },
	accepted_from: { required: true, type: String, trim: true },
	ready_at: { type: Date, required: true, trim: true },
	ready_from: { required: true, type: String, trim: true },
	delivered_at: { type: Date, required: true, trim: true },
	delivered_from: { required: true, type: String, trim: true },
	features: { type:  mongoose.Schema.Types.Mixed, of: String },
	map: { type:  mongoose.Schema.Types.Mixed, of: String },
	images: { type: Array },
	description: { type: String, required: true, trim: true },
	parent: { required: true, type: String, trim: true },
	active: { type: Boolean, required: true }
});

Custom_productSchema.methods.toJSON = function(){
	let Custom_product = this;
	let Custom_productObject = Product.toObject();
	return _.pick(Custom_productObject, ['_id','name','price','quantity','material','status','created_at','deadline','accepted_at','accepted_from','ready_at','ready_from','delivered_at','delivered_from','features','map','images','description','parent','active']);
}

Custom_productSchema.index({ _id: 1, parent: 1 }, { unique: true });

Custom_productSchema.plugin(mongoosePaginate);
let Custom_product = mongoose.model('Custom_product', Custom_productSchema);

module.exports = {Custom_product}