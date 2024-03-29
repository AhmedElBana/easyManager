var express = require('express');
var router = express.Router();
const _ = require('lodash');
let {Order} = require('../db/models/order');
let {Branch} = require('../db/models/branch');
let {Customer} = require('../db/models/customer');
let {ProductGroup} = require('../db/models/productGroup');
let {Product} = require('../db/models/product');
let {Custom_product} = require('../db/models/custom_product');
let {Promo} = require('../db/models/promo');
let {Store} = require('../db/models/store');
let {Payment} = require('../db/models/payment');
let {authenticate} = require('../middleware/authenticate');
//let {single_sms} = require('./../services/sms');
let {single_sms} = require('./../services/sms-sns');
const { stubFalse } = require('lodash');
var ObjectID = require('mongodb').ObjectID;

/* Create new feature. */
router.post('/create', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('124')){
        return res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to create new order."
        });
    }else{
        let body = _.pick(req.body, ['customerName','customerPhone','products','new_products','unregistered_products','custom_products','promo','promo_name','branch_id','payed','method']);
        if(!body.customerName || !body.customerPhone || !body.promo || !body.branch_id){
            return res.status(400).send({
                "status": 0,
                "message": "Missing data, (customerName, customerPhone, promo, branch_id) fields are required."
            });
        }else if(!body.products && !body.custom_products && !body.new_products && !body.unregistered_products){
            return res.status(400).send({
                "status": 0,
                "message": "Missing data, must have one field from (products, new_products unregistered_products, custom_products) at least."
            });
        }else{
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            checkBranch(req, body, function(err){
                if(err !== null){
                    return res.status(400).send(err);
                }else{
                    checkCustomer(body, function(err, customer){
                        if(err !== null){
                            return res.status(400).send(err);
                        }else{
                            body.customer_id = customer._id;
                            checkNewProducts(body, function(err){
                                if(err !== null){
                                    return res.status(400).send(err);
                                }else{
                                    productsFormatCheck(body, function(err){
                                        if(err !== null){
                                            return res.status(400).send(err);
                                        }else{
                                            custom_productsFormatCheck(body, function(err){
                                                if(err !== null){
                                                    return res.status(400).send(err);
                                                }else{
                                                    checkProductsAvailability(body, function(err){
                                                        if(err !== null){
                                                            return res.status(400).send(err);
                                                        }else{
                                                            checkUnregisteredProducts(body, function(err){
                                                                if(err !== null){
                                                                    return res.status(400).send(err);
                                                                }else{
                                                                    checkCustomProductsAvailability(body, function(err){
                                                                        if(err !== null){
                                                                            return res.status(400).send(err);
                                                                        }else{
                                                                            checkPromo(body, function(err){
                                                                                if(err !== null){
                                                                                    return res.status(400).send(err);
                                                                                }else{
                                                                                    removeProducts(body, function(err){
                                                                                        if(err !== null){
                                                                                            return res.status(400).send(err);
                                                                                        }else{
                                                                                            //create the order  , payed, method
                                                                                            let final_payed;
                                                                                            if(body.payed){
                                                                                                final_payed = Number(body.payed)
                                                                                            }else if(body.payed === 0){
                                                                                                final_payed = 0
                                                                                            }else{
                                                                                                final_payed = Number(body.total)
                                                                                            }
                                                                                            if(Number(body.payed) > Number(body.total)){
                                                                                                final_payed = Number(body.total)
                                                                                            }
                                                                                            let final_debt = Number(body.total) - final_payed;
        
                                                                                            let final_method;
                                                                                            if(body.method){
                                                                                                final_method = body.method
                                                                                            }else{
                                                                                                final_method = 'cash'
                                                                                            }
                                                                                            let orderObj = {
                                                                                                "type": "order",
                                                                                                "status": "success",
                                                                                                "method": final_method,
                                                                                                "customer": customer._id,
                                                                                                "bill": body.bill,
                                                                                                "subTotal": body.subTotal.toFixed(2),
                                                                                                "total": body.total.toFixed(2),
                                                                                                "payed": final_payed.toFixed(2),
                                                                                                "debt": final_debt.toFixed(2),
                                                                                                "promo": body.promo,
                                                                                                "discountValue": body.discountValue.toFixed(2),
                                                                                                "createdDate": new Date(),
                                                                                                "branch_id": body.branch_id,
                                                                                                "creator_id": req.user._id,
                                                                                                "parent": body.parent
                                                                                            }
                                                                                            if(body.promoData){
                                                                                                orderObj.promo_id = body.promoData._id;
                                                                                            }
                                                                                            if(body.products){
                                                                                                orderObj.products = body.products;
                                                                                            }
                                                                                            if(body.unregistered_products){
                                                                                                orderObj.unregistered_products = body.unregistered_products;
                                                                                            }
                                                                                            if(body.custom_products){
                                                                                                orderObj.custom_products = body.custom_products;
                                                                                            }
                                                                                            let newOrderData = new Order(orderObj);
                                                                                            newOrderData.save().then((finalNewOrder) => {
                                                                                                updateCustomerDebt(finalNewOrder, function(err){
                                                                                                    if(err !== null){
                                                                                                        return res.status(400).send(err);
                                                                                                    }else{
                                                                                                        addPayment(finalNewOrder, function(err){
                                                                                                            if(err !== null){
                                                                                                                return res.status(400).send(err);
                                                                                                            }else{
                                                                                                                updateCustomProducts(body, finalNewOrder, function(err){
                                                                                                                    single_sms(
                                                                                                                        finalNewOrder.parent,
                                                                                                                        "Thanks for shopping with us.\nYour order amount is " + finalNewOrder.total + "EGP.\nVisit https://tradket.com/bill/" + finalNewOrder._id + " to check bill details.",
                                                                                                                        customer.phoneNumber,
                                                                                                                        function(error, data){
                                                                                                                            if (error){
                                                                                                                                return res.status(201).send({
                                                                                                                                    "sms": "fail",
                                                                                                                                    "data": finalNewOrder
                                                                                                                                });
                                                                                                                            }else{
                                                                                                                                return res.status(201).send({
                                                                                                                                    "sms": "success",
                                                                                                                                    "data": finalNewOrder
                                                                                                                                });
                                                                                                                            }
                                                                                                                        }
                                                                                                                    )
                                                                                                                })
                                                                                                            }
                                                                                                        })
                                                                                                    }
                                                                                                })
                                                                                            }).catch((e) => {
                                                                                                return res.status(400).send({
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
                    });
                }
            })
        }
    }
});
var addPayment = (new_order, callback) => {
    let paymentObj = {
        "type": "in",
        "sub_type": "order",
        "method": new_order.method,
        "status": "success",
        "name": "Order Pay",
        "branch": new_order.branch_id,
        "amount": new_order.payed,
        "created_at": new Date(),
        "created_from": new_order.creator_id,
        "customer": new_order.customer,
        "order": new_order._id,
        "parent": new_order.parent
    }
    let newPaymentData = new Payment(paymentObj);
    newPaymentData.save().then((newPayment) => {  
        callback(null)
    }).catch((e) => {
        callback({
            "status": 0,
            "message": e
        }, null)
    });
}
var updateCustomerDebt = (new_order, callback) => {
    if(new_order.debt > 0){
        let updateBody = {$inc : {'debt' : new_order.debt}};
        let query = {_id: new_order.customer};
        Customer.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
            if(e){
                callback({
                    "status": 0,
                    "message": e
                })
            }else{
                callback(null);
            }
        })
    }else{
        callback(null);
    }
}
async function checkPromo(body, callback){
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
async function checkProductsAvailability(body, callback){
    if(body.products){
        let fountError = false;
        let productsArr = [];
        let productsQuantityMap = {};
        let finalProductsQuantityMap = {};
        let full_obj_by_id = {};
        body.products.map((product)=>{
            productsArr.push(product.product_id)
            productsQuantityMap[product.product_id] = product.quantity;
            full_obj_by_id[product.product_id] = product;
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
                        finalProductsQuantityMap[singleProduct._id] = newMapObj;
                        let single_final_price;
                        if(full_obj_by_id[singleProduct._id].final_price && !isNaN(full_obj_by_id[singleProduct._id].final_price)){
                            single_final_price = full_obj_by_id[singleProduct._id].final_price
                        }else{
                            single_final_price = singleProduct.price
                        }
                        bill.push({
                            "_id": singleProduct._id,
                            "name": singleProduct.name,
                            "quantity": productsQuantityMap[singleProduct._id.toString()],
                            "price": single_final_price,
                            "total": productsQuantityMap[singleProduct._id.toString()] * single_final_price,
                            "is_custom": false
                        })
                        totalPrice += productsQuantityMap[singleProduct._id.toString()] * single_final_price;
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

    }else{
        body.bill = [];
        body.subTotal = 0;
        return callback(null)
    }
}
function checkUnregisteredProducts(body, callback){
    if(body.unregistered_products){
        let fountError = false;
        if(typeof(body.unregistered_products[0]) !== 'object'){
            fountError = true;
            let err = {
                "status": 0,
                "message": "Wrong data (unregistered_products) must be array of objects."
            }
            return callback(err);
        }else{
            body.unregistered_products.map((product)=>{
                if(!product.name){
                    fountError = true;
                    let err = {
                        "status": 0,
                        "message": "each object inside unregistered_products must have (name) field."
                    }
                    return callback(err);
                }
                if(!product.quantity || isNaN(product.quantity)){
                    fountError = true;
                    let err = {
                        "status": 0,
                        "message": "each object inside unregistered_products must have (quantity) field with numeric value."
                    }
                    return callback(err);
                }
                if(!product.price || isNaN(product.price)){
                    fountError = true;
                    let err = {
                        "status": 0,
                        "message": "each object inside unregistered_products must have (price) field with numeric value."
                    }
                    return callback(err);
                }
            })
        }
        let bill = [];
        let totalPrice = 0;
        body.unregistered_products.map((singleProduct) => {
            singleProduct.product_id = new ObjectID();
            bill.push({
                "_id": singleProduct.product_id,
                "name": singleProduct.name,
                "quantity": Number(singleProduct.quantity),
                "price": Number(singleProduct.price),
                "total": Number(singleProduct.price) * Number(singleProduct.quantity),
                "is_custom": false,
                "unregistered": true
            })
            totalPrice += Number(singleProduct.price) * Number(singleProduct.quantity);
        })
        body.bill = [...body.bill, ...bill];
        body.subTotal += totalPrice;
        if(!fountError){return callback(null);}
    }else{
        return callback(null);
    }
}
function checkNewProducts(body, callback){
    if(body.new_products){
        let final_products_arr = [];
        let fountError = false;
        if(typeof(body.new_products[0]) !== 'object'){
            fountError = true;
            let err = {
                "status": 0,
                "message": "Wrong data (new_products) must be array of objects."
            }
            return callback(err);
        }else{
            body.new_products.map((product)=>{
                if(!product.name){
                    fountError = true;
                    let err = {
                        "status": 0,
                        "message": "each object inside new_products must have (name) field."
                    }
                    return callback(err);
                }
                if(!product.quantity || isNaN(product.quantity)){
                    fountError = true;
                    let err = {
                        "status": 0,
                        "message": "each object inside new_products must have (quantity) field with numeric value."
                    }
                    return callback(err);
                }
                if(!product.price || isNaN(product.price)){
                    fountError = true;
                    let err = {
                        "status": 0,
                        "message": "each object inside new_products must have (price) field with numeric value."
                    }
                    return callback(err);
                }
                if(!product._id){
                    product._id = new ObjectID().toString();
                }
                final_products_arr.push({
                    "product_id": product._id, 
                    "quantity": product.quantity
                })
            })
        }
        createNewProducts(body.new_products, body.parent, body.branch_id, function(err){
            if(err !== null){
                return callback(err);
            }else{
                if(body.products){
                    body.products = [...body.products, ...final_products_arr]
                }else{
                    body.products = [...final_products_arr]
                }
                return callback(null);
                
            }
        })
    }else{
        return callback(null);
    }
}
async function createNewProducts(new_products, parent, branch_id, callback){
    let fountError = false;
    let error;
    await Promise.all(new_products.map(async (new_product)=>{
        await createProductGroup(new_product, parent, branch_id).catch((err) => {
            fountError = true;
            error = err;
        })
    }))
    if(!fountError){
        return callback(null);
    }else{
        return callback(error);
    }
}           
function createProductGroup(new_product, parent, branch_id) {
    return new Promise(resolve => {
        let newProductGroup = {
            "_id": new_product._id,
            "is_material": false,
            "name": new_product.name,
            "createdAt": new Date(),
            "parent": parent,
            "active": true,
            "rate": 0
        }
        let newProductGroupData = new ProductGroup(newProductGroup);
        newProductGroupData.save().then((newProductGroup) => {
            let mapObj = {};
            mapObj[branch_id] = Number(new_product.quantity);
            let finalProduct = {
                "_id": newProductGroup._id,
                "is_material": false,
                "group_id": newProductGroup._id,
                "name": new_product.name,
                "price": new_product.price,
                "quantity": new_product.quantity,
                "map": mapObj,
                "parent": parent,
                "active": true
            }
            let newProductData = new Product(finalProduct);
            newProductData.save().then((newProduct) => {
                resolve(null)
            }).catch((e) => {
                if(e.code){
                    if(e.code == 11000){
                        resolve(null)
                    }else{
                        resolve({"message": e})
                    }
                }else{
                    resolve({"message": e})
                }
            });
        }).catch((e) => {
            if(e.code){
                if(e.code == 11000){
                    //res.status(400).send({"message": "you have product with the same id"});
                    resolve(null)
                }else{
                    resolve({"message": e})
                }
            }else{
                resolve({"message": e})
            }
        });
    });
}
async function checkCustomProductsAvailability(body, callback){
    let fountError = false;
    if(body.custom_products){
        let productsArr = [];
        let productsQuantityMap = {};
        body.custom_products.map((product)=>{
            productsArr.push(product.product_id)
            productsQuantityMap[product.product_id] = product.quantity;
        })
        Custom_product.find({'_id': { $in: productsArr}, 'parent': body.parent})
            .then((products) => {
                if(products.length !== productsArr.length){
                    fountError = true;
                    let err = {
                        "status": 0,
                        "message": "Wrong data: can't find some custom products, please check (product_id) for each custom product."
                    };
                    return callback(err)
                }else{
                    products.map((singleProduct) => {
                        if(singleProduct.status != "created"){
                            fountError = true;
                            let err = {
                                "status": 0,
                                "message": "custom product with is (" + singleProduct._id.toString() +") is assigned to another order."
                            };
                            return callback(err)
                        }
                    })
                    let bill = [];
                    let totalPrice = 0;
                    products.map((singleProduct) => {
                        bill.push({
                            "_id": singleProduct._id,
                            "name": singleProduct.name,
                            "quantity": singleProduct.quantity,
                            "price": singleProduct.price,
                            "total": singleProduct.price,
                            "is_custom": true
                        })
                        totalPrice += singleProduct.price;
                    })
                    body.bill = [...body.bill, ...bill];
                    body.subTotal += totalPrice;
                    if(!fountError){return callback(null);}
                }
            },(e) => {
                fountError = true;
                let err;
                if(e.name && e.name == 'CastError'){
                    err = {
                        "status": 0,
                        "message": "Wrong value: (" + e.value + ") is not valid custom product id."
                    };
                }else{
                    err = {
                        "status": 0,
                        "message": "error hanppen while query custom products data."
                    };
                }
                return callback(err)
            });
    }else{
        return callback(null);
    }
}
var productsFormatCheck = (body, callback) => {
    if(body.products){
        let fountError = false;
        if(typeof(body.products[0]) !== 'object'){
            fountError = true;
            let err = {
                "status": 0,
                "message": "Wrong data (products) must be array of objects."
            }
            return callback(err);
        }else{
            let products_obj = {};
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
                if(product.final_price && (isNaN(product.final_price) || product.final_price < 0)){
                    fountError = true;
                    let err = {
                        "status": 0,
                        "message": "final_price must be positive numeric value."
                    }
                    return callback(err);
                }
                if(products_obj[product.product_id]){
                    products_obj[product.product_id]["quantity"] = Number(products_obj[product.product_id]["quantity"]) + Number(product.quantity);
                }else{
                    products_obj[product.product_id] = {...product};
                }
            })
            //arrange the final list
            let final_arr = [];
            Object.keys(products_obj).map((key)=>{
                final_arr.push(products_obj[key])
            })
            body.products = [...final_arr];
        }
        if(!fountError){return callback(null);}
    }else{
        return callback(null);
    }
}
var custom_productsFormatCheck = (body, callback) => {
    let fountError = false;
    if(body.custom_products){
        if(typeof(body.custom_products[0]) !== 'object'){
            fountError = true;
            let err = {
                "status": 0,
                "message": "Wrong data (custom_products) must be array of objects."
            }
            return callback(err);
        }else{
            body.custom_products.map((product)=>{
                if(!product.product_id){
                    fountError = true;
                    let err = {
                        "status": 0,
                        "message": "each object inside custom_products must have (product_id) field."
                    }
                    return callback(err);
                }
            })
        }
    }
    if(!fountError){return callback(null);}
}
async function updateCustomProducts(body, finalNewOrder, callback) {
    if(body.custom_products){
        body.custom_products.map((product)=>{
            updateOneCustomProduct(product.product_id, finalNewOrder);
        })
    }
    callback(null);
}
function updateOneCustomProduct(product_id, finalNewOrder) { 
    return new Promise(resolve => {
        let updateBody = {
            "status": "assigned",
            "order": finalNewOrder._id,
            "customer": finalNewOrder.customer
        };
        let query = {_id: product_id};
        Custom_product.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
            if(e){
                console.log(e)
            }else{
                resolve(response);
            }
        })
    });
}
async function removeProducts(body, callback) {
    if(body.products){
        Object.keys(body.finalProductsQuantityMap).map((product_id)=>{
            updateOneProduct(product_id,body.finalProductsQuantityMap[product_id]);
        })
    }
    callback(null);
}
async function addProducts(productsArr, parent_id, branch_id, callback) {
    if(productsArr && productsArr.length > 0){
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
                        newIdWithFullMap[product_id][branch_id] = Number(newIdWithFullMap[product_id][branch_id]) + Number(productsMap[product_id]);
                    }else{
                        newIdWithFullMap[product_id][branch_id] = Number(productsMap[product_id]);
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
    }else{
        return callback(null);
    }
}
function updateOneProduct(product_id, updatedMap) { 
    return new Promise(resolve => {
        totalQuantity = 0;
        Object.keys(updatedMap).map((branch_id)=>{
            totalQuantity += Number(updatedMap[branch_id])
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
async function addMaterials(productsArr, parent_id, branch_id, callback) {
    let fountError = false;
    let productsIds = [];
    let productsMap = {};
    Object.keys(productsArr).map((product_id)=>{
        productsIds.push(product_id);
        productsMap[product_id] = productsArr[product_id]
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
function cancelOneCustomProduct(custom_product) { 
    return new Promise(resolve => {
        let updateBody = {"status": "canceled"};
        let query = {_id: custom_product._id};
        Custom_product.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
            if(e){
                console.log(e)
            }else{
                addMaterials(response.materials, response.parent, response.materials_branch, function(err){
                    if(err !== null){
                        res.status(400).send(err);
                    }else{
                        resolve(response);
                    }
                })
            }
        })
    });
}
async function cancelCustomProducts(custom_products, parent_id, callback) {
    if(custom_products && custom_products.length > 0){
        let fountError = false;
        let productsIds = [];
        custom_products.map((product)=>{
            productsIds.push(product._id);
        })
        Custom_product.find({'_id': { $in: productsIds}, 'parent': parent_id})
        .then((custom_products) => {
            if(custom_products.length !== productsIds.length){
                fountError = true;
                let err = {
                    "status": 0,
                    "message": "Wrong data: can't find some custom_products, please check (product_id) for each product."
                };
                return callback(err)
            }else{
                let idWithFullMap = {};
                custom_products.map((single_custom_product) => {
                    cancelOneCustomProduct(single_custom_product);
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
    }else{
        return callback(null);
    }
}
/* order add_payment */
router.post('/add_payment', authenticate, function(req, res, next) {
    let body = _.pick(req.body, ['order_id', 'amount','method']);
    if(!body.order_id || !body.amount || !body.method){
        res.status(400).send({
            "status": 0,
            "message": "Missing data, (order_id, amount, method) field is required."
        });
    }else{
        if(isNaN(body.amount) || Number(body.amount) <= 0){
            res.status(400).send({
                "status": 0,
                "message": "amount must be valid number more than 0."
            });
        }else{
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            let query = {
                id: body.order_id, 
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
                    if(order.status == "canceled"){
                        res.status(400).send({
                            "status": 0,
                            "message": "Can't add payment on canceled order."
                        });
                    }else if(order.status == "returned"){
                        res.status(400).send({
                            "status": 0,
                            "message": "Can't add payment on returned order."
                        });
                    }else{
                        if(Number(order.debt) < Number(body.amount)){
                            res.status(400).send({
                                "status": 0,
                                "message": "Max amout can add to this order is: " + order.debt
                            });
                        }else{
                            let updateBody = {$inc : {'debt' : -body.amount, 'payed': body.amount}};
                            Order.findOneAndUpdate(query,updateBody, { new: true }, (e, updated_order) => {
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
                                    updateCustomerDebtCustomAmount(updated_order.customer, body.amount, function(err){
                                        if(err !== null){
                                            res.status(400).send(err);
                                        }else{
                                            addNewPayment(updated_order, body.amount, req.user._id, body.method, function(err){
                                                if(err !== null){
                                                    res.status(400).send(err);
                                                }else{
                                                    return res.send({
                                                        "status": 1,
                                                        "data": updated_order
                                                    });
                                                }
                                            })
                                        }
                                    })
                                }
                            })
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
var updateCustomerDebtCustomAmount = (customer, amount, callback) => {
    let updateBody = {$inc : {'debt' : -amount}};
    let query = {_id: customer};
    Customer.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
        if(e){
            callback({
                "status": 0,
                "message": e
            })
        }else{
            callback(null);
        }
    })
}
var addNewPayment = (new_order, add_amount, staff, method, callback) => {
    let paymentObj = {
        "type": "in",
        "sub_type": "debts",
        "method": method,
        "status": "success",
        "name": "Debt pay",
        "branch": new_order.branch_id,
        "amount": Number(add_amount),
        "created_at": new Date(),
        "created_from": staff,
        "customer": new_order.customer,
        "order": new_order._id,
        "parent": new_order.parent
    }
    let newPaymentData = new Payment(paymentObj);
    newPaymentData.save().then((newPayment) => {  
        callback(null)
    }).catch((e) => {
        callback({
            "status": 0,
            "message": e
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
                id: body.order_id, 
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
                    if(order.creator_id.toString() != req.user._id.toString()){
                        res.status(400).send({
                            "status": 0,
                            "message": "order must be canceled from the same staff."
                        });
                    }else{
                        if(order.status == "canceled"){
                            res.status(400).send({
                                "status": 0,
                                "message": "This order is already canceled."
                            });
                        }else if(order.type == "return"){
                            res.status(400).send({
                                "status": 0,
                                "message": "Can't cancel Return order."
                            });
                        }else if(order.status == "returned"){
                            res.status(400).send({
                                "status": 0,
                                "message": "This order can't be cancel because it returned before."
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
                                        cancelCustomProducts(order.custom_products, order.parent, function(err){
                                            if(err !== null){
                                                res.status(400).send(err);
                                            }else{
                                                //cancel order
                                                let updateBody = {
                                                    "status": "canceled",
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
                                                        updateCancelCustomerDebt(response, function(err){
                                                            if(err !== null){
                                                                res.status(400).send(err);
                                                            }else{
                                                                cancelOrderPayment(response, function(err){
                                                                    if(err !== null){
                                                                        res.status(400).send(err);
                                                                    }else{
                                                                        return res.send({
                                                                            "status": 1,
                                                                            "data": response
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
var cancelOrderPayment = (order, callback) => {
    let updateBody = {"status": "canceled"};
    let query = {order: order._id, parent: order.parent, "status": "success"};
    Payment.updateMany(query,updateBody, { new: true }, (e, response) => {
        if(e){
            callback({
                "status": 0,
                "message": e
            })
        }else{
            callback(null)
        }
    })
}
var updateCancelCustomerDebt = (new_order, callback) => {
    if(new_order.debt > 0){
        let updateBody = {$inc : {'debt' : -new_order.debt}};
        let query = {_id: new_order.customer};
        Customer.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
            if(e){
                callback({
                    "status": 0,
                    "message": e
                })
            }else{
                callback(null);
            }
        })
    }else{
        callback(null);
    }
}
/* return order. */
router.post('/return', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('126')){
        res.status(400).send({"message": "This user does not have perrmission to return order."});
    }else{
        let body = _.pick(req.body, ['order_id','branch_id','removed_products']);
        if(!body.order_id || !body.branch_id || !body.removed_products){
            res.status(400).send({"message": "Missing data, (order_id, branch_id, removed_products) field is required."});
        }else{
            let user = req.user;
            if(user.type == 'admin'){body.parent = user._id;}
            else if(user.type == 'staff'){body.parent = user.parent;}
            let query = {id: body.order_id, parent: body.parent};
            Order.findOne(query)
            .then((order) => {
                if(!order){
                    res.status(400).send({"message": "can't find any order with this order_id."});
                }else{
                    if(order.status == "canceled"){
                        res.status(400).send({"message": "This order can't be return because it canceled before."});
                    }else if(order.status == "returned"){
                        res.status(400).send({"message": "This order can't be return because it returned before."});
                    }else{
                        checkStoreConditions(body, order, function(err, store){
                            if(err !== null){
                                res.status(400).send(err);
                            }else{
                                checkSelectedBranch(user, body.branch_id, body.parent, function(err){
                                    if(err !== null){
                                        res.status(400).send(err);
                                    }else{
                                        handle_removed_products(order, body.removed_products, body.branch_id, body.parent, function(err, remains_products, remains_products_amount, remains_products_bill, remains_custom, remains_custom_amount, remains_custom_bill, remains_unregistered_products, remains_unregistered_products_amount, remains_unregistered_products_bill){
                                            if(err !== null){
                                                res.status(400).send(err);
                                            }else{
                                                //handle pre/new orders and customer debt
                                                let final_new_amount = remains_products_amount + remains_custom_amount + remains_unregistered_products_amount;
                                                let new_order_payed;
                                                let new_order_debt;
                                                let final_customer_debt = - Number(order.debt);
                                                let pay_out = 0;
                                                if(final_new_amount >= order.payed){
                                                    new_order_payed = order.payed;
                                                    new_order_debt = final_new_amount - order.payed;
                                                    final_customer_debt += new_order_debt
                                                }else{
                                                    new_order_payed = final_new_amount;
                                                    new_order_debt = 0;
                                                    pay_out = order.payed - final_new_amount;
                                                }
                                                //set order as returned
                                                let query = {id: order.id, parent: body.parent};
                                                let newData = {status: "returned"}
                                                Order.findOneAndUpdate(query,newData, { new: true })
                                                .then(updatedProduct => {
                                                    //update customer debt
                                                    addCustomerDebt(updatedProduct.customer, final_customer_debt, function(err){
                                                        if(err !== null){
                                                            return callback(err);
                                                        }else{
                                                            //create the new order
                                                            let orderObj = {
                                                                "type": "return",
                                                                "status": "success",
                                                                "method": order.method,
                                                                "customer": order.customer,
                                                                "products": remains_products,
                                                                "unregistered_products": remains_unregistered_products,
                                                                "custom_products": remains_custom,
                                                                "bill": [...remains_products_bill, ...remains_unregistered_products_bill, ...remains_custom_bill],
                                                                "prevOrderSubTotal": order.subTotal,
                                                                "prevOrderDiscountValue": order.discountValue,
                                                                "prevOrderTotal": order.total,
                                                                "subTotal": final_new_amount,
                                                                "discountValue": 0,
                                                                "total": final_new_amount,
                                                                "payed": new_order_payed,
                                                                "debt": new_order_debt,
                                                                "discountValue": 0,
                                                                "promo": false,
                                                                "createdDate": new Date(),
                                                                "branch_id": body.branch_id,
                                                                "creator_id": req.user._id,
                                                                "parentOrder": order._id,
                                                                "parent": body.parent
                                                            }
                                                            let newOrderData = new Order(orderObj);
                                                            newOrderData.save().then((newOrder) => {  
                                                                //if payout != 0 make payout for the current order/cutomer/staff
                                                                customer_Pay_out(newOrder._id, pay_out, req.user._id, newOrder.customer, body.branch_id, newOrder.parent, function(err){
                                                                    if(err !== null){
                                                                        res.status(400).send(err);
                                                                    }else{
                                                                        checkReturnCustomer(newOrder.customer, newOrder.parent, function(err, customer){
                                                                            if(err !== null){
                                                                                res.status(400).send(err);
                                                                            }else{
                                                                                single_sms(
                                                                                    newOrder.parent,
                                                                                    "Thanks for shopping with us.\nYour Returned Amount is " + pay_out + "EGP with " + new_order_debt + "EGP Debt.\nVisit https://tradket.com/bill/" + newOrder._id + " to check order bill after return.",
                                                                                    customer.phoneNumber,
                                                                                    function(error, data){
                                                                                        if (error){
                                                                                            return res.status(201).send({
                                                                                                "sms": "fail",
                                                                                                "data": {...newOrder._doc, "pay_out": pay_out}
                                                                                            });
                                                                                        }else{
                                                                                            return res.status(201).send({
                                                                                                "sms": "success",
                                                                                                "data": {...newOrder._doc, "pay_out": pay_out}
                                                                                            });
                                                                                        }
                                                                                    }
                                                                                )
                                                                            }
                                                                        })
                                                                    }
                                                                })
                                                            }).catch((e) => {
                                                                res.status(400).send({
                                                                    "status": 0,
                                                                    "message": e
                                                                });
                                                            });
                                                        }
                                                    })
                                                })
                                                .catch(err => {
                                                    res.status(400).send({
                                                        "status": 0,
                                                        "message": "error while query order data."
                                                    });
                                                });
                                            }
                                        })
                                    }
                                })
                            }
                        })
                    }
                }
            },(e) => {
                if(e.name && e.name == "CastError"){res.status(400).send({"message": "Wrong order_id value."});}
                else{res.status(400).send({"message": "error happen while query order data."});}
            });
        }
    }
});
var customer_Pay_out = (order_id, add_amount, staff, customer, branch_id, parent, callback) => {
    if(add_amount > 0){
        let paymentObj = {
            "type": "out",
            "sub_type": "return",
            "method": "cash",
            "status": "success",
            "name": "Order Return",
            "branch": branch_id,
            "amount": Number(add_amount),
            "created_at": new Date(),
            "created_from": staff,
            "customer": customer,
            "order": order_id,
            "parent": parent
        }
        let newPaymentData = new Payment(paymentObj);
        newPaymentData.save().then((newPayment) => {  
            callback(null)
        }).catch((e) => {
            callback({
                "status": 0,
                "message": e
            }, null)
        });
    }else{
        callback(null)
    }
}
var addCustomerDebt = (customer_id, new_debt, callback) => {
    if(new_debt != 0){
        let updateBody = {$inc : {'debt' : new_debt}};
        let query = {_id: customer_id};
        Customer.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
            if(e){
                callback({
                    "status": 0,
                    "message": e
                })
            }else{
                callback(null);
            }
        })
    }else{
        callback(null);
    }
}
var handle_removed_products = (order, removed_products, current_branch, parent, callback) => {
    //check removed roducts in the order && custom is not acceted
    check_removed_products_format(removed_products, function(err){
        if(err !== null){
            return callback(err);
        }else{
            let normal = [];
            let custom = [];
            let unregistered = [];
            removed_products.map((current_product)=>{
                if(!current_product.is_custom && current_product.unregistered){
                    unregistered.push(current_product)
                }else{
                    if(current_product.is_custom){
                        custom.push(current_product)
                    }else{
                        normal.push(current_product)
                    }
                }
            })
            check_prod_in_order(order, normal, function(err, remains_products, remains_products_amount, remains_products_bill){
                if(err !== null){
                    return callback(err);
                }else{
                    check_unregistered_prod_in_order(order, unregistered, function(err, remains_unregistered_products, remains_unregistered_products_amount, remains_unregistered_products_bill){
                        if(err !== null){
                            return callback(err);
                        }else{
                            check_custom_in_order(order, custom, parent, function(err, remains_custom, remains_custom_amount, remains_custom_bill){
                                if(err !== null){
                                    return callback(err);
                                }else{
                                    back_prod_to_branch(normal, current_branch, parent, function(err){
                                        if(err !== null){
                                            return callback(err);
                                        }else{
                                            cancelCustomProducts(custom, parent, function(err){
                                                if(err !== null){
                                                    res.status(400).send(err);
                                                }else{
                                                    return callback(null, remains_products, remains_products_amount, remains_products_bill, remains_custom, remains_custom_amount, remains_custom_bill, remains_unregistered_products, remains_unregistered_products_amount, remains_unregistered_products_bill);
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
var back_prod_to_branch = (productsArr, branch_id, parent, callback) => {
    if(productsArr && productsArr.length > 0){
        let fountError = false;
        let productsIds = [];
        let productsMap = {};
        productsArr.map((product)=>{
            productsIds.push(product._id);
            productsMap[product._id] = Number(product.quantity);
        })
        Product.find({'_id': { $in: productsIds}, 'parent': parent})
        .then((products) => {
            if(products.length !== productsIds.length){
                fountError = true;
                let err = {
                    "status": 0,
                    "message": "Wrong data: can't find some products, please check (_id) for each product."
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
                        newIdWithFullMap[product_id][branch_id] += Number(productsMap[product_id]);
                    }else{
                        newIdWithFullMap[product_id][branch_id] = Number(productsMap[product_id]);
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
    }else{
        return callback(null);
    } 
}
var check_custom_in_order = (order, products, parent, callback) => {
    //check all products in order
    let remains_products = [];
    let remains_products_bill = [];
    let remains_products_amount = 0;
    let products_err = false;
    let err_message = "";
    let order_prod_obj = {};
    let products_id_arr = [];
    order.custom_products.map((ele)=>{
        order_prod_obj[ele.product_id] = true;
    })
    let order_prod_price_obj = {};
    let order_prod_full_obj = {};
    order.bill.map((ele)=>{
        order_prod_price_obj[ele._id] = Number(ele.price);
        order_prod_full_obj[ele._id] = ele;
    })
    products.map((ele)=>{
        products_id_arr.push(ele._id)
        if(!order_prod_obj[ele._id]){
            products_err = true;
            err_message = `custom product with _id (${ele._id}) is not found in the order.`;
        }
    })
    if(products_err){
        let err = {"message": err_message}
        return callback(err);
    }else{
        //check if custom products still not in progress
        Custom_product.find({'_id': { $in: products_id_arr}, 'status': "assigned", 'parent': parent})
        .then((products) => {
            if(products.length !== products_id_arr.length){
                fountError = true;
                let err = {"message": "Can't return custom product with status (accepted) or (ready)"};
                return callback(err)
            }else{
                order.custom_products.map((pro)=>{
                    if(!products_id_arr.includes(pro.product_id)){
                        remains_products.push(pro)
                        remains_products_amount += order_prod_price_obj[pro.product_id]
                        remains_products_bill.push(order_prod_full_obj[pro.product_id])
                    }
                })
                return callback(null, remains_products, remains_products_amount, remains_products_bill)
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
}
var check_prod_in_order = (order, products, callback) => {
    //check all products in order
    let remains_products = [];
    let remains_products_bill = [];
    let remains_products_amount = 0;
    let products_err = false;
    let err_message = "";
    let order_prod_obj = {};
    order.products.map((ele)=>{
        order_prod_obj[ele.product_id] = ele.quantity;
    })
    let order_prod_price_obj = {};
    let order_prod_full_obj = {};
    order.bill.map((ele)=>{
        order_prod_price_obj[ele._id] = Number(ele.price);
        order_prod_full_obj[ele._id] = ele;
    })
    let removed_obj = {};
    products.map((ele)=>{
        if(!order_prod_obj[ele._id]){
            products_err = true;
            err_message = `product with _id (${ele._id}) is not found in the order.`;
        }else if(order_prod_obj[ele._id] < ele.quantity){
            products_err = true;
            err_message = `can't find enough quantity from htis product (${ele._id}) in the order, max quantity is ${order_prod_obj[ele._id]}.`;
        }else{
            removed_obj[[ele._id]] = ele.quantity
        }
    })
    if(products_err){
        let err = {"message": err_message}
        return callback(err);
    }else{
        order.products.map((pro)=>{
            if(!removed_obj[pro.product_id]){
                remains_products.push(pro)
                remains_products_amount += pro.quantity * order_prod_price_obj[pro.product_id]
                remains_products_bill.push(order_prod_full_obj[pro.product_id])
            }else if(removed_obj[pro.product_id] && (pro.quantity - removed_obj[pro.product_id] > 0)){
                let current_pro = {...pro}
                current_pro.quantity -= removed_obj[pro.product_id];
                remains_products.push(current_pro)
                remains_products_amount += current_pro.quantity * order_prod_price_obj[current_pro.product_id]
                remains_products_bill.push({
                    "_id" : current_pro.product_id,
                    "name" : order_prod_full_obj[current_pro.product_id].name,
                    "quantity" : current_pro.quantity,
                    "price" : order_prod_full_obj[current_pro.product_id].price,
                    "total" : Number(current_pro.quantity) * Number(order_prod_full_obj[current_pro.product_id].price),
                    "is_custom": false
                })
            }
        })
        return callback(null, remains_products, remains_products_amount, remains_products_bill);
    }
}
var check_unregistered_prod_in_order = (order, products, callback) => {
    //check all products in order
    let remains_unregistered_products = [];
    let remains_unregistered_products_bill = [];
    let remains_unregistered_products_amount = 0;
    let products_err = false;
    let err_message = "";
    let order_prod_obj = {};
    order.unregistered_products.map((ele)=>{
        order_prod_obj[ele.product_id] = ele.quantity;
    })
    let order_prod_price_obj = {};
    let order_prod_full_obj = {};
    order.bill.map((ele)=>{
        order_prod_price_obj[ele._id] = Number(ele.price);
        order_prod_full_obj[ele._id] = ele;
    })
    let removed_obj = {};
    products.map((ele)=>{
        if(!order_prod_obj[ele._id]){
            products_err = true;
            err_message = `product with _id (${ele._id}) is not found in the order.`;
        }else if(order_prod_obj[ele._id] < ele.quantity){
            products_err = true;
            err_message = `can't find enough quantity from this product (${ele._id}) in the order, max quantity is ${order_prod_obj[ele._id]}.`;
        }else{
            removed_obj[[ele._id]] = ele.quantity
        }
    })
    if(products_err){
        let err = {"message": err_message}
        return callback(err);
    }else{
        order.unregistered_products.map((pro)=>{
            if(!removed_obj[pro.product_id]){
                remains_unregistered_products.push(pro)
                remains_unregistered_products_amount += Number(pro.quantity) * Number(order_prod_price_obj[pro.product_id]);
                remains_unregistered_products_bill.push(order_prod_full_obj[pro.product_id])
            }else if(removed_obj[pro.product_id] && (pro.quantity - removed_obj[pro.product_id] > 0)){
                let current_pro = {...pro}
                current_pro.quantity -= removed_obj[pro.product_id];
                remains_unregistered_products.push(current_pro)
                remains_unregistered_products_amount += Number(current_pro.quantity) * Number(order_prod_price_obj[current_pro.product_id]);
                remains_unregistered_products_bill.push({
                    "_id" : current_pro.product_id,
                    "name" : order_prod_full_obj[current_pro.product_id].name,
                    "quantity" : current_pro.quantity,
                    "price" : order_prod_full_obj[current_pro.product_id].price,
                    "total" : Number(current_pro.quantity) * Number(order_prod_full_obj[current_pro.product_id].price),
                    "is_custom": false,
                    "unregistered": true
                })
            }
        })
        return callback(null, remains_unregistered_products, remains_unregistered_products_amount, remains_unregistered_products_bill);
    }
}
var check_removed_products_format = (products, callback) => {
    let fountError = false;
    if(typeof(products[0]) !== 'object'){
        if(!(typeof(products) === 'object' && products.length === 0)){
            fountError = true;
            let err = {"message": "Wrong data (removed_products) must be array of objects."}
            return callback(err);
        }
    }else{
        products.map((product)=>{
            if(!product._id){
                fountError = true;
                let err = {
                    "status": 0,
                    "message": "each object inside removed_products must have (_id) field."
                }
                return callback(err);
            }
            if((!product.quantity || isNaN(product.quantity)) && product.is_custom == false){
                fountError = true;
                let err = {
                    "status": 0,
                    "message": "each normal product inside removed_products must have (quantity) field with numeric value."
                }
                return callback(err);
            }
            if(product.is_custom != false && product.is_custom != true){
                fountError = true;
                let err = {
                    "status": 0,
                    "message": "each object inside removed_products must have (is_custom) field with true/false value."
                }
                return callback(err);
            }
        })
    }
    if(!fountError){return callback(null);}
}
var checkSelectedBranch = (user, branch_id, parent, callback) => {
    Branch.findOne({_id: branch_id, parent: parent})
    .then((branch) => {
        if(!branch){
            callback({"message": "wrong branch_id."})
        }else{
            if(!user.branches.includes(branch_id) && user.type != "admin"){
                callback({"message": "This user don't have access to this branch."})
            }else{
                callback(null)
            }
        }
    },(e) => {
        if(e.name && e.name == 'CastError'){
            callback({"message": "wrong branch_id."})
        }else{
            callback({"message": "error happen while query branch data."})
        }
    });
}
router.post('/return-old', authenticate, function(req, res, next) {
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
                id: body.order_id, 
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
                        checkReturnCustomer(body, order, function(err, customer){
                            if(err !== null){
                                res.status(400).send(err);
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
                                                                                                        body.promo = order.promo;
                                                                                                        body.promo_id = order.promo_id;
                                                                                                        body.subTotal = body.remainderProductsSubTotal + body.newProductsSubTotal;
                                                                                                        body.bill = [...body.remainderProductsBill,...body.newProductsBill];
                                                                                                        body.products = [...body.remainderProducts,...body.newProducts];
                                                                                                        checkReturnPromo(body, order.total, function(err){
                                                                                                            if(err !== null){
                                                                                                                res.status(400).send(err);
                                                                                                            }else{
                                                                                                                //create the return
                                                                                                                let orderObj = {
                                                                                                                    "type": "Return",
                                                                                                                    "customer": order.customer,
                                                                                                                    "products": body.products,
                                                                                                                    "bill": body.bill,
                                                                                                                    "prevOrderSubTotal": order.subTotal,
                                                                                                                    "prevOrderDiscountValue": order.discountValue,
                                                                                                                    "prevOrderTotal": order.total,
                                                                                                                    "subTotal": body.subTotal.toFixed(2),
                                                                                                                    "total": body.total.toFixed(2),
                                                                                                                    "amount_out": body.amount_out.toFixed(2),
                                                                                                                    "amount_in": body.amount_in.toFixed(2),
                                                                                                                    "discountValue": body.discountValue.toFixed(2),
                                                                                                                    "promo": body.promo,
                                                                                                                    "createdDate": new Date(),
                                                                                                                    "branch_id": body.branch_id,
                                                                                                                    "creator_id": req.user._id,
                                                                                                                    "canceled": false,
                                                                                                                    "returned": false,
                                                                                                                    "parentOrder": order._id,
                                                                                                                    "parent": body.parent
                                                                                                                }
                                                                                                                if(body.promo && body.promo_id != undefined){
                                                                                                                    orderObj.promo_id = body.promo_id
                                                                                                                }
                                                                                                                if(body.returnNote){
                                                                                                                    orderObj.returnNote = body.returnNote;
                                                                                                                }
                                                                                                                let newOrderData = new Order(orderObj);
                                                                                                                newOrderData.save().then((newOrder) => {    
                                                                                                                    let query = {id: order.id, parent: body.parent};
                                                                                                                    let newData = {returned: true, returnedDate: new Date()}
                                                                                                                    Order.findOneAndUpdate(query,newData, { new: true })
                                                                                                                    .then(updatedProduct => {
                                                                                                                        single_sms(
                                                                                                                            newOrder.parent,
                                                                                                                            "Thanks for shopping with us.\nYour Returned amount is " + newOrder.amount_out + "EGP.\nVisit https://tradket.com/bill/" + newOrder._id + " to check order bill after return.",
                                                                                                                            customer.phoneNumber,
                                                                                                                            function(error, data){
                                                                                                                                if (error){
                                                                                                                                    return res.status(201).send({
                                                                                                                                        "sms": "fail",
                                                                                                                                        "data": newOrder
                                                                                                                                    });
                                                                                                                                }else{
                                                                                                                                    return res.status(201).send({
                                                                                                                                        "sms": "success",
                                                                                                                                        "data": newOrder
                                                                                                                                    });
                                                                                                                                }
                                                                                                                            }
                                                                                                                        )
                                                                                                                    })
                                                                                                                    .catch(err => {
                                                                                                                        res.status(400).send({
                                                                                                                            "status": 0,
                                                                                                                            "message": "error while query order data."
                                                                                                                        });
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
var checkReturnCustomer = (customer, parent, callback) => {
    Customer.findOne({_id: customer, parent: parent})
    .then((customer) => {
        if(!customer){
            callback({
                "status": 0,
                "message": "error happen while query customer data."
            }, null)
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
    let full_obj_by_id = {};
    newProducts.map((product)=>{
        productsArr.push(product.product_id)
        productsQuantityMap[product.product_id] = product.quantity;
        full_obj_by_id[product.product_id] = product;
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
                    finalProductsQuantityMap[singleProduct._id] = newMapObj;
                    let single_final_price;
                    if(full_obj_by_id[singleProduct._id].final_price && !isNaN(full_obj_by_id[singleProduct._id].final_price)){
                        single_final_price = full_obj_by_id[singleProduct._id].final_price
                    }else{
                        single_final_price = singleProduct.price
                    }
                    bill.push({
                        "_id": singleProduct._id,
                        "name": singleProduct.name,
                        "quantity": productsQuantityMap[singleProduct._id.toString()],
                        "price": single_final_price,
                        "total": productsQuantityMap[singleProduct._id.toString()] * single_final_price
                    })
                    totalPrice += productsQuantityMap[singleProduct._id.toString()] * single_final_price;
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
    let full_obj_by_id = {};
    orderProducts.map((product)=>{
        orderProductsMap[product.product_id] = product.quantity;
        full_obj_by_id[product.product_id] = product;
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
            if(full_obj_by_id[key].final_price){
                remainderProducts.push({"product_id": key, "quantity": orderProductsMap[key], "final_price": full_obj_by_id[key].final_price})
            }else{
                remainderProducts.push({"product_id": key, "quantity": orderProductsMap[key]})
            }
        }
    })
    if(!fountError){return callback(null,remainderProducts);}
}
var remainderProductsBill = (body, newProducts, callback) => {
    let fountError = false;
    let productsArr = [];
    let productsQuantityMap = {};
    let full_obj_by_id = {};
    newProducts.map((product)=>{
        productsArr.push(product.product_id)
        productsQuantityMap[product.product_id] = product.quantity;
        full_obj_by_id[product.product_id] = product;
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
                    newMapObj[body.branch_id] -= productsQuantityMap[singleProduct._id.toString()];
                    let single_final_price;
                    if(full_obj_by_id[singleProduct._id].final_price && !isNaN(full_obj_by_id[singleProduct._id].final_price)){
                        single_final_price = full_obj_by_id[singleProduct._id].final_price
                    }else{
                        single_final_price = singleProduct.price
                    }
                    bill.push({
                        "_id": singleProduct._id,
                        "name": singleProduct.name,
                        "quantity": productsQuantityMap[singleProduct._id.toString()],
                        "price": single_final_price,
                        "total": productsQuantityMap[singleProduct._id.toString()] * single_final_price
                    })
                    totalPrice += productsQuantityMap[singleProduct._id.toString()] * single_final_price;
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
var noPromoCalac = (body, paidAmount, callback) => {
    //no promo
    let amount_out,amount_in;
    if(paidAmount - body.subTotal < 0){
        amount_in = Math.abs(paidAmount - body.subTotal);
        amount_out = 0;
    }else{
        amount_in = 0;
        amount_out = Math.abs(paidAmount - body.subTotal);
    }
    body.discountValue = 0;
    body.total = body.subTotal;
    body.amount_out = amount_out;
    body.amount_in = amount_in;
    callback(null);
}
var checkReturnPromo = (body,paidAmount, callback) => {
    if(body.promo == false){
        //no promo
        noPromoCalac(body, paidAmount, function(err){
            callback(null);  
        })
    }else{
        //promo
        Promo.findOne({_id: body.promo_id, parent: body.parent})
        .then((promo) => {
            if(!promo){
                callback({
                    "status": 0,
                    "message": "wrong promo_id."
                })
            }else{
                body.promoData = promo;
                checkReturnPromoDate(body, function(errDate){
                    if(errDate !== null){
                        noPromoCalac(body, paidAmount, function(err){
                            body.returnNote = errDate;
                            callback(null);  
                        })
                    }else{
                        checkReturnPromoCustomer(body, function(errCustomer){
                            if(errCustomer !== null){
                                noPromoCalac(body, paidAmount, function(err){
                                    body.returnNote = errCustomer;
                                    callback(null);  
                                })
                            }else{
                                checkReturnPromoBranch(body, function(errBranch){
                                    if(errBranch !== null){
                                        noPromoCalac(body, paidAmount, function(err){
                                            body.returnNote = errBranch;
                                            callback(null);  
                                        })
                                    }else{
                                        calcReturnPromoDiscount(body, paidAmount, function(errDiscount){
                                            if(errDiscount !== null){
                                                noPromoCalac(body, paidAmount, function(err){
                                                    body.returnNote = errDiscount;
                                                    callback(null);  
                                                })
                                            }else{
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
var calcReturnPromoDiscount = (body, paidAmount, callback) => {
    if(body.promoData.productsType == "ALL"){
        let billTotal = 0;
        body.bill.map((product) => {
            billTotal += product.total;
        })
        calcReturnBillDiscount(billTotal, body.promoData, body, paidAmount, function(err){
            if(err !== null){
                callback(err);
            }else{
                callback(null)
            }
        })
    }else if(body.promoData.productsType == "SELECTED"){
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
        calcReturnBillDiscount(billTotal, body.promoData, body, paidAmount, function(err){
            if(err !== null){
                callback(err);
            }else{
                callback(null)
            }
        })
    }else{
        callback("Wronge productsType in promo data.")
    }
}
var calcReturnBillDiscount = (total, promo, body, paidAmount, callback) => {
    if(total < promo.limit){
        callback("Products total must be more than: (" + promo.limit + "), your bill total is : (" + total + ").")
    }else{
        if(promo.discountType == "VALUE"){
            body.promo_id = promo._id;
            body.discountValue = promo.discountValue;

            let totalAmount,amount_out,amount_in;
            if((paidAmount + body.discountValue) - body.subTotal < 0){
                totalAmount = Math.abs(body.subTotal - body.discountValue);
                amount_in = Math.abs((paidAmount + body.discountValue) - body.subTotal);
                amount_out = 0;
            }else{
                totalAmount = Math.abs(body.subTotal - body.discountValue);
                amount_in = 0;
                amount_out = Math.abs((paidAmount + body.discountValue) - body.subTotal);
            }
            body.total = totalAmount;
            body.amount_in = amount_in;
            body.amount_out = amount_out;
            callback(null);
        }else if(promo.discountType == "PERCENTAGE"){
            body.promo_name = promo.name;
            body.discountValue = total * (promo.discountValue/100);
            let totalAmount,amount_out,amount_in;
            if((paidAmount + body.discountValue) - body.subTotal < 0){
                totalAmount = Math.abs(body.subTotal - body.discountValue);
                amount_in = Math.abs((paidAmount + body.discountValue) - body.subTotal);
                amount_out = 0;
            }else{
                totalAmount = Math.abs(body.subTotal - body.discountValue);
                amount_in = 0;
                amount_out = Math.abs((paidAmount + body.discountValue) - body.subTotal);
            }
            body.total = totalAmount;
            body.amount_in = amount_in;
            body.amount_out = amount_out;
            callback(null);
        }else{
            callback("Wrong discountType value.")
        }
    }
}
var checkReturnPromoDate = (body, callback) => {
    let current = new Date();
    if(new Date(body.promoData.startDate).getTime() > current.getTime()){
        callback("promo will be valid at: " + body.promoData.startDate)
    }else if(new Date(body.promoData.endDate).getTime() < current.getTime()){
        callback("promo expired at: " + body.promoData.endDate)
    }else{
        callback(null);
    }
}
var checkReturnPromoCustomer = (body, callback) => {
    if(body.promoData.customerType == "ALL"){
        callback(null)
    }else if(body.promoData.customerType == "SELECTED"){
        if(body.promoData.customers.includes(body.customer_id)){
            callback(null)
        }else{
            callback("Promo: (" + body.promoData.name + ") is not valid for this customer.")
        }
    }else{
        callback("Wronge customerType in promo data.")
    }
}
var checkReturnPromoBranch = (body, callback) => {
    if(body.promoData.branchesType == "ALL"){
        callback(null)
    }else if(body.promoData.branchesType == "SELECTED"){
        if(body.promoData.branches.includes(body.branch_id)){
            callback(null)
        }else{
            callback("Promo: (" + body.promoData.name + ") is not valid in this branch.")
        }
    }else{
        callback("Wronge branchesType in promo data.")
    }
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
            sort: { createdDate: -1 },
            populate: [
                { path: 'customer', select: ['name', 'phoneNumber'] },
                { path: 'branch_id', select: ['name', 'phoneNumber', 'address', 'type'] },
                { path: 'creator_id', select: ['name', 'email'] }
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
        if(req.query.id){filters.id={ $regex: new RegExp(req.query.id), $options: "i" }}
        if(req.query.status){filters.status = req.query.status}
        if(req.query.creator_id){filters.creator_id = req.query.creator_id}
        if(req.query.branch_id){filters.branch_id = req.query.branch_id}
        if(req.query.customer_id){filters.customer = req.query.customer_id}
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
router.get('/bill', function(req, res, next){
    if(!req.query._id){
        res.status(400).send({
            "status": 0,
            "message": "Missing data, (_id) field is required."
        });
    }else{
        let filters = {_id: req.query._id}
        Order.findOne(filters)
        .then((order) => {
            if(!order){
                res.status(400).send({
                    "message": "can't find any order with this _id."
                });
            }else{
                Customer.findOne({_id: order.customer, parent: order.parent})
                .then((customer) => {
                    if(!customer){
                        res.status(400).send({
                            "status": 0,
                            "message": "error happen while query customer data."
                        }, null)
                    }else{
                        order.customer = customer;
                        return res.send({
                            "data": order
                        });
                    }
                },(e) => {
                    res.status(400).send({
                        "status": 0,
                        "message": "error happen while query customer data."
                    }, null)
                });
            }
        },(e) => {
            res.status(400).send({
                "message": "can't find any order with this _id."
            });
        });
    }
});
router.get('/summary', authenticate, function(req, res, next){
    if(!req.query.date_from || !req.query.date_to){
        res.status(400).send({
            "status": 0,
            "message": "Missing data, (date_from, date_to) field is required."
        });
    }else{
        let user = req.user;
        let body = _.pick(req.query, ['date_from','date_to','branch_id','staff_id']);
        if(req.user.type == 'admin'){
            body.parent = req.user._id;
        }else if(req.user.type == 'staff'){
            body.parent = req.user.parent;
        }
        if(new Date(req.query.date_from) == "Invalid Date" || new Date(body.date_to) == "Invalid Date"){
            res.status(400).send({
                "status": 0,
                "message": "Invalid Date format."
            });
        }else{
            let filters = { 
                parent: body.parent,
                createdDate: {
                    $gte: new Date(body.date_from),
                    $lte: new Date(body.date_to)
                }
            };
            if(body.branch_id){filters.branch_id = body.branch_id}
            if(body.staff_id){filters.creator_id = body.staff_id}
            Order.find(filters)
            .then((orders) => {
                let total_success_amount = 0;
                let total_count = 0;
                let total_success_count = 0;
                let total_canceled_count = 0;
                let total_returned_count = 0;
                orders.map((order)=>{
                    total_count += 1;
                    if(order.status == "success"){
                        total_success_amount += order.total;
                        total_success_count += 1;
                    }else if(order.status == "canceled"){
                        total_canceled_count += 1;
                    }else if(order.status == "returned"){
                        total_returned_count += 1;
                    }
                })
                return res.send({
                    "total_success_amount": total_success_amount,
                    "total_count": total_count,
                    "total_success_count": total_success_count,
                    "total_canceled_count": total_canceled_count,
                    "total_returned_count": total_returned_count
                });
            },(e) => {
                res.status(400).send({
                    "message": "error happen while calc orders summary."
                });
            });
        }
    }
});

router.get('/search_id', authenticate, function(req, res, next){
    if(!req.query.id){
        return res.send({
            "data": []
        });
    }else{
        let parent;
        if(req.user.type == 'admin'){
            parent = req.user._id;
        }else if(req.user.type == 'staff'){
            parent = req.user.parent;
        }
        let filters = [
            {
              $addFields: {
                tempId: { $toString: '$id' },
              }
            },
            {
              $match: {
                tempId: { $regex: req.query.id, $options: "i" },
                parent: parent
              }
            },
            { $limit : 10 }
          ]
        Order.aggregate(filters)
        .then((order) => {
            if(!order){
                res.status(400).send({
                    "message": "can't find any order with this id."
                });
            }else{
                return res.send({
                    "data": order
                });
            }
        },(e) => {
            res.status(400).send({
                "message": "can't find any order with this _id."
            });
        });
    }
});

module.exports = router;
