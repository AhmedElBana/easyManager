var express = require('express');
var router = express.Router();
const _ = require('lodash');
let {Order} = require('../db/models/order');
let {Branch} = require('../db/models/branch');
let {Customer} = require('../db/models/customer');
let {Product} = require('../db/models/product');
let {authenticate} = require('../middleware/authenticate');

/* Create new feature. */
router.post('/create', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('124')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to create new order."
        });
    }else{
        let body = _.pick(req.body, ['customerName','customerPhone','products','promo','promo_id','branch_id']);
        if(!body.customerName || !body.customerPhone || !body.products || !body.promo || !body.branch_id){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (customerName, customerPhone, products, promo, branch_id) fields are required."
            });
        }else{
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            checkBranch(req, body, function(err){
                if(err !== null){
                    res.status(400).send(err);
                }else{
                    checkCustomer(body, function(err, customer){
                        if(err !== null){
                            res.status(400).send(err);
                        }else{
                            productsFormatCheck(body, function(err){
                                if(err !== null){
                                    res.status(400).send(err);
                                }else{
                                    checkProductsAvailability(body, function(err){
                                        if(err !== null){
                                            res.status(400).send(err);
                                        }else{
                                            checkPromo(body, function(err){
                                                if(err !== null){
                                                    res.status(400).send(err);
                                                }else{
                                                    removeProducts(body, function(err){
                                                        if(err !== null){
                                                            res.status(400).send(err);
                                                        }else{
                                                            //create the order
                                                            let orderObj = {
                                                                "customer_id": customer._id,
                                                                "products": body.products,
                                                                "bill": body.bill,
                                                                "subTotal": body.subTotal,
                                                                "total": body.total,
                                                                "promo": body.promo,
                                                                "promo_id": body.promo_id,
                                                                "discountValue": body.discountValue,
                                                                "createdDate": new Date(),
                                                                "branch_id": body.branch_id,
                                                                "creator_id": req.user._id,
                                                                "canceled": false,
                                                                "parent": body.parent
                                                            }
                                                            let newOrderData = new Order(orderObj);
                                                            newOrderData.save().then((newOrder) => {                
                                                                return res.status(201).send({
                                                                    "status": 1,
                                                                    "data": {"orderData": newOrder}
                                                                });
                                                            }).catch((e) => {
                                                                res.status(400).send({
                                                                    "status": 0,
                                                                    "message": e
                                                                });
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
                    });
                }
            })
        }
    }
});
var checkPromo = (body, callback) => {
    if(!body.promo){
        //no promo
        body.promo_id = null;
        body.discountValue = 0;
        body.total = body.subTotal;
        callback(null);
    }else{
        //promo
        body.promo_id = null;
        body.discountValue = 0;
        body.total = body.subTotal;
        callback(null);
    }
}
var checkProductsAvailability = (body, callback) => {
    let fountError = false;
    let productsArr = [];
    let productsQuantityMap = {};
    let finalProductsQuantityMap = {};
    body.products.map((product)=>{
        productsArr.push(product.product_id)
        productsQuantityMap[product.product_id] = product.quantity;
    })
    Product.find({'_id': { $in: productsArr}, 'parent': body.parent})
        .then((products) => {
            if(products.length !== productsArr.length){
                fountError = true;
                let err = {
                    "status": 0,
                    "message": "Wrong data: can't find some products, please check (product_id) for each product."
                };
                return callback(err)
            }else{
                products.map((singleProduct) => {
                    if(!singleProduct.map[body.branch_id] || singleProduct.map[body.branch_id] < productsQuantityMap[singleProduct._id.toString()]){
                        fountError = true;
                        let err = {
                            "status": 0,
                            "message": "can't find enough quantity from this product (" + singleProduct._id.toString() +")."
                        };
                        return callback(err)
                    }
                })
                let bill = [];
                let totalPrice = 0;
                products.map((singleProduct) => {
                    var newMapObj = {...singleProduct.map};
                    newMapObj[body.branch_id] -= productsQuantityMap[singleProduct._id.toString()]
                    finalProductsQuantityMap[singleProduct._id] = newMapObj
                    bill.push({
                        "_id": singleProduct._id,
                        "name": singleProduct.name,
                        "quantity": productsQuantityMap[singleProduct._id.toString()],
                        "price": singleProduct.price,
                        "total": productsQuantityMap[singleProduct._id.toString()] * singleProduct.price
                    })
                    totalPrice += productsQuantityMap[singleProduct._id.toString()] * singleProduct.price;
                })
                body.bill = bill;
                body.subTotal = totalPrice;
                body.finalProductsQuantityMap = finalProductsQuantityMap;
                if(!fountError){return callback(null);}
            }
        },(e) => {
            fountError = true;
            let err;
            if(e.name && e.name == 'CastError'){
                err = {
                    "status": 0,
                    "message": "Wrong value: (" + e.value + ") is not valid product id."
                };
            }else{
                err = {
                    "status": 0,
                    "message": "error hanppen while query products data."
                };
            }
            return callback(err)
        });

}
var productsFormatCheck = (body, callback) => {
    let fountError = false;
    if(typeof(body.products[0]) !== 'object'){
        fountError = true;
        let err = {
            "status": 0,
            "message": "Wrong data (products) must be array of objects."
        }
        return callback(err);
    }else{
        body.products.map((product)=>{
            if(!product.product_id){
                fountError = true;
                let err = {
                    "status": 0,
                    "message": "each object inside products must have (product_id) field."
                }
                return callback(err);
            }
            if(!product.quantity || isNaN(product.quantity)){
                fountError = true;
                let err = {
                    "status": 0,
                    "message": "each object inside products must have (quantity) field with numeric value."
                }
                return callback(err);
            }
        })
    }
    if(!fountError){return callback(null);}
}
async function removeProducts(body, callback) {
    Object.keys(body.finalProductsQuantityMap).map((product_id)=>{
        updateOneProduct(product_id,body.finalProductsQuantityMap[product_id]);
    })
    callback(null);
}
async function addProducts(productsArr, parent_id, branch_id, callback) {
    let fountError = false;
    let productsIds = [];
    let productsMap = {};
    productsArr.map((product)=>{
        productsIds.push(product.product_id);
        productsMap[product.product_id] = product.quantity
    })
    Product.find({'_id': { $in: productsIds}, 'parent': parent_id})
    .then((products) => {
        if(products.length !== productsIds.length){
            fountError = true;
            let err = {
                "status": 0,
                "message": "Wrong data: can't find some products, please check (product_id) for each product."
            };
            return callback(err)
        }else{
            let idWithFullMap = {};
            products.map((singleProduct) => {
                idWithFullMap[singleProduct._id] = singleProduct.map;
            })
            let newIdWithFullMap = {...idWithFullMap}
            Object.keys(productsMap).map((product_id) => {
                if(newIdWithFullMap[product_id][branch_id]){
                    newIdWithFullMap[product_id][branch_id] += productsMap[product_id];
                }else{
                    newIdWithFullMap[product_id][branch_id] = productsMap[product_id];
                }
            })
            Object.keys(newIdWithFullMap).map((product_id)=>{
                updateOneProduct(product_id,newIdWithFullMap[product_id]);
            })
            if(!fountError){return callback(null);}
        }
    },(e) => {
        fountError = true;
        let err;
        if(e.name && e.name == 'CastError'){
            err = {
                "status": 0,
                "message": "Wrong value: (" + e.value + ") is not valid product id."
            };
        }else{
            err = {
                "status": 0,
                "message": "error hanppen while query products data."
            };
        }
        return callback(err)
    });
}
function updateOneProduct(product_id, updatedMap) { 
    return new Promise(resolve => {
        totalQuantity = 0;
        Object.keys(updatedMap).map((branch_id)=>{
            totalQuantity += updatedMap[branch_id]
        })
        let updateBody = {"map": updatedMap, "quantity": totalQuantity};
        let query = {_id: product_id};
        Product.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
            if(e){
                console.log(e)
            }else{
                resolve(response);
            }
        })
    });
}
var checkBranch = (req, body, callback) => {
    Branch.findOne({_id: body.branch_id, parent: body.parent})
    .then((branch) => {
        if(!branch){
            callback({
                "status": 0,
                "message": "wrong branch_id."
            })
        }else{
            if(!req.user.branches.includes(body.branch_id) && req.user.type != "admin"){
                callback({
                    "status": 0,
                    "message": "This user don't have access to this branch."
                })
            }else{
                callback(null)
            }
        }
    },(e) => {
        if(e.name && e.name == 'CastError'){
            callback({
                "status": 0,
                "message": "wrong branch_id."
            })
        }else{
            callback({
                "status": 0,
                "message": "error happen while query branch data."
            })
        }
    });
}
var checkCustomer = (body, callback) => {
    Customer.findOne({phoneNumber: body.customerPhone, parent: body.parent})
    .then((customer) => {
        if(!customer){
            let customerObj = {
                "name": body.customerName,
                "phoneNumber": body.customerPhone,
                "register_completed": false,
                "is_login": false,
                "parent": body.parent
            }
            //create new customer
            let newCustomerData = new Customer(customerObj);
            newCustomerData.save().then((newCustomer) => {  
                callback(null,newCustomer)
            }).catch((e) => {
                callback({
                    "status": 0,
                    "message": e
                }, null)
            });
        }else{
            callback(null, customer)
        }
    },(e) => {
        callback({
            "status": 0,
            "message": "error happen while query customer data."
        }, null)
    });
}
/* cancel order. */
router.post('/cancel', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('125')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to cancel order."
        });
    }else{
        let body = _.pick(req.body, ['order_id']);
        if(!body.order_id){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (order_id) field is required."
            });
        }else{
            let user = req.user;
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            let query = {
                _id: body.order_id, 
                parent: body.parent
            };
            Order.findOne(query)
            .then((order) => {
                if(!order){
                    res.status(400).send({
                        "status": 0,
                        "message": "can't find any order with this order_id."
                    });
                }else{
                    if(order.creator_id != req.user._id){
                        res.status(400).send({
                            "status": 0,
                            "message": "order must be canceled from the same staff."
                        });
                    }else{
                        if(order.canceled){
                            res.status(400).send({
                                "status": 0,
                                "message": "This order is already canceled."
                            });
                        }else{
                            let diffTime = Math.abs(new Date() - order.createdDate);
                            let diffHours = diffTime / (1000 * 60 * 60);
                            if(diffHours > 1){
                                res.status(400).send({
                                    "status": 0,
                                    "message": "order can't be cancel after 1 hour."
                                });
                            }else{
                                addProducts(order.products, order.parent, order.branch_id, function(err){
                                    if(err !== null){
                                        res.status(400).send(err);
                                    }else{
                                        //cancel order
                                        let updateBody = {
                                            "canceled": true,
                                            "canceledDate": new Date()
                                        };
                                        Order.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
                                            if(e){
                                                if(e.name && e.name == "CastError"){
                                                    res.status(400).send({
                                                        "status": 0,
                                                        "message": e.message
                                                    });
                                                }else{
                                                    res.status(400).send({
                                                        "status": 0,
                                                        "message": "error while updating order data."
                                                    });
                                                }
                                            }else{
                                                return res.send({
                                                    "status": 1,
                                                    "data": {"orderData": response}
                                                });
                                            }
                                        })
                                    }
                                })
                            }
                        }
                    }
                }
            },(e) => {
                if(e.name && e.name == "CastError"){
                    res.status(400).send({
                        "status": 0,
                        "message": "Wrong order_id value."
                    });
                }else{
                    res.status(400).send({
                        "status": 0,
                        "message": "error happen while query order data."
                    });
                }
            });
        }
    }
});

/* list feature. */
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
    Feature.paginate(filters, options, function(err, result) {
        let next;
        if(result.hasNextPage){
            next = "https://" + req.headers.host + "/api/category/feature?page=" + result.nextPage + "&page_size=" + page_size;
        }else{next = null;}
        let prev;
        if(result.hasPrevPage){
            prev = "https://" + req.headers.host + "/api/category/feature?page=" + result.prevPage + "&page_size=" + page_size;
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

module.exports = router;
