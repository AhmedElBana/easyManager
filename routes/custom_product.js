const fs = require('fs');
var express = require('express');
var router = express.Router();
const _ = require('lodash');
let {Store} = require('../db/models/store');
let {Custom_product} = require('../db/models/custom_product');
let {Product} = require('../db/models/product');
let {Branch} = require('../db/models/branch');
let {Category} = require('../db/models/category');
let {SubCategory} = require('../db/models/subCategory');
let {authenticate} = require('../middleware/authenticate');

var mongo = require('mongodb'),
ObjectID = mongo.ObjectID;
var multer  = require('multer')
const storage = multer.diskStorage({
    destination: function(req, file, cb){
        cb(null, './uploads/');
    },
    filename: function(req, file, cb){
        cb(null, new ObjectID().toString() + file.originalname);
    }
})
const fileFilter = (req, file, cb)=>{
    var type = file.mimetype;
    var typeArray = type.split("/");
    if (typeArray[0] == "image") {
        cb(null, true);
    }else {
        cb(null, false);
    }
};
var upload = multer({
    storage: storage, 
    limits: {
        fileSize: 1024 * 1024 * 5 
    },
    fileFilter: fileFilter
});
/* create Custom_product. */
router.post('/create', authenticate, upload.array('image', 50), function(req, res, next) {
    if(!req.user.permissions.includes('133')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to create new custom product."
        });
    }else{
        let body = _.pick(req.body, ['name','branch','price','quantity','materials_branch','materials','deadline','features','image','description']);
        
        let images = [];
        body.images_size = 0;
        if(req.files){
            let imagesSize = 0;
            if(req.files.length > 0){
                req.files.map((photo)=>{
                    imagesSize += photo.size;
                    images.push("https://" + req.headers.host + "/" + photo.path)
                })
                body.images_size = imagesSize * (1/(1024*1024));//MB
            }
        }
        body.images = images;
        if(!body.name || !body.branch || !body.price || !body.quantity || !body.materials_branch || !body.materials || !body.deadline || !body.features || !body.description){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (name, branch, price, quantity, materials_branch, materials, deadline, features, description) fields are required."
            });
        }else{
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            body.active = true;
            check_features(body,function(err){
                if(err !== null){
                    res.status(400).send(err);
                }else{
                    check_deadline(body, function(err){
                        if(err !== null){
                            res.status(400).send(err);
                        }else{
                            checkBranch(body,function(err){
                                if(err !== null){
                                    res.status(400).send(err);
                                }else{
                                    checkMaterialsBranch(body,function(err){
                                        if(err !== null){
                                            res.status(400).send(err);
                                        }else{
                                            check_materials(body,function(err){
                                                if(err !== null){
                                                    res.status(400).send(err);
                                                }else{
                                                    calcStorage(res,body,function(err){
                                                        if(err !== null){
                                                            res.status(400).send(err);
                                                        }else{
                                                            removeProducts(body,function(err){
                                                                if(err !== null){
                                                                    res.status(400).send(err);
                                                                }else{
                                                                    //create the custom roduct
                                                                    let custom_roduct_obj = {
                                                                        "_id": new ObjectID().toString(),
                                                                        "name": body.name,
                                                                        "branch": body.branch,
                                                                        "price": body.price,
                                                                        "quantity": body.quantity,
                                                                        "materials_branch": body.materials_branch,
                                                                        "materials": body.materials,
                                                                        "status": "created",
                                                                        "created_at": new Date(),
                                                                        "created_from": req.user._id,
                                                                        "deadline": body.deadline,
                                                                        "features": body.features,
                                                                        "images": body.images,
                                                                        "description": body.description,
                                                                        "parent": body.parent,
                                                                        "active": true
                                                                    }
                                                                    let custom_roduct_data = new Custom_product(custom_roduct_obj);
                                                                    custom_roduct_data.save().then((final_custom_roduct) => {
                                                                        return res.status(201).send({
                                                                            "status": 1,
                                                                            "data": final_custom_roduct
                                                                        });
                                                                    })
                                                                }
                                                            });
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                    })
                                }
                            });
                        }
                    })
                }
            })
        }
    }
});
async function removeProducts(body, callback) {
    Object.keys(body.finalProductsQuantityMap).map((product_id)=>{
        updateOneProduct(product_id,body.finalProductsQuantityMap[product_id]);
    })
    callback(null);
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
var check_materials = (body, callback) => {
    try {
        body.materials = JSON.parse(body.materials);
        if(body.materials && typeof(body.materials) !== 'object'){
            let err = {
                "status": 0,
                "message": "Wrong data (materials) must be JSON object."
            }
            return callback(err);
        }else{
            if(Object.keys(body.materials).length == 0){
                let err = {
                    "status": 0,
                    "message": "Wrong data (materials) must have one value at least {material_id: quantity}."
                }
                return callback(err);
            }else{
                checkMaterialsAvailability(body,function(err){
                    if(err !== null){
                        return callback(err);
                    }else{
                        return callback(null);
                    }
                });
            }
        }
    }
    catch(error) {
        console.log(error)
        let err = {
            "status": 0,
            "message": "Wrong data (materials) must be JSON object."
        }
        return callback(err);
    }
}
var checkMaterialsAvailability = (body, callback) => {
    let fountError = false;
    let productsArr = [];
    let productsQuantityMap = {};
    let finalProductsQuantityMap = {};
    Object.keys(body.materials).map((material_id)=>{
        productsArr.push(material_id)
        productsQuantityMap[material_id] = body.materials[material_id];
    })
    Product.find({'_id': { $in: productsArr}, 'parent': body.parent, "is_material": true})
        .then((products) => {
            if(products.length !== productsArr.length){
                fountError = true;
                let err = {
                    "status": 0,
                    "message": "Wrong data: can't find some materials, please check (material_id) for each material."
                };
                return callback(err)
            }else{
                products.map((singleProduct) => {
                    if(!singleProduct.map[body.materials_branch] || singleProduct.map[body.materials_branch] < productsQuantityMap[singleProduct._id.toString()]){
                        fountError = true;
                        let err = {
                            "status": 0,
                            "message": "can't find enough quantity from this material  (" + singleProduct._id.toString() +") in selected materials_branch."
                        };
                        return callback(err)
                    }
                })
                products.map((singleProduct) => {
                    var newMapObj = {...singleProduct.map};
                    newMapObj[body.materials_branch] -= productsQuantityMap[singleProduct._id.toString()]
                    finalProductsQuantityMap[singleProduct._id] = newMapObj;
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
var checkBranch = (body, callback) => {
    Branch.findOne({_id: body.branch, parent: body.parent})
    .then((branch) => {
        if(!branch){
            let err = {
                "status": 0,
                "message": "wrong branch."
            }
            return callback(err);
        }else{
            // if(!req.user.branches.includes(body.branch) && req.user.type != "admin"){
            //     let err = {
            //         "status": 0,
            //         "message": "This user don't have access to this branch."
            //     }
            //     return callback(err);
            // }else{
            //     callback(null)
            // }
            callback(null)
        }
    },(e) => {
        if(e.name && e.name == 'CastError'){
            let err = {
                "status": 0,
                "message": "wrong branch."
            }
            return callback(err);
        }else{
            let err = {
                "status": 0,
                "message": "error happen while query branch data."
            }
            return callback(err);
        }
    });
}
var checkMaterialsBranch = (body, callback) => {
    Branch.findOne({_id: body.materials_branch, parent: body.parent})
    .then((branch) => {
        if(!branch){
            let err = {
                "status": 0,
                "message": "wrong materials_branch."
            }
            return callback(err);
        }else{
            // if(!req.user.branches.includes(body.branch) && req.user.type != "admin"){
            //     let err = {
            //         "status": 0,
            //         "message": "This user don't have access to this branch."
            //     }
            //     return callback(err);
            // }else{
            //     callback(null)
            // }
            callback(null)
        }
    },(e) => {
        if(e.name && e.name == 'CastError'){
            let err = {
                "status": 0,
                "message": "wrong materials_branch."
            }
            return callback(err);
        }else{
            let err = {
                "status": 0,
                "message": "error happen while query materials_branch data."
            }
            return callback(err);
        }
    });
}
var check_deadline = (body, callback) => {
    if(new Date(body.deadline) == "Invalid Date"){
        let err = {
            "status": 0,
            "message": "Wrong data (deadline) must be valid date."
        }
        return callback(err);
    }else{
        return callback(null);
    }
}
var check_features = (body, callback) => {
    try {
        body.features = JSON.parse(body.features);
        if(body.features && typeof(body.features) !== 'object'){
            fountError = true;
            let err = {
                "status": 0,
                "message": "Wrong data (features) must be JSON object."
            }
            return callback(err);
        }else{
            return callback(null);
        }
    }
    catch(error) {
        fountError = true;
        let err = {
            "status": 0,
            "message": "Wrong data (features) must be JSON object."
        }
        return callback(err);
    }
}
var calcStorage = (res,body, callback) => {
    if((body.images.length > 0)){
        let storeQuery = {parent: body.parent}
        storeQuery.$where = 'function() { return (this.imagesStorage + ' + body.images_size + ') <= this.imagesStorageLimit;}';
        Store.findOneAndUpdate(
            storeQuery,
            {$inc : {'imagesStorage' : body.images_size}}, 
            { new: true, useFindAndModify:false }, 
            (e, response) => {
            if(e){
                console.log(e)
                if(e.name && e.name == "CastError"){
                    let err = {
                        "status": 0,
                        "message": e.message
                    }
                    return callback(err);
                }else{
                    let err = {
                        "status": 0,
                        "message": "error while updating store data."
                    }
                    return callback(err);
                }
            }else{
                if(response == null){
                    deleteImages(body.images);
                    let err = {
                        "status": 0,
                        "message": "you don't have enough space to uploud product images."
                    }
                    return callback(err);
                }else{
                    return callback(null);
                }
            }
        })
    }else{
        return callback(null);
    }
}
var deleteImages = (imagesArr) => {
    let startIndex = imagesArr[0].indexOf('/uploads/');
    let filesArr = [];
    imagesArr.map((url)=>{
        filesArr.push('.' + url.substring(startIndex))
    })
    //var files = ['./uploads/5db2c1f6e52ea52139ecfe1bScreenshot from 2019-01-02 22-34-54.png', './uploads/5db2c1f6e52ea52139ecfe1cScreenshot from 2019-01-02 22-34-54.png'];
    deleteFiles(filesArr, function(err) {
        // if (err) {
        // console.log(err);
        // } else {
        // console.log('all files removed');
        // }
    });
}
function deleteFiles(files, callback){
    var i = files.length;
    files.forEach(function(filepath){
      fs.unlink(filepath, function(err) {
        i--;
        if (err) {
          callback(err);
          return;
        } else if (i <= 0) {
          callback(null);
        }
      });
    });
}
/* start custom products. */
router.post('/start', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('134') && !req.user.permissions.includes('135')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to start cutom product."
        });
    }else{
        let body = _.pick(req.body, ['id']);
        if(!body.id){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (id) field is required."
            });
        }else{
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            let updateBody = {"status": "accepted", "accepted_at": new Date(), "accepted_from": req.user._id};
            let query = {parent: body.parent, _id: body.id, status: "assigned"};
            Custom_product.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
                if(e){
                    if(e.name && e.name == "CastError"){
                        res.status(400).send({
                            "status": 0,
                            "message": e.message
                        });
                    }else{
                        res.status(400).send({
                            "status": 0,
                            "message": "error while updating custom product data."
                        });
                    }
                }else{
                    if(response == null){
                        res.status(400).send({
                            "status": 0,
                            "message": "can't find any custom product with this _id and assigned status."
                        });
                    }else{
                        return res.send({
                            "status": 1,
                            "data": response
                        });   
                    }
                }
            })  
        }
    }
});
router.post('/start_cancel', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('134') && !req.user.permissions.includes('135')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to start cutom product."
        });
    }else{
        let body = _.pick(req.body, ['id']);
        if(!body.id){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (id) field is required."
            });
        }else{
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            let updateBody = {"status": "assigned", "accepted_at": undefined, "accepted_from": undefined};
            let query = {parent: body.parent, _id: body.id, status: "accepted"};
            Custom_product.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
                if(e){
                    if(e.name && e.name == "CastError"){
                        res.status(400).send({
                            "status": 0,
                            "message": e.message
                        });
                    }else{
                        res.status(400).send({
                            "status": 0,
                            "message": "error while updating custom product data."
                        });
                    }
                }else{
                    if(response == null){
                        res.status(400).send({
                            "status": 0,
                            "message": "can't find any custom product with this _id and accepted status."
                        });
                    }else{
                        return res.send({
                            "status": 1,
                            "data": response
                        });   
                    }
                }
            })  
        }
    }
});
/* list Custom_products. */
router.get('/list', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('131') && !req.user.permissions.includes('132')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to view Custom products."
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
        if(req.query._id){
            filters._id={ $regex: new RegExp(req.query._id), $options: "i" }
        }
        if(req.query.name){
            filters.name={ $regex: new RegExp(req.query.name), $options: "i" }
        }
        if(req.query.status){filters.status = req.query.status}
        if(req.query.creator_id){filters.created_from = req.query.creator_id}
        if(req.query.branch_id){filters.branch = req.query.branch_id}
        if(req.query.accepted_from){filters.accepted_from = req.query.accepted_from}
        if(req.query.ready_from){filters.ready_from = req.query.ready_from}
        if(req.query.delivered_from){filters.delivered_from = req.query.delivered_from}
        if(req.query.createdDateFrom){
            if(new Date(req.query.createdDateFrom) == "Invalid Date"){
                errHappen = true;
                err = {
                    "status": 0,
                    "message": "Invalid createdDateFrom."
                }
            }
            filters.created_at = {$gte: new Date(req.query.createdDateFrom)}
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
                filters.created_at = {$gte: new Date(req.query.createdDateFrom), $lte: new Date(req.query.createdDateTo)}
            }else{
                filters.created_at = {$lte: new Date(req.query.createdDateTo)}
            }
        }
        if(errHappen){
            res.status(400).send(err);
        }else{
            Custom_product.paginate(filters, options, function(err, result) {
                let next;
                if(result.hasNextPage){
                    next = "https://" + req.headers.host + "/api/custom_product/list?page=" + result.nextPage + "&page_size=" + page_size;
                }else{next = null;}
                let prev;
                if(result.hasPrevPage){
                    prev = "https://" + req.headers.host + "/api/custom_product/list?page=" + result.prevPage + "&page_size=" + page_size;
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
router.get('/full_details', authenticate, function(req, res, next){
    if(!req.query._id){
        res.status(400).send({
            "status": 0,
            "message": "Missing data, (_id) field is required."
        });
    }else{
        let filters = {_id: req.query._id}
        if(req.user.type == 'admin'){
            filters.parent = req.user._id;
        }else if(req.user.type == 'staff'){
            filters.parent = req.user.parent;
        }
        Custom_product.findOne(filters)
        .populate('branch', ['name', 'phoneNumber','address','type'])
        .populate('materials_branch', ['name','phoneNumber','address','type'])
        .populate('customer', ['name','phoneNumber'])
        .populate('created_from', ['name','phoneNumber'])
        .populate('accepted_from', ['name','phoneNumber'])
        .populate('ready_from', ['name','phoneNumber'])
        .populate('delivered_from', ['name','phoneNumber'])
        .then((custom_product) => {
            if(!custom_product){
                res.status(400).send({
                    "message": "can't find any custom_product with this _id."
                });
            }else{
                let productsArr = [];
                let productsFinal_obj = {};
                for (var key in custom_product.materials) {
                    productsArr.push(key)
                    productsFinal_obj[key] = {"used_quantity": custom_product.materials[key]}
                }
                Product.find({'_id': { $in: productsArr}, 'parent': filters.parent})
                    .then((products) => {
                        if(products.length !== productsArr.length){
                            res.status(400).send({
                                "message": "Wrong data: can't find some custom products, please check (product_id) for each custom product."
                            });
                        }else{
                            products.map((singleProduct) => {
                                productsFinal_obj[singleProduct._id]["full_data"] = singleProduct
                            })
                            return res.send({
                                "data": {...custom_product._doc, 'materials_details': productsFinal_obj}
                            });
                        }
                    },(e) => {
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
                        res.status(400).send({
                            err
                        });
                    });
            }
        },(e) => {
            res.status(400).send({
                "message": "can't find any custom_product with this _id."
            });
        });
    }
});

module.exports = router;
