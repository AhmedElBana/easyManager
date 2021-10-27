const fs = require('fs');
var express = require('express');
var router = express.Router();
const _ = require('lodash');
let {Store} = require('../db/models/store');
let {Custom_product} = require('../db/models/custom_product');
let {Branch} = require('../db/models/branch');
let {Category} = require('../db/models/category');
let {SubCategory} = require('../db/models/subCategory');
let {authenticate} = require('../middleware/authenticate');

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
