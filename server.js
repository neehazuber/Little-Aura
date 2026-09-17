const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/db');

// Import models
const User = require('./models/User');
const Category = require('./models/Category');
const Brand = require('./models/Brand');
const Product = require('./models/Product');
const Customer = require('./models/Customer');

const app = express();

// Connect Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes Setup
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/reports', require('./routes/reports'));

// Serve Static Assets in production
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to SPA Frontend index.html
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
});

// Database Seeding Logic (Admin account initialization)
const seedDatabase = async () => {
  try {
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      await User.create({
        name: 'Administrator Core',
        username: 'admin',
        password: 'admin123',
        role: 'admin'
      });
      console.log('Seed: Default Admin user created (admin / admin123).');
    }
  } catch (error) {
    console.error('Seed error:', error.message);
  }
};

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  if (require('mongoose').connection.readyState === 1) {
    await seedDatabase();
  }
});
