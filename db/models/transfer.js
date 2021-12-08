const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');
var ObjectId = require('mongodb').ObjectID;

let TransferSchema = new mongoose.Schema({
	creator_id: {type: ObjectId, ref: 'User'},
	source_id: {type: ObjectId, ref: 'Branch'},
	target_id: {type: ObjectId, ref: 'Branch'},
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
	parent: {type: ObjectId, ref: 'User'}
});

TransferSchema.methods.toJSON = function(){
	let Transfer = this;
	let TransferObject = Transfer.toObject();
	return _.pick(TransferObject, ['_id','creator_id','source_id','target_id','products','createdAt','lastUpdate','status','actionsMap','parent']);
}

TransferSchema.plugin(mongoosePaginate);
let Transfer = mongoose.model('Transfer', TransferSchema);

module.exports = {Transfer}