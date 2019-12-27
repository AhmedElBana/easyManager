const expect = require('expect');
const request = require('supertest');
var server = require("./../bin/www").server;


const SignInTest = (newUser) => {
    describe('Signin', () => {
        it('login (wrong data)', (done) => {
            let userLogin = {
                "email": newUser.email + "test",
                "password": newUser.password + "test"
            }
            request(server)
              .post('/api/users/login')
              .send(userLogin)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(401, done);
        });
        it('login (true data)', (done) => {
            let userLogin = {
                "email": newUser.email,
                "password": newUser.password.toString()
            }
            request(server)
              .post('/api/users/login')
              .send(userLogin)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                token = res.body.data.token;
                if (err) return done(err);
                done();
              });
        });
    })
    return token
}
module.exports.SignInTest = SignInTest;