var express = require('express');
var router = express.Router();
const _ = require('lodash');
let {User} = require('./../db/models/user');
let {authenticate} = require('../middleware/authenticate');

/* Add new staff. */
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
            body.is_login = false;
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


module.exports = router;
