const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, admin } = require('./authMiddleware');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'clothbill-super-secret-key-987654321', {
    expiresIn: '30d',
  });
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    // If DB is disconnected, fallback to default admin credentials
    if (require('mongoose').connection.readyState !== 1) {
      if (username === 'admin' && password === 'admin123') {
        return res.json({
          success: true,
          token: generateToken('demo_admin_id'),
          user: {
            _id: 'demo_admin_id',
            name: 'Administrator Core',
            username: 'admin',
            role: 'admin'
          }
        });
      }
    }

    const user = await User.findOne({ username });
    if (user && (await user.matchPassword(password))) {
      res.json({
        success: true,
        token: generateToken(user._id),
        user: {
          _id: user._id,
          name: user.name,
          username: user.username,
          role: user.role
        }
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Register a new user (Staff)
// @route   POST /api/auth/register
// @access  Private/Admin
router.post('/register', protect, admin, async (req, res) => {
  const { name, username, password, role } = req.body;
  try {
    const userExists = await User.findOne({ username });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User with this username already exists' });
    }
    const user = await User.create({ name, username, password, role });
    res.status(201).json({
      success: true,
      message: 'Staff registered successfully',
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Get all staff users
// @route   GET /api/auth/staff
// @access  Private/Admin
router.get('/staff', protect, admin, async (req, res) => {
  try {
    const staff = await User.find({}).select('-password');
    res.json({ success: true, staff });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Change password
// @route   PUT /api/auth/password
// @access  Private
router.put('/password', protect, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  try {
    const user = await User.findById(req.user._id);
    if (user && (await user.matchPassword(oldPassword))) {
      user.password = newPassword;
      await user.save();
      res.json({ success: true, message: 'Password updated successfully' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid current password' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Delete a staff user
// @route   DELETE /api/auth/staff/:id
// @access  Private/Admin
router.delete('/staff/:id', protect, admin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot delete default administrator accounts' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Staff deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
