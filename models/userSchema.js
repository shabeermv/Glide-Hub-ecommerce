const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    username: {
      type: String,
      required: false,
    },
    password: {
      type: String,
      required: false,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    contact: {
      type: Number,
      required: false,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      required: false,
    },
    address:[ {
      address: {
        type: String,
        required: false,
      },
      city: {
        type: String,
        required: false,
      },
      state: {
        type: String,
        required: false,
      },
      postCode: {
        type: String,
        required: false,
      },
      country: {
        type: String,
        required: false,
      },
    }],
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);
module.exports = User;
