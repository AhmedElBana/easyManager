var express = require('express');
var router = express.Router();
const _ = require('lodash');
let {Promo} = require('../db/models/promo');
let {Customer} = require('../db/models/customer');
let {Branch} = require('../db/models/branch');
let {authenticate} = require('../middleware/authenticate');

/* Create new promo. */
router.post('/create', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('128')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to create new promo."
        });
    }else{
        let body = _.pick(req.body, ['name','type','limit','discountType','discountValue','startDate','endDate','validTimesPerCustomer','customerType','customers','branchesType','branches','sms']);
        if(!body.name || !body.type || !body.limit || !body.discountType || !body.discountValue || !body.startDate || !body.endDate || !body.validTimesPerCustomer || !body.customerType || !body.branchesType || !body.sms){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (name, type, limit, discountType, discountValue, startDate, endDate, validTimesPerCustomer, customerType, branchesType, sms) fields are required."
            });
        }else{
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            body.createdDate = new Date();
            body.active = true;
            body.creator_id = req.user._id;
            checkDiscount(body, function(err){
                if(err !== null){
                    res.status(400).send(err);
                }else{
                    //check customers
                    checkCustomers(body, function(err){
                        if(err !== null){
                            res.status(400).send(err);
                        }else{
                            let newPromoData = new Promo(body);
                            newPromoData.save().then((newPromo) => {                
                                return res.status(201).send({
                                    "status": 1,
                                    "data": {"promoData": newPromo}
                                });
                            }).catch((e) => {
                                if(e.code && e.code == 11000){
                                    res.status(400).send({
                                        "status": 0,
                                        "message": "you have another promo with the same name."
                                    });
                                }else if(e.message){
                                    res.status(400).send({
                                        "status": 0,
                                        "message": e.message
                                    });
                                }else{
                                    res.status(400).send({
                                        "status": 0,
                                        "message": e
                                    });
                                }
                            });
                        }
                    })
                }
            })
        }
    }
});
async function checkCustomers(body, callback){
    if(body.customerType !== 'ALL' && body.customerType !== "SELECTED"){
        fountError = true;
        let err = {
            "status": 0,
            "message": "Wrong data (customerType) must be (ALL/SELECTED)."
        }
        return callback(err);
    }else if(body.customerType == "ALL"){
        delete body.customers
        return callback(null);
    }else if(body.customerType == "SELECTED"){
        if(typeof(body.customers) !== 'object' || !body.customers[0]){
            fountError = true;
            let err = {
                "status": 0,
                "message": "Wrong data (customers) must be array of customer IDs."
            }
            return callback(err);
        }else{
            //check customers ids
            compareCustomerIDs(body).then((data) => {
                //match all customers ids
                return callback(null);
            }, (err) => {
                fountError = true;
                return callback(err);
            });
        }
    }
}
function compareCustomerIDs(body) {
    return new Promise((resolve, reject) => {
        Customer.find({'_id': { $in: body.customers}, 'parent': body.parent})
        .then((customers) => {
            if(customers.length !== body.customers.length){
                reject({
                    "status": 0,
                    "message": "Wrong data: can't find some customers, please check (customers) values."
                });
            }else{
                resolve();
            }
        },(e) => {
            if(e.name && e.name == 'CastError'){
                reject({
                    "status": 0,
                    "message": "Wrong value: (" + e.value + ") is not valid customer id."
                });
            }else{
                reject({
                    "status": 0,
                    "message": "error hanppen while query customers data."
                });
            }
        });
    });
}
var checkDiscount = (body, callback) => {
    let fountError = false;
    if(body.discountType !== 'VALUE' && body.discountType !== "PERCENTAGE"){
        fountError = true;
        let err = {
            "status": 0,
            "message": "Wrong data (discountType) must be (VALUE/PERCENTAGE)."
        }
        return callback(err);
    }else if(body.discountType == "VALUE"){
        if(isNaN(body.discountValue) || body.discountValue <= 0){
            fountError = true;
        let err = {
            "status": 0,
            "message": "Wrong data (discountValue) must be number more than 0."
        }
        return callback(err);
        }
    }else if(body.discountType == "PERCENTAGE"){
        if(isNaN(body.discountValue) || body.discountValue >= 100 || body.discountValue <= 0){
            fountError = true;
        let err = {
            "status": 0,
            "message": "Wrong data (discountValue) must be number more than 0 and less than 100."
        }
        return callback(err);
        }
    }
    if(!fountError){return callback(null);}
}
/* edit branch. */
router.post('/edit', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('106')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to edit branch."
        });
    }else{
        let body = _.pick(req.body, ['branch_id','name','phoneNumber','address','type','active']);
        if(!body.branch_id){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (branch_id) field is required."
            });
        }else{
            let user = req.user;
            let updateBody = {};
            if(req.body.name){updateBody.name = req.body.name}
            if(req.body.phoneNumber){updateBody.phoneNumber = req.body.phoneNumber}
            if(req.body.address){updateBody.address = req.body.address}
            if(req.body.type){updateBody.type = req.body.type}
            if(req.body.active){updateBody.active = req.body.active}

            let query;
            if(req.user.type == 'admin'){
                query = {_id: body.branch_id, parent: req.user._id};
            }else if(req.user.type == 'staff'){
                query = {_id: body.branch_id, parent: req.user.parent};
            }
            Branch.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
                if(e){
                    if(e.errmsg && e.errmsg.includes("phoneNumber")){
                        res.status(400).send({
                            "status": 0,
                            "message": "This phone number is already exist."
                        });
                    }else if(e.name && e.name == "CastError"){
                        res.status(400).send({
                            "status": 0,
                            "message": e.message
                        });
                    }else{
                        res.status(400).send({
                            "status": 0,
                            "message": "error while updating user data."
                        });
                    }
                }else{
                    if(response == null){
                        res.status(400).send({
                            "status": 0,
                            "message": "can't find any branch with this branch_id."
                        });
                    }else{
                        return res.send({
                            "status": 1,
                            "data": {"branchData": response}
                        });   
                    }
                }
            })
        }
    }
});

/* list branches. */
router.get('/list', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('104')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to view branches."
        });
    }else{
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
        Branch.paginate(filters, options, function(err, result) {
            let next;
            if(result.hasNextPage){
                next = "https://" + req.headers.host + "/api/branch/list?page=" + result.nextPage + "&page_size=" + page_size;
            }else{next = null;}
            let prev;
            if(result.hasPrevPage){
                prev = "https://" + req.headers.host + "/api/branch/list?page=" + result.prevPage + "&page_size=" + page_size;
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
});

module.exports = router;
