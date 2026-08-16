const mongoose = require('mongoose');

const consignmentSchema = new mongoose.Schema(
  {
    enquiryId: { type: String, required: true },
    driverId: { type: String, required: true },
    driverName: { type: String, required: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String, default: '' },
    materialName: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    unitType: { type: String, default: 'ton' },
    agreedRate: { type: Number, default: 0 },
    pickupAddress: { type: String, default: '' },
    pickupLat: { type: Number, default: 10.9601 },
    pickupLng: { type: Number, default: 78.0766 },
    customerAddress: { type: String, default: '' },
    customerLat: { type: Number, default: 11.0168 },
    customerLng: { type: Number, default: 76.9558 },
    status: {
      type: String,
      enum: ['assigned', 'reached_pickup', 'picked_up', 'reached_customer', 'delivered'],
      default: 'assigned',
    },
    driverLat: { type: Number, default: 11.0168 },
    driverLng: { type: Number, default: 76.9558 },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Consignment', consignmentSchema);
