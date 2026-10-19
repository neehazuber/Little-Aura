const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect } = require('./authMiddleware');

// @desc  Clear all data except users (admin only, temporary route)
// @route DELETE /api/admin/cleardata
router.delete('/cleardata', protect, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin only' });
  }

  try {
    const db = mongoose.connection.db;

    const sales = await db.collection('sales').deleteMany({});
    const logs = await db.collection('inventorylogs').deleteMany({});
    const customers = await db.collection('customers').deleteMany({});
    const products = await db.collection('products').deleteMany({});
    const categories = await db.collection('categories').deleteMany({});
    const brands = await db.collection('brands').deleteMany({});

    res.json({
      success: true,
      message: '✅ All data cleared successfully!',
      deleted: {
        sales: sales.deletedCount,
        inventoryLogs: logs.deletedCount,
        customers: customers.deletedCount,
        products: products.deletedCount,
        categories: categories.deletedCount,
        brands: brands.deletedCount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
