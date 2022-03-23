var express = require('express');
var router = express.Router();
const _ = require('lodash');
let {authenticate} = require('../middleware/authenticate');
let {User} = require('../db/models/user');
let {Customer} = require('../db/models/customer');
let {Custom_product} = require('../db/models/custom_product');
let {single_email_otp} = require('./../services/email_mailazy');
const { errorMonitor } = require('nodemailer/lib/mailer');

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
    if(req.query.customer_id){filters._id = req.query.customer_id}
    if(req.query.name){filters.name={ $regex: new RegExp(req.query.name), $options: "i" }}
    if(req.query.phoneNumber){filters.phoneNumber={ $regex: new RegExp(req.query.phoneNumber), $options: "i" }}
    
    Customer.paginate(filters, options, function(err, result) {
        let next;
        if(result.hasNextPage){
            next = "https://" + req.headers.host + "/api/customer/list?page=" + result.nextPage + "&page_size=" + page_size;
        }else{next = null;}
        let prev;
        if(result.hasPrevPage){
            prev = "https://" + req.headers.host + "/api/customer/list?page=" + result.prevPage + "&page_size=" + page_size;
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
//signup new customer
router.post('/signup', function(req, res, next) {
    let body = _.pick(req.body, ['name','phoneNumber','email','password','parent']);
    if(!body.name || !body.phoneNumber || !body.email || !body.password || !body.parent){
        res.status(400).send({"message": "Missing data, (name, phoneNumber, email, password, parent) fields are required."});
    }else{
        User.findOne({"_id": body.parent, 'type': "admin"})
        .then((user) => {
            if(!user){
                res.status(400).send({"message": "wrong parent id."});
            }else{
                Customer.findOne({"parent": body.parent, $or:[ {'phoneNumber': body.phoneNumber}, {'email': body.email}]})
                .then((customer) => {
                    if(!customer){
                        let customerObj = {
                            "name": body.name,
                            "phoneNumber": body.phoneNumber,
                            "email": body.email,
                            "password": body.password,
                            "parent": body.parent,
                            "is_login": true,
                            "register_completed": true
                        }
                        let newCustomerData = new Customer(customerObj);
                        newCustomerData.save().then((newCustomer) => {
                            let token = newCustomer.generateAuthToken();
                            return res.header('x-auth', token).status(201).send({
                                "data": newCustomer, "token": token
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
                    }else{
                        if(!customer.register_completed){
                            let newData = {
                                "name": body.name,
                                "email": body.email,
                                "password": body.password,
                                "is_login": true,
                                "register_completed": true
                            }
                            Customer.findOneAndUpdate({"_id": customer._id},newData, { new: true, useFindAndModify:false })
                            .then(current_customer => {
                                if(current_customer){
                                    let token = current_customer.generateAuthToken();
                                    return res.header('x-auth', token).status(201).send({
                                        "data": current_customer, "token": token
                                    });
                                }else{
                                    res.status(401).send({"message": "error while query customer data."});
                                }
                            })
                            .catch(err => {
                                res.status(401).send({"message": "error while query customer data."});
                            });
                        }else{
                            if(body.email == customer.email){
                                res.status(400).send({"message": "البريد الالكتروني مسجل لدينا من قبل."});
                            }else if(body.phoneNumber == customer.phoneNumber){
                                res.status(400).send({"message": "رقم الهاتف مسجل لدينا من قبل."});
                            }else{
                                res.status(400).send({"message": "error happen while query customer data."});
                            }
                        }
                    }
                },(e) => {
                    res.status(400).send({"message": "error while query customer data."});
                });
            }
        },(e) => {
            res.status(400).send({"message": "wrong parent id."});
        });
    }
});
/* customer Login. */
router.post('/login', function(req, res, next) {
    let body = _.pick(req.body, ['identifier','password','parent']);
    if(!body.identifier || !body.password || !body.parent){
        res.status(400).send({
            "status": 0,
            "message": "Missing data, (identifier, password, parent) fields are required."
        });
    }else{
        Customer.findByCredentials_identifier(body.identifier, body.password, body.parent).then((customer) => {
            let query = {_id: customer._id};
            let newData = {"is_login": true}
            Customer.findOneAndUpdate(query,newData, { new: true, useFindAndModify:false })
            .then(response => {
                if(response){
                let token = customer.generateAuthToken();
                return res.header('x-auth', token).status(201).send({
                    "data": customer, "token": token
                });
                }else{
                    res.status(401).send({
                        "status": 0,
                        "message": "Invalid customer data."
                    });
                }
            })
            .catch(err => {
                res.status(401).send({
                    "status": 0,
                    "message": "error while query customer data."
                });
            });
        }).catch((e) => {
            res.status(401).send({
                "message": {
                        "en": "Identifier or password is not correct.",
                        "ar": "خطا في المستخدم او كلمة المرور."
                }
            });
        });
    }
});
//create new customer
router.post('/create', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('142')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to create customer."
        });
    }else{
        let body = _.pick(req.body, ['name','phoneNumber']);
        if(!body.name || !body.phoneNumber){
            res.status(400).send({"message": "Missing data, (name, phoneNumber) fields are required."});
        }else{
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            let filters = {phoneNumber: body.phoneNumber, parent: body.parent}
            Customer.findOne(filters)
            .then((customer) => {
                if(!customer){
                    let customerObj = {
                        "name": body.name,
                        "phoneNumber": body.phoneNumber,
                        "register_completed": false,
                        "is_login": false,
                        "parent": body.parent
                    }
                    //create new customer
                    let newCustomerData = new Customer(customerObj);
                    newCustomerData.save().then((newCustomer) => {  
                        return res.send({
                            "data": newCustomer
                        });
                    }).catch((e) => {
                        res.status(400).send({"message": "error happen while save new customer."});
                    });
                }else{
                    res.status(400).send({
                        "message": "لديك عميل مسجل بنفس رقم الهاتف."
                    });
                }
            },(e) => {
                res.status(400).send({
                    "message": "error happen while get customer data."
                });
            });
        }
    }
});
//edit customer data
router.post('/edit', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('143')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to edit customer."
        });
    }else{
        let body = _.pick(req.body, ['customer_id','name','phoneNumber']);
        if(!body.customer_id || !body.name || !body.phoneNumber){
            res.status(400).send({"message": "Missing data, (customer_id, name, phoneNumber) fields are required."});
        }else{
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            let search_filters = {phoneNumber: body.phoneNumber, parent: body.parent}
            Customer.findOne(search_filters)
            .then((search_customer) => {
                if(!search_customer || (search_customer._id == body.customer_id)){
                    let query = {_id: body.customer_id, parent: body.parent}
                    let updateBody = {};
                    if(body.name){updateBody.name = body.name};
                    if(body.phoneNumber){updateBody.phoneNumber = body.phoneNumber};
                    Customer.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
                        if(e){
                            if(e.errmsg && e.errmsg.includes("phoneNumber")){
                                res.status(400).send({
                                    "status": 0,
                                    "message": "This phone number is already exist for another customer."
                                });
                            }else if(e.name && e.name == "CastError"){
                                res.status(400).send({
                                    "status": 0,
                                    "message": e.message
                                });
                            }else{
                                res.status(400).send({
                                    "status": 0,
                                    "message": "error while updating customer data."
                                });
                            }
                        }else{
                            if(response == null){
                                res.status(400).send({
                                    "status": 0,
                                    "message": "can't find any customer with this customer_id."
                                });
                            }else{
                                return res.send({
                                    "data": response
                                });
                            }
                        }
                    })
                }else{
                    res.status(400).send({
                        "message": "This phone number is already exist for another customer."
                    });
                }
            },(e) => {
                res.status(400).send({
                    "message": "error happen while search for customer."
                });
            });
        }
    }
});
router.get('/custom_products', authenticate, function(req, res, next) {
    if(!req.query.customer_id){
        res.status(400).send({
            "status": 0,
            "message": "customer_id is required."
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
            sort: { created_at: -1 },
            populate: [
                { path: 'customer', select: ['name', 'phoneNumber'] },
                { path: 'branch', select: ['name', 'phoneNumber', 'address', 'type'] },
                { path: 'materials_branch', select: ['name', 'phoneNumber', 'address', 'type'] },
                { path: 'created_from', select: ['name', 'email'] },
                { path: 'accepted_from', select: ['name', 'email'] },
                { path: 'ready_from', select: ['name', 'email'] },
                { path: 'delivered_from', select: ['name', 'email'] }
            ],
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
        filters.customer = req.query.customer_id
        if(errHappen){
            res.status(400).send(err);
        }else{
            Custom_product.paginate(filters, options, function(err, result) {
                let next;
                if(result.hasNextPage){
                    next = "https://" + req.headers.host + "/api/customer/custom_products?page=" + result.nextPage + "&page_size=" + page_size;
                }else{next = null;}
                let prev;
                if(result.hasPrevPage){
                    prev = "https://" + req.headers.host + "/api/customer/custom_products?page=" + result.prevPage + "&page_size=" + page_size;
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

// forgotpassword flow
router.post('/forgotpassword', function(req, res, next) {
    let body = _.pick(req.body, ['email']);
    if(body.email){
        single_email_otp(
            "5621",
            body.email,
            function(error, data){
                if (error){
                    return res.status(201).send({
                        "sms": "fail",
                        "data": errorMonitor
                    });
                }else{
                    return res.status(201).send({
                        "sms": "success",
                        "data": data
                    });
                }
            }
        )
        // User.find({email: body.email}).then(
        //     (result) => {
        //         if(result.length === 0){
        //             res.status(400).send({
        //                 "status": 0,
        //                 "message": "Invalid email."
        //             });
        //         }else{
        //             //genrate random 5 digis code
        //             let code = Math.floor(Math.random()*90000) + 10000;
        //             //save code and send message with it
        //             let query = {email: body.email};
        //             let newData = {"code": code}
        //             User.findOneAndUpdate(query,newData, { new: true })
        //             .then(response => {
        //                 if(response){
        //                   let transporter = nodeMailer.createTransport({
        //                       host: 'smtp.gmail.com',
        //                       port: 465,
        //                       secure: true,
        //                       auth: {
        //                           // should be replaced with real sender's account
        //                           user: 'ahmedelpna@gmail.com',
        //                           pass: process.env.GoogleAppPass
        //                       }
        //                   });
        //                   let mailOptions = {
        //                       // should be replaced with real recipient's account
        //                       to: result[0].email,
        //                       subject: "easyManager",
        //                       html: "<b>Your OPT is : " + code + "</b>"
        //                   };
        //                   transporter.sendMail(mailOptions, (error, info) => {
        //                       if (error) {
        //                         res.status(400).send({
        //                           "status": 0,
        //                           "message": error
        //                       });
        //                       }
        //                       return res.send({
        //                         "status": 1
        //                     });
        //                   });
        //                 }else{
        //                     res.status(400).send({
        //                         "status": 0,
        //                         "message": "Invalid email."
        //                     });
        //                 }
        //             })
        //             .catch(err => {
        //                 res.status(400).send({
        //                     "status": 0,
        //                     "message": "error while query user data."
        //                 });
        //             });
        //         }
        //     },(e) => {
        //         res.status(400).send({
        //             "status": 0,
        //             "message": "error happened while query user with email."
        //         });
        //     }
        // )
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
module.exports = router;
