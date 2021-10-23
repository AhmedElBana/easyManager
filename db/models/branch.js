const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');

let BranchSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		minlenght: 2,
		trim: true
	},
	phoneNumber: {
		type: String,
		trim: true,
		unique: true,
		required: true
	},
	address: {
		type: String,
		trim: true,
		required: true
	},
	type: {
		// branch/warehouse/factory
		type: String,
		trim: true,
		required: true
	},
	active: {
		type: Boolean,
		required: true
	},
	parent: {
		type: String,
		trim: true
	}
});

BranchSchema.methods.toJSON = function(){
	let Branch = this;
	let BranchObject = Branch.toObject();
	return _.pick(BranchObject, ['_id','name','phoneNumber','address','type','active','parent']);
}

BranchSchema.plugin(mongoosePaginate);
let Branch = mongoose.model('Branch', BranchSchema);

module.exports = {Branch}