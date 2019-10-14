var express = require('express');
var router = express.Router();
const _ = require('lodash');
let {User} = require('./../db/models/user');
let {authenticate} = require('../middleware/authenticate');

/* Create new staff. */
router.post('/create', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('101')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to create new staff."
        });
    }else{
        let body = _.pick(req.body, ['name','email','phoneNumber','permissions','password']);
        if(!body.name || !body.email || !body.phoneNumber || !body.permissions || !body.password){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (name, email, phoneNumber, permissions, password) fields are required."
            });
        }else{
            body.active = true;
            body.is_login = false;
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            body.type = 'staff';
            let permissionsArr = body.permissions.split(",");
            let fullPermsArr = Object.keys(JSON.parse(process.env['permisitions']));
            let resultArr = [];
            permissionsArr.map((perm)=>{
                if(fullPermsArr.includes(perm)){
                    resultArr.push(perm);
                }
            })
            body.permissions = resultArr;
            let newUserData = new User(body);
            newUserData.save().then((newUser) => {
                let token = newUser.generateAuthToken();
                
                return res.header('x-auth', token).status(201).send({
                    "status": 1,
                    "data": {"userData": newUser}
                });
            }).catch((e) => {
                if(e.code){
                    if(e.code == 11000){
                        if(e.errmsg.includes("email")){
                            res.status(400).send({
                                "status": 0,
                                "message": "This email is already exist."
                            });
                        }else if(e.errmsg.includes("phoneNumber")){
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

/* edit staff. */
router.post('/edit', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('102')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to edit staff."
        });
    }else{
        let body = _.pick(req.body, ['user_id','name','email','phoneNumber','permissions','active','password']);
        if(!body.user_id){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (user_id) field is required."
            });
        }else{
            let user = req.user;
            let updateBody = {};
            if(req.body.name){updateBody.name = req.body.name}
            if(req.body.email){updateBody.email = req.body.email}
            if(req.body.phoneNumber){updateBody.phoneNumber = req.body.phoneNumber}
            if(req.body.permissions){
                let permissionsArr = body.permissions.split(",");
                let fullPermsArr = Object.keys(JSON.parse(process.env['permisitions']));
                let resultArr = [];
                permissionsArr.map((perm)=>{
                    if(fullPermsArr.includes(perm)){
                        resultArr.push(perm);
                    }
                })
                updateBody.permissions = resultArr;
            }
            if(req.body.active){updateBody.active = req.body.active}
            if(req.body.password){updateBody.password = req.body.password}

            let query;
            if(req.user.type == 'admin'){
                query = {_id: body.user_id, parent: req.user._id};
            }else if(req.user.type == 'staff'){
                query = {_id: body.user_id, parent: req.user.parent};
            }
            User.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
                if(e){
                    if(e.errmsg && e.errmsg.includes("email")){
                        res.status(400).send({
                            "status": 0,
                            "message": "This email is already exist."
                        });
                    }else if(e.errmsg && e.errmsg.includes("phoneNumber")){
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
                            "message": "can't find any staff with this user_id."
                        });
                    }else{
                        return res.send({
                            "status": 1,
                            "data": {"userData": response}
                        });   
                    }
                }
            })
        }
    }
});

/* edit staff. */
router.get('/list', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('100')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to view staff."
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
        User.paginate(filters, options, function(err, result) {
            let next;
            if(result.hasNextPage){
                next = "https://" + req.headers.host + "/api/staff/list?page=" + result.nextPage + "&page_size=" + page_size;
            }else{next = null;}
            let prev;
            if(result.hasPrevPage){
                prev = "https://" + req.headers.host + "/api/staff/list?page=" + result.prevPage + "&page_size=" + page_size;
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
