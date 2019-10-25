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

/* Create new productGroup. */
router.post('/create', authenticate, upload.array('image', 12), function(req, res, next) {
    if(!req.user.permissions.includes('116')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to create new product."
        });
    }else{
        let body = _.pick(req.body, ['name','branch_id','category_id','subCategory_id','price','quantity','description','features','image','productMap']);
        
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
        if(!body.name || !body.branch_id || !body.category_id || !body.price || !body.quantity || !body.description){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (name, branch_id, category_id, price, quantity, description) fields are required."
            });
        }else{
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            body.active = true;
            body.features = JSON.parse(body.features);
            if(body.productMap){body.productMap = JSON.parse(body.productMap);}
            let FullBranchesArr = [];
            Branch.find({parent: body.parent})
            .then((branches) => {
                branches.map((branch)=>{
                    FullBranchesArr.push(branch._id.toString())
                });
                if(!FullBranchesArr.includes(body.branch_id)){
                    res.status(400).send({
                        "status": 0,
                        "message": "you don't have any branch with this branch_id."
                    });
                }else{
                    let FullcategoriesArr = [];
                    Category.find({parent: body.parent})
                    .then((categories) => {
                        categories.map((category)=>{
                            FullcategoriesArr.push(category._id.toString())
                        });
                        if(!FullcategoriesArr.includes(body.category_id)){
                            res.status(400).send({
                                "status": 0,
                                "message": "you don't have any category with this category_id."
                            });
                        }else{
                            if(body.subCategory_id){
                                let FullSubCategoryArr = [];
                                SubCategory.find({parent: body.parent})
                                .then((subCategories) => {
                                    subCategories.map((subCategory)=>{
                                        FullSubCategoryArr.push(subCategory._id.toString())
                                    });
                                    if(!FullSubCategoryArr.includes(body.subCategory_id)){
                                        res.status(400).send({
                                            "status": 0,
                                            "message": "you don't have any subCategory with this subCategory_id."
                                        });
                                    }else{
                                        calcStorage(res,body);
                                    }
                                },(e) => {
                                    res.status(400).send({
                                        "status": 0,
                                        "message": "Error happen while query subCategory data."
                                    });
                                });
                            }else{
                                calcStorage(res,body);
                            }
                        }
                    },(e) => {
                        res.status(400).send({
                            "status": 0,
                            "message": "Error happen while query category data."
                        });
                    });
                }
            },(e) => {
                res.status(400).send({
                    "status": 0,
                    "message": "Error happen while query branches data."
                });
            });
        }
    }
});
var calcStorage = (res,body) => {
    let storeQuery = {parent: body.parent}
        storeQuery.$where = 'function() { return (this.imagesStorage + ' + body.images_size + ') <= this.imagesStorageLimit;}';
        Store.findOneAndUpdate(
            storeQuery,
            {$inc : {'imagesStorage' : body.images_size}}, 
            { new: true }, 
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
                if(response == null){
                    deleteImages(body.images);
                    res.status(400).send({
                        "status": 0,
                        "message": "you don't have enough space to uploud product images."
                    });
                }else{
                    createProductGroup(res,body);
                }
            }
        })
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
    if(body.subCategory_id){newProductGroup["subCategory_id"] = body.subCategory_id}
    let newProductGroupData = new ProductGroup(newProductGroup);
    newProductGroupData.save().then((newProductGroup) => {
        if(body.productMap && body.productMap.length >= 1){
            let finalProductsArr = [];
            body.productMap.map((product)=>{
                let mapObj = {};
                mapObj[body.branch_id] = product.quantity;
                let name = body.name;
                Object.keys(product.features).map(function(key, index) {
                        name += "-" + product.features[key]
                });
                let finalProduct = {
                    "group_id": newProductGroup._id,
                    "name": name,
                    "price": product.price,
                    "quantity": product.quantity,
                    "features": product.features,
                    "map": mapObj,
                    "parent": body.parent,
                    "active": true
                }
                finalProductsArr.push(finalProduct);
            })
            createManyProducts(res, finalProductsArr);
        }else{
            let mapObj = {};
            mapObj[body.branch_id] = body.quantity;
            let finalProduct = {
                "group_id": newProductGroup._id,
                "name": body.name,
                "price": body.price,
                "quantity": body.quantity,
                "map": mapObj,
                "parent": body.parent,
                "active": true
            }
            createProduct(res, finalProduct);
        }
    }).catch((e) => {
        console.log(e)
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
router.post('/singleAdd', authenticate, function(req, res, next) {
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
                            if(isNaN(body.quantity)){
                                res.status(400).send({
                                    "status": 0,
                                    "message": "wrong quantity value, must be integer."
                                });
                            }else{
                                let oldMap = product.map;
                                if(Object.keys(oldMap).includes(body.branch_id)){
                                    oldMap[body.branch_id] += parseInt(body.quantity);
                                }else{
                                    oldMap[body.branch_id] = parseInt(body.quantity);
                                }
                                let newMap = oldMap;
                                let query = {_id: body._id, parent: body.parent};
                                let newData = {map: newMap}
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
    if(!req.user.permissions.includes('113')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to edit feature."
        });
    }else{
        let body = _.pick(req.body, ['feature_id','name','options','active']);
        if(!body.feature_id){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (feature_id) field is required."
            });
        }else{
            let user = req.user;
            let updateBody = {};
            if(req.body.name){updateBody.name = req.body.name}
            if(req.body.options){updateBody.options = req.body.options}
            if(req.body.active){updateBody.active = req.body.active}

            let query;
            if(req.user.type == 'admin'){
                query = {_id: body.feature_id, parent: req.user._id};
            }else if(req.user.type == 'staff'){
                query = {_id: body.feature_id, parent: req.user.parent};
            }
            Feature.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
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
                            "message": "error while updating data."
                        });
                    }
                }else{
                    if(response == null){
                        res.status(400).send({
                            "status": 0,
                            "message": "can't find any branch with this category_id."
                        });
                    }else{
                        return res.send({
                            "status": 1,
                            "data": {"categoryData": response}
                        });   
                    }
                }
            })
        }
    }
});

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
router.get('/singleProduct', authenticate, function(req, res, next){
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
            if(req.query.branch_id){
                filters.$where = 'function() { return Object.keys(this.map).includes("' + req.query.branch_id + '");}';
                // filters.$where = function(){return Object.keys(this.map).includes(req.query.branch_id)}
            }
            Product.findOne(filters)
            .then((productGroup) => {
                if(!productGroup){
                    res.status(400).send({
                        "status": 0,
                        "message": "can't find any product with this _id."
                    });
                }else{
                    return res.send({
                        "status": 1,
                        "data": productGroup
                    });
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
