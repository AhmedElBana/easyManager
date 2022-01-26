var express = require('express');
var router = express.Router();
const _ = require('lodash');
let {authenticate} = require('../middleware/authenticate');
let {CustomerGroup} = require('../db/models/customerGroup');
let {Customer} = require('../db/models/customer');

/* list CustomerGroup. */
router.get('/list', authenticate, function(req, res, next) {
    let page;
    if(req.query.page){page = req.query.page;}else{page = 1;}
    let page_size;
    if(req.query.page_size){page_size = req.query.page_size;}else{page_size = 10;}
    const options = {
        page: page,
        limit: page_size,
        sort: { createdAt: -1 },
        collation: {
        locale: 'en'
        }
    };
    let filters;
    if(req.user.type == 'admin'){
        filters = {parent: req.user._id};
    }else if(req.user.type == 'staff'){
        filters = {parent: req.user.parent};
    }
    if(req.query.name){filters.name={ $regex: new RegExp(req.query.name), $options: "i" }}
    
    CustomerGroup.paginate(filters, options, function(err, result) {
        let next;
        if(result.hasNextPage){
            next = "https://" + req.headers.host + "/api/customerGroup/list?page=" + result.nextPage + "&page_size=" + page_size;
        }else{next = null;}
        let prev;
        if(result.hasPrevPage){
            prev = "https://" + req.headers.host + "/api/customerGroup/list?page=" + result.prevPage + "&page_size=" + page_size;
        }else{prev = null;}
        let data = {
            total: result.totalDocs,
            next: next,
            prev: prev,
            result: result.docs
        }
        return res.send({
            "status": 1,
            "data": {...data}
        });
    });
});

// create CustomerGroup
router.post('/create', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('144')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to create customers group."
        });
    }else{
        let body = _.pick(req.body, ['name']);
        if(!body.name){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (name) field is required."
            });
        }else{
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            let newGroupData = new CustomerGroup(body);
            newGroupData.save().then((newGroup) => {                
                return res.status(201).send({
                    "data": newGroup
                });
            }).catch((e) => {
                if(e.code){
                    res.status(400).send({
                        "status": 0,
                        "message": e
                    });
                }else{
                    res.status(400).send({
                        "status": 0,
                        "message": e
                    });
                }
            });
        }
    }
});

// add customer to CustomerGroup
router.post('/add', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('145')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to edit customers group."
        });
    }else{
        let body = _.pick(req.body, ['group_id','customer_id']);
        if(!body.customer_id || !body.group_id){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (group_id, customer_id) field is required."
            });
        }else{
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            let filters = {_id: body.customer_id, parent: body.parent}
            Customer.findOne(filters)
            .then((customer) => {
                if(!customer){
                    res.status(400).send({
                        "message": "can't find any customer with this customer_id."
                    });
                }else{
                    let group_filters = {_id: body.group_id, parent: body.parent}
                    CustomerGroup.findOne(group_filters)
                    .then((group) => {
                        if(!group){
                            res.status(400).send({
                                "message": "can't find any group with this group_id."
                            });
                        }else{
                            if(!group.customers.includes(body.customer_id)){
                                let final_customer_arr = [...group.customers]
                                final_customer_arr.push(body.customer_id)
                                let updateBody = {customers: final_customer_arr};
                                CustomerGroup.findOneAndUpdate(group_filters,updateBody, { new: true }, (e, group_response) => {
                                    if(e){
                                        res.status(400).send({
                                            "message": "error while add customer."
                                        });
                                    }else{
                                        let final_group_arr = [...customer.groups]
                                        final_group_arr.push(body.group_id)
                                        let updateCustomerBody = {groups: final_group_arr};
                                        Customer.findOneAndUpdate(filters,updateCustomerBody, { new: true }, (e, response) => {
                                            if(e){
                                                res.status(400).send({
                                                    "message": "error while add group to the customer."
                                                });
                                            }else{
                                                return res.status(200).send({
                                                    "data": group_response
                                                });
                                            }
                                        })
                                    }
                                })
                            }else{
                                res.status(400).send({
                                    "message": "this customer is member in this group."
                                });
                            }
                        }
                    },(e) => {
                        res.status(400).send({
                            "message": "can't find any group with this group_id."
                        });
                    });
                }
            },(e) => {
                res.status(400).send({
                    "message": "can't find any group with this customer_id."
                });
            });
        }
    }
});

// remove customer to CustomerGroup
router.post('/remove', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('145')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to edit customers group."
        });
    }else{
        let body = _.pick(req.body, ['group_id','customer_id']);
        if(!body.customer_id || !body.group_id){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (group_id, customer_id) field is required."
            });
        }else{
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            let filters = {_id: body.customer_id, parent: body.parent}
            Customer.findOne(filters)
            .then((customer) => {
                if(!customer){
                    res.status(400).send({
                        "message": "can't find any customer with this customer_id."
                    });
                }else{
                    let group_filters = {_id: body.group_id, parent: body.parent}
                    CustomerGroup.findOne(group_filters)
                    .then((group) => {
                        if(!group){
                            res.status(400).send({
                                "message": "can't find any group with this group_id."
                            });
                        }else{
                            if(group.customers.includes(body.customer_id)){
                                let current_customer_arr = [...group.customers];
                                let final_customer_arr = current_customer_arr.filter(function(value, index, arr){ 
                                    return value != body.customer_id;
                                });
                                let updateBody = {customers: final_customer_arr};
                                CustomerGroup.findOneAndUpdate(group_filters,updateBody, { new: true }, (e, group_response) => {
                                    if(e){
                                        res.status(400).send({
                                            "message": "error while add customer."
                                        });
                                    }else{
                                        let current_group_arr = [...customer.groups]
                                        let final_group_arr = current_group_arr.filter(function(value, index, arr){ 
                                            return value != body.group_id;
                                        });
                                        let updateCustomerBody = {groups: final_group_arr};
                                        Customer.findOneAndUpdate(filters,updateCustomerBody, { new: true }, (e, response) => {
                                            if(e){
                                                res.status(400).send({
                                                    "message": "error while add group to the customer."
                                                });
                                            }else{
                                                return res.status(200).send({
                                                    "data": group_response
                                                });
                                            }
                                        })
                                    }
                                })
                            }else{
                                res.status(400).send({
                                    "message": "this customer is not member in this group."
                                });
                            }
                        }
                    },(e) => {
                        res.status(400).send({
                            "message": "can't find any group with this group_id."
                        });
                    });
                }
            },(e) => {
                res.status(400).send({
                    "message": "can't find any group with this customer_id."
                });
            });
        }
    }
});

/* list CustomerGroup customers. */
router.get('/customers', authenticate, function(req, res, next) {
    if(!req.query.group_id){
        res.status(400).send({"message": "Missing data, (group_id) field is required."});
    }else{
        let parent;
        if(req.user.type == 'admin'){
            parent = req.user._id;
        }else if(req.user.type == 'staff'){
            parent = req.user.parent;
        }
        let group_filters = {_id: req.query.group_id, parent: parent}
        CustomerGroup.findOne(group_filters)
        .then((group) => {
            if(!group){
                res.status(400).send({"message": "can't find any group with this group_id."});
            }else{
                Customer.find({'_id': { $in: group.customers}, 'parent': parent})
                .then((customers) => {
                    return res.status(200).send({
                        "data": customers
                    });
                },(e) => {
                    res.status(400).send({"message": "error happen while get customers."});
                });
            }
        },(e) => {
            res.status(400).send({
                "message": "can't find any group with this group_id."
            });
        });
    }
});
module.exports = router;
