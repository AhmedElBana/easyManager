const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');
var ObjectId = require('mongodb').ObjectID;

let ProductGroupSchema = new mongoose.Schema({
	_id: {
		type: String,
		trim: true
	},
	is_material: {
		type: Boolean,
		required: true
	},
	name: {
		type: String,
		required: true,
		minlenght: 2,
		trim: true
	},
	category_id: {
		type: String,
		trim: true
	},
	subCategory_id: {
		type: String,
		trim: true
	},
	description: {
		type: String,
		trim: true
	},
	features: {
		type:  mongoose.Schema.Types.Mixed,
		of: String
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
	parent: {type: ObjectId, ref: 'User'},
	active: {
		type: Boolean,
		required: true
	}
});

ProductGroupSchema.methods.toJSON = function(){
	let ProductGroup = this;
	let ProductGroupObject = ProductGroup.toObject();
	return _.pick(ProductGroupObject, ['_id','is_material','name','category_id','subCategory_id','description','features','images','rate','createdAt','parent','active']);
}

ProductGroupSchema.index({ _id: 1, parent: 1 }, { unique: true });

ProductGroupSchema.plugin(mongoosePaginate);
let ProductGroup = mongoose.model('ProductGroup', ProductGroupSchema);

module.exports = {ProductGroup}