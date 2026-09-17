const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  loyaltyPoints: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  purchaseHistory: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale'
  }]
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
