var express = require('express');
const axios = require('axios');
var router = express.Router();
const _ = require('lodash');
let {Promo} = require('../db/models/promo');
let {Customer} = require('../db/models/customer');
let {Branch} = require('../db/models/branch');
let {Product} = require('../db/models/product');
let {Store} = require('../db/models/store');
let {authenticate} = require('../middleware/authenticate');

/* Create new promo. */
router.post('/create', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('128')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to create new promo."
        });
    }else{
        let body = _.pick(req.body, ['name','type','limit','discountType','discountValue','startDate','endDate','validTimesPerCustomer','customerType','customers','branchesType','branches','productsType','products','sms']);
        if(!body.name || !body.type || !body.limit || !body.discountType || !body.discountValue || !body.startDate || !body.endDate || !body.validTimesPerCustomer || !body.customerType || !body.branchesType || !body.productsType || !body.sms){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (name, type, limit, discountType, discountValue, startDate, endDate, validTimesPerCustomer, customerType, branchesType, productsType, sms) fields are required."
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
                            //check branches
                            checkBranches(body, function(err){
                                if(err !== null){
                                    res.status(400).send(err);
                                }else{
                                    checkProducts(body, function(err){
                                        if(err !== null){
                                            res.status(400).send(err);
                                        }else{
                                            //create new promo
                                            craetePromo(body, function(err){
                                                if(err !== null){
                                                    res.status(400).send(err);
                                                }else{
                                                    //send SMS
                                                    SMS(body, function(err){
                                                        if(err !== null){
                                                            // update promo sms to false
                                                            updatePromoSmsStatus(body, function(err){
                                                                if(err !== null){
                                                                    res.status(400).send(err);
                                                                }else{
                                                                    res.status(201).send({
                                                                        "status": 0,
                                                                        "data": body.promoData,
                                                                        "message": "Promo created but fiald to send SMS please try to re-send SMS again later."
                                                                    });
                                                                }
                                                            })
                                                        }else{
                                                            // update store number of avilable sms
                                                            updateStoreSmsCalc(body, function(err){
                                                                if(err !== null){
                                                                    res.status(400).send(err);
                                                                }else{
                                                                    res.status(201).send({
                                                                        "status": 1,
                                                                        "message": body.promoData
                                                                    });
                                                                }
                                                            })
                                                        }
                                                    })
                                                }
                                            })
                                        }
                                    })
                                }
                            })
                        }
                    })
                }
            })
        }
    }
});
var updateStoreSmsCalc = (body, callback) => {
    let updateBody = {$inc : {'usedSMS' : body.customersData.length, 'availableSMS' : -body.customersData.length}};
    let query = {'parent': body.parent};
    Store.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
        if(e){
            callback({
                "status": 0,
                "message": "error happen while update store sms status."
            })
        }else{
            callback(null)
        }
    })
}
var updatePromoSmsStatus = (body, callback) => {
    let updateBody = {"sms": false};
    let query = {_id: body.promoData._id};
    Promo.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
        if(e){
            callback({
                "status": 0,
                "message": "error happen while update promo sms status."
            })
        }else{
            body.promoData = response;
            callback(null)
        }
    })
}
var craetePromo = (body, callback) => {
    let newPromoData = new Promo(body);
    newPromoData.save().then((newPromo) => {
        body.promoData = newPromo;
        callback(null);
    }).catch((e) => {
        if(e.code && e.code == 11000){
            callback({
                "status": 0,
                "message": "you have another promo with the same name."
            });
        }else if(e.message){
            callback({
                "status": 0,
                "message": e.message
            });
        }else{
            callback({
                "status": 0,
                "message": e
            });
        }
    });
}
var SMS = (body, callback) => {
    if(body.sms == "false"){
        return callback(null);
    }else{
        Store.findOne({'parent': body.parent})
        .then((store) => {
            if(!store){
                let err = {
                    "status": 0,
                    "message": "can't find any store for this user."
                };
                return callback(err);
            }else{
                body.availableSMS = store.availableSMS;
                checkSMS(body, function(err){
                    if(err !== null){
                        callback(err);
                    }else{
                        sendSMS(body, function(err){
                            if(err !== null){
                                callback(err);
                            }else{
                                console.log("sms sent sucessfully.")
                                callback(null)
                            }
                        })
                    }
                })
            }
        },(e) => {
            let err = {
                "status": 0,
                "message": "error hanppen while query store data."
            };
            return callback(err);
        });
    }
}
// used in create/resend
var sendSMS = (body, callback) => {
    let discountType = "";
    if(body.discountType == "PERCENTAGE"){
        discountType = "%"
    }else{
        discountType = "EGP"
    }
    let customersPhoneArr = "";
    body.customersData.map((customer, index) => {
        if(body.customersData.length == index + 1){
            customersPhoneArr += customer.phoneNumber + ""
        }else{
            customersPhoneArr += customer.phoneNumber + ","
        }
    })
    console.log(customersPhoneArr)
    let url = "https://smsmisr.com/api/webapi/";
    let config ={
        headers: {
            "Content-Type": "application/json "
        },
        params: {
            "Username": process.env.SMS_USER,
            "password": process.env.SMS_PASS,
            "language": 1,
            "sender": process.env.SMS_SENDER,
            "Mobile": customersPhoneArr,
            "message": "Promo: " + body.name + " . get discount: " + body.discountValue + "" + discountType + " on order more than " + body.limit + "EGP. promo valid for " + body.validTimesPerCustomer + "times."
        }
    }
    axios.post(url, {}, config)
    .then(response => {
        if(response.data.code == 1901){
            callback(null)
        }else{
            callback({
                "status": 0,
                "message": "Fiald to send SMS please try to re-send SMS again later."
            });
        }
    })
    .catch(error => {
        callback({
            "status": 0,
            "message": "error happen while sending SMS."
        });
    });
}
// used in create/resend
var checkSMS = (body, callback) => {
    if(body.customerType == "ALL"){
        //get all customers
        Customer.find({'parent': body.parent})
        .then((customers) => {
            body.customersData = customers;
            if(customers.length > body.availableSMS){
                callback({
                    "status": 0,
                    "message": "Don't have enough available SMS."
                });
            }else{
                callback(null)
            }
        },(e) => {
            callback({
                "status": 0,
                "message": "error hanppen while query customers data."
            });
        });
    }else if(body.customerType == "SELECTED"){
        if(body.customers.length > body.availableSMS){
            callback({
                "status": 0,
                "message": "Don't have enough available SMS."
            });
        }else{
            callback(null)
        }
    }else{
        let err = {
            "status": 0,
            "message": "wronge customerType value."
        };
        return callback(err);
    }
}
async function checkBranches(body, callback){
    if(body.branchesType !== 'ALL' && body.branchesType !== "SELECTED"){
        fountError = true;
        let err = {
            "status": 0,
            "message": "Wrong data (branchesType) must be (ALL/SELECTED)."
        }
        return callback(err);
    }else if(body.branchesType == "ALL"){
        delete body.branches
        return callback(null);
    }else if(body.branchesType == "SELECTED"){
        if(typeof(body.branches) !== 'object' || !body.branches[0]){
            fountError = true;
            let err = {
                "status": 0,
                "message": "Wrong data (branches) must be array of customer IDs."
            }
            return callback(err);
        }else{
            //check customers ids
            compareBranchesIDs(body).then((data) => {
                //match all customers ids
                return callback(null);
            }, (err) => {
                fountError = true;
                return callback(err);
            });
        }
    }
}
function compareBranchesIDs(body) {
    return new Promise((resolve, reject) => {
        Branch.find({'_id': { $in: body.branches}, 'parent': body.parent})
        .then((branches) => {
            if(branches.length !== body.branches.length){
                reject({
                    "status": 0,
                    "message": "Wrong data: can't find some branches, please check (branches) values."
                });
            }else{
                resolve();
            }
        },(e) => {
            if(e.name && e.name == 'CastError'){
                reject({
                    "status": 0,
                    "message": "Wrong value: (" + e.value + ") is not valid branch id => field: (branches)."
                });
            }else{
                reject({
                    "status": 0,
                    "message": "error hanppen while query branches data."
                });
            }
        });
    });
}
async function checkProducts(body, callback){
    if(body.productsType !== 'ALL' && body.productsType !== "SELECTED"){
        fountError = true;
        let err = {
            "status": 0,
            "message": "Wrong data (productsType) must be (ALL/SELECTED)."
        }
        return callback(err);
    }else if(body.productsType == "ALL"){
        delete body.products
        return callback(null);
    }else if(body.productsType == "SELECTED"){
        if(typeof(body.products) !== 'object' || !body.products[0]){
            fountError = true;
            let err = {
                "status": 0,
                "message": "Wrong data (products) must be array of product IDs."
            }
            return callback(err);
        }else{
            //check products ids
            compareProductsIDs(body).then((data) => {
                //match all products ids
                return callback(null);
            }, (err) => {
                fountError = true;
                return callback(err);
            });
        }
    }
}
function compareProductsIDs(body) {
    return new Promise((resolve, reject) => {
        Product.find({'_id': { $in: body.products}, 'parent': body.parent})
        .then((products) => {
            if(products.length !== body.products.length){
                reject({
                    "status": 0,
                    "message": "Wrong data: can't find some products, please check (products) values."
                });
            }else{
                resolve();
            }
        },(e) => {
            if(e.name && e.name == 'CastError'){
                reject({
                    "status": 0,
                    "message": "Wrong value: (" + e.value + ") is not valid product id => field: (products)."
                });
            }else{
                reject({
                    "status": 0,
                    "message": "error hanppen while query products data."
                });
            }
        });
    });
}
// used in create/resend
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
                body.customersData = customers;
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
router.get('/sms/resend', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('128')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to edit branch."
        });
    }else{
        if(!req.query.promo_id){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (promo_id) field is required."
            });
        }else{
            let body = {};
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            Promo.findOne({_id: req.query.promo_id, parent: body.parent})
            .then((promo) => {
                if(!promo){
                    res.status(400).send({
                        "status": 0,
                        "message": "wrong promo_id."
                    })
                }else{
                    if(promo.sms){
                        res.status(400).send({
                            "status": 0,
                            "message": "SMS already sent for this promo."
                        })
                    }else{
                        body.promo = promo;
                        body = {...body, ...promo._doc}
                        smsResend(body, function(err){
                            if(err !== null){
                                res.status(400).send(err);
                            }else{
                                // update store number of avilable sms
                                resendUpdateStoreSmsCalc(body, function(err){
                                    if(err !== null){
                                        res.status(400).send(err);
                                    }else{
                                        resendUpdatePromoSmsStatus(body, function(err){
                                            if(err !== null){
                                                res.status(400).send(err);
                                            }else{
                                                res.send({
                                                    "status": 1,
                                                    "message": "SMS sent successfully."
                                                })
                                            }
                                        })
                                    }
                                })
                            }
                        })
                    }
                }
            },(e) => {
                res.status(400).send({
                    "status": 0,
                    "message": "error happen while query promo data."
                })
            });
        }
    }
});
var resendUpdateStoreSmsCalc = (body, callback) => {
    let updateBody = {$inc : {'usedSMS' : body.customersData.length, 'availableSMS' : -body.customersData.length}};
    let query = {'parent': body.parent};
    Store.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
        if(e){
            callback({
                "status": 0,
                "message": "error happen while update store sms status."
            })
        }else{
            callback(null)
        }
    })
}
var resendUpdatePromoSmsStatus = (body, callback) => {
    let updateBody = {"sms": true};
    let query = {_id: body.promo._id};
    Promo.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
        if(e){
            callback({
                "status": 0,
                "message": "error happen while update promo sms status."
            })
        }else{
            body.promoData = response;
            callback(null)
        }
    })
}
var smsResend = (body, callback) => {
    // checkCustomers to get body.customersData in type SELECTED
    checkCustomers(body, function(err){
        if(err !== null){
            callback(err);
        }else{
            reSMS(body, function(err){
                if(err !== null){
                    callback(err);
                }else{
                    callback(null);
                }
            })
        }
    })
}
var reSMS = (body, callback) => {
    Store.findOne({'parent': body.parent})
    .then((store) => {
        if(!store){
            let err = {
                "status": 0,
                "message": "can't find any store for this user."
            };
            return callback(err);
        }else{
            body.availableSMS = store.availableSMS;
            checkSMS(body, function(err){
                if(err !== null){
                    callback(err);
                }else{
                    sendSMS(body, function(err){
                        if(err !== null){
                            callback(err);
                        }else{
                            callback(null)
                        }
                    })
                }
            })
        }
    },(e) => {
        let err = {
            "status": 0,
            "message": "error hanppen while query store data."
        };
        return callback(err);
    });
}
/* activate promo. */
router.get('/activate', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('129')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to activate promo."
        });
    }else{
        if(!req.query.promo_id){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (promo_id) field is required."
            });
        }else{
            let updateBody = {active: true};
            let query;
            if(req.user.type == 'admin'){
                query = {_id: req.query.promo_id, parent: req.user._id};
            }else if(req.user.type == 'staff'){
                query = {_id: req.query.promo_id, parent: req.user.parent};
            }
            Promo.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
                if(e){
                    res.status(400).send({
                        "status": 0,
                        "message": "wrong promo_id."
                    })
                }else{
                    if(response == null){
                        res.status(400).send({
                            "status": 0,
                            "message": "can't find any promo with this promo_id."
                        });
                    }else{
                        return res.send({
                            "status": 1,
                            "data": {"promoData": response}
                        });   
                    }
                }
            })
        }
    }
});
/* deactivate promo. */
router.get('/deactivate', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('130')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to deactivate promo."
        });
    }else{
        if(!req.query.promo_id){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (promo_id) field is required."
            });
        }else{
            let updateBody = {active: false};
            let query;
            if(req.user.type == 'admin'){
                query = {_id: req.query.promo_id, parent: req.user._id};
            }else if(req.user.type == 'staff'){
                query = {_id: req.query.promo_id, parent: req.user.parent};
            }
            Promo.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
                if(e){
                    res.status(400).send({
                        "status": 0,
                        "message": "wrong promo_id."
                    })
                }else{
                    if(response == null){
                        res.status(400).send({
                            "status": 0,
                            "message": "can't find any promo with this promo_id."
                        });
                    }else{
                        return res.send({
                            "status": 1,
                            "data": {"promoData": response}
                        });   
                    }
                }
            })
        }
    }
});
/* list promo. */
router.get('/list', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('127')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to view promos."
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
        Promo.paginate(filters, options, function(err, result) {
            let next;
            if(result.hasNextPage){
                next = "https://" + req.headers.host + "/api/promo/list?page=" + result.nextPage + "&page_size=" + page_size;
            }else{next = null;}
            let prev;
            if(result.hasPrevPage){
                prev = "https://" + req.headers.host + "/api/promo/list?page=" + result.prevPage + "&page_size=" + page_size;
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
