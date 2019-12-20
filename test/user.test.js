const expect = require('expect');
const request = require('supertest');
var server = require("./../bin/www").server;

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
var currentDateNumer2 = currentDateNumer + 2;
let newUserDuplicateEmail = {
	"name": "test " + currentDateNumer2,
	"email": "test"  + currentDateNumer + "@test.com",
	"phoneNumber": currentDateNumer2,
	"password": currentDateNumer2,
	"language": "en",
	"storeName": "mobile shop",
	"storePhoneNumber": currentDateNumer2
}
var currentDateNumer3 = currentDateNumer + 3;
let newUserDuplicatePhone = {
	"name": "test " + currentDateNumer3,
	"email": "test"  + currentDateNumer3 + "@test.com",
	"phoneNumber": currentDateNumer,
	"password": currentDateNumer3,
	"language": "en",
	"storeName": "mobile shop",
	"storePhoneNumber": currentDateNumer3
}
describe('User Test', () => {
    beforeEach(function() {
        // ...some logic before each test is run
    })
    describe('Signup', () => {
        it('signup (valid data)', (done) => {
            request(server)
              .post('/api/users/admin/create')
              .send(newUser)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201, done);
        });
        it('Signup (duplicated email)', (done) => {
            request(server)
              .post('/api/users/admin/create')
              .send(newUserDuplicateEmail)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(400)
              .expect((res) => {
                  expect(res.body).toInclude({
                    "message": "This email is already exist."
                  })
              })
              .end(done);
        });
        it('Signup (duplicated phone)', (done) => {
            request(server)
              .post('/api/users/admin/create')
              .send(newUserDuplicatePhone)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(400)
              .expect((res) => {
                  expect(res.body).toInclude({
                    "message": "This phone number is already exist."
                  })
              })
              .end(done);
        });
    })
    // describe('Signup (duplicated email)', () => {
        
    // })
    // it('login (true data)', (done) => {
    //     let userLogin = {
    //         "email": newUser.email,
    //         "password": newUser.password
    //     }
    //     request(server)
    //       .post('/api/users/login')
    //       .send(userLogin)
    //       .set('Accept', 'application/json')
    //       .expect('Content-Type', /json/)
    //       .expect(200, done);
    // });
    // it('login (wrong data)', (done) => {
    //     let userLogin = {
    //         "email": newUser.email + "test",
    //         "password": newUser.password + "test"
    //     }
    //     request(server)
    //       .post('/api/users/login')
    //       .send(userLogin)
    //       .set('Accept', 'application/json')
    //       .expect('Content-Type', /json/)
    //       .expect(401, done);
    // });
})