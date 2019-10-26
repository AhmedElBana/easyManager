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
        let body = _.pick(req.body, ['productGroup_id','name','category_id','subCategory_id','description','features','active']);
        if(!body.productGroup_id || !body.category_id){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (productGroup_id, category_id) field is required."
            });
        }else{
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            Category.findOne({_id: body.category_id, parent: body.parent})
            .then((category) => {
                if(!category){
                    res.status(400).send({
                        "status": 0,
                        "message": "you don't have any category with this category_id."
                    });
                }else{
                    if(body.subCategory_id){
                        SubCategory.findOne({_id: body.subCategory_id, category_id: body.category_id,parent: body.parent})
                        .then((subCategory) => {
                            if(!subCategory){
                                res.status(400).send({
                                    "status": 0,
                                    "message": "you don't have any subCategory with this subCategory_id and category_id."
                                });
                            }else{
                                editProductGroup(res,body);
                            }
                        },(e) => {
                            res.status(400).send({
                                "status": 0,
                                "message": "you don't have any subCategory with this subCategory_id and category_id."
                            });
                        });
                    }else{
                        editProductGroup(res,body);
                    }
                }
            },(e) => {
                res.status(400).send({
                    "status": 0,
                    "message": "you don't have any category with this category_id."
                });
            });
            
        }
    }
});
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
