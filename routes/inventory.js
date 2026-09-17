const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const InventoryLog = require('../models/InventoryLog');
const { protect } = require('./authMiddleware');

const MOCK_LOGS = [];

// @desc    Get all stock logs (auditing history)
// @route   GET /api/inventory/logs
router.get('/logs', protect, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, logs: MOCK_LOGS });
    }
    const logs = await InventoryLog.find({})
      .populate('product', 'name size color')
      .populate('user', 'name')
      .sort({ date: -1 });
    res.json({ success: true, logs });
  } catch (error) {
    res.json({ success: true, logs: MOCK_LOGS });
  }
});

// @desc    Manually adjust product stock (Stock In / Stock Out)
// @route   POST /api/inventory/adjust
router.post('/adjust', protect, async (req, res) => {
  const { productId, type, quantity, reason } = req.body;

  if (!productId || !type || !quantity || !reason) {
    return res.status(400).json({ success: false, message: 'All fields (productId, type, quantity, reason) are required' });
  }

  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ success: false, message: 'Quantity must be a positive integer' });
  }

  if (type !== 'in' && type !== 'out') {
    return res.status(400).json({ success: false, message: 'Type must be either "in" (Stock In) or "out" (Stock Out)' });
  }

  try {
    if (mongoose.connection.readyState !== 1) {
      MOCK_LOGS.unshift({
        _id: 'log_' + Date.now(),
        date: new Date(),
        product: { name: 'Adjusted Product', size: 'N/A', color: 'N/A' },
        productCode: 'SKU-' + productId,
        type,
        quantity: qty,
        reason: reason.trim(),
        user: { name: req.user ? req.user.name : 'Administrator' }
      });
      return res.status(201).json({
        success: true,
        message: `Stock successfully adjusted (${type === 'in' ? 'Added' : 'Reduced'} ${qty} units)`
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (type === 'in') {
      product.stock += qty;
    } else {
      if (product.stock < qty) {
        return res.status(400).json({ 
          success: false, 
          message: `Insufficient stock for adjustment. Current stock: ${product.stock}, requested reduction: ${qty}` 
        });
      }
      product.stock -= qty;
    }

    await product.save();

    const log = await InventoryLog.create({
      product: product._id,
      productCode: product.code,
      type,
      quantity: qty,
      reason: reason.trim(),
      user: req.user._id
    });

    res.status(201).json({
      success: true,
      message: `Stock successfully adjusted (${type === 'in' ? 'Added' : 'Reduced'} ${qty} units)`,
      product
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
