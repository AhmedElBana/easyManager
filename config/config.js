let env = process.env.NODE_ENV || 'test';

if(env === 'development' || env === 'test'){
	let config = require('./config.json');
	let permisitions = require('./permisitions.json');
	let envConfig = config[env];

	Object.keys(envConfig).forEach((key) => {
		process.env[key] = envConfig[key]
	});
	process.env['permisitions'] = JSON.stringify(permisitions);
}
