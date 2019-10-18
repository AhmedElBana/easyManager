var express = require('express');
var router = express.Router();
const _ = require('lodash');
let {Category} = require('../db/models/category');
let {SubCategory} = require('../db/models/subCategory');
let {authenticate} = require('../middleware/authenticate');

/* Create new subCategory. */
router.post('/create', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('108')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to create new subcategory."
        });
    }else{
        let body = _.pick(req.body, ['category_id','name']);
        if(!body.category_id || !body.name){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (category_id, name) fields are required."
            });
        }else{
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            Category.find({"parent": body.parent}).then(
                (result) => {
                    let categoriesArr = [];
                    result.map((category)=>{
                        categoriesArr.push(category._id.toString());
                    })
                    if(!categoriesArr.includes(body.category_id)){
                        res.status(400).send({
                            "status": 0,
                            "message": "you don't have category with this _id."
                        });
                    }else{
                        let newSubCategoryData = new SubCategory(body);
                        newSubCategoryData.save().then((newSubCategory) => {                
                            return res.status(201).send({
                                "status": 1,
                                "data": {"subCategoryData": newSubCategory}
                            });
                        }).catch((e) => {
                            if(e.code){
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
                        });
                    }
                },(e) => {
                    res.status(400).send({
                        "status": 0,
                        "message": "error happen while query categorys."
                    });
                }
            )
        }
    }
});

/* edit subCategory. */
router.post('/edit', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('109')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to edit subCategory."
        });
    }else{
        let body = _.pick(req.body, ['subCategory_id','name']);
        if(!body.subCategory_id){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (subCategory_id) field is required."
            });
        }else{
            let user = req.user;
            let updateBody = {};
            if(req.body.name){updateBody.name = req.body.name}

            let query;
            if(req.user.type == 'admin'){
                query = {_id: body.subCategory_id, parent: req.user._id};
            }else if(req.user.type == 'staff'){
                query = {_id: body.subCategory_id, parent: req.user.parent};
            }
            SubCategory.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
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

/* list subcategories. */
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
    if(req.query.category_id){filters.category_id = req.query.category_id}
    SubCategory.paginate(filters, options, function(err, result) {
        let next;
        if(result.hasNextPage){
            next = "https://" + req.headers.host + "/api/subCategory/list?page=" + result.nextPage + "&page_size=" + page_size;
        }else{next = null;}
        let prev;
        if(result.hasPrevPage){
            prev = "https://" + req.headers.host + "/api/subCategory/list?page=" + result.prevPage + "&page_size=" + page_size;
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
