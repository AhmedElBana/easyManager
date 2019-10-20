const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');

let ProductGroupSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		minlenght: 2,
		trim: true
	},
	category_id: {
		type: String,
		required: true,
		trim: true
	},
	subCategory_id: {
		type: String,
		trim: true
	},
	description: {
		type: String,
		required: true,
		trim: true
	},
	features: {
		type: Map
	},
	images: {
		type: Array
	},
	rate: {
		type: Number,
		min: 0,
		max: 5,
		required: true
	},
	createdAt: {
		type: Date,
		required: true,
		trim: true
	},
	parent: {
		required: true,
		type: String,
		trim: true
	},
	active: {
		type: Boolean,
		required: true
	}
});

ProductGroupSchema.methods.toJSON = function(){
	let ProductGroup = this;
	let ProductGroupObject = ProductGroup.toObject();
	return _.pick(ProductGroupObject, ['_id','name','category_id','subCategory_id','description','features','images','rate','createdAt','parent','active']);
}

ProductGroupSchema.plugin(mongoosePaginate);
let ProductGroup = mongoose.model('ProductGroup', ProductGroupSchema);

module.exports = {ProductGroup}