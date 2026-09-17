const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const { protect } = require('./authMiddleware');
const store = require('../config/store');

const getOfflineDashboardData = () => {
  const todayRevenue = store.sales.reduce((acc, sale) => acc + (sale.grandTotal || 0), 0);
  const totalStockUnits = store.products.reduce((acc, p) => acc + (p.stock || 0), 0);
  const lowStockProducts = store.products.filter(p => p.stock <= (p.lowStockThreshold || 5));

  return {
    todaySalesCount: store.sales.length,
    todayRevenue: parseFloat(todayRevenue.toFixed(2)),
    totalSalesCount: store.sales.length,
    totalRevenue: parseFloat(todayRevenue.toFixed(2)),
    totalProductsCount: store.products.length,
    totalStockUnits,
    lowStockCount: lowStockProducts.length,
    lowStockProducts,
    recentTransactions: store.sales.slice(0, 5)
  };
};

// @desc    Get dashboard summary statistics
// @route   GET /api/reports/dashboard
router.get('/dashboard', protect, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, data: getOfflineDashboardData() });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0,0,0,0);
    const endOfToday = new Date();
    endOfToday.setHours(23,59,59,999);

    const todaySales = await Sale.find({
      date: { $gte: startOfToday, $lte: endOfToday }
    });
    const todayRevenue = todaySales.reduce((acc, sale) => acc + sale.grandTotal, 0);

    const allSales = await Sale.find({});
    const totalLifetimeRevenue = allSales.reduce((acc, sale) => acc + sale.grandTotal, 0);

    const products = await Product.find({});
    const totalProductsCount = products.length;
    const totalStockUnits = products.reduce((acc, p) => acc + p.stock, 0);

    const lowStockProducts = products.filter(p => p.stock <= p.lowStockThreshold);
    const lowStockCount = lowStockProducts.length;

    const recentTransactions = await Sale.find({})
      .populate('cashier', 'name')
      .sort({ date: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        todaySalesCount: todaySales.length,
        todayRevenue: parseFloat(todayRevenue.toFixed(2)),
        totalSalesCount: allSales.length,
        totalRevenue: parseFloat(totalLifetimeRevenue.toFixed(2)),
        totalProductsCount,
        totalStockUnits,
        lowStockCount,
        lowStockProducts: lowStockProducts.slice(0, 10),
        recentTransactions
      }
    });

  } catch (error) {
    res.json({ success: true, data: getOfflineDashboardData() });
  }
});

// @desc    Get sales reports with date range and product breakouts
// @route   GET /api/reports/sales
router.get('/sales', protect, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      let totalRevenue = 0;
      let paymentBreakdown = { cash: 0, upi: 0, card: 0 };
      let productSales = {};

      store.sales.forEach(sale => {
        totalRevenue += sale.grandTotal || 0;
        if (paymentBreakdown[sale.paymentMode] !== undefined) {
          paymentBreakdown[sale.paymentMode] += sale.grandTotal || 0;
        }

        (sale.items || []).forEach(item => {
          const code = item.code || 'UNKNOWN';
          if (!productSales[code]) {
            productSales[code] = { code, name: item.name, quantity: 0, revenue: 0 };
          }
          productSales[code].quantity += item.quantity || 1;
          productSales[code].revenue += item.subtotal || item.price || 0;
        });
      });

      return res.json({
        success: true,
        summary: {
          totalRevenue: parseFloat(totalRevenue.toFixed(2)),
          totalTransactions: store.sales.length,
          paymentBreakdown: {
            cash: parseFloat(paymentBreakdown.cash.toFixed(2)),
            upi: parseFloat(paymentBreakdown.upi.toFixed(2)),
            card: parseFloat(paymentBreakdown.card.toFixed(2))
          }
        },
        sales: store.sales,
        productWiseSales: Object.values(productSales).sort((a, b) => b.revenue - a.revenue)
      });
    }

    const { startDate, endDate } = req.query;
    let query = {};
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23,59,59,999);
        query.date.$lte = end;
      }
    }

    const sales = await Sale.find(query)
      .populate('cashier', 'name')
      .sort({ date: -1 });

    let totalRevenue = 0;
    let totalTransactions = sales.length;
    let paymentBreakdown = { cash: 0, upi: 0, card: 0 };
    let productSales = {};

    sales.forEach(sale => {
      totalRevenue += sale.grandTotal;
      if (paymentBreakdown[sale.paymentMode] !== undefined) {
        paymentBreakdown[sale.paymentMode] += sale.grandTotal;
      }

      sale.items.forEach(item => {
        const code = item.code;
        if (!productSales[code]) {
          productSales[code] = { code, name: item.name, quantity: 0, revenue: 0 };
        }
        productSales[code].quantity += item.quantity;
        productSales[code].revenue += item.subtotal;
      });
    });

    res.json({
      success: true,
      summary: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalTransactions,
        paymentBreakdown: {
          cash: parseFloat(paymentBreakdown.cash.toFixed(2)),
          upi: parseFloat(paymentBreakdown.upi.toFixed(2)),
          card: parseFloat(paymentBreakdown.card.toFixed(2))
        }
      },
      sales,
      productWiseSales: Object.values(productSales).sort((a, b) => b.revenue - a.revenue)
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
