var express = require('express');
var router = express.Router();
const _ = require('lodash');
let {User} = require('./../db/models/user');
let {Branch} = require('./../db/models/branch');
let {authenticate} = require('../middleware/authenticate');
let {single_sms} = require('./../services/sms-sns');

var handdleStaffPerms = (permissionsArr) =>{
    if(permissionsArr.includes('101') && !permissionsArr.includes('100')){permissionsArr.push('100')}
    if(permissionsArr.includes('102') && !permissionsArr.includes('100')){permissionsArr.push('100')}
    if(permissionsArr.includes('103') && !permissionsArr.includes('100')){permissionsArr.push('100')}
    if(permissionsArr.includes('101') && !permissionsArr.includes('104')){permissionsArr.push('104')}
    if(permissionsArr.includes('102') && !permissionsArr.includes('104')){permissionsArr.push('104')}
    if(permissionsArr.includes('105') && !permissionsArr.includes('104')){permissionsArr.push('104')}
    if(permissionsArr.includes('106') && !permissionsArr.includes('104')){permissionsArr.push('104')}
    if(permissionsArr.includes('107') && !permissionsArr.includes('104')){permissionsArr.push('104')}
    return permissionsArr
}
/* Create new staff. */
router.post('/create', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('101')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to create new staff."
        });
    }else{
        let body = _.pick(req.body, ['name','email','phoneNumber','permissions','branches','password']);
        if(!body.name || !body.email || !body.phoneNumber || !body.permissions || !body.branches || !body.password){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (name, email, phoneNumber, permissions, branches, password) fields are required."
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
            //if need to add extra perms
            permissionsArr = handdleStaffPerms(permissionsArr);
            permissionsArr.map((perm)=>{
                if(fullPermsArr.includes(perm)){
                    if(!resultArr.includes(perm)){
                        resultArr.push(perm);
                    }
                }
            })
            body.permissions = resultArr;
            //staff branches
            let branchesArr = body.branches.split(",");
            let fullbranchesArr = [];
            let branchesResultArr = [];
            Branch.find({parent: body.parent}).then(
                (result) => {
                    result.map((branch)=>{
                        fullbranchesArr.push(branch._id.toString())
                    })
                    branchesArr.map((recBranch)=>{
                        if(fullbranchesArr.includes(recBranch)){
                            if(!branchesResultArr.includes(recBranch)){
                                branchesResultArr.push(recBranch);
                            }
                        }
                    })
                    body.branches = branchesResultArr;
                    //save new staff
                    let newUserData = new User(body);
                    newUserData.save().then((newUser) => {
                        let token = newUser.generateAuthToken();
                        single_sms(
                            newUser.parent,
                            "Your password is: " + body.password + "\nYou can download Tradket app from Play Store: https://play.google.com/store/apps/details?id=com.neptune.tradket",
                            newUser.phoneNumber,
                            function(error, data){
                                if (error){
                                    return res.header('x-auth', token).status(201).send({
                                        "status": 1,
                                        "sms": "fail",
                                        "data": {"userData": newUser}
                                    });
                                }else{
                                    return res.header('x-auth', token).status(201).send({
                                        "status": 1,
                                        "sms": "success",
                                        "data": {"userData": newUser}
                                    });
                                }
                            }
                        )
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
                },(e) => {
                    res.status(400).send({
                        "status": 0,
                        "message": "error happened while query branches data."
                    });
                }
            )
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
                //if need to add extra perms
                permissionsArr = handdleStaffPerms(permissionsArr);
                let fullPermsArr = Object.keys(JSON.parse(process.env['permisitions']));
                let resultArr = [];
                permissionsArr.map((perm)=>{
                    if(fullPermsArr.includes(perm)){
                        if(!resultArr.includes(perm)){
                            resultArr.push(perm);
                        }
                    }
                })
                updateBody.permissions = resultArr;
            }
            if(req.body.active){updateBody.active = req.body.active}
            if(req.body.password){updateBody.password = req.body.password}
            if(req.body.branches){
                let parent_id;
                if(req.user.type == 'admin'){
                    parent_id = req.user._id;
                }else if(req.user.type == 'staff'){
                    parent_id = req.user.parent;
                }
                //staff branches
                let branchesArr = req.body.branches.split(",");
                let fullbranchesArr = [];
                let branchesResultArr = [];
                Branch.find({parent: parent_id}).then(
                    (result) => {
                        result.map((branch)=>{
                            fullbranchesArr.push(branch._id.toString())
                        })
                        branchesArr.map((recBranch)=>{
                            if(fullbranchesArr.includes(recBranch)){
                                if(!branchesResultArr.includes(recBranch)){
                                    branchesResultArr.push(recBranch);
                                }
                            }
                        })
                        updateBody.branches = branchesResultArr;
                        //save updates to staff
                        let query;
                        if(req.user.type == 'admin'){
                            query = {_id: body.user_id, parent: req.user._id};
                        }else if(req.user.type == 'staff'){
                            query = {_id: body.user_id, parent: req.user.parent};
                        }
                        User.findOneAndUpdate(query,updateBody, { new: true, useFindAndModify: false}, (e, response) => {
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
                    },(e) => {
                        res.status(400).send({
                            "status": 0,
                            "message": "error happened while query branches data."
                        });
                    }
                )
            }else{
                let query;
                if(req.user.type == 'admin'){
                    query = {_id: body.user_id, parent: req.user._id};
                }else if(req.user.type == 'staff'){
                    query = {_id: body.user_id, parent: req.user.parent};
                }
                User.findOneAndUpdate(query,updateBody, { new: true, useFindAndModify: false}, (e, response) => {
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
