let {Store} = require('../db/models/store');
var sns = require('aws-node-sns');
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(
    accountSid, 
    authToken
);
module.exports = {
    single_sms: function(parent, message, phone_number, callback){
        Store.findOne({'parent': parent})
        .then((store) => {
            if(!store || store.availableSMS <= 0){
                return callback(true);
            }else{
                let updateBody = {$inc : {'usedSMS' : 1, 'availableSMS' : -1}};
                let query = {'parent': parent};
                Store.findOneAndUpdate(query,updateBody, { new: true }, (e, response) => {
                    if(e){
                        return callback(true);
                    }else{
                        try {
                            client.messages
                            .create({
                                body: message,
                                from: "+19899997691",
                                to: "+2" + phone_number
                            })
                            .then(message => callback(null, message))
                            .catch((e) => {
                                return callback(true);
                            });
                        }
                        catch(err) {
                            return callback(true);
                        }
                    }
                })
            }
        },(e) => {
            return callback(true);
        });
    }
}