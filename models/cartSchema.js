const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  product: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
      size: {
        type: String,
        required: true
      },
      quantity: {
        type: Number,
        default: 1,
      },
      offerDiscount: {
        type: Number,
        required: false,
      },
      totalPriceWithOffer: {
        type: Number,
        required: false,
      },
      totalPrice: {
        type: Number,
        required: true,
      },
      price: {
        type: Number,
        required: true,
      },
    },
  ],
  totalPrice: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

const Cart = mongoose.model('Cart', cartSchema);
module.exports = Cart;
