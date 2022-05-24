const axios = require('axios');

module.exports = {
    single_whatsapp_otp: async function(otp, receiver_phone, callback){
        try {
            try{
                const resp = await axios.post(
                    `https://graph.facebook.com/v13.0/109789025074795/messages`,
                    {
                        "messaging_product": "whatsapp",
                        "to": "2" + receiver_phone,
                        "type": "template",
                        "template": {
                            "name": "otp",
                            "language": {
                                "code": "ar"
                            },
                            "components": [{
                                "type": "body",
                                "parameters": [
                                    {
                                        "type": "text",
                                        "text": otp
                                    }
                                ]
                            }]
                        }
                    }, 
                    {
                        headers: {
                            "Content-Type": "application/json",
                            "Accept": "application/json",
                            "Authorization": "Bearer " + process.env['FACEBOOK_ACCESS_TOKEN']
                        }
                    }
                )
                return callback(false, {"succes": true});
            }catch(error){
                return callback(true);
            }
        } catch (e) {
            return callback(true);
        }
    }
}