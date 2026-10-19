require('dotenv').config();
const mongoose = require('mongoose');

const clearAllData = async () => {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    console.log('Connected! Clearing all data...\n');

    const db = mongoose.connection.db;

    // Delete all sales
    const sales = await db.collection('sales').deleteMany({});
    console.log(`✅ Deleted ${sales.deletedCount} sales records`);

    // Delete all inventory logs
    const logs = await db.collection('inventorylogs').deleteMany({});
    console.log(`✅ Deleted ${logs.deletedCount} inventory log records`);

    // Delete all customers
    const customers = await db.collection('customers').deleteMany({});
    console.log(`✅ Deleted ${customers.deletedCount} customer records`);

    // Delete all products
    const products = await db.collection('products').deleteMany({});
    console.log(`✅ Deleted ${products.deletedCount} product records`);

    // Delete all categories
    const categories = await db.collection('categories').deleteMany({});
    console.log(`✅ Deleted ${categories.deletedCount} category records`);

    // Delete all brands
    const brands = await db.collection('brands').deleteMany({});
    console.log(`✅ Deleted ${brands.deletedCount} brand records`);

    console.log('\n🎉 All data cleared! Your system is now fresh and clean.');
    console.log('Admin login (admin / admin123) is preserved.\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
};

clearAllData();
