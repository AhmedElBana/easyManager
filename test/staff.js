const expect = require('expect');
const request = require('supertest');
var server = require("./../bin/www").server;


const StaffTest = () => {
    let newStaff = {
        "name": "staff" + currentDateNumer,
        "email": "staff" + currentDateNumer + "@test.com",
        "phoneNumber": currentDateNumer + 10,
        "permissions": "100",
        "branches": "11,5da762fbd79c93148fc1aae4",
        "password": currentDateNumer
    }
    describe('Staff', () => {
        it('Creat Staff (true data)', (done) => {
            request(server)
              .post('/api/staff/create')
              .send(newStaff)
              .set('Accept', 'application/json')
              .set('x-auth',token)
              .expect('Content-Type', /json/)
              .expect(201, done);
        });
        it('Creat Staff (without x-auth)', (done) => {
            request(server)
              .post('/api/staff/create')
              .send(newStaff)
              .set('Accept', 'application/json')
              .expect(401, done);
        });
        let staffNoName = {...newStaff};
        delete staffNoName.name;
        it('Creat Staff (without name)', (done) => {
            request(server)
              .post('/api/staff/create')
              .send(staffNoName)
              .set('Accept', 'application/json')
              .set('x-auth',token)
              .expect('Content-Type', /json/)
              .expect(400, done);
        });
        let staffNoEmail = {...newStaff};
        delete staffNoEmail.email;
        it('Creat Staff (without email)', (done) => {
            request(server)
              .post('/api/staff/create')
              .send(staffNoEmail)
              .set('Accept', 'application/json')
              .set('x-auth',token)
              .expect('Content-Type', /json/)
              .expect(400, done);
        });
        let staffNoPhoneNumber = {...newStaff};
        delete staffNoPhoneNumber.phoneNumber;
        it('Creat Staff (without phoneNumber)', (done) => {
            request(server)
              .post('/api/staff/create')
              .send(staffNoPhoneNumber)
              .set('Accept', 'application/json')
              .set('x-auth',token)
              .expect('Content-Type', /json/)
              .expect(400, done);
        });
        let staffNoPerms = {...newStaff};
        delete staffNoPerms.permissions;
        it('Creat Staff (without permissions)', (done) => {
            request(server)
              .post('/api/staff/create')
              .send(staffNoPerms)
              .set('Accept', 'application/json')
              .set('x-auth',token)
              .expect('Content-Type', /json/)
              .expect(400, done);
        });
        let staffNoBranches = {...newStaff};
        delete staffNoBranches.branches;
        it('Creat Staff (without branches)', (done) => {
            request(server)
              .post('/api/staff/create')
              .send(staffNoBranches)
              .set('Accept', 'application/json')
              .set('x-auth',token)
              .expect('Content-Type', /json/)
              .expect(400, done);
        });
        let staffNoPassword = {...newStaff};
        delete staffNoPassword.password;
        it('Creat Staff (without password)', (done) => {
            request(server)
              .post('/api/staff/create')
              .send(staffNoPassword)
              .set('Accept', 'application/json')
              .set('x-auth',token)
              .expect('Content-Type', /json/)
              .expect(400, done);
        });
        let currentDateNumer2 = currentDateNumer + 1;
        let newStaff2 = {
            "name": "staff" + currentDateNumer2,
            "email": "staff" + currentDateNumer2 + "@test.com",
            "phoneNumber": currentDateNumer2 + 10,
            "permissions": "100",
            "branches": "11,5da762fbd79c93148fc1aae4",
            "password": currentDateNumer2
        }
        let staffWrongPerms = {...newStaff2};
        staffWrongPerms.permissions= "bla";
        it('Creat Staff (Wrong permissions)', (done) => {
            request(server)
              .post('/api/staff/create')
              .send(staffWrongPerms)
              .set('Accept', 'application/json')
              .set('x-auth',token)
              .expect('Content-Type', /json/)
              .expect(201)
                .expect((res) => {
                    expect(res.body.data.userData).toInclude({
                    "permissions": []
                    })
                })
                .end(done);
        });
        let currentDateNumer3 = currentDateNumer2 + 1;
        let newStaff3 = {
            "name": "staff" + currentDateNumer3,
            "email": "staff" + currentDateNumer3 + "@test.com",
            "phoneNumber": currentDateNumer3 + 10,
            "permissions": "100",
            "branches": "11,5da762fbd79c93148fc1aae4",
            "password": currentDateNumer3
        }
        let staffWrongBranches = {...newStaff3};
        staffWrongBranches.branches= "bla";
        it('Creat Staff (Wrong branches)', (done) => {
            request(server)
              .post('/api/staff/create')
              .send(staffWrongBranches)
              .set('Accept', 'application/json')
              .set('x-auth',token)
              .expect('Content-Type', /json/)
              .expect(201)
                .expect((res) => {
                    expect(res.body.data.userData).toInclude({
                    "branches": []
                    })
                })
                .end(done);
        });
        let currentDateNumer4 = currentDateNumer3 + 1;
        let newStaff4 = {
            "name": "staff" + currentDateNumer4,
            "email": "staff" + currentDateNumer3 + "@test.com",
            "phoneNumber": currentDateNumer4 + 10,
            "permissions": "100",
            "branches": "11,5da762fbd79c93148fc1aae4",
            "password": currentDateNumer4
        }
        it('Creat Staff (Duplicate email)', (done) => {
            request(server)
                .post('/api/staff/create')
                .send(newStaff4)
                .set('Accept', 'application/json')
                .set('x-auth',token)
                .expect('Content-Type', /json/)
                .expect(400)
                .expect((res) => {
                    expect(res.body).toInclude({
                    "message": "This email is already exist."
                    })
                })
                .end(done);
        });
        let newStaff5 = {
            "name": "staff" + currentDateNumer4,
            "email": "staff" + currentDateNumer4 + "@test.com",
            "phoneNumber": currentDateNumer3 + 10,
            "permissions": "100",
            "branches": "11,5da762fbd79c93148fc1aae4",
            "password": currentDateNumer4
        }
        it('Creat Staff (Duplicate email)', (done) => {
            request(server)
                .post('/api/staff/create')
                .send(newStaff5)
                .set('Accept', 'application/json')
                .set('x-auth',token)
                .expect('Content-Type', /json/)
                .expect(400)
                .expect((res) => {
                    expect(res.body).toInclude({
                    "message": "This phone number is already exist."
                    })
                })
                .end(done);
        });
        it('Staff Login', (done) => {
            let userLogin = {
                "email": newStaff.email,
                "password": newStaff.password.toString()
            }
            request(server)
              .post('/api/users/login')
              .send(userLogin)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200, done);
        });
    })
    return token
}
module.exports.StaffTest = StaffTest;