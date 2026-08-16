const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema(
  {
    billId: { type: String, default: '' },
    customerName: { type: String, required: true },
    customerPhone: { type: String, default: '' },
    promisedAmount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    promisedDate: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'paid', 'partial', 'cancelled'], default: 'pending' },
    paidAmount: { type: Number, default: 0 },
    note: { type: String, default: '' },
    notificationId: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Reminder', reminderSchema);
