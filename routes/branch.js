var express = require('express');
var router = express.Router();
const _ = require('lodash');
let {User} = require('./../db/models/user');
let {Branch} = require('./../db/models/branch');
let {authenticate} = require('../middleware/authenticate');

/* Create new branch. */
router.post('/create', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('105')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to create new branch."
        });
    }else{
        let body = _.pick(req.body, ['name','phoneNumber','address','type']);
        if(!body.name || !body.phoneNumber || !body.address || !body.type){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (name, phoneNumber, address, type) fields are required."
            });
        }else{
            body.active = true;
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            let newBranchData = new Branch(body);
            newBranchData.save().then((newBranch) => {                
                return res.status(201).send({
                    "status": 1,
                    "data": {"branchData": newBranch}
                });
            }).catch((e) => {
                if(e.code){
                    if(e.code == 11000){
                        if(e.errmsg.includes("phoneNumber")){
                            res.status(400).send({
                                "status": 0,
                                "message": "This phone number is already exist."
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
                }else{
                    res.status(400).send({
                        "status": 0,
                        "message": e
                    });
                }
            });
        }
    }
});

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
