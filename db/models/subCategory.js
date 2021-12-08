const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');
var ObjectId = require('mongodb').ObjectID;

let SubCategorySchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		minlenght: 2,
		trim: true
	},
	category_id: {
		type: String,
		required: true,
		minlenght: 2,
		trim: true
	},
	parent: {type: ObjectId, ref: 'User'}
});

SubCategorySchema.methods.toJSON = function(){
	let SubCategory = this;
	let SubCategoryObject = SubCategory.toObject();
	return _.pick(SubCategoryObject, ['_id','name','category_id','parent']);
}

SubCategorySchema.plugin(mongoosePaginate);
let SubCategory = mongoose.model('SubCategory', SubCategorySchema);

module.exports = {SubCategory}