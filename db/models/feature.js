const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');
var ObjectId = require('mongodb').ObjectID;

let FeatureSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		minlenght: 2,
		trim: true
	},
	options: {
		required: true,
		type: Array
	},
	for_custom_products: {
		type: Boolean,
		default: false
	},
	parent: {type: ObjectId, ref: 'User'},
	active: {
		type: Boolean,
		required: true
	}
});

FeatureSchema.methods.toJSON = function(){
	let Feature = this;
	let FeatureObject = Feature.toObject();
	return _.pick(FeatureObject, ['_id','name','options','for_custom_products','parent','active']);
}

FeatureSchema.plugin(mongoosePaginate);
let Feature = mongoose.model('Feature', FeatureSchema);

module.exports = {Feature}