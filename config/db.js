const mongoose = require('mongoose');

const connectDb = async () => {
  try {
    // MongoDB connection string with the default options.
    await mongoose.connect('mongodb://localhost:27017/glide_hub');
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
};

module.exports = connectDb;
