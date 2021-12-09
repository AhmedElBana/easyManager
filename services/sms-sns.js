let {Store} = require('../db/models/store');
var sns = require('aws-node-sns');
sns.createClient({       
    accessKeyId: "AKIA5ZLEC4WBKED2X4XS",
    secretAccessKey: "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",
    region: "eu-west-1"  
});
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
                        sns.sendSMS(
                            message, 
                            "+2" + phone_number, 
                            "Tradket" , 
                            "Promotional", 
                            callback
                        );
                    }
                })
            }
        },(e) => {
            return callback(true);
        });
    }
}