var express = require('express');
var router = express.Router();
const _ = require('lodash');
let {authenticate} = require('../middleware/authenticate');
let {Customer} = require('../db/models/customer');
let {Custom_product} = require('../db/models/custom_product');

/* list subcategories. */
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
    if(req.query.customer_id){filters._id = req.query.customer_id}
    if(req.query.name){filters.name={ $regex: new RegExp(req.query.name), $options: "i" }}
    if(req.query.phoneNumber){filters.phoneNumber={ $regex: new RegExp(req.query.phoneNumber), $options: "i" }}
    
    Customer.paginate(filters, options, function(err, result) {
        let next;
        if(result.hasNextPage){
            next = "https://" + req.headers.host + "/api/customer/list?page=" + result.nextPage + "&page_size=" + page_size;
        }else{next = null;}
        let prev;
        if(result.hasPrevPage){
            prev = "https://" + req.headers.host + "/api/customer/list?page=" + result.prevPage + "&page_size=" + page_size;
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


//create new customer
router.post('/create', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('142')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to create customer."
        });
    }else{
        let body = _.pick(req.body, ['name','phoneNumber']);
        if(!body.name || !body.phoneNumber){
            res.status(400).send({"message": "Missing data, (name, phoneNumber) fields are required."});
        }else{
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            let filters = {phoneNumber: body.phoneNumber, parent: body.parent}
            Customer.findOne(filters)
            .then((customer) => {
                if(!customer){
                    let customerObj = {
                        "name": body.name,
                        "phoneNumber": body.phoneNumber,
                        "register_completed": false,
                        "is_login": false,
                        "parent": body.parent
                    }
                    //create new customer
                    let newCustomerData = new Customer(customerObj);
                    newCustomerData.save().then((newCustomer) => {  
                        return res.send({
                            "data": newCustomer
                        });
                    }).catch((e) => {
                        res.status(400).send({"message": "error happen while save new customer."});
                    });
                }else{
                    res.status(400).send({
                        "message": "لديك عميل مسجل بنفس رقم الهاتف."
                    });
                }
            },(e) => {
                res.status(400).send({
                    "message": "error happen while get customer data."
                });
            });
        }
    }
});
//edit customer data
router.post('/edit', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('143')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to edit customer."
        });
    }else{
        let body = _.pick(req.body, ['customer_id','name','phoneNumber']);
        if(!body.customer_id || !body.name || !body.phoneNumber){
            res.status(400).send({"message": "Missing data, (customer_id, name, phoneNumber) fields are required."});
        }else{
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            let search_filters = {phoneNumber: body.phoneNumber, parent: body.parent}
            Customer.findOne(search_filters)
            .then((search_customer) => {
                if(!search_customer || (search_customer._id == body.customer_id)){
                    let query = {_id: body.customer_id, parent: body.parent}
                    let updateBody = {};
                    if(body.name){updateBody.name = body.name};
                    if(body.phoneNumber){updateBody.phoneNumber = body.phoneNumber};
                    Customer.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
                        if(e){
                            if(e.errmsg && e.errmsg.includes("phoneNumber")){
                                res.status(400).send({
                                    "status": 0,
                                    "message": "This phone number is already exist for another customer."
                                });
                            }else if(e.name && e.name == "CastError"){
                                res.status(400).send({
                                    "status": 0,
                                    "message": e.message
                                });
                            }else{
                                res.status(400).send({
                                    "status": 0,
                                    "message": "error while updating customer data."
                                });
                            }
                        }else{
                            if(response == null){
                                res.status(400).send({
                                    "status": 0,
                                    "message": "can't find any customer with this customer_id."
                                });
                            }else{
                                return res.send({
                                    "data": response
                                });
                            }
                        }
                    })
                }else{
                    res.status(400).send({
                        "message": "This phone number is already exist for another customer."
                    });
                }
            },(e) => {
                res.status(400).send({
                    "message": "error happen while search for customer."
                });
            });
        }
    }
});
router.get('/custom_products', authenticate, function(req, res, next) {
    if(!req.query.customer_id){
        res.status(400).send({
            "status": 0,
            "message": "customer_id is required."
        });
    }else{
        let errHappen = false;
        let err;
        let page;
        if(req.query.page){page = req.query.page;}else{page = 1;}
        let page_size;
        if(req.query.page_size){page_size = req.query.page_size;}else{page_size = 10;}
        const options = {
            page: page,
            limit: page_size,
            sort: { created_at: -1 },
            populate: [
                { path: 'customer', select: ['name', 'phoneNumber'] },
                { path: 'branch', select: ['name', 'phoneNumber', 'address', 'type'] },
                { path: 'materials_branch', select: ['name', 'phoneNumber', 'address', 'type'] },
                { path: 'created_from', select: ['name', 'email'] },
                { path: 'accepted_from', select: ['name', 'email'] },
                { path: 'ready_from', select: ['name', 'email'] },
                { path: 'delivered_from', select: ['name', 'email'] }
            ],
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
        filters.customer = req.query.customer_id
        if(errHappen){
            res.status(400).send(err);
        }else{
            Custom_product.paginate(filters, options, function(err, result) {
                let next;
                if(result.hasNextPage){
                    next = "https://" + req.headers.host + "/api/customer/custom_products?page=" + result.nextPage + "&page_size=" + page_size;
                }else{next = null;}
                let prev;
                if(result.hasPrevPage){
                    prev = "https://" + req.headers.host + "/api/customer/custom_products?page=" + result.prevPage + "&page_size=" + page_size;
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
        }
    }
});

module.exports = router;
