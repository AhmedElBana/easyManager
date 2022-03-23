let {Customer} = require('../db/models/customer');

let authenticate_customer = (req, res, next) => {
	let token = req.header('x-auth');
	Customer.findByToken(token).then((customer) => {
		if(!customer){
			return Promise.reject();
		}
		req.customer = customer;
		req.token = token;
		next();
	}).catch((e) => {
		res.status(401).send();
	});
};

module.exports = {authenticate_customer};