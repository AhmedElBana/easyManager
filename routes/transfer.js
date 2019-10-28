var express = require('express');
var router = express.Router();
const _ = require('lodash');
let {Product} = require('./../db/models/product');
let {Branch} = require('./../db/models/branch');
let {Transfer} = require('./../db/models/transfer');
let {authenticate} = require('../middleware/authenticate');

/* Create new branch. */
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
            console.log(body)
            checkBranches(body,function(err){
                if(err !== null){
                    res.status(400).send(err);
                }else{
                    console.log('branches ready to gooo');
                    checkProductsFormat(body, function(err){
                        if(err !== null){
                            res.status(400).send(err);
                        }else{
                            checkProductsAvailability(body, function(err){
                                if(err !== null){
                                    res.status(400).send(err);
                                }else{
                                    console.log('products Availability ready to gooo');
                                }
                            })
                            console.log('products ready to gooo');
                        }
                    })
                }
            });
            // let newBranchData = new Branch(body);
            // newBranchData.save().then((newBranch) => {                
            //     return res.status(201).send({
            //         "status": 1,
            //         "data": {"branchData": newBranch}
            //     });
            // }).catch((e) => {
            //     if(e.code){
            //         if(e.code == 11000){
            //             if(e.errmsg.includes("phoneNumber")){
            //                 res.status(400).send({
            //                     "status": 0,
            //                     "message": "This phone number is already exist."
            //                 });
            //             }else{
            //                 res.status(400).send({
            //                     "status": 0,
            //                     "message": e
            //                 });
            //             }
            //         }else{
            //             res.status(400).send({
            //                 "status": 0,
            //                 "message": e
            //             });
            //         }
            //     }else{
            //         res.status(400).send({
            //             "status": 0,
            //             "message": e
            //         });
            //     }
            // });
        }
    }
});
var checkProductsAvailability = (body, callback) => {
    let productsArr = [];
    let productsQuantityMap = {};
    body.products.map((product)=>{
        productsArr.push(product.product_id)
        productsQuantityMap[product.product_id] = product.quantity;
    })
    Product.find({'_id': { $in: productsArr}, 'parent': body.parent})
        .then((products) => {
            console.log(products);
            if(products.length !== productsArr.length){
                let err = {
                    "status": 0,
                    "message": "Wrong data: can't find some products, please check (product_id) for each product."
                };
                return callback(err)
            }else{
                products.map((singleProduct) => {
                    if(!singleProduct.map[body.source_id] || singleProduct.map[body.source_id] < productsQuantityMap[singleProduct._id.toString()]){
                        let err = {
                            "status": 0,
                            "message": "can't find enough quantity from this product (" + singleProduct._id.toString() +")."
                        };
                        return callback(err)
                    }
                })
                return callback(null)
            }
        },(e) => {
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
