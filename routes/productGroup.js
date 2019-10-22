var express = require('express');
var router = express.Router();
const _ = require('lodash');
let {ProductGroup} = require('../db/models/productGroup');
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
        let body = _.pick(req.body, ['name','branch_id','category_id','subCategory_id','description','features','image','productMap']);
        
        let images = [];
        if(req.files){
            console.log(req.files);
            if(req.files.length > 0){
                req.files.map((photo)=>{
                    images.push("https://" + req.headers.host + "/" + photo.path)
                })
            }
        }
        body.images = images;
        if(!body.name || !body.branch_id || !body.category_id || !body.description || !body.features || !body.productMap){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (name, branch_id, category_id, description, features, productMap) fields are required."
            });
        }else{
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            body.active = true;
            body.features = JSON.parse(body.features);
            body.productMap = JSON.parse(body.productMap);
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
                                        createProductGroup(res,body);
                                    }
                                },(e) => {
                                    res.status(400).send({
                                        "status": 0,
                                        "message": "Error happen while query subCategory data."
                                    });
                                });
                            }else{
                                createProductGroup(res,body);
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
    //----------------- >>>>> product group images
    let newProductGroupData = new ProductGroup(newProductGroup);
    newProductGroupData.save().then((newProductGroup) => {
        console.log(body);       
        return res.status(201).send({
            "status": 1,
            "data": {"productGroupData": newProductGroup}
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
/* edit feature. */
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

/* list feature. */
router.get('/list', authenticate, function(req, res, next) {
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
    Feature.paginate(filters, options, function(err, result) {
        let next;
        if(result.hasNextPage){
            next = "https://" + req.headers.host + "/api/category/feature?page=" + result.nextPage + "&page_size=" + page_size;
        }else{next = null;}
        let prev;
        if(result.hasPrevPage){
            prev = "https://" + req.headers.host + "/api/category/feature?page=" + result.prevPage + "&page_size=" + page_size;
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
});

module.exports = router;
