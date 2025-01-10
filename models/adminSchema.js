const mongoose = require('mongoose');
const bcrypt = require('bcrypt');


const adminSchema = new mongoose.Schema({
   
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
    isAdmin:{
        type:Boolean,
        default:true
    }
   
});



const Admin = mongoose.model('Admin', adminSchema);
module.exports = Admin;
