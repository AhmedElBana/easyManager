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
let {upload_products} = require('./../services/images_upload');

var mongo = require('mongodb'),
    ObjectID = mongo.ObjectID;

var multer  = require('multer')
const storage = multer.diskStorage({
    destination: function(req, file, cb){
        cb(null, './uploads/');
    },
    filename: function(req, file, cb){
        //cb(null, new Date().toISOString() + file.originalname);
        cb(null, new ObjectID().toString() + file.originalname);
    }
})
const fileFilter = (req, file, cb)=>{
    // if(file.mimetype === 'image/jpeg' || file.mimetype === 'image/png'){
    //     cb(null, true);
    // }else{
    //     cb(null, false);
    // }
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


var imageUpload = (req, res, parent, callback) => {
    let storeQuery = {parent: parent}
    Store.findOne({parent: parent})
    .then((store) => {
        if(!store){
            callback({
                "status": 0,
                "message": "can't find any store with this parent."
            })
        }else{
            if(Number(store.imagesStorage) < Number(store.imagesStorageLimit)){
                upload_products(req, res, parent,
                    function(error, all_images_size, images_path_arr){
                        if (error){
                            callback({
                                "status": 0,
                                "message": "error happen while uploading images."
                            })
                        }else{
                            Store.findOneAndUpdate(
                            storeQuery,
                            {$inc : {'imagesStorage' : all_images_size}}, 
                            { new: true, useFindAndModify:false }, 
                            (e, response) => {
                                if(e){
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
                                        let err = {
                                            "status": 0,
                                            "message": "error while updating store data."
                                        }
                                        return callback(err);
                                    }else{
                                        return callback(null, images_path_arr);
                                    }
                                }
                            })
                        }
                    }
                )
            }else{
                callback({
                    "status": 0,
                    "message": "you don't have enough space to uploud product images."
                })
            }
        }
    },(e) => {
        callback({
            "status": 0,
            "message": "can't find any store with this parent."
        })
    });
}

/* Create new productGroup. */
router.post('/create', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('116')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to create new product."
        });
    }else{
        let parent;
        if(req.user.type == 'admin'){
            parent = req.user._id;
        }else if(req.user.type == 'staff'){
            parent = req.user.parent;
        }
        imageUpload(req, res, parent, function(err, images_path_arr){
            if(err !== null){
                res.status(400).send(err);
            }else{
                let body = _.pick(req.body, ['_id','is_material','name','branch_id','category_id','subCategory_id','price','quantity','description','features','image','productMap']);
                if(!body.is_material || !body.name || !body.branch_id || !body.category_id || !body.price || !body.quantity || !body.description){
                    res.status(400).send({
                        "status": 0,
                        "message": "Missing data, (is_material, name, branch_id, category_id, price, quantity, description) fields are required."
                    });
                }else{
                    body.images = images_path_arr;
                    body.parent = parent
                    body.active = true;
                    if(body.features){body.features = JSON.parse(body.features);}
                    if(body.productMap){body.productMap = JSON.parse(body.productMap);}
                    Branch.findOne({parent: body.parent, _id: body.branch_id})
                    .then((branch) => {
                        if(!branch){
                            res.status(400).send({
                                "status": 0,
                                "message": "you don't have any branch with this branch_id."
                            });
                        }else{
                            Category.findOne({parent: body.parent, _id: body.category_id})
                            .then((category) => {
                                if(!category){
                                    res.status(400).send({
                                        "status": 0,
                                        "message": "you don't have any category with this category_id."
                                    });
                                }else{
                                    if(body.subCategory_id){
                                        SubCategory.findOne({parent: body.parent, _id: body.subCategory_id, category_id: body.category_id})
                                        .then((subCategory) => {
                                            if(!subCategory){
                                                res.status(400).send({
                                                    "status": 0,
                                                    "message": "wrong subCategory_id."
                                                });
                                            }else{
                                                check_features_productMap(body,function(err){
                                                    if(err !== null){
                                                        res.status(400).send(err);
                                                    }else{
                                                        createProductGroup(res,body);
                                                    }
                                                })
                                            }
                                        },(e) => {
                                            res.status(400).send({
                                                "status": 0,
                                                "message": "wrong subCategory_id."
                                            });
                                        });
                                    }else{
                                        check_features_productMap(body,function(err){
                                            if(err !== null){
                                                res.status(400).send(err);
                                            }else{
                                                createProductGroup(res,body);
                                            }
                                        })
                                    }
                                }
                            },(e) => {
                                res.status(400).send({
                                    "status": 0,
                                    "message": "you don't have any category with this category_id."
                                });
                            });
                        }
                    },(e) => {
                        res.status(400).send({
                            "status": 0,
                            "message": "you don't have any branch with this branch_id."
                        });
                    });
                }
            }
        })
    }
});
var check_features_productMap = (body, callback) => {
    let fountError = false;
    if(body.features){
        if(typeof(body.features) !== 'object'){
            fountError = true;
            let err = {
                "status": 0,
                "message": "Wrong data (features) must be object."
            }
            return callback(err);
        }
    }
    if(body.productMap){
        if(typeof(body.productMap[0]) !== 'object'){
            fountError = true;
            let err = {
                "status": 0,
                "message": "Wrong data (productMap) must be array of objects."
            }
            return callback(err);
        }else{
            body.productMap.map((object)=>{
                if(!object.price || isNaN(object.price)){
                    fountError = true;
                    let err = {
                        "status": 0,
                        "message": "each object inside productMap must have (price) field with numeric value."
                    }
                    return callback(err);
                }
                if(!object.quantity || isNaN(object.quantity)){
                    fountError = true;
                    let err = {
                        "status": 0,
                        "message": "each object inside productMap must have (quantity) field with numeric value."
                    }
                    return callback(err);
                }
                if(typeof(object.features) !== 'object'){
                    fountError = true;
                    let err = {
                        "status": 0,
                        "message": "each object inside productMap must have (features) field with object value."
                    }
                    return callback(err);
                }
            })
        }
    }
    if(!fountError){return callback(null);}
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
var createProductGroup = (res,body) => {
    let newProductGroup = {
        "is_material": body.is_material,
        "name": body.name,
        "category_id": body.category_id,
        "description": body.description,
        "features": body.features,
        "createdAt": new Date(),
        "parent": body.parent,
        "images": body.images,
        "active": true,
        "rate": 0
    }
    if(body._id){
        newProductGroup["_id"] = body._id
    }else{
        newProductGroup["_id"] = new ObjectID().toString();
    }
    if(body.subCategory_id){newProductGroup["subCategory_id"] = body.subCategory_id}
    let newProductGroupData = new ProductGroup(newProductGroup);
    newProductGroupData.save().then((newProductGroup) => {
        if(body.productMap && body.productMap.length >= 1){
            let finalProductsArr = [];
            let customerNewIds = [];
            body.productMap.map((product)=>{
                let mapObj = {};
                mapObj[body.branch_id] = Number(product.quantity);
                let name = body.name;
                Object.keys(product.features).map(function(key, index) {
                        name += "-" + product.features[key]
                });
                let finalProduct = {
                    "is_material": body.is_material,
                    "group_id": newProductGroup._id,
                    "name": name,
                    "price": product.price,
                    "quantity": product.quantity,
                    "features": product.features,
                    "map": mapObj,
                    "parent": body.parent,
                    "active": true
                }
                if(product._id){
                    finalProduct["_id"] = product._id;
                    customerNewIds.push(product._id);
                }else{
                    finalProduct["_id"] = new ObjectID().toString();
                }
                finalProductsArr.push(finalProduct);
            })
            check_products_id(body.parent,customerNewIds,function(err){
                if(err !== null){
                    res.status(400).send(err);
                }else{
                    createManyProducts(res, finalProductsArr);
                }
            })
        }else{
            let mapObj = {};
            mapObj[body.branch_id] = Number(body.quantity);
            let finalProduct = {
                "_id": newProductGroup._id,
                "is_material": body.is_material,
                "group_id": newProductGroup._id,
                "name": body.name,
                "price": body.price,
                "quantity": body.quantity,
                "map": mapObj,
                "parent": body.parent,
                "active": true
            }
            check_products_id(body.parent,[newProductGroup._id],function(err){
                if(err !== null){
                    res.status(400).send(err);
                }else{
                    createProduct(res, finalProduct);
                }
            })
        }
    }).catch((e) => {
        if(e.code){
            if(e.code == 11000){
                res.status(400).send({
                    "status": 0,
                    "message": "you have product with the same id"
                });
            }else{
                res.status(400).send({
                    "status": 0,
                    "message": e
                });
            }
        }else{
            res.status(400).send({
                "status": 0,
                "message": e
            });
        }
    });
}
var check_products_id = (parent, ids, callback) => {
    Product.find({parent: parent, _id: { $in:  ids} })
    .then((products) => {
        if(products.length == 0){
            return callback(null);
        }else{
            usedIds = [];
            products.map((product)=>{
                usedIds.push(product._id)
            })
            let err = {
                "status": 0,
                "message": "this product IDs is used before : (" + usedIds.join() + ")."
            }
            return callback(err);
        }
    },(e) => {
        return callback(null);
    });
}
var createProduct = (res, product) => {
    let newProductData = new Product(product);
    newProductData.save().then((newProduct) => {
        return res.status(201).send({
            "status": 1,
            "data": {"productData": newProduct}
        });
    }).catch((e) => {
        if(e.code){
            if(e.code == 11000){
                res.status(400).send({
                    "status": 0,
                    "message": e
                });
            }else{
                res.status(400).send({
                    "status": 0,
                    "message": e
                });
            }
        }else{
            res.status(400).send({
                "status": 0,
                "message": e
            });
        }
    });
}
var createManyProducts = (res, products) => {
    Product.insertMany(products).then((newProducts) => {
        return res.status(201).send({
            "status": 1,
            "data": {"productData": newProducts}
        });
    }).catch((e) => {
        if(e.code){
            if(e.code == 11000){
                res.status(400).send({
                    "status": 0,
                    "message": e
                });
            }else{
                res.status(400).send({
                    "status": 0,
                    "message": e
                });
            }
        }else{
            res.status(400).send({
                "status": 0,
                "message": e
            });
        }
    });
}

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
var editProductGroup = (res, body) =>{
    let updateBody = {};
    if(body.name){updateBody.name = body.name}
    if(body.category_id){updateBody.category_id = body.category_id}
    if(body.subCategory_id){updateBody.subCategory_id = body.subCategory_id}
    if(body.description){updateBody.description = body.description}
    if(body.features){updateBody.features = body.features}
    if(body.active){updateBody.active = body.active}

    let query;
    query = {_id: body.productGroup_id, parent: body.parent};
    ProductGroup.findOneAndUpdate(query,updateBody, { new: true, useFindAndModify:false }, (e, response) => {
        if(e){
            if(e.name && e.name == "CastError"){
                res.status(400).send({
                    "status": 0,
                    "message": e.message
                });
            }else{
                res.status(400).send({
                    "status": 0,
                    "message": "error while updating data."
                });
            }
        }else{
            if(response == null){
                res.status(400).send({
                    "status": 0,
                    "message": "can't find any productGroup with this productGroup_id."
                });
            }else{
                return res.send({
                    "status": 1,
                    "data": {"ProductGroupData": response}
                });   
            }
        }
    })
}
router.post('/edit/addImages', authenticate, upload.array('image', 50), function(req, res, next) {
    if(!req.user.permissions.includes('117')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to edit product."
        });
    }else{
        let body = _.pick(req.body, ['_id']);
        
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
        if(!body._id || images.length == 0){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (_id, image) fields are required."
            });
        }else{
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            editCalcStorage(res,body);
        }
    }
});
var editCalcStorage = (res,body) => {
    let storeQuery = {parent: body.parent}
        storeQuery.$where = 'function() { return (this.imagesStorage + ' + body.images_size + ') <= this.imagesStorageLimit;}';
        Store.findOneAndUpdate(
            storeQuery,
            {$inc : {'imagesStorage' : body.images_size}}, 
            { new: true, useFindAndModify:false }, 
            (e, response) => {
            if(e){
                if(e.name && e.name == "CastError"){
                    res.status(400).send({
                        "status": 0,
                        "message": e.message
                    });
                }else{
                    res.status(400).send({
                        "status": 0,
                        "message": "error while updating store data."
                    });
                }
            }else{
                if(response == null){
                    deleteImages(body.images);
                    res.status(400).send({
                        "status": 0,
                        "message": "you don't have enough space to uploud product images."
                    });
                }else{
                    saveImagesToGroup(res,body);
                }
            }
        })
}
var saveImagesToGroup = (res,body) => {
    ProductGroup.findOne({_id: body._id, parent: body.parent})
        .then((productGroup) => {
            if(!productGroup){
                res.status(400).send({
                    "status": 0,
                    "message": "can't find any product group with this _id."
                });
            }else{
                let fullImagesArr = [...productGroup.images,...body.images]
                let query = {_id: body._id, parent: body.parent}
                ProductGroup.findOneAndUpdate(
                    query,
                    {'images': fullImagesArr}, 
                    { new: true, useFindAndModify:false }, 
                    (e, response) => {
                    if(e){
                        console.log(e)
                        if(e.name && e.name == "CastError"){
                            res.status(400).send({
                                "status": 0,
                                "message": e.message
                            });
                        }else{
                            res.status(400).send({
                                "status": 0,
                                "message": "error while updating store data."
                            });
                        }
                    }else{
                        return res.send({
                            "status": 1,
                            "data": {"ProductGroupData": response}
                        });   
                    }
                })
            }
        },(e) => {
            res.status(400).send({
                "status": 0,
                "message": "can't find any product group with this _id."
            });
        });
}
router.post('/edit/removeImages', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('117')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to edit product."
        });
    }else{
        let body = _.pick(req.body, ['_id','images']);
        if(!body._id || !body.images){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (_id, images) fields are required."
            });
        }else{
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            ProductGroup.findOne({_id: body._id, parent: body.parent})
            .then((productGroup) => {
                if(!productGroup){
                    res.status(400).send({
                        "status": 0,
                        "message": "can't find any product group with this _id."
                    });
                }else{
                    let oldImagesArr = [...productGroup.images];
                    let newImagesArr = [];
                    let removedImagesArr = [];
                    oldImagesArr.map((image)=>{
                        if(body.images.includes(image)){
                            removedImagesArr.push(image);
                        }else{
                            newImagesArr.push(image);
                        }
                    })
                    console.log(removedImagesArr)
                    if(removedImagesArr.length >= 1){
                        deleteImagesEdit(removedImagesArr, function(err, removedSize){
                            if(err != null){
                                res.status(400).send({
                                    "status": 0,
                                    "message": "error happen while remove images."
                                });
                            }else{
                                let storeQuery = {parent: body.parent}
                                Store.findOneAndUpdate(
                                    storeQuery,
                                    {$inc : {'imagesStorage' : -removedSize}}, 
                                    { new: true, useFindAndModify:false }, 
                                    (e, response) => {
                                    if(e){
                                        console.log(e)
                                        if(e.name && e.name == "CastError"){
                                            res.status(400).send({
                                                "status": 0,
                                                "message": e.message
                                            });
                                        }else{
                                            res.status(400).send({
                                                "status": 0,
                                                "message": "error while updating store data."
                                            });
                                        }
                                    }else{
                                        let query = {_id: body._id, parent: body.parent}
                                        ProductGroup.findOneAndUpdate(
                                            query,
                                            {'images': newImagesArr}, 
                                            { new: true, useFindAndModify:false }, 
                                            (e, response) => {
                                            if(e){
                                                console.log(e)
                                                if(e.name && e.name == "CastError"){
                                                    res.status(400).send({
                                                        "status": 0,
                                                        "message": e.message
                                                    });
                                                }else{
                                                    res.status(400).send({
                                                        "status": 0,
                                                        "message": "error while updating store data."
                                                    });
                                                }
                                            }else{
                                                return res.send({
                                                    "status": 1,
                                                    "data": {"ProductGroupData": response}
                                                });   
                                            }
                                        })
                                    }
                                })
                            }
                        })
                    }else{
                        res.status(400).send({
                            "status": 0,
                            "message": "can't find any image of this inside your product group."
                        });; 
                    }
                }
            },(e) => {
                res.status(400).send({
                    "status": 0,
                    "message": "can't find any product group with this _id."
                });
            });
        }
    }
});
var deleteImagesEdit = (imagesArr,callback) => {
    let startIndex = imagesArr[0].indexOf('/uploads/');
    let filesArr = [];
    imagesArr.map((url)=>{
        filesArr.push('.' + url.substring(startIndex))
    })
    //var files = ['./uploads/5db2c1f6e52ea52139ecfe1bScreenshot from 2019-01-02 22-34-54.png', './uploads/5db2c1f6e52ea52139ecfe1cScreenshot from 2019-01-02 22-34-54.png'];
    deleteFilesEdit(filesArr, function(err,imagesSize) {
        if (err == null) {
            callback(null,imagesSize * 1/(1024*1024))//MB
        }else{
            callback(err)
        }
    });    
}
function deleteFilesEdit(files, callback){
    var i = files.length;
    let imagesSize = 0;
    files.forEach(function(filepath){
        imagesSize += fs.statSync(filepath).size;
      fs.unlink(filepath, function(err) {
        i--;
        if (err) {
          callback(err);
          return;
        } else 
        if (i <= 0) {
          callback(null,imagesSize);
        }
      });
    });
}
/* list products. */
router.get('/list', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('115')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to view products."
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
        if(req.query.is_material){filters.is_material = req.query.is_material}
        if(req.query.name){filters.name = new RegExp(req.query.name, 'i')}
        if(req.query._id){filters._id = req.query._id}
        if(req.query.category_id){filters.category_id = req.query.category_id}
        if(req.query.subCategory_id){filters.subCategory_id = req.query.subCategory_id}
        ProductGroup.paginate(filters, options, function(err, result) {
            let next;
            if(result.hasNextPage){
                next = "https://" + req.headers.host + "/api/category/productGroup?page=" + result.nextPage + "&page_size=" + page_size;
            }else{next = null;}
            let prev;
            if(result.hasPrevPage){
                prev = "https://" + req.headers.host + "/api/category/productGroup?page=" + result.prevPage + "&page_size=" + page_size;
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
router.get('/fullProduct', authenticate, function(req, res, next){
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
            ProductGroup.findOne({parent: parent, _id: req.query._id})
            .then((productGroup) => {
                if(!productGroup){
                    res.status(400).send({
                        "status": 0,
                        "message": "can't find any product group with this _id."
                    });
                }else{
                    let fullProduct = {...productGroup._doc}
                    Product.find({parent: parent, group_id: fullProduct._id})
                    .then((products) => {
                        fullProduct.products = products;
                        return res.send({
                            "status": 1,
                            "data": {...fullProduct}
                        });
                    },(e) => {
                        res.status(400).send({
                            "status": 0,
                            "message": "can't find any product group with this _id."
                        });
                    });
                }
            },(e) => {
                res.status(400).send({
                    "status": 0,
                    "message": "can't find any product group with this _id."
                });
            });
        }
    }
});
module.exports = router;
