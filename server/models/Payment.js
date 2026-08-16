const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    billId: { type: String, default: '' },
    customerName: { type: String, default: '' },
    amount: { type: Number, required: true, default: 0 },
    note: { type: String, default: '' },
    paidAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
