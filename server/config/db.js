const mongoose = require('mongoose');

const connectDB = async () => {
  const connString = process.env.MONGODB_URI;

  if (!connString) {
    console.warn('⚠️ MONGODB_URI environment variable not set. Falling back to local MongoDB or memory storage.');
    return false;
  }

  try {
    const conn = await mongoose.connect(connString, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`🍃 MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    return false;
  }
};

module.exports = connectDB;
