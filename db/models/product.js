const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');

let ProductSchema = new mongoose.Schema({
	group_id: {
		type: String,
		required: true,
		minlenght: 2,
		trim: true
	},
	name: {
		type: String,
		required: true,
		minlenght: 2,
		trim: true
	},
	price: {
		type: Number,
		min: 0,
		required: true
	},
	quantity: {
		type: Number,
		min: 0,
		required: true
	},
	features: {
		type:  mongoose.Schema.Types.Mixed,
		of: String
	},
	map: {
		type:  mongoose.Schema.Types.Mixed,
		of: String
	},
	parent: {
		required: true,
		type: String,
		trim: true
	}
});

ProductSchema.methods.toJSON = function(){
	let Product = this;
	let ProductObject = Product.toObject();
	return _.pick(ProductObject, ['_id','name','group_id','price','quantity','features','images','map','parent']);
}

ProductSchema.plugin(mongoosePaginate);
let Product = mongoose.model('Product', ProductSchema);

module.exports = {Product}