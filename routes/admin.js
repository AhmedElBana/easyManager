var express = require('express');
var router = express.Router();
const _ = require('lodash');
let {Admin} = require('./../db/models/admin');

/* Add new admin user. */
router.post('/create', function(req, res, next) {
  let body = _.pick(req.body, ['name','email','password','permissions']);
    if(!body.name || !body.email || !body.password || !body.permissions){
        res.status(400).send({
            "status": 0,
            "message": "Missing data, (name, email, password, permissions) fields are required."
        });
    }else{
        body.active = true;
        let newUserData = new Admin(body);
        newUserData.save().then((newUser) => {
            return res.status(201).send({"data": newUser});
        }).catch((e) => {
            if(e.code){
                if(e.code == 11000){
                    if(e.errmsg.includes("email")){
                        res.status(400).send({
                            "status": 0,
                            "message": "This email is already exist."
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
});


module.exports = router;
