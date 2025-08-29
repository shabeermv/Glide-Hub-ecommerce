const mongoose=require('mongoose')

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
        required: true,
    },
    isDeleted: {
        type: Boolean,
        default: false, 
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
        required: false,
    },
    appliedOffer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductOffer'
    },
    products:{
    type:mongoose.Schema.Types.ObjectId,
    ref:'Product'
    }
});

module.exports = mongoose.model('Category', categorySchema);
