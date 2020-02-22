var express = require('express');
var router = express.Router();
const _ = require('lodash');
let {Order} = require('../db/models/order');
let {Branch} = require('../db/models/branch');
let {Customer} = require('../db/models/customer');
let {Product} = require('../db/models/product');
let {Promo} = require('../db/models/promo');
let {Store} = require('../db/models/store');
let {authenticate} = require('../middleware/authenticate');

/* Create new feature. */
router.post('/create', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('124')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to create new order."
        });
    }else{
        let body = _.pick(req.body, ['customerName','customerPhone','products','promo','promo_name','branch_id']);
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
                            body.customer_id = customer._id;
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
                                                                "type": "Order",
                                                                "customer_id": customer._id,
                                                                "customer_name": customer.name,
                                                                "customer_phoneNumber": customer.phoneNumber,
                                                                "products": body.products,
                                                                "bill": body.bill,
                                                                "subTotal": body.subTotal,
                                                                "total": body.total,
                                                                "promo": body.promo,
                                                                "discountValue": body.discountValue,
                                                                "createdDate": new Date(),
                                                                "branch_id": body.branch_id,
                                                                "creator_id": req.user._id,
                                                                "canceled": false,
                                                                "returned": false,
                                                                "parent": body.parent
                                                            }
                                                            if(body.promoData){
                                                                orderObj.promo_id = body.promoData._id;
                                                            }
                                                            let newOrderData = new Order(orderObj);
                                                            newOrderData.save().then((newOrder) => {                
                                                                return res.status(201).send({
                                                                    "status": 1,
                                                                    "data": {
                                                                        "orderData": newOrder
                                                                    }
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
    if(body.promo == "false"){
        //no promo
        body.promo_name = null;
        body.discountValue = 0;
        body.total = body.subTotal;
        callback(null);
    }else{
        //promo
        if(!body.promo_name){
            callback({
                "status": 0,
                "message": "(promo_name) is required while (promo) is true."
            });
        }else{
            Promo.findOne({name: body.promo_name, parent: body.parent})
            .then((promo) => {
                if(!promo){
                    callback({
                        "status": 0,
                        "message": "wrong promo_name."
                    })
                }else{
                    body.promoData = promo;
                    checkPromoDate(body, function(err){
                        if(err !== null){
                            callback(err);
                        }else{
                            checkPromoCustomer(body, function(err){
                                if(err !== null){
                                    callback(err);
                                }else{
                                    checkPromoBranch(body, function(err){
                                        if(err !== null){
                                            callback(err);
                                        }else{
                                            calcPromoDiscount(body, function(err){
                                                if(err !== null){
                                                    callback(err);
                                                }else{
                                                    console.log(body)
                                                    callback(null)
                                                }
                                            })
                                        }
                                    })
                                }
                            })
                        }
                    })
                }
            },(e) => {
                if(e.name && e.name == 'CastError'){
                    callback({
                        "status": 0,
                        "message": "wrong promo_name."
                    })
                }else{
                    callback({
                        "status": 0,
                        "message": "error happen while query promo data."
                    })
                }
            });
        }
    }
}
var calcPromoDiscount = (body, callback) => {
    if(body.promoData.productsType == "ALL"){
        let billTotal = 0;
        body.bill.map((product) => {
            billTotal += product.total;
        })
        calcBillDiscount(billTotal, body.promoData, body, function(err){
            if(err !== null){
                callback(err);
            }else{
                callback(null)
            }
        })
    }else if(body.promoData.productsType == "SELECTED"){
        console.log("##########")
        let billTotal = 0;
        let discountBill = [];
        body.bill.map((product) => {
            if(body.promoData.products.includes(product._id)){
                discountBill.push(product);
            }
        })
        discountBill.map((product) => {
            billTotal += product.total;
        })
        calcBillDiscount(billTotal, body.promoData, body, function(err){
            if(err !== null){
                callback(err);
            }else{
                callback(null)
            }
        })
    }else{
        callback({
            "status": 0,
            "message": "Wronge productsType in promo data."
        })
    }
}
var calcBillDiscount = (total, promo, body, callback) => {
    if(total < promo.limit){
        callback({
            "status": 0,
            "message": "Products total must be more than: (" + promo.limit + "), your bill total is : (" + total + ")."
        })
    }else{
        if(promo.discountType == "VALUE"){
            body.promo_name = promo.name;
            body.discountValue = promo.discountValue;
            body.total = body.subTotal - body.discountValue;
            callback(null);
        }else if(promo.discountType == "PERCENTAGE"){
            body.promo_name = promo.name;
            body.discountValue = total * (promo.discountValue/100);
            body.total = body.subTotal - body.discountValue;
            callback(null);
        }else{
            callback({
                "status": 0,
                "message": "Wrong discountType value."
            })
        }
    }
}
var checkPromoDate = (body, callback) => {
    let current = new Date();
    if(new Date(body.promoData.startDate).getTime() > current.getTime()){
        callback({
            "status": 0,
            "message": "promo will be valid at: " + body.promoData.startDate
        })
    }else if(new Date(body.promoData.endDate).getTime() < current.getTime()){
        callback({
            "status": 0,
            "message": "promo expired at: " + body.promoData.endDate
        })
    }else{
        callback(null);
    }
}
var checkPromoCustomer = (body, callback) => {
    if(body.promoData.customerType == "ALL"){
        callback(null)
    }else if(body.promoData.customerType == "SELECTED"){
        if(body.promoData.customers.includes(body.customer_id)){
            callback(null)
        }else{
            callback({
                "status": 0,
                "message": "Promo: (" + body.promoData.name + ") is not valid for this customer."
            })
        }
    }else{
        callback({
            "status": 0,
            "message": "Wronge customerType in promo data."
        })
    }
}
var checkPromoBranch = (body, callback) => {
    if(body.promoData.branchesType == "ALL"){
        callback(null)
    }else if(body.promoData.branchesType == "SELECTED"){
        if(body.promoData.branches.includes(body.branch_id)){
            callback(null)
        }else{
            callback({
                "status": 0,
                "message": "Promo: (" + body.promoData.name + ") is not valid in this branch."
            })
        }
    }else{
        callback({
            "status": 0,
            "message": "Wronge branchesType in promo data."
        })
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
/* return order. */
router.post('/return', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('126')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to return order."
        });
    }else{
        let body = _.pick(req.body, ['order_id','branch_id','newProducts','removedProducts']);
        if(!body.order_id || !body.branch_id || !body.newProducts || !body.removedProducts){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (order_id, branch_id, newProducts, removedProducts) field is required."
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
                    if(order.canceled){
                        res.status(400).send({
                            "status": 0,
                            "message": "This order can't be return because it canceled before."
                        });
                    }else if(order.returned){
                        res.status(400).send({
                            "status": 0,
                            "message": "This order can't be return because it returned before."
                        });
                    }else{
                        checkStoreConditions(body, order, function(err, store){
                            if(err !== null){
                                res.status(400).send(err);
                            }else{
                                checkBranch(req, body, function(err){
                                    if(err !== null){
                                        res.status(400).send(err);
                                    }else{
                                        productsCheckFormat(body.removedProducts, function(err){
                                            if(err !== null){
                                                res.status(400).send(err);
                                            }else{
                                                productsCheckFormat(body.newProducts, function(err){
                                                    if(err !== null){
                                                        res.status(400).send(err);
                                                    }else{
                                                        checkNewProductsAvailability(body, body.newProducts, function(err){
                                                            if(err !== null){
                                                                res.status(400).send(err);
                                                            }else{
                                                                checkRemovedProducts(body.removedProducts, order.products, function(err, remainderProducts){
                                                                    if(err !== null){
                                                                        res.status(400).send(err);
                                                                    }else{
                                                                        body.remainderProducts = remainderProducts;
                                                                        remainderProductsBill(body, remainderProducts, function(err, remainderProducts){
                                                                            if(err !== null){
                                                                                res.status(400).send(err);
                                                                            }else{
                                                                                removeNewProducts(body, function(err){
                                                                                    if(err !== null){
                                                                                        res.status(400).send(err);
                                                                                    }else{
                                                                                        addProducts(body.removedProducts, body.parent, body.branch_id, function(err){
                                                                                            if(err !== null){
                                                                                                res.status(400).send(err);
                                                                                            }else{
                                                                                                //create the order
                                                                                                let total,returnAmount;
                                                                                                if(order.total - (body.remainderProductsSubTotal + body.newProductsSubTotal) < 0){
                                                                                                    total = Math.abs(order.total - (body.remainderProductsSubTotal + body.newProductsSubTotal));
                                                                                                    returnAmount = 0;
                                                                                                }else{
                                                                                                    total = 0;
                                                                                                    returnAmount = Math.abs(order.total - (body.remainderProductsSubTotal + body.newProductsSubTotal));
                                                                                                }
                                                                                                let orderObj = {
                                                                                                    "type": "Return",
                                                                                                    "customer_id": order.customer_id,
                                                                                                    "customer_name": order.customer_name,
                                                                                                    "customer_phoneNumber": order.customer_phoneNumber,
                                                                                                    "products": [...body.remainderProducts,...body.newProducts],
                                                                                                    "bill": [...body.remainderProductsBill,...body.newProductsBill],
                                                                                                    "prevOrderSubTotal": order.subTotal,
                                                                                                    "prevOrderDiscountValue": order.discountValue,
                                                                                                    "prevOrderTotal": order.total,
                                                                                                    "subTotal": body.remainderProductsSubTotal + body.newProductsSubTotal,
                                                                                                    "total": total,
                                                                                                    "returnAmount": returnAmount,
                                                                                                    "promo": false,
                                                                                                    "discountValue": 0,
                                                                                                    "createdDate": new Date(),
                                                                                                    "branch_id": body.branch_id,
                                                                                                    "creator_id": req.user._id,
                                                                                                    "canceled": false,
                                                                                                    "returned": false,
                                                                                                    "parentOrder": order._id,
                                                                                                    "parent": body.parent
                                                                                                }
                                                                                                let newOrderData = new Order(orderObj);
                                                                                                newOrderData.save().then((newOrder) => {                
                                                                                                    return res.status(201).send({
                                                                                                        "status": 1,
                                                                                                        "data": {
                                                                                                            "orderData": newOrder
                                                                                                        }
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
var checkStoreConditions = (body, order, callback) => {
    Store.findOne({parent: body.parent})
    .then((store) => {
        if(!store){
            callback({
                "status": 0,
                "message": "can't find any store ."
            }, null)
        }else{
            if(!store.returnOrederAllowed){
                callback({
                    "status": 0,
                    "message": store.name + " does not allow order return."
                }, null)
            }else{
                let diffTime = Math.abs(new Date() - order.createdDate);
                let diffHours = diffTime / (1000 * 60 * 60);
                if(diffHours > (Number(store.returnOrederDays) * 24)){
                    callback({
                        "status": 0,
                        "message": "order can't be return after (" + store.returnOrederDays + ") Day."
                    }, null)
                }else{
                    if(!store.returnAnyBranch){
                        if(order.branch_id != body.branch_id){
                            callback({
                                "status": 0,
                                "data": {"branch_id": order.branch_id},
                                "message": "Order return must be from the source branch (" + order.branch_id + ")"
                            }, null)
                        }else{
                            callback(null, store)
                        }
                    }else{
                        callback(null, store)
                    }
                }
            }
        }
    },(e) => {
        callback({
            "status": 0,
            "message": "error happen while query store data."
        }, null)
    });
}
var productsCheckFormat = (products, callback) => {
    let fountError = false;
    if(typeof(products[0]) !== 'object'){
        if(!(typeof(products) === 'object' && products.length === 0)){
            fountError = true;
            let err = {
                "status": 0,
                "message": "Wrong data (products) must be array of objects."
            }
            return callback(err);
        }
    }else{
        products.map((product)=>{
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
var checkNewProductsAvailability = (body, newProducts, callback) => {
    let fountError = false;
    let productsArr = [];
    let productsQuantityMap = {};
    let finalProductsQuantityMap = {};
    newProducts.map((product)=>{
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
                body.newProductsBill = bill;
                body.newProductsSubTotal = totalPrice;
                body.newProductsFinalQuantityMap = finalProductsQuantityMap;
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
var checkRemovedProducts = (removedProducts, orderProducts, callback) => {
    let fountError = false;
    let remainderProducts = [];
    let orderProductsMap = {};
    orderProducts.map((product)=>{
        orderProductsMap[product.product_id] = product.quantity;
    })
    removedProducts.map((removedProduct)=>{
        if(!orderProductsMap[removedProduct.product_id]){
            fountError = true;
            let err = {
                "status": 0,
                "message": "Returned product (" + removedProduct.product_id + ") not found in order."
            }
            return callback(err);
        }else{
            if(orderProductsMap[removedProduct.product_id] < removedProduct.quantity){
                fountError = true;
                let err = {
                    "status": 0,
                    "message": "Returned quantity of product (" + removedProduct.product_id + ") is more than quantity in the order."
                }
                return callback(err);
            }else{
                orderProductsMap[removedProduct.product_id] -= removedProduct.quantity;
            }
        }
    })
    Object.keys(orderProductsMap).map((key)=>{
        if(orderProductsMap[key] != 0){
            remainderProducts.push({"product_id": key, "quantity": orderProductsMap[key]})
        }
    })
    if(!fountError){return callback(null,remainderProducts);}
}
var remainderProductsBill = (body, newProducts, callback) => {
    let fountError = false;
    let productsArr = [];
    let productsQuantityMap = {};
    newProducts.map((product)=>{
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
                let bill = [];
                let totalPrice = 0;
                products.map((singleProduct) => {
                    var newMapObj = {...singleProduct.map};
                    newMapObj[body.branch_id] -= productsQuantityMap[singleProduct._id.toString()]
                    bill.push({
                        "_id": singleProduct._id,
                        "name": singleProduct.name,
                        "quantity": productsQuantityMap[singleProduct._id.toString()],
                        "price": singleProduct.price,
                        "total": productsQuantityMap[singleProduct._id.toString()] * singleProduct.price
                    })
                    totalPrice += productsQuantityMap[singleProduct._id.toString()] * singleProduct.price;
                })
                body.remainderProductsBill = bill;
                body.remainderProductsSubTotal = totalPrice;
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
async function removeNewProducts(body, callback) {
    Object.keys(body.newProductsFinalQuantityMap).map((product_id)=>{
        updateOneProduct(product_id,body.newProductsFinalQuantityMap[product_id]);
    })
    callback(null);
}
/* list orders. */
router.get('/list', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('123')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to view orders."
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
        if(req.query._id){filters._id = req.query._id}
        if(req.query.canceled){filters.canceled = req.query.canceled}
        if(req.query.branch_id){filters.branch_id = req.query.branch_id}
        if(req.query.createdDateFrom){
            if(new Date(req.query.createdDateFrom) == "Invalid Date"){
                errHappen = true;
                err = {
                    "status": 0,
                    "message": "Invalid createdDateFrom."
                }
            }
            filters.createdDate = {$gte: new Date(req.query.createdDateFrom)}
        }
        if(req.query.createdDateTo){
            if(new Date(req.query.createdDateTo) == "Invalid Date"){
                errHappen = true;
                err = {
                    "status": 0,
                    "message": "Invalid createdDateTo."
                }
            }
            if(req.query.createdDateFrom){
                filters.createdDate = {$gte: new Date(req.query.createdDateFrom), $lte: new Date(req.query.createdDateTo)}
            }else{
                filters.createdDate = {$lte: new Date(req.query.createdDateTo)}
            }
        }
        if(errHappen){
            res.status(400).send(err);
        }else{
            Order.paginate(filters, options, function(err, result) {
                let next;
                if(result.hasNextPage){
                    next = "https://" + req.headers.host + "/api/order/list?page=" + result.nextPage + "&page_size=" + page_size;
                }else{next = null;}
                let prev;
                if(result.hasPrevPage){
                    prev = "https://" + req.headers.host + "/api/order/list?page=" + result.prevPage + "&page_size=" + page_size;
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
