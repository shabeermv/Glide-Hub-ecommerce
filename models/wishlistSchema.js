const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    products: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',  // Ensure 'Product' is correctly referenced here (case-sensitive)
            required: true,
        },
        
    }],
}, { timestamps: true }); // Fixed the capitalization of timestamps

const Wishlist = mongoose.model('Wishlist', wishlistSchema);

module.exports = Wishlist;
