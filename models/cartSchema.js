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
        ref: "Product", // Correct the model name here
      },
      quantity: {
        type: Number,
        default: 1,
      },
      offerDiscount: {
        type: Number,
        required: true,
      },
      totalPriceWithOffer: {
        type: Number,
        required: true,
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
}, { timestamps: true });

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;
