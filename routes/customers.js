const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const { protect } = require('./authMiddleware');

const MOCK_CUSTOMERS = [];

// @desc    Get all customers or search
// @route   GET /api/customers
router.get('/', protect, async (req, res) => {
  const { search } = req.query;
  try {
    if (mongoose.connection.readyState !== 1) {
      let filtered = [...MOCK_CUSTOMERS];
      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(c => c.name.toLowerCase().includes(s) || c.phone.includes(s));
      }
      return res.json({ success: true, customers: filtered });
    }

    let query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    const customers = await Customer.find(query).sort({ name: 1 });
    res.json({ success: true, customers });
  } catch (error) {
    res.json({ success: true, customers: MOCK_CUSTOMERS });
  }
});

// @desc    Get customer details by phone
// @route   GET /api/customers/:phone
router.get('/:phone', protect, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const customer = MOCK_CUSTOMERS.find(c => c.phone === req.params.phone);
      if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
      return res.json({ success: true, customer });
    }

    const customer = await Customer.findOne({ phone: req.params.phone })
      .populate({
        path: 'purchaseHistory',
        options: { sort: { date: -1 } },
        populate: { path: 'cashier', select: 'name' }
      });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    res.json({ success: true, customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Add a new customer
// @route   POST /api/customers
router.post('/', protect, async (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ success: false, message: 'Name and phone are required' });
  }
  try {
    if (mongoose.connection.readyState !== 1) {
      const newCust = { _id: 'cust_' + Date.now(), name, phone, loyaltyPoints: 0, purchaseHistory: [] };
      MOCK_CUSTOMERS.push(newCust);
      return res.status(201).json({ success: true, customer: newCust });
    }

    const exists = await Customer.findOne({ phone });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Customer with this phone number already registered' });
    }
    const customer = await Customer.create({ name, phone });
    res.status(201).json({ success: true, customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
