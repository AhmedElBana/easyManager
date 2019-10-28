const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');

let TransferSchema = new mongoose.Schema({
	creator_id: {
		type: String,
		trim: true,
		required: true
	},
	source_id: {
		type: String,
		required: true,
		minlenght: 2,
		trim: true
	},
	target_id: {
		type: String,
		trim: true,
		required: true
	},
	products: {
		type: Array,
		required: true
	},
	createdAt: {
		type: Date,
		required: true,
		trim: true
	},
	lastUpdate: {
		type: Date,
		required: true,
		trim: true
	},
	expectedDeliveryTime: {
		type: Date,
		required: true,
		trim: true
	},
	status: {
		// inProgress/canceled/completed
		type: String,
		trim: true,
		required: true
	},
	actionsMap: {
		type: Array,
		required: true
	},
	parent: {
		type: String,
		trim: true
	}
});

TransferSchema.methods.toJSON = function(){
	let Transfer = this;
	let TransferObject = Transfer.toObject();
	return _.pick(TransferObject, ['_id','creator_id','source_id','target_id','products','createdAt','lastUpdate','expectedDeliveryTime','status','actionsMap','parent']);
}

TransferSchema.plugin(mongoosePaginate);
let Transfer = mongoose.model('Transfer', TransferSchema);

module.exports = {Transfer}