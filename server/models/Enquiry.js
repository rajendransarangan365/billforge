const mongoose = require('mongoose');

const enquirySchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true },
    customerPhone: { type: String, default: '' },
    materialName: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    unitType: { type: String, default: 'ton' },
    quotedRate: { type: Number, default: 0 },
    agreedRate: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'agreed', 'assigned', 'rejected'], default: 'pending' },
    pickupAddress: { type: String, default: '' },
    pickupLat: { type: Number, default: 10.9601 },
    pickupLng: { type: Number, default: 78.0766 },
    customerAddress: { type: String, default: '' },
    customerLat: { type: Number, default: 11.0168 },
    customerLng: { type: Number, default: 76.9558 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Enquiry', enquirySchema);
