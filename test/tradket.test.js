const expect = require('expect');
const request = require('supertest');
var server = require("./../bin/www").server;

var SignUpTest = require('./signup.js').SignUpTest;
var SignInTest = require('./signin.js').SignInTest;

let currentDateNumer = new Date().getTime();
let newUser = {
	"name": "test " + currentDateNumer,
	"email": "test"  + currentDateNumer + "@test.com",
	"phoneNumber": currentDateNumer,
	"password": currentDateNumer,
	"language": "en",
	"storeName": "mobile shop",
	"storePhoneNumber": currentDateNumer
}

global.token = "";
describe('Tradket Test', () => {
	describe('User Model', () => {
		// after(function() {
		// 	console.log("x-auth token: " + token)	 
		// })
		SignUpTest(newUser);
		SignInTest(newUser);
	})
})












// let {User} = require('./../db/models/user');
// const defaultUser = {
// 	"name": "mainTest",
// 	"email": "main2@test.com",
// 	"phoneNumber": "010999999992",
// 	"password": "123456",
// 	"language": "en",
// 	"storeName": "mainTest shop",
// 	"storePhoneNumber": "99999",
// 	"is_login": true,
// 	"active": true,
// 	"type": "admin"
// };
// const createUser = async () => {
//     const UserModel = new User(defaultUser);
//     await UserModel.save();
// };
// createUser()
// createUser().then(()=>{
// 	getDefaultUser()
// });
// const getDefaultUser = async () => {
//     let users = await User.find({ "name" : defaultUser.name });
//     if (users.length === 0) {
//         await createUser();
//         return getDefaultUser();
//     } else {
// 		console.log(users)
//         return users[0];
//     }
// };
