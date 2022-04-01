let {User} = require('../db/models/user');

let authenticate = (req, res, next) => {
	let token = req.header('x-auth');
	User.findByToken(token).then((user) => {
		if(!user){
			return Promise.reject({"error": "invaild token"});
		}else if(user && !user.active){
			return Promise.reject({"error": "account is not active"});
		}
		req.user = user;
		req.token = token;
		next();
	}).catch((e) => {
		res.status(401).send(e);
	});
};

module.exports = {authenticate};