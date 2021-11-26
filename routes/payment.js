var express = require('express');
var router = express.Router();
const _ = require('lodash');
let {Payment} = require('./../db/models/payment');
let {Branch} = require('./../db/models/branch');
let {authenticate} = require('../middleware/authenticate');

/* Create new branch. */
router.post('/pay_out', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('137')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to pay out."
        });
    }else{
        let body = _.pick(req.body, ['name','amount']);
        if(!body.name || !body.amount){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (name, amount) fields are required."
            });
        }else{
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            let paymentObj = {
                "type": "out",
                "sub_type": "others",
                "method": "cashe",
                "status": "success",
                "name": body.name,
                "branch": req.user.branches[0],
                "amount": body.amount,
                "created_at": new Date(),
                "created_from": req.user._id,
                "parent": body.parent
            }
            let newPaymentData = new Payment(paymentObj);
            newPaymentData.save().then((newPayment) => {  
                return res.send({
                    "status": 1,
                    "data": newPayment
                });
            }).catch((e) => {
                res.status(400).send({
                    "status": 0,
                    "message": "error while creating pay out."
                });
            });
        }
    }
});
router.post('/pay_out/cancel', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('138')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to cancel pay out."
        });
    }else{
        let body = _.pick(req.body, ['payment_id']);
        if(!body.payment_id){
            res.status(400).send({
                "status": 0,
                "message": "Missing data, (payment_id) fields are required."
            });
        }else{
            if(req.user.type == 'admin'){
                body.parent = req.user._id;
            }else if(req.user.type == 'staff'){
                body.parent = req.user.parent;
            }
            let updateBody = {
                "status": "canceled"
            };
            let query = {
                "_id": body.payment_id,
                "status": "success",
                "created_from": req.user._id
            };
            Payment.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
                if(e || response == null){
                    res.status(400).send({
                        "status": 0,
                        "message": "can't find any out success payment with this payment_id for this staff."
                    });
                }else{
                    return res.send({
                        "status": 1,
                        "data": response
                    });
                }
            })
        }
    }
});
/* list branches. */
router.get('/list', authenticate, function(req, res, next) {
    if(!req.user.permissions.includes('139')){
        res.status(400).send({
            "status": 0,
            "message": "This user does not have perrmission to view payments."
        });
    }else{
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
                { path: 'created_from', select: ['name', 'email'] },
                { path: 'order', select: ['type','status','method','bill','total','payed','debt','createdDate'] }
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
        if(req.query._id){filters._id = req.query._id}
        if(req.query.type){filters.type = req.query.type}
        if(req.query.method){filters.method = req.query.method}
        if(req.query.status){filters.status = req.query.status}
        if(req.query.branch){filters.branch = req.query.branch}
        if(req.query.created_from){filters.created_from = req.query.created_from}
        if(req.query.customer){filters.customer = req.query.customer}
        if(req.query.order){filters.order = req.query.order}
        if(req.query.created_at_from){
            if(new Date(req.query.created_at_from) == "Invalid Date"){
                errHappen = true;
                err = {
                    "status": 0,
                    "message": "Invalid created_at_from."
                }
            }
            filters.created_at = {$gte: new Date(req.query.created_at_from)}
        }
        if(req.query.created_at_to){
            if(new Date(req.query.created_at_to) == "Invalid Date"){
                errHappen = true;
                err = {
                    "status": 0,
                    "message": "Invalid created_at_to."
                }
            }
            if(req.query.created_at_from){
                filters.created_at = {$gte: new Date(req.query.created_at_from), $lte: new Date(req.query.created_at_to)}
            }else{
                filters.created_at = {$lte: new Date(req.query.created_at_to)}
            }
        }
        Payment.paginate(filters, options, function(err, result) {
            let next;
            if(result.hasNextPage){
                next = "https://" + req.headers.host + "/api/payment/list?page=" + result.nextPage + "&page_size=" + page_size;
            }else{next = null;}
            let prev;
            if(result.hasPrevPage){
                prev = "https://" + req.headers.host + "/api/payment/list?page=" + result.prevPage + "&page_size=" + page_size;
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
