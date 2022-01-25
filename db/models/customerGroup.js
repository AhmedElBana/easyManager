const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');
var ObjectId = require('mongodb').ObjectID;

let CustomerGroupSchema = new mongoose.Schema({
	name: { type: String, required: true, trim: true },
	customers: {type: Array},
	parent: {type: ObjectId, ref: 'User'}
});

CustomerGroupSchema.methods.toJSON = function(){
	let CustomerGroup = this;
	let CustomerGroupObject = CustomerGroup.toObject();
	return _.pick(CustomerGroupObject, ['_id','name','customers','parent']);
}

CustomerGroupSchema.index({ _id: 1, parent: 1 }, { unique: true });

CustomerGroupSchema.plugin(mongoosePaginate);
let CustomerGroup = mongoose.model('CustomerGroup', CustomerGroupSchema);

module.exports = {CustomerGroup}