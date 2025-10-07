const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: function () {
      return !this.isGuestCheckout;
    },
  },
  cancellationReason: {
    type: String,
    default: "",
  },
  isGuestCheckout: {
    type: Boolean,
    default: false,
  },
  guestEmail: {
    type: String,
    required: function () {
      return this.isGuestCheckout === true;
    },
  },
  products: [
    {
      productOrderId: {
        type: String,
        default: uuidv4(),
      },
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
        default: 1,
      },
      size: {
        type: String,
        required: true,
      },
      price: {
        type: Number,
        required: true,
      },
      status: {
        type: String,
        enum: [
          "Pending",
          "Confirmed",
          "Shipped",
          "Delivered",
          "Cancelled",
          "Returned",
          "Return Requested",
          "Return Rejected",
          "Cancel Requested",
          "Cancel Rejected",
        ],
        default: "Pending",
      },
    },
  ],
  orderStatus: {
    type: String,
    enum: [
      "Pending",
      "Confirmed",
      "Shipped",
      "Delivered",
      "Cancelled",
      "Returned",
      "Return Requested",
      "Return Rejected",
      "Cancel Requested",
      "Cancel Rejected",
      "Order Pending",
    ],
    default: "Pending",
  },
  shippingAddress: {
    fullName: String,
    address: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
    phone: String,
  },
  paymentMethod: [
    {
      type: String,
      enum: ["cod", "RazorPay", "wallet"],
      required: true,
    },
  ],
  paymentStatus: {
    type: String,
    enum: ["Pending", "completed", "Failed", "Refunded"],
    default: "Pending",
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  returnReason: {
    type: String,
    required: false,
  },
  cancelReason: {
    type: String,
  },
  razorpayOrderId: {
    type: String,
  },
  razorpayPaymentId: {
    type: String,
  },
  coupon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Coupon",
  },
  couponCode: {
    type: String,
  },
});

orderSchema.pre("save", function (next) {
  this.products.forEach((product) => {
    if (!product.productOrderId) {
      product.productOrderId = uuidv4();
    }
  });
  next();
});

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
