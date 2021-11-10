var express = require('express');
var router = express.Router();
const _ = require('lodash');
let {Store} = require('../db/models/store');
let {authenticate} = require('../middleware/authenticate');

router.get('/info', authenticate, function(req, res, next){
    let parent;
    if(req.user.type == 'admin'){
        parent = req.user._id;
    }else if(req.user.type == 'staff'){
        parent = req.user.parent;
    }
    let filters = {parent: parent}
    Store.findOne(filters)
    .then((store) => {
        if(!store){
            res.status(400).send({
                "message": "can't find any store with this parent."
            });
        }else{
            return res.send({
                "data": store
            });
        }
    },(e) => {
        res.status(400).send({
            "message": "can't find any store with this parent."
        });
    });
});

module.exports = router;
