const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid'); // Import UUID for unique IDs

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: false,
        unique: true,
        sparse: true  
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: function () {
            return !this.isGuestCheckout; 
        }
    },
    cancellationReason: {
        type: String
    },
    isGuestCheckout: {
        type: Boolean,
        default: false
    },
    guestEmail: {
        type: String,
        required: function () {
            return this.isGuestCheckout === true;
        }
    },
    products: [
        {
            productOrderId: { 
                type: String, 
                default: uuidv4() // ✅ Ensure uuidv4() is called as a function
            },
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product',
                required: true
            },
            quantity: {
                type: Number,
                required: true,
                default: 1
            },
            size: {
                type: String,  
                required: true
            },
            price: {
                type: Number,
                required: true
            },
            status: {
                type: String,
                enum: ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled', 'Returned', 'Return Requested','Return Rejected'],
                default: "Pending"
            }
        }
    ],
    orderStatus: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled', 'Returned', 'Return Requested','Return Rejected'],
        default: 'Pending'
    },
    shippingAddress: {
        fullName: String,
        address: String,
        city: String,
        state: String,
        postalCode: String,
        country: String,
        phone: String
    },
    paymentMethod: [{
        type: String,
        enum: ['cod', 'razorpay', 'wallet'],  // Add all valid payment methods
        required: true
    }],
    paymentStatus: {
        type: String,
        enum: ['Pending', 'completed', 'Failed', 'Refunded'],
        default: 'Pending'
    },
    totalAmount: {
        type: Number,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    returnReason: {
        type: String,
        required: false
    },
    razorpayOrderId: {
        type: String
    },
    razorpayPaymentId: {
        type: String
    }
});

orderSchema.pre('save', function (next) {
    this.products.forEach(product => {
        if (!product.productOrderId) {
            product.productOrderId = uuidv4(); 
        }
    });
    next();
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
