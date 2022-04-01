var express = require('express');
var router = express.Router();
const _ = require('lodash');
let {User} = require('./../db/models/user');
let {Store} = require('./../db/models/store');
let {authenticate} = require('../middleware/authenticate');
let {single_email_otp} = require('./../services/email_mailazy');
const { errorMonitor } = require('nodemailer/lib/mailer');

/* User Login. */
router.post('/login', function(req, res, next) {
    let body = _.pick(req.body, ['email','password']);
      if(!body.email || !body.password){
          res.status(400).send({
              "status": 0,
              "message": "Missing data, (email, password) fields are required."
          });
      }else{
          User.findByCredentials(body.email, body.password).then((user) => {
              let query = {_id: user._id};
              let newData = {"is_login": true}
              User.findOneAndUpdate(query,newData, { new: true, useFindAndModify:false })
                  .then(response => {
                      if(response){
                        let token = user.generateAuthToken();
                        if(user.type == 'admin'){
                            body.parent = user._id;
                        }else if(user.type == 'staff'){
                            body.parent = user.parent;
                        }
                        Store.findOne({parent: body.parent})
                        .then((store) => {
                            if(!store){
                                res.status(400).send({
                                    "status": 0,
                                    "message": "you don't have any store with this parent."
                                });
                            }else{
                                return res.header('x-auth', token).send({
                                    "status": 1,
                                    "data": {
                                        "userData": response, 
                                        "store": store,
                                        "token": token
                                    }
                                });
                            }
                        },(e) => {
                            res.status(400).send({
                                "status": 0,
                                "message": "you don't have any store with this parent."
                            });
                        });
                      }else{
                          res.status(401).send({
                              "status": 0,
                              "message": "Invalid user data."
                          });
                      }
                  })
                  .catch(err => {
                      res.status(401).send({
                          "status": 0,
                          "message": "error while query user data."
                      });
                  });
          }).catch((e) => {
              res.status(401).send({
                  "status": 0,
                  "message": "email or password is not correct."
              });
          });
      }
});
router.post('/login_v2', function(req, res, next) {
    let body = _.pick(req.body, ['identifier','password']);
      if(!body.identifier || !body.password){
          res.status(400).send({
              "status": 0,
              "message": "Missing data, (identifier, password) fields are required."
          });
      }else{
          User.findByCredentials_identifier(body.identifier, body.password).then((user) => {
              if(!user.active){
                res.status(401).send({"error": "account is not active"});
              }else{
                let query = {_id: user._id};
                let newData = {"is_login": true}
                User.findOneAndUpdate(query,newData, { new: true, useFindAndModify:false })
                .then(response => {
                    if(response){
                    let token = user.generateAuthToken();
                    if(user.type == 'admin'){
                        body.parent = user._id;
                    }else if(user.type == 'staff'){
                        body.parent = user.parent;
                    }
                    Store.findOne({parent: body.parent})
                    .then((store) => {
                        if(!store){
                            res.status(400).send({
                                "status": 0,
                                "message": "you don't have any store with this parent."
                            });
                        }else{
                            return res.header('x-auth', token).send({
                                "status": 1,
                                "data": {
                                    "userData": response, 
                                    "store": store,
                                    "token": token
                                }
                            });
                        }
                    },(e) => {
                        res.status(400).send({
                            "status": 0,
                            "message": "you don't have any store with this parent."
                        });
                    });
                    }else{
                        res.status(401).send({
                            "status": 0,
                            "message": "Invalid user data."
                        });
                    }
                })
                .catch(err => {
                    console.log(err)
                    res.status(401).send({
                        "status": 0,
                        "message": "error while query user data."
                    });
                });
              }
          }).catch((e) => {
              res.status(401).send({
                  "status": 0,
                  "message": "phoneNumber or password is not correct."
              });
          });
      }
});
/* User logout. */
router.get('/logout', authenticate, function(req, res, next) {
let user = req.user;
let query = {_id: user._id};
let newData = {"is_login": false}
User.findOneAndUpdate(query,newData, { new: true })
    .then(response => {
        if(response){
            return res.send({
                "status": 1
            });
        }else{
            res.status(400).send({
                "status": 0,
                "message": "Invalid user data."
            });
        }
    })
    .catch(err => {
        res.status(400).send({
            "status": 0,
            "message": "error while query user data."
        });
    });
});
/* generate new otp to change password. */
router.post('/forgotpassword', function(req, res, next) {
    let body = _.pick(req.body, ['email']);
    if(body.email){
        User.find({email: body.email}).then(
            (result) => {
                if(result.length === 0){
                    res.status(400).send({
                        "status": 0,
                        "message": "Invalid email."
                    });
                }else{
                    //genrate random 5 digis code
                    let code = Math.floor(Math.random()*90000) + 10000;
                    //save code and send message with it
                    let query = {email: body.email};
                    let newData = {"code": code}
                    User.findOneAndUpdate(query,newData, { new: true })
                    .then(response => {
                        if(response){
                            single_email_otp(
                                code,
                                body.email,
                                function(error, data){
                                    if (error){
                                        res.status(400).send({"message": "fail to send otp, please try again later."});
                                    }else{
                                        return res.send({"status": "success"});
                                    }
                                }
                            )
                        }else{
                            res.status(400).send({"message": "Invalid email."});
                        }
                    })
                    .catch(err => {
                        res.status(400).send({
                            "status": 0,
                            "message": "error while query user data."
                        });
                    });
                }
            },(e) => {
                res.status(400).send({
                    "status": 0,
                    "message": "error happened while query user with email."
                });
            }
        )
    }else{
        res.status(400).send({
            "status": 0,
            "message": "missing data: email field is required."
        });
    }
  });
  /* get user code and generate new token. */
  router.post('/verifycode', function(req, res, next) {
    let body = _.pick(req.body, ['email','code']);
    if(body.email && body.code){
        User.find({"email": body.email}).then(
            (result) => {
                if(result.length === 0){
                    res.status(400).send({
                        "status": 0,
                        "message": "Invalid email."
                    });
                }else{
                    if(result[0].code == body.code){
                        let token = result[0].generateAuthToken();
                        return res.header('x-auth', token).send({
                            "status": 1,
                            "data": {"token": token}
                        });
                    }else{
                        res.status(400).send({
                            "status": 0,
                            "message": "Invalid code."
                        });
                    }
                }
            },(e) => {
                res.status(400).send({
                    "status": 0,
                    "message": "Invalid email."
                });
            }
        )
    }else{
        res.status(400).send({
            "status": 0,
            "message": "missing data: email and code fields are required."
        });
    }
  });
  /* change password. */
  router.post('/changepassword', authenticate, function(req, res, next) {
    let body = _.pick(req.body, ['password']);
      let user = req.user;
      if(body.password){
          let query = {"_id": user._id};
          let newData = {"password": body.password}
          User.findOneAndUpdate(query,newData, { new: true })
          .then(response => {
              if(response){
                  res.send({
                      "status": 1
                  });
              }else{
                  res.status(400).send({
                      "status": 0,
                      "message": "Invalid data."
                  });
              }
          })
          .catch(err => {
              res.status(400).send({
                  "status": 0,
                  "message": "error while query user data."
              });
          });
      }else{
          res.status(400).send({
              "status": 0,
              "message": "missing data: password field is required."
          });
      }
  });

/* Add new admin user. */
router.post('/admin/create', function(req, res, next) {
  let body = _.pick(req.body, ['name','language','email','phoneNumber','password','storeName','storePhoneNumber']);
    if(!body.name || !body.language || !body.email || !body.password || !body.storeName || !body.storePhoneNumber){
        res.status(400).send({
            "status": 0,
            "message": "Missing data, (name, language, email, phoneNumber, password, storeName, storePhoneNumber) fields are required."
        });
    }else if(body.language !== 'en' && body.language !== "ar"){
        res.status(400).send({
            "status": 0,
            "message": "Wronge data, (language) value must be 'ar' or 'en'."
        });
    }else{
        body.active = true;
        body.is_login = true;
        body.type = 'admin';
        body.permissions = Object.keys(JSON.parse(process.env['permisitions']));
        let newUserData = new User(body);
        newUserData.save().then((newUser) => {
            let storeObj = {
                "name": body.storeName,
                "language": body.language,
                "phoneNumber": body.storePhoneNumber,
                "imagesStorageLimit": 50,
                "imagesStorage": 0,
                "availableEmails": 0,
                "usedEmails": 0,
                "availableSMS": 0,
                "usedSMS": 0,
                "returnOrederAllowed": true,
                "returnOrederDays": 14,
                "returnAnyBranch": true,
                "parent": newUser._id
            }
            let newStoreData = new Store(storeObj);
            newStoreData.save().then((newStore) => {
                let token = newUser.generateAuthToken();
                return res.header('x-auth', token).status(201).send({
                    "status": 1,
                    "data": {"userData": newUser, "storeData": newStore, "token": token}
                });
            }).catch((e) => {
                if(e.code){
                    if(e.code == 11000){
                        if(e.errmsg.includes("phoneNumber")){
                            res.status(400).send({
                                "status": 0,
                                "message": "This store phone number is already exist."
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
});

/* update admin profile. */
router.post('/admin/profile', authenticate, function(req, res, next) {
  let user = req.user;
    let updateBody = {};
    if(req.body.name){updateBody.name = req.body.name}
    if(req.body.email){updateBody.email = req.body.email}
    if(req.body.phoneNumber){updateBody.phoneNumber = req.body.phoneNumber}

    let query = {_id: user._id};
    User.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
        if(e){
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
                    "message": "error while updating user data."
                });
            }
        }else{
            return res.send({
                "status": 1,
                "data": {"userData": response}
            });   
        }
    })
});

module.exports = router;
