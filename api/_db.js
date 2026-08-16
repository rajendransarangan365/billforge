// Serverless-Optimized Cached MongoDB Atlas Connection Module for Vercel
const mongoose = require('mongoose');

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn('⚠️ MONGODB_URI not provided. Serverless API running in fallback mode.');
    return false;
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };

    cached.promise = mongoose.connect(uri, opts).then((mongooseInstance) => {
      console.log('🍃 Serverless MongoDB Connected!');
      return mongooseInstance;
    }).catch((err) => {
      console.error('❌ Serverless MongoDB Connection Error:', err);
      cached.promise = null;
      return null;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

// Schemas & Models
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

const marketplaceOrderSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true },
    customerPhone: { type: String, default: '' },
    customerAddress: { type: String, default: '' },
    customerLat: { type: Number, default: 11.0168 },
    customerLng: { type: Number, default: 76.9558 },
    quarryName: { type: String, default: 'Coimbatore Sand Quarry' },
    quarryAddress: { type: String, default: 'Karur Quarry Yard 1' },
    quarryLat: { type: Number, default: 10.9601 },
    quarryLng: { type: Number, default: 78.0766 },
    materialName: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    unitType: { type: String, default: 'ton' },
    materialPrice: { type: Number, default: 0 },
    transportPrice: { type: Number, default: 0 },
    totalPrice: { type: Number, default: 0 },
    driverId: { type: String, default: '' },
    driverName: { type: String, default: '' },
    driverPhone: { type: String, default: '' },
    vehicleNo: { type: String, default: '' },
    status: {
      type: String,
      enum: ['requirement_posted', 'rate_quoted', 'rate_agreed', 'bidding_active', 'driver_assigned', 'loaded', 'in_transit', 'delivered', 'settled'],
      default: 'requirement_posted',
    },
    driverLat: { type: Number, default: 11.0168 },
    driverLng: { type: Number, default: 76.9558 },
    documents: [
      {
        name: { type: String },
        uri: { type: String },
        uploadedBy: { type: String },
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

const transportBidSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true },
    driverId: { type: String, required: true },
    driverName: { type: String, required: true },
    vehicleNo: { type: String, default: '' },
    fareQuote: { type: Number, required: true },
    distanceKm: { type: Number, default: 10 },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' }
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Enquiry = mongoose.models.Enquiry || mongoose.model('Enquiry', enquirySchema);
const Consignment = mongoose.models.Consignment || mongoose.model('Consignment', consignmentSchema);
const MarketplaceOrder = mongoose.models.MarketplaceOrder || mongoose.model('MarketplaceOrder', marketplaceOrderSchema);
const TransportBid = mongoose.models.TransportBid || mongoose.model('TransportBid', transportBidSchema);

module.exports = {
  connectToDatabase,
  User,
  Enquiry,
  Consignment,
  MarketplaceOrder,
  TransportBid,
};

