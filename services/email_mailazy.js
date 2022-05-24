const MailazyClient = require('mailazy-node');
const client = new MailazyClient({ accessKey: process.env['mailazy_key'], accessSecret: process.env['mailazy_secret'] });

module.exports = {
    single_email_otp: async function(otp, receiver_email, callback){
        try {
            const resp = await client.send({
                to: receiver_email,
                from: 'Tradket <no-reply@tradket.com>',
                subject: 'كود التفعيل',
                text: " ",
                html: `
                    <!DOCTYPE html>
                    <html>
                        <head></head>
                        <body>
                            <div>
                                <div style="background-color: #1c95bf; height: 170px; text-align: center;">
                                    <img src="https://tradket.sfo3.digitaloceanspaces.com/tradket_assets/images/images/tradket_logo.png" alt="tradket" style="width: 230px; margin-top: 45px;" />
                                </div>
                                <div style="border-left: 2px solid #1c95bf; border-right: 2px solid #1c95bf; background-color: #fff !important; padding: 15px 30px; text-align: center;">
                                    <p style="color:#000; font-size: 25px; margin-bottom: 30px;">عميلنا العزيز</p>
                                    <p style="color:#000; font-size: 22px;">يمكنك استخدام هذا الرقم لتفعيل حسابك</p>
                                    <p style="color:#000; font-size: 24px; margin-bottom: 15px;">${otp}</p>
                                </div>
                                <div style="background-color: #1c95bf; height: 70px; text-align: center;">
                                    <a style="text-decoration: none;" href="https://tradket.com"><span style="line-height: 70px; font-size: 22px; color: #fff;">tradket.com</span></a>
                                </div>
                            </div>
                        </body>
                    </html>`
            });
            return callback(false, resp);
        } catch (e) {
            console.log("##################");
            console.log(e)
            return callback(true);
        }
    }
}