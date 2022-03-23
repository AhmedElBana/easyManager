const AdminJS = require('adminjs');
const AdminJSExpress = require('@adminjs/express');
const AdminJSMongoose = require('@adminjs/mongoose');
const bcrypt = require('bcryptjs');
AdminJS.registerAdapter(AdminJSMongoose)

let { Store } = require('./../db/models/store');
let { Admin } = require('./../db/models/admin');
let { User } = require('./../db/models/user');
let { Order } = require('./../db/models/order');
let { Customer } = require('./../db/models/customer');
let { Branch } = require('./../db/models/branch');
let { Payment } = require('./../db/models/payment');

const admin_locale = {
    translations: {
      labels: {
        loginWelcome: 'Tradket',
      },
      messages: {
        loginWelcome: 'welcome to tradket admin panel',
      },
    },
  };
const contentParent = {
    name: 'Auth',
    icon: 'Accessibility',
}
const adminJs = new AdminJS({
    databases: [],
    assets: {
        styles: ["/assets/css/admin.css"],
    },
    dashboard: {
        component: AdminJS.bundle('./../admin/home')
    },
    rootPath: '/admin',
    locale: admin_locale,
    branding: {
        companyName: 'Tradket',
        softwareBrothers: false,
        logo: 'https://tradket.sfo3.digitaloceanspaces.com/tradket_assets/images/images/tradket_logo.png',
    },
    resources: [
        { resource: Store, options: { listProperties: ['_id', 'name','parent', 'availableSMS','usedSMS', 'imagesStorageLimit', 'imagesStorage', 'phoneNumber','returnOrederAllowed','returnOrederDays','returnAnyBranch'] } },
        { resource: Admin, 
            options: { 
                listProperties: ['name', 'email','active'],
                properties: {
                    _id: {
                        isVisible: { list: false, filter: true, show: true, edit: false }
                    },
                    permissions: {
                        isVisible: { list: false, filter: false, show: true, edit: true },
                        availableValues: JSON.parse(process.env['admin_permisitions'])
                    },
                    active: {
                        isVisible: { list: true, filter: true, show: true, edit: true }
                    },
                    password: {
                        type: 'password',
                        isVisible: {list: false, edit: true, filter: false, show: false}
                    },
                },
                parent: contentParent,
                actions: {
                    new: {isAccessible: ({ currentAdmin }) => currentAdmin && currentAdmin.permissions.includes("can create admin")},
                    edit: {isAccessible: ({ currentAdmin }) => currentAdmin && currentAdmin.permissions.includes("can edit admin")},
                    delete: {isAccessible: ({ currentAdmin }) => currentAdmin && currentAdmin.permissions.includes("can delete admin")},
                }
            }
        },
        { resource: User, 
            options: { 
                listProperties: ['name', 'email', 'phoneNumber', 'type', 'parent'],
                properties: {
                    _id: {
                      isVisible: { list: false, filter: true, show: true, edit: false }
                    },
                    permissions: {
                        isVisible: { list: false, filter: false, show: true, edit: true },
                        availableValues: JSON.parse(process.env['user_permisitions'])
                    },
                    active: {
                        isVisible: { list: false, filter: true, show: true, edit: true }
                    },
                    password: {
                        type: 'password',
                        isVisible: {list: false, edit: true, filter: false, show: false}
                    },
                    code: {
                        isVisible: { list: false, filter: false, show: true, edit: true }
                    },
                    is_login: {
                        isVisible: { list: false, filter: false, show: true, edit: true }
                    },
                    type: {
                        availableValues: [
                            {value: 'admin', label: 'Admin'},
                            {value: 'staff', label: 'Staff'},
                        ],
                    },
                },
                parent: contentParent,
                actions: {
                    new: {isAccessible: ({ currentAdmin }) => currentAdmin && currentAdmin.permissions.includes("can create user")},
                    edit: {isAccessible: ({ currentAdmin }) => currentAdmin && currentAdmin.permissions.includes("can edit user")},
                    delete: {isAccessible: ({ currentAdmin }) => currentAdmin && currentAdmin.permissions.includes("can delete user")},
                }
            }
        },
        { resource: Customer, 
            options: { 
                listProperties: ['name', 'phoneNumber', 'email', 'register_completed', 'parent'],
                properties: {
                    _id: {
                      isVisible: { list: false, filter: true, show: true, edit: false }
                    },
                    password: {
                        type: 'password',
                        isVisible: {list: false, edit: true, filter: false, show: false}
                    },
                    code: {
                        isVisible: { list: false, filter: false, show: true, edit: true }
                    },
                    is_login: {
                        isVisible: { list: false, filter: false, show: true, edit: true }
                    },
                    debt: {
                        isVisible: { list: false, filter: false, show: true, edit: true }
                    },
                },
                parent: contentParent,
                actions: {
                    new: {isAccessible: ({ currentAdmin }) => currentAdmin && currentAdmin.permissions.includes("can create customer")},
                    edit: {isAccessible: ({ currentAdmin }) => currentAdmin && currentAdmin.permissions.includes("can edit customer")},
                    delete: {isAccessible: ({ currentAdmin }) => currentAdmin && currentAdmin.permissions.includes("can delete customer")},
                }
            }
        },
        Order, Branch, Payment]
});
const router = AdminJSExpress.buildAuthenticatedRouter(adminJs, 
    {
        authenticate: async (email, password) => {
            const user = await Admin.findOne({ email })
            if (user) {
                const matched = await bcrypt.compare(password, user.password)
                if (matched) {
                    if(user.active){
                        return user
                    }else{
                        return false
                    }
                }
            }
            return false
        }
    },
);

module.exports = {adminJs, router};