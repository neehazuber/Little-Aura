const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Brand = require('../models/Brand');
const { protect } = require('./authMiddleware');

// Mock Fallback Data when DB is disconnected
const MOCK_CATEGORIES = [
  { _id: 'cat_1', name: 'Women', description: 'Women\'s premium boutique wear' },
  { _id: 'cat_2', name: 'Men', description: 'Men\'s apparel collection' },
  { _id: 'cat_3', name: 'Kids', description: 'Junior wear and accessories' },
  { _id: 'cat_4', name: 'Accessories', description: 'Boutique luxury accessories' }
];

const MOCK_BRANDS = [
  { _id: 'brand_1', name: 'Little Aura Luxury', description: 'Premium Minimalist Wear' },
  { _id: 'brand_2', name: 'Zara', description: 'Fast fashion boutique lines' },
  { _id: 'brand_3', name: 'H&M', description: 'Casual everyday items' }
];

const store = require('../config/store');

// ==========================================
// CATEGORY CRUD
// ==========================================
router.get('/categories', protect, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, categories: MOCK_CATEGORIES });
    }
    const categories = await Category.find({}).sort({ name: 1 });
    res.json({ success: true, categories });
  } catch (error) {
    res.json({ success: true, categories: MOCK_CATEGORIES });
  }
});

router.post('/categories', protect, async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Category name is required' });
  try {
    if (mongoose.connection.readyState !== 1) {
      const newCat = { _id: 'cat_' + Date.now(), name, description };
      MOCK_CATEGORIES.push(newCat);
      return res.status(201).json({ success: true, category: newCat });
    }
    const exists = await Category.findOne({ name });
    if (exists) return res.status(400).json({ success: false, message: 'Category already exists' });
    const category = await Category.create({ name, description });
    res.status(201).json({ success: true, category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/categories/:id', protect, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const idx = MOCK_CATEGORIES.findIndex(c => c._id === req.params.id);
      if (idx !== -1) MOCK_CATEGORIES.splice(idx, 1);
      return res.json({ success: true, message: 'Category deleted successfully' });
    }
    const inUse = await Product.findOne({ category: req.params.id });
    if (inUse) {
      return res.status(400).json({ success: false, message: 'Cannot delete category currently linked to products' });
    }
    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// BRAND CRUD
// ==========================================
router.get('/brands', protect, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, brands: MOCK_BRANDS });
    }
    const brands = await Brand.find({}).sort({ name: 1 });
    res.json({ success: true, brands });
  } catch (error) {
    res.json({ success: true, brands: MOCK_BRANDS });
  }
});

router.post('/brands', protect, async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Brand name is required' });
  try {
    if (mongoose.connection.readyState !== 1) {
      const newBrand = { _id: 'brand_' + Date.now(), name, description };
      MOCK_BRANDS.push(newBrand);
      return res.status(201).json({ success: true, brand: newBrand });
    }
    const exists = await Brand.findOne({ name });
    if (exists) return res.status(400).json({ success: false, message: 'Brand already exists' });
    const brand = await Brand.create({ name, description });
    res.status(201).json({ success: true, brand });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/brands/:id', protect, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const idx = MOCK_BRANDS.findIndex(b => b._id === req.params.id);
      if (idx !== -1) MOCK_BRANDS.splice(idx, 1);
      return res.json({ success: true, message: 'Brand deleted successfully' });
    }
    const inUse = await Product.findOne({ brand: req.params.id });
    if (inUse) {
      return res.status(400).json({ success: false, message: 'Cannot delete brand currently linked to products' });
    }
    await Brand.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Brand deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// PRODUCT CRUD & SEARCH
// ==========================================
router.get('/', protect, async (req, res) => {
  const { search, category, brand, size, color, lowStock } = req.query;
  try {
    if (mongoose.connection.readyState !== 1) {
      let filtered = [...store.products];
      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(p => p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s));
      }
      if (category) filtered = filtered.filter(p => p.category._id === category || p.category.name === category);
      if (brand) filtered = filtered.filter(p => p.brand._id === brand || p.brand.name === brand);
      if (lowStock === 'true') filtered = filtered.filter(p => p.stock <= p.lowStockThreshold);
      return res.json({ success: true, products: filtered });
    }

    let query = {};
    if (category) query.category = category;
    if (brand) query.brand = brand;
    if (size) query.size = size;
    if (color) query.color = color;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }

    let products = await Product.find(query)
      .populate('category', 'name')
      .populate('brand', 'name')
      .sort({ name: 1 });

    if (lowStock === 'true') {
      products = products.filter(p => p.stock <= p.lowStockThreshold);
    }

    res.json({ success: true, products });
  } catch (error) {
    res.json({ success: true, products: store.products });
  }
});

router.post('/', protect, async (req, res) => {
  const { code, name, category, brand, size, color, price, costPrice, stock, lowStockThreshold } = req.body;
  try {
    if (mongoose.connection.readyState !== 1) {
      const catObj = MOCK_CATEGORIES.find(c => c._id === category) || { _id: category, name: 'General' };
      const brandObj = MOCK_BRANDS.find(b => b._id === brand) || { _id: brand, name: 'Brand' };
      const newProd = {
        _id: 'prod_' + Date.now(),
        code, name, category: catObj, brand: brandObj, size, color,
        price: Number(price), costPrice: Number(costPrice),
        stock: Number(stock) || 0, lowStockThreshold: Number(lowStockThreshold) || 5
      };
      store.products.push(newProd);
      return res.status(201).json({ success: true, product: newProd });
    }

    const exists = await Product.findOne({ code });
    if (exists) {
      return res.status(400).json({ success: false, message: `Product SKU/Barcode "${code}" already exists.` });
    }
    const product = new Product({
      code, name, category, brand, size, color, price, costPrice, stock: stock || 0, lowStockThreshold: lowStockThreshold || 5
    });
    await product.save();
    res.status(201).json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  const { code, name, category, brand, size, color, price, costPrice, stock, lowStockThreshold } = req.body;
  try {
    if (mongoose.connection.readyState !== 1) {
      const prod = store.products.find(p => p._id === req.params.id);
      if (prod) {
        if (code) prod.code = code;
        if (name) prod.name = name;
        if (price !== undefined) prod.price = Number(price);
        if (costPrice !== undefined) prod.costPrice = Number(costPrice);
        if (stock !== undefined) prod.stock = Number(stock);
      }
      return res.json({ success: true, product: prod });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    if (code && code !== product.code) {
      const exists = await Product.findOne({ code });
      if (exists) return res.status(400).json({ success: false, message: `Product SKU/Barcode "${code}" already exists.` });
      product.code = code;
    }
    product.name = name || product.name;
    product.category = category || product.category;
    product.brand = brand || product.brand;
    product.size = size || product.size;
    product.color = color || product.color;
    product.price = price !== undefined ? price : product.price;
    product.costPrice = costPrice !== undefined ? costPrice : product.costPrice;
    product.stock = stock !== undefined ? stock : product.stock;
    product.lowStockThreshold = lowStockThreshold !== undefined ? lowStockThreshold : product.lowStockThreshold;

    await product.save();
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const idx = store.products.findIndex(p => p._id === req.params.id);
      if (idx !== -1) store.products.splice(idx, 1);
      return res.json({ success: true, message: 'Product deleted successfully' });
    }
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
