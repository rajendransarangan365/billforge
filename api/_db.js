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

// ─── 1. User & Driver/Vehicle Profile ──────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    passwordHash: { type: String, default: 'demo' },
    role: { type: String, enum: ['customer', 'owner', 'driver', 'admin'], default: 'customer' },
    // Vehicle & Driver fields
    vehicleNo: { type: String, default: '' },
    vehicleType: { type: String, default: '10-Wheeler Tipper' },
    capacityTon: { type: Number, default: 10 },
    isOutsourced: { type: Boolean, default: true },
    associatedQuarryId: { type: String, default: '' },
    verificationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
    documents: {
      licenceNo: { type: String, default: '' },
      rcNo: { type: String, default: '' },
      insuranceNo: { type: String, default: '' },
      permitNo: { type: String, default: '' },
    },
    bankDetails: {
      accountNo: { type: String, default: '' },
      ifsc: { type: String, default: '' },
    },
    // Operational State Machine
    currentOperationalState: {
      type: String,
      enum: [
        'OFFLINE', 'ONLINE', 'OFFER_RECEIVED', 'ACCEPTED',
        'GOING_TO_QUARRY', 'ARRIVED_AT_QUARRY', 'LOADING',
        'LOADED', 'IN_TRANSIT', 'ARRIVED_AT_SITE', 'UNLOADING', 'DELIVERED'
      ],
      default: 'OFFLINE',
    },
    lat: { type: Number, default: 11.0168 },
    lng: { type: Number, default: 76.9558 },
  },
  { timestamps: true }
);

// ─── 2. Quarry Material Catalog ───────────────────────────────────────────────
const quarryMaterialSchema = new mongoose.Schema(
  {
    quarryId: { type: String, required: true },
    quarryName: { type: String, required: true },
    materialName: { type: String, required: true }, // River Sand, M-Sand, Blue Metal, Jelly, Gravel, Quarry Dust
    basePrice: { type: Number, required: true },
    unitType: { type: String, default: 'ton' },
    availableQty: { type: Number, default: 500 },
    moq: { type: Number, default: 1 },
    isAvailable: { type: Boolean, default: true },
    rating: { type: Number, default: 4.8 },
    reliabilityScore: { type: Number, default: 98 },
  },
  { timestamps: true }
);

// ─── 3. Customer Enquiry ──────────────────────────────────────────────────────
const enquirySchema = new mongoose.Schema(
  {
    customerId: { type: String, default: 'cust-demo' },
    customerName: { type: String, required: true },
    customerPhone: { type: String, default: '' },
    materialName: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    unitType: { type: String, default: 'ton' },
    deliveryDate: { type: String, default: '' },
    timeWindow: { type: String, default: '10 AM - 1 PM' },
    siteLocation: {
      lat: { type: Number, default: 11.0168 },
      lng: { type: Number, default: 76.9558 },
      address: { type: String, required: true },
      landmark: { type: String, default: '' },
      contactPerson: { type: String, default: '' },
      contactPhone: { type: String, default: '' },
      deliveryInstructions: { type: String, default: '' },
      maxVehicleWeightTon: { type: Number, default: 20 },
    },
    status: { type: String, enum: ['open', 'quoted', 'negotiating', 'accepted', 'cancelled'], default: 'open' },
  },
  { timestamps: true }
);

// ─── 4. Quote & Controlled Negotiation ─────────────────────────────────────────
const quoteSchema = new mongoose.Schema(
  {
    enquiryId: { type: String, required: true },
    quarryId: { type: String, required: true },
    quarryName: { type: String, required: true },
    quarryAddress: { type: String, default: 'Karur Road Quarry Yard' },
    quarryLat: { type: Number, default: 10.9601 },
    quarryLng: { type: Number, default: 78.0766 },
    materialPrice: { type: Number, required: true },
    transportPrice: { type: Number, default: 0 },
    platformFee: { type: Number, default: 150 },
    tax: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true },
    estDeliveryHours: { type: Number, default: 4 },
    negotiationHistory: [
      {
        proposedBy: { type: String, enum: ['customer', 'quarry'] },
        materialPrice: { type: Number },
        transportPrice: { type: Number },
        note: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    status: { type: String, enum: ['pending', 'countered', 'accepted', 'rejected'], default: 'pending' },
  },
  { timestamps: true }
);

// ─── 5. Frozen Order Architecture (Commercial Contract) ──────────────────────
const orderSchema = new mongoose.Schema(
  {
    enquiryId: { type: String, required: true },
    quoteId: { type: String, required: true },
    customerId: { type: String, required: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String, default: '' },
    quarryId: { type: String, required: true },
    quarryName: { type: String, required: true },
    materialName: { type: String, required: true },
    totalQuantity: { type: Number, required: true },
    unitType: { type: String, default: 'ton' },
    // Frozen Price Snapshot
    priceSnapshot: {
      materialPrice: { type: Number, required: true },
      transportPrice: { type: Number, required: true },
      platformFee: { type: Number, default: 150 },
      tax: { type: Number, default: 0 },
      totalAmount: { type: Number, required: true },
    },
    siteLocation: {
      lat: { type: Number, default: 11.0168 },
      lng: { type: Number, default: 76.9558 },
      address: { type: String, default: '' },
      landmark: { type: String, default: '' },
      contactPerson: { type: String, default: '' },
      contactPhone: { type: String, default: '' },
      deliveryInstructions: { type: String, default: '' },
    },
    totalTripsRequired: { type: Number, default: 1 },
    completedTrips: { type: Number, default: 0 },
    status: { type: String, enum: ['confirmed', 'in_progress', 'completed', 'settled'], default: 'confirmed' },
  },
  { timestamps: true }
);

// ─── 6. Multi-Trip Logistics & Driver Assignment ──────────────────────────────
const tripSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true },
    tripNumber: { type: Number, required: true },
    loadQuantityTon: { type: Number, default: 10 },
    quarryId: { type: String, required: true },
    quarryName: { type: String, required: true },
    quarryAddress: { type: String, default: '' },
    quarryLat: { type: Number, default: 10.9601 },
    quarryLng: { type: Number, default: 78.0766 },
    customerName: { type: String, required: true },
    customerPhone: { type: String, default: '' },
    customerAddress: { type: String, required: true },
    customerLat: { type: Number, default: 11.0168 },
    customerLng: { type: Number, default: 76.9558 },
    landmark: { type: String, default: '' },
    siteContact: { type: String, default: '' },
    instructions: { type: String, default: '' },
    // Assigned Driver & Vehicle
    driverId: { type: String, default: '' },
    driverName: { type: String, default: '' },
    driverPhone: { type: String, default: '' },
    vehicleNo: { type: String, default: '' },
    driverEarnings: { type: Number, default: 0 },
    offerTimeoutSeconds: { type: Number, default: 30 },
    tripState: {
      type: String,
      enum: [
        'UNASSIGNED', 'OFFER_RECEIVED', 'ACCEPTED',
        'GOING_TO_QUARRY', 'ARRIVED_AT_QUARRY', 'LOADING',
        'LOADED', 'IN_TRANSIT', 'ARRIVED_AT_SITE', 'UNLOADING', 'DELIVERED', 'CANCELLED'
      ],
      default: 'UNASSIGNED',
    },
    // Proof of Delivery
    proofOfDelivery: {
      photoUri: { type: String, default: '' },
      weighbridgeSlipUri: { type: String, default: '' },
      vehiclePhotoUri: { type: String, default: '' },
      otp: { type: String, default: '' },
      customerSignature: { type: String, default: '' },
      timestamp: { type: Date },
      lat: { type: Number },
      lng: { type: Number },
    },
  },
  { timestamps: true }
);

// ─── 7. System Audit Log ──────────────────────────────────────────────────────
const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    performedBy: { type: String, required: true },
    userRole: { type: String, default: '' },
    entityType: { type: String, required: true }, // Order, Quote, Trip, Price
    entityId: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

// ─── Legacy Schemas for Backward Compatibility ────────────────────────────────
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
    status: { type: String, default: 'requirement_posted' },
    driverLat: { type: Number, default: 11.0168 },
    driverLng: { type: Number, default: 76.9558 },
    documents: [{ name: String, uri: String, uploadedBy: String, createdAt: { type: Date, default: Date.now } }],
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
    status: { type: String, default: 'pending' },
  },
  { timestamps: true }
);

// Models
const User = mongoose.models.User || mongoose.model('User', userSchema);
const QuarryMaterial = mongoose.models.QuarryMaterial || mongoose.model('QuarryMaterial', quarryMaterialSchema);
const Enquiry = mongoose.models.Enquiry || mongoose.model('Enquiry', enquirySchema);
const Quote = mongoose.models.Quote || mongoose.model('Quote', quoteSchema);
const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
const Trip = mongoose.models.Trip || mongoose.model('Trip', tripSchema);
const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

// Legacy
const MarketplaceOrder = mongoose.models.MarketplaceOrder || mongoose.model('MarketplaceOrder', marketplaceOrderSchema);
const TransportBid = mongoose.models.TransportBid || mongoose.model('TransportBid', transportBidSchema);

module.exports = {
  connectToDatabase,
  User,
  QuarryMaterial,
  Enquiry,
  Quote,
  Order,
  Trip,
  AuditLog,
  MarketplaceOrder,
  TransportBid,
};
