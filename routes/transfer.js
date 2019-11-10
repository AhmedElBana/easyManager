var express = require('express');
var router = express.Router();
const _ = require('lodash');
let {Product} = require('./../db/models/product');
let {Branch} = require('./../db/models/branch');
let {Transfer} = require('./../db/models/transfer');
let {authenticate} = require('../middleware/authenticate');

/* Create new transfer. */
router.post('/create', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('120')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to create new transfer."
        });
    }else{
        let body = _.pick(req.body, ['source_id','target_id','products','expectedDeliveryTime']);
        if(!body.source_id || !body.target_id || !body.products || !body.expectedDeliveryTime){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (source_id, target_id, products, expectedDeliveryTime) fields are required."
            });
        }else{
            body.creator_id = req.user._id;
            body.createdAt = new Date();
            body.lastUpdate = new Date();
            body.status = "inProgress";
            body.actionsMap = [{"user_id": body.creator_id, "date": body.createdAt, "action": "create"}]
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            if(new Date(body.expectedDeliveryTime)  == 'Invalid Date'){
                res.status(400).send({
                    "status": 0,
                    "message": "Wrong data: (expectedDeliveryTime) must be valid date."
                });
            }else{
                body.expectedDeliveryTime = new Date(body.expectedDeliveryTime);
                checkBranches(body,function(err){
                    if(err !== null){
                        res.status(400).send(err);
                    }else{
                        checkProductsFormat(body, function(err){
                            if(err !== null){
                                res.status(400).send(err);
                            }else{
                                checkProductsAvailability(body, function(err){
                                    if(err !== null){
                                        res.status(400).send(err);
                                    }else{
                                        removeProducts(body, function(err){
                                            if(err !== null){
                                                res.status(400).send(err);
                                            }else{
                                                //create the transfer
                                                let newTransferData = new Transfer(body);
                                                newTransferData.save().then((newTransfer) => {                
                                                    return res.status(201).send({
                                                        "status": 1,
                                                        "data": {"transferData": newTransfer}
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
                });
            }
        }
    }
});
/* accept transfer. */
router.get('/accept', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('121')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to accept transfer."
        });
    }else{
        if(!req.query.transfer_id){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (transfer_id) field is required."
            });
        }else{
            let parent;
            if(req.user.type == 'admin'){
                parent = req.user._id;
            }else if(req.user.type == 'staff'){
                parent = req.user.parent;
            }
            Transfer.findOne({'_id': req.query.transfer_id, 'parent': parent})
            .then((transfer) => {
                if(!transfer){
                    res.status(400).send({
                        "status": 0,
                        "message": "can't find any transfer with this transfer_id."
                    });
                }else{
                    if(transfer.status != "inProgress"){
                        res.status(400).send({
                            "status": 0,
                            "message": "can't accept this transfer ( " + transfer.status +" transfer)."
                        });
                    }else{
                        addProducts(transfer.products, parent, transfer.target_id, function(err){
                            if(err !== null){
                                res.status(400).send(err);
                            }else{
                                let newActionsMap = [...transfer.actionsMap,{"user_id": req.user._id, "date": new Date(), "action": "accept"}];
                                let updateBody = {
                                    "status": "completed",
                                    "lastUpdate": new Date(),
                                    "actionsMap": newActionsMap
                                };
                                let query = {_id: transfer._id};
                                Transfer.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
                                    if(response == null){
                                        res.status(400).send({
                                            "status": 0,
                                            "message": "error happen while update transfer data."
                                        });
                                    }else{
                                        return res.send({
                                            "status": 1,
                                            "data": {"transferData": response}
                                        });   
                                    }
                                })
                            }
                        })
                    }
                }
            },(e) => {
                let err;
                if(e.name && e.name == 'CastError'){
                    res.status(400).send({
                        "status": 0,
                        "message": "Wrong value: (" + e.value + ") is not valid transfer id."
                    });
                }else{
                    res.status(400).send({
                        "status": 0,
                        "message": "error hanppen while query transfer data."
                    });
                }
            });
        }
    }
});
/* cancel transfer. */
router.get('/cancel', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('122')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to cancel transfer."
        });
    }else{
        if(!req.query.transfer_id){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (transfer_id) field is required."
            });
        }else{
            let parent;
            if(req.user.type == 'admin'){
                parent = req.user._id;
            }else if(req.user.type == 'staff'){
                parent = req.user.parent;
            }
            Transfer.findOne({'_id': req.query.transfer_id, 'parent': parent})
            .then((transfer) => {
                if(!transfer){
                    res.status(400).send({
                        "status": 0,
                        "message": "can't find any transfer with this transfer_id."
                    });
                }else{
                    if(transfer.status != "inProgress"){
                        res.status(400).send({
                            "status": 0,
                            "message": "can't cancel this transfer ( " + transfer.status +" transfer)."
                        });
                    }else{
                        addProducts(transfer.products, parent, transfer.source_id, function(err){
                            if(err !== null){
                                res.status(400).send(err);
                            }else{
                                let newActionsMap = [...transfer.actionsMap,{"user_id": req.user._id, "date": new Date(), "action": "cancel"}];
                                let updateBody = {
                                    "status": "canceled",
                                    "lastUpdate": new Date(),
                                    "actionsMap": newActionsMap
                                };
                                let query = {_id: transfer._id};
                                Transfer.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
                                    if(response == null){
                                        res.status(400).send({
                                            "status": 0,
                                            "message": "error happen while update transfer data."
                                        });
                                    }else{
                                        return res.send({
                                            "status": 1,
                                            "data": {"transferData": response}
                                        });   
                                    }
                                })
                            }
                        })
                    }
                }
            },(e) => {
                let err;
                if(e.name && e.name == 'CastError'){
                    res.status(400).send({
                        "status": 0,
                        "message": "Wrong value: (" + e.value + ") is not valid transfer id."
                    });
                }else{
                    res.status(400).send({
                        "status": 0,
                        "message": "error hanppen while query transfer data."
                    });
                }
            });
        }
    }
});
/* list transfer. */
router.get('/list', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('119')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to view transfers."
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
        Transfer.paginate(filters, options, function(err, result) {
            let next;
            if(result.hasNextPage){
                next = "https://" + req.headers.host + "/api/transfer/list?page=" + result.nextPage + "&page_size=" + page_size;
            }else{next = null;}
            let prev;
            if(result.hasPrevPage){
                prev = "https://" + req.headers.host + "/api/transfer/list?page=" + result.prevPage + "&page_size=" + page_size;
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
async function removeProducts(body, callback) {
    Object.keys(body.finalProductsQuantityMap).map((product_id)=>{
        updateOneProduct(product_id,body.finalProductsQuantityMap[product_id]);
    })
    callback(null);
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
                    if(!singleProduct.map[body.source_id] || singleProduct.map[body.source_id] < productsQuantityMap[singleProduct._id.toString()]){
                        fountError = true;
                        let err = {
                            "status": 0,
                            "message": "can't find enough quantity from this product (" + singleProduct._id.toString() +")."
                        };
                        return callback(err)
                    }
                })
                products.map((singleProduct) => {
                    var newMapObj = {...singleProduct.map};
                    newMapObj[body.source_id] -= productsQuantityMap[singleProduct._id.toString()]
                    finalProductsQuantityMap[singleProduct._id] = newMapObj
                })
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
var checkProductsFormat = (body, callback) => {
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
var checkBranches = (body, callback) => {
    if(body.source_id === body.target_id){
        let err = {
            "status": 0,
            "message": "can't transfer products to the same branch."
        };
        return callback(err)
    }else{
        Branch.find({'_id': { $in: [body.source_id, body.target_id]}, 'parent': body.parent})
        .then((branches) => {
            if(branches.length !== 2){
                let err;
                let foundedIds = [];
                branches.map((branch)=>{
                    foundedIds.push(branch._id.toString())
                })
                if(!foundedIds.includes(body.source_id)){
                    err = {
                        "status": 0,
                        "message": "can't find any branch with this (source_id)."
                    };
                }else if(!foundedIds.includes(body.target_id)){
                    err = {
                        "status": 0,
                        "message": "can't find any branch with this (target_id)."
                    };
                }else{
                    err = {
                        "status": 0,
                        "message": "error hanppen while query branches data."
                    };
                }
                return callback(err)
            }else{
                return callback(null)
            }
        },(e) => {
            let err;
            if(e.name && e.name == 'CastError'){
                err = {
                    "status": 0,
                    "message": "Wrong value: (" + e.value + ") is not valid baranch id."
                };
            }else{
                err = {
                    "status": 0,
                    "message": "error hanppen while query branches data."
                };
            }
            return callback(err)
        });
    }
}
// updateOneProduct used with removeProducts/addProducts
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
module.exports = router;
