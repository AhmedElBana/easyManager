const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');
var ObjectId = require('mongodb').ObjectID;

let Custom_productSchema = new mongoose.Schema({
	_id: { type: String, trim: true },
	name: { type: String, required: true, minlenght: 2, trim: true },
	branch: {type: ObjectId, ref: 'Branch'},
	price: { type: Number, min: 0, required: true },
	quantity: { type: Number, min: 0, required: true },
	customer: {type: ObjectId, ref: 'Customer'},
	order: {type: ObjectId, ref: 'Order'},
	//{"material_id": quantity}
	materials_branch: {type: ObjectId, ref: 'Branch'},
	materials: { type:  mongoose.Schema.Types.Mixed, of: String },
	status: { type: String, required: true, trim: true, enum: ['created','assigned','accepted','inprogress','ready','delivered','canceled'] },
	created_at: { type: Date, required: true, trim: true },
	created_from: {type: ObjectId, ref: 'User'},
	deadline: { type: Date, required: true, trim: true },
	accepted_at: { type: Date, trim: true },
	accepted_from: {type: ObjectId, ref: 'User'},
	ready_at: { type: Date, trim: true },
	ready_from: {type: ObjectId, ref: 'User'},
	delivered_at: { type: Date, trim: true },
	delivered_from: {type: ObjectId, ref: 'User'},
	features: { type:  mongoose.Schema.Types.Mixed, of: String },
	images: { type: Array },
	description: { type: String, required: true, trim: true },
	parent: { required: true, type: String, trim: true },
	active: { type: Boolean, required: true }
});

Custom_productSchema.methods.toJSON = function(){
	let Custom_product = this;
	let Custom_productObject = Custom_product.toObject();
	return _.pick(Custom_productObject, ['_id','name','branch','price','quantity','customer','order','materials_branch','materials','status','created_at','created_from','deadline','accepted_at','accepted_from','ready_at','ready_from','delivered_at','delivered_from','features','images','description','parent','active']);
}

Custom_productSchema.index({ _id: 1, parent: 1 }, { unique: true });

Custom_productSchema.plugin(mongoosePaginate);
let Custom_product = mongoose.model('Custom_product', Custom_productSchema);

module.exports = {Custom_product}