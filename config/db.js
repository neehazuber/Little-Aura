const mongoose = require('mongoose');

const connectDB = async () => {
  const primaryUri = process.env.MONGO_URI;
  const localUri = 'mongodb://127.0.0.1:27017/clothbill';

  if (primaryUri) {
    try {
      console.log('Connecting to MongoDB Atlas...');
      const conn = await mongoose.connect(primaryUri, { serverSelectionTimeoutMS: 5000 });
      console.log(`MongoDB Connected (Atlas): ${conn.connection.host}`);
      return;
    } catch (error) {
      console.warn(`MongoDB Atlas connection failed: ${error.message}`);
      console.log('Attempting fallback to local MongoDB...');
    }
  }

  try {
    const conn = await mongoose.connect(localUri, { serverSelectionTimeoutMS: 5000 });
    console.log(`MongoDB Connected (Local): ${conn.connection.host}`);
  } catch (localErr) {
    console.warn(`Local MongoDB connection failed: ${localErr.message}`);
    console.warn('⚠️ Server will remain running. Please check your MongoDB service or IP whitelist settings in Atlas.');
  }
};

module.exports = connectDB;
