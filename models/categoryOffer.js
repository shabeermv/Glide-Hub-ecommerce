const mongoose = require('mongoose');

const categoryOfferSchema = new mongoose.Schema({
    description: {
        type: String,
        required: true
    },
    discountType: {  // Added Discount Type Field
        type: String,
        enum: ['percentage', 'fixed'],  // Only allow these two values
        required: true
    },
    discountValue: {
        type: Number,
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
});

const CategoryOffer = mongoose.model('CategoryOffer', categoryOfferSchema);

module.exports = CategoryOffer;
