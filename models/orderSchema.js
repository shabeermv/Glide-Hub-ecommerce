const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: false,
        unique: true,
        sparse: true  // This makes the unique index only apply to non-null values
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: function () {
            return !this.isGuestCheckout; // Only required if not a guest
        }
    },
    cancellationReason:{
        type:String
    },
    isGuestCheckout: {
        type: Boolean,
        default: false
      },
      guestEmail: {
        type: String,
        // Required if it's a guest checkout
        required: function() {
          return this.isGuestCheckout === true;
        }
      },
    products: [
        {
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
                type: String,  // Changed from Number to String to match the controller
                required: true
            },
            price: {
                type: Number,
                required: true
            }
        }
    ],
    orderStatus: {
        type: String,
        enum: ['Pending','Confirmed', 'Shipped', 'Delivered', 'Cancelled','Returned'],
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
    paymentMethod: {
        type: [String],
        enum: ['Credit Card', 'Debit Card', 'PayPal', 'UPI', 'Cash on Delivery']
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'completed', 'Failed'],
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
    razorpayOrderId: {
        type: String
      },
      razorpayPaymentId: {
        type: String
      }
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;