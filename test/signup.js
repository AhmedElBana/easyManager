const expect = require('expect');
const request = require('supertest');
var server = require("./../bin/www").server;

const SignUpTest = (newUser) => {
    let currentDateNumer = new Date().getTime();
    var currentDateNumer2 = currentDateNumer + 2;
    let newUserDuplicateEmail = {
        "name": "test " + currentDateNumer2,
        "email": newUser.email,
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
        "phoneNumber": newUser.phoneNumber,
        "password": currentDateNumer3,
        "language": "en",
        "storeName": "mobile shop",
        "storePhoneNumber": currentDateNumer3
    }
    
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
}
module.exports.SignUpTest = SignUpTest;