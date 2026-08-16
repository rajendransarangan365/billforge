const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'driver'], default: 'driver' },
    vehicleNo: { type: String, default: '' },
    status: { type: String, default: 'Available' },
    lat: { type: Number, default: 11.0168 },
    lng: { type: Number, default: 76.9558 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
