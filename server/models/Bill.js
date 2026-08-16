const mongoose = require('mongoose');

const billSchema = new mongoose.Schema(
  {
    templateId: { type: String, default: '1' },
    companyId: { type: String, default: '1' },
    billNumber: { type: String, required: true },
    customerName: { type: String, required: true },
    headerData: { type: Object, default: {} },
    rowData: { type: Array, default: [] },
    totalAmount: { type: Number, default: 0 },
    pdfUri: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Bill', billSchema);
