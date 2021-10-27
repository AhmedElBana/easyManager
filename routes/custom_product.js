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
    if(!req.user.permissions.includes('116')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to create new custom product."
        });
    }else{
        let body = _.pick(req.body, ['name','branch','price','quantity','materials','deadline','features','image','description']);
        
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
        if(!body.name || !body.branch || !body.price || !body.quantity || !body.materials || !body.deadline || !body.features || !body.description){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (name, branch, price, quantity, materials, deadline, features, description) fields are required."
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
                    checkBranch(body,function(err){
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
                                            //goooo on
                                            console.log("gooooo on.")
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            })
        }
    }
});
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
                    if(!singleProduct.map[body.branch] || singleProduct.map[body.branch] < productsQuantityMap[singleProduct._id.toString()]){
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
                    newMapObj[body.branch] -= productsQuantityMap[singleProduct._id.toString()]
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
/* list Custom_products. */
router.get('/list', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('115')){
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
        if(req.query.name){filters.name = req.query.name}
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
module.exports = router;
