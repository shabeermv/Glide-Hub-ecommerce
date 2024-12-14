const mongoose = require('mongoose');
const bcrypt = require('bcrypt');


const adminSchema = new mongoose.Schema({
    adminname: {
        type: String,
        required: false,
        trim:false,
        minlength: 3
    },
    email: {
        type: String,
        required: true,
        unique:false,
        match: [/.+\@.+\..+/, 'Please enter a valid email address']
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});



const Admin = mongoose.model('Admin', adminSchema);
module.exports = Admin;
