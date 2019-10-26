const fs = require('fs');
var express = require('express');
var router = express.Router();
const _ = require('lodash');
let {ProductGroup} = require('../db/models/productGroup');
let {Store} = require('../db/models/store');
let {Product} = require('../db/models/product');
let {Branch} = require('../db/models/branch');
let {Category} = require('../db/models/category');
let {SubCategory} = require('../db/models/subCategory');
let {authenticate} = require('../middleware/authenticate');


router.post('/add', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('116')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to create new product."
        });
    }else{
        let body = _.pick(req.body, ['_id','branch_id','quantity']);
        
        if(!body._id || !body.branch_id || !body.quantity){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (_id, branch_id, quantity) fields are required."
            });
        }else{
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            Product.findOne({_id: body._id, parent: body.parent})
            .then((product) => {
                if(!product){
                    res.status(400).send({
                        "status": 0,
                        "message": "you don't have any product with this _id."
                    });
                }else{
                    Branch.findOne({_id: body.branch_id, parent: body.parent})
                    .then((branch) => {
                        if(!branch){
                            res.status(400).send({
                                "status": 0,
                                "message": "you don't have any branch with this branch_id."
                            });
                        }else{
                            if(isNaN(body.quantity) || parseInt(body.quantity) <= 0){
                                res.status(400).send({
                                    "status": 0,
                                    "message": "wrong quantity value, must be integer more than 0."
                                });
                            }else{
                                let oldMap = product.map;
                                if(Object.keys(oldMap).includes(body.branch_id)){
                                    oldMap[body.branch_id] += parseInt(body.quantity);
                                }else{
                                    oldMap[body.branch_id] = parseInt(body.quantity);
                                }
                                let newMap = oldMap;
                                let newQuantity = product.quantity + parseInt(body.quantity);
                                let query = {_id: body._id, parent: body.parent};
                                let newData = {map: newMap, quantity: newQuantity}
                                Product.findOneAndUpdate(query,newData, { new: true })
                                .then(updatedProduct => {
                                    return res.send({
                                        "status": 1,
                                        "data": {"productData": updatedProduct}
                                    });
                                })
                                .catch(err => {
                                    res.status(400).send({
                                        "status": 0,
                                        "message": "error while query product data."
                                    });
                                }); 
                            }
                        }
                    },(e) => {
                        res.status(400).send({
                            "status": 0,
                            "message": "you don't have any branch with this branch_id."
                        });
                    });
                }
            },(e) => {
                res.status(400).send({
                    "status": 0,
                    "message": "you don't have any product with this _id."
                });
            });
        }
    }
});

/* edit products. */
router.post('/edit', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('117')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to edit product."
        });
    }else{
        let body = _.pick(req.body, ['product_id','name','price','features','active']);
        if(!body.product_id){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (product_id) field is required."
            });
        }else{
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            Product.findOne({parent: body.parent, _id: body.product_id})
            .then((product) => {
                if(!product){
                    res.status(400).send({
                        "status": 0,
                        "message": "can't find any product with this _id."
                    });
                }else{
                    let updateBody = {};
                    if(body.name){updateBody.name = body.name}
                    if(body.price){updateBody.price = body.price}
                    if(body.active){updateBody.active = body.active}
                    if(body.features){
                        if(typeof(body.features) !== 'object'){
                            res.status(400).send({
                                "status": 0,
                                "message": "Wrong data (features) must be object."
                            });
                        }else{
                            let newFeaturesObj = {...product.features};
                            Object.keys(body.features).map((key)=>{
                                if(Object.keys(product.features).includes(key)){
                                    newFeaturesObj[key] = body.features[key];
                                }
                            });
                            updateBody.features = {...newFeaturesObj}
                            editProduct(res, body, updateBody);
                        }
                    }else{
                        editProduct(res, body, updateBody);
                    }    
                }
            },(e) => {
                res.status(400).send({
                    "status": 0,
                    "message": "can't find any product with this _id."
                });
            }); 
        }
    }
});
var editProduct = (res, body, updateBody) => {
    let query;
    query = {_id: body.product_id, parent: body.parent};
    Product.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
        if(e){
            if(e.name && e.name == "CastError"){
                res.status(400).send({
                    "status": 0,
                    "message": e.message
                });
            }else{
                res.status(400).send({
                    "status": 0,
                    "message": "error while updating product data."
                });
            }
        }else{
            if(response == null){
                res.status(400).send({
                    "status": 0,
                    "message": "can't find any product with this product_id."
                });
            }else{
                return res.send({
                    "status": 1,
                    "data": {"ProductData": response}
                });   
            }
        }
    })       
}
/* list products. */
router.get('/search', authenticate, function(req, res, next){
    if(!req.user.permissions.includes('115')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to view products."
        });
    }else{
        if(!req.query._id){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (_id) field is required."
            });
        }else{
            let parent;
            if(req.user.type == 'admin'){
                parent = req.user._id;
            }else if(req.user.type == 'staff'){
                parent = req.user.parent;
            }
            let filters = {parent: parent, _id: req.query._id}
            // if(req.query.branch_id){
            //     filters.$where = 'function() { return Object.keys(this.map).includes("' + req.query.branch_id + '");}';
            //     // filters.$where = function(){return Object.keys(this.map).includes(req.query.branch_id)}
            // }
            Product.findOne(filters)
            .then((productGroup) => {
                if(!productGroup){
                    res.status(400).send({
                        "status": 0,
                        "message": "can't find any product with this _id."
                    });
                }else{
                    if(Object.keys(productGroup.map).includes(req.query.branch_id)){
                        return res.send({
                            "status": 1,
                            "data": productGroup
                        });
                    }else{
                        res.status(400).send({
                            "status": 0,
                            "message": "this product ran out from this branch. try to search in the other branches."
                        });
                    }
                }
            },(e) => {
                console.log(e)
                res.status(400).send({
                    "status": 0,
                    "message": "can't find any product with this _id."
                });
            });
        }
    }
});
module.exports = router;
