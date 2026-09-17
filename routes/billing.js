const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const InventoryLog = require('../models/InventoryLog');
const { protect } = require('./authMiddleware');

const store = require('../config/store');

// @desc    Checkout and generate invoice
// @route   POST /api/billing/checkout
router.post('/checkout', protect, async (req, res) => {
  const { customerPhone, items, discountType, discountValue, paymentMode } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: 'No items in the checkout cart' });
  }

  try {
    let subtotal = 0;
    let gstTotal = 0;
    const checkoutItems = [];

    // Offline / Mock fallback
    if (mongoose.connection.readyState !== 1) {
      for (const item of items) {
        const itemSubtotal = (item.price || 1000) * item.quantity;
        const itemGst = itemSubtotal - (itemSubtotal / 1.12);
        subtotal += itemSubtotal;
        gstTotal += itemGst;
        checkoutItems.push({
          product: item.product || 'prod_1',
          name: item.name || 'Sample Product',
          code: item.code || 'P001',
          price: item.price || 1000,
          quantity: item.quantity,
          gstAmount: parseFloat(itemGst.toFixed(2)),
          subtotal: parseFloat(itemSubtotal.toFixed(2))
        });
      }

      let discountAmount = 0;
      const val = parseFloat(discountValue) || 0;
      if (discountType === 'percentage') discountAmount = subtotal * (val / 100);
      else if (discountType === 'amount') discountAmount = val;
      const grandTotal = Math.max(0, subtotal - discountAmount);

      const timestamp = Date.now().toString().slice(-6);
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const invoiceNo = `INV-${dateStr}-${timestamp}`;

      const sale = {
        _id: 'sale_' + Date.now(),
        invoiceNo,
        customerPhone: customerPhone || 'Walk-in',
        items: checkoutItems,
        subtotal: parseFloat(subtotal.toFixed(2)),
        gstTotal: parseFloat(gstTotal.toFixed(2)),
        discountType: discountType || 'none',
        discountValue: val,
        discountAmount: parseFloat(discountAmount.toFixed(2)),
        grandTotal: parseFloat(grandTotal.toFixed(2)),
        paymentMode: paymentMode || 'cash',
        cashier: { name: req.user ? req.user.name : 'Administrator' },
        date: new Date(),
        createdAt: new Date()
      };
      store.sales.push(sale);
      return res.status(201).json({
        success: true,
        message: 'Transaction completed successfully',
        sale
      });
    }

    // Verify all stocks first before modifying anything
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({ success: false, message: `Product "${item.name || 'Unknown'}" not found` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ 
          success: false, 
          message: `Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${item.quantity}` 
        });
      }
    }

    // Deduct stock, log inventory, and prepare items array
    for (const item of items) {
      const product = await Product.findById(item.product);
      
      const itemSubtotal = product.price * item.quantity;
      const itemGst = itemSubtotal - (itemSubtotal / 1.12);

      subtotal += itemSubtotal;
      gstTotal += itemGst;

      checkoutItems.push({
        product: product._id,
        name: product.name,
        code: product.code,
        price: product.price,
        quantity: item.quantity,
        gstAmount: parseFloat(itemGst.toFixed(2)),
        subtotal: parseFloat(itemSubtotal.toFixed(2))
      });

      product.stock -= item.quantity;
      await product.save();

      await InventoryLog.create({
        product: product._id,
        productCode: product.code,
        type: 'out',
        quantity: item.quantity,
        reason: 'POS Sale',
        user: req.user._id
      });
    }

    let discountAmount = 0;
    const val = parseFloat(discountValue) || 0;
    if (discountType === 'percentage') {
      discountAmount = subtotal * (val / 100);
    } else if (discountType === 'amount') {
      discountAmount = val;
    }
    const grandTotal = Math.max(0, subtotal - discountAmount);

    const timestamp = Date.now().toString().slice(-6);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const invoiceNo = `INV-${dateStr}-${timestamp}`;

    let customerObj = null;
    let resolvedCustomerPhone = 'Walk-in';
    
    if (customerPhone && customerPhone.trim() !== '' && customerPhone !== 'Walk-in') {
      customerObj = await Customer.findOne({ phone: customerPhone.trim() });
      if (customerObj) {
        resolvedCustomerPhone = customerObj.phone;
        const earnedPoints = Math.floor(grandTotal / 100);
        customerObj.loyaltyPoints += earnedPoints;
      }
    }

    const sale = new Sale({
      invoiceNo,
      customer: customerObj ? customerObj._id : undefined,
      customerPhone: resolvedCustomerPhone,
      items: checkoutItems,
      subtotal: parseFloat(subtotal.toFixed(2)),
      gstTotal: parseFloat(gstTotal.toFixed(2)),
      discountType: discountType || 'none',
      discountValue: val,
      discountAmount: parseFloat(discountAmount.toFixed(2)),
      grandTotal: parseFloat(grandTotal.toFixed(2)),
      paymentMode: paymentMode || 'cash',
      cashier: req.user._id
    });

    await sale.save();

    if (customerObj) {
      customerObj.purchaseHistory.push(sale._id);
      await customerObj.save();
    }

    const populatedSale = await Sale.findById(sale._id).populate('cashier', 'name');

    res.status(201).json({
      success: true,
      message: 'Transaction completed successfully',
      sale: populatedSale
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Get sale by invoice number
// @route   GET /api/billing/invoice/:invoiceNo
router.get('/invoice/:invoiceNo', protect, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const sale = store.sales.find(s => s.invoiceNo === req.params.invoiceNo);
      if (!sale) return res.status(404).json({ success: false, message: 'Invoice not found' });
      return res.json({ success: true, sale });
    }

    const sale = await Sale.findOne({ invoiceNo: req.params.invoiceNo })
      .populate('cashier', 'name')
      .populate('customer');
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    res.json({ success: true, sale });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
