let env = process.env.NODE_ENV || 'test';

if(env === 'development' || env === 'test'){
	let config = require('./config.json');
	let admin_permisitions = require('./admin_permisitions.json');
	let permisitions = require('./permisitions.json');
	let envConfig = config[env];

	Object.keys(envConfig).forEach((key) => {
		process.env[key] = envConfig[key]
	});
	let user_perms = [];
	Object.keys(permisitions).map((key) => {
		user_perms.push({"value": key, "label": permisitions[key]})
	})
	process.env['admin_permisitions'] = JSON.stringify(admin_permisitions);
	process.env['user_permisitions'] = JSON.stringify(user_perms);
	process.env['permisitions'] = JSON.stringify(permisitions);
}
