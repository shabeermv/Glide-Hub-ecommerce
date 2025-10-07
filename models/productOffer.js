const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
  },
  discountType: {
    type: String,
    enum: ["percentage", "fixed"],
    required: true,
  },
  discountValue: {
    type: Number,
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
});

const ProductOffer = mongoose.model("ProductOffer", offerSchema);

module.exports = ProductOffer;
