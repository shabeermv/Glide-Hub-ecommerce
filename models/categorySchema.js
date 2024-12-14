const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true,
    },
    description: {
        type: String,
        trim: true,
        required:true
    },
    offer:{
        type:String,
        ref:'offer',
        required:false

    },

    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
    isBlocked: {
        type: Boolean,
        default: false, 
        required: true,
    },
    
});



module.exports = mongoose.model('Category', categorySchema);
