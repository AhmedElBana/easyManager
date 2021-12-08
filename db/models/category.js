const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');
var ObjectId = require('mongodb').ObjectID;

let CategorySchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		minlenght: 2,
		trim: true
	},
	parent: {type: ObjectId, ref: 'User'}
});

CategorySchema.methods.toJSON = function(){
	let Category = this;
	let CategoryObject = Category.toObject();
	return _.pick(CategoryObject, ['_id','name','parent']);
}

CategorySchema.plugin(mongoosePaginate);
let Category = mongoose.model('Category', CategorySchema);

module.exports = {Category}