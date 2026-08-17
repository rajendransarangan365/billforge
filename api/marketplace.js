// Vercel Serverless Function: Construction Material Marketplace, Dispatch & Bargaining Engine
const {
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
} = require('./_db');

// Initialize Pusher real-time dispatcher
let pusher = null;
try {
  const Pusher = require('pusher');
  if (process.env.PUSHER_APP_ID && process.env.PUSHER_KEY && process.env.PUSHER_SECRET) {
    pusher = new Pusher({
      appId: process.env.PUSHER_APP_ID,
      key: process.env.PUSHER_KEY,
      secret: process.env.PUSHER_SECRET,
      cluster: process.env.PUSHER_CLUSTER || 'ap2',
      useTLS: true,
    });
  }
} catch (e) {
  console.warn('Pusher not available:', e.message);
}

async function pushEvent(event, data) {
  if (!pusher) return;
  try {
    await pusher.trigger('quarry-live', event, data);
  } catch (e) {
    console.warn(`Pusher trigger error (${event}):`, e.message);
  }
}

// Distance helper (Haversine formula in km)
function calcDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 10;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}

// Pre-seeded default material catalog if database is fresh
const DEFAULT_MATERIALS = [
  { quarryName: 'Sri Murugan Quarry', materialName: 'River Sand', basePrice: 3200, unitType: 'ton', availableQty: 500, moq: 1, rating: 4.9, reliabilityScore: 99 },
  { quarryName: 'Sri Murugan Quarry', materialName: 'M-Sand', basePrice: 2600, unitType: 'ton', availableQty: 800, moq: 1, rating: 4.8, reliabilityScore: 97 },
  { quarryName: 'Coimbatore Blue Metal Yard', materialName: 'Blue Metal 20mm', basePrice: 2400, unitType: 'ton', availableQty: 600, moq: 1, rating: 4.7, reliabilityScore: 96 },
  { quarryName: 'Coimbatore Blue Metal Yard', materialName: 'Jelly 40mm', basePrice: 2200, unitType: 'ton', availableQty: 400, moq: 1, rating: 4.6, reliabilityScore: 95 },
  { quarryName: 'Kongu Gravel Supply', materialName: 'Gravel / Soil', basePrice: 1800, unitType: 'ton', availableQty: 1000, moq: 2, rating: 4.8, reliabilityScore: 98 },
  { quarryName: 'Kongu Gravel Supply', materialName: 'Quarry Dust', basePrice: 1200, unitType: 'ton', availableQty: 1200, moq: 2, rating: 4.5, reliabilityScore: 94 },
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const db = await connectToDatabase();

  // ─── GET ROUTE: Marketplace Queries ──────────────────────────────────────────
  if (req.method === 'GET') {
    const { action, customerId, quarryId, driverId, enquiryId, orderId, tripId } = req.query || {};

    if (!db) {
      return res.json({ success: true, offline: true, materials: DEFAULT_MATERIALS, enquiries: [], quotes: [], orders: [], trips: [] });
    }

    try {
      // 1. Material Catalog
      if (action === 'get_materials') {
        let materials = await QuarryMaterial.find({ isAvailable: true }).sort({ rating: -1 }).lean();
        if (materials.length === 0) {
          materials = await QuarryMaterial.insertMany(DEFAULT_MATERIALS.map(m => ({ ...m, quarryId: 'quarry-1' })));
        }
        return res.json({ success: true, materials });
      }

      // 2. Customer Enquiries & Quotes
      if (action === 'get_enquiries') {
        const filter = customerId ? { customerId } : {};
        const enquiries = await Enquiry.find(filter).sort({ createdAt: -1 }).lean();
        const quotes = await Quote.find({ enquiryId: { $in: enquiries.map(e => e._id.toString()) } }).lean();
        return res.json({ success: true, enquiries, quotes });
      }

      // 3. Single Enquiry & all submitted Quotes
      if (enquiryId) {
        const enquiry = await Enquiry.findById(enquiryId).lean();
        const quotes = await Quote.find({ enquiryId }).lean();
        return res.json({ success: true, enquiry, quotes });
      }

      // 4. Orders & Multi-Trips
      if (action === 'get_orders') {
        const filter = quarryId ? { quarryId } : (customerId ? { customerId } : {});
        const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();
        const trips = await Trip.find({ orderId: { $in: orders.map(o => o._id.toString()) } }).lean();
        return res.json({ success: true, orders, trips });
      }

      // 5. Driver Delivery Radar & Active Trips
      if (action === 'get_driver_radar') {
        // Active trips available for assignment or assigned to this driver
        const eligibleTrips = await Trip.find({
          $or: [
            { tripState: 'UNASSIGNED' },
            { driverId, tripState: { $nin: ['DELIVERED', 'CANCELLED'] } }
          ]
        }).sort({ createdAt: -1 }).lean();

        // Privacy Filter: Anonymize site details for UNASSIGNED trips
        const sanitizedTrips = eligibleTrips.map(t => {
          if (t.tripState === 'UNASSIGNED' && t.driverId !== driverId) {
            return {
              _id: t._id,
              id: t._id,
              tripNumber: t.tripNumber,
              loadQuantityTon: t.loadQuantityTon,
              quarryName: t.quarryName,
              quarryAddress: t.quarryAddress,
              driverEarnings: t.driverEarnings || (t.loadQuantityTon * 250),
              tripState: t.tripState,
              // Privacy protected fields before acceptance
              customerAddress: 'Site Location (Revealed upon acceptance)',
              siteContact: 'Hidden',
              customerPhone: 'Hidden',
              distanceKm: calcDistanceKm(t.quarryLat, t.quarryLng, t.customerLat, t.customerLng),
            };
          }
          return { ...t, id: t._id };
        });

        return res.json({ success: true, trips: sanitizedTrips });
      }

      // 6. Admin Control Tower Overview
      if (action === 'admin_overview') {
        const totalCustomers = await User.countDocuments({ role: 'customer' });
        const totalDrivers = await User.countDocuments({ role: 'driver' });
        const onlineDrivers = await User.countDocuments({ role: 'driver', currentOperationalState: 'ONLINE' });
        const activeOrders = await Order.countDocuments({ status: 'in_progress' });
        const activeTrips = await Trip.countDocuments({ tripState: { $in: ['ACCEPTED', 'GOING_TO_QUARRY', 'LOADING', 'LOADED', 'IN_TRANSIT'] } });
        const pendingDrivers = await User.find({ role: 'driver', verificationStatus: 'pending' }).lean();
        const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(20).lean();

        return res.json({
          success: true,
          stats: { totalCustomers, totalDrivers, onlineDrivers, activeOrders, activeTrips, pendingVerifications: pendingDrivers.length },
          pendingDrivers,
          logs,
        });
      }

      // Default GET: return orders & bids (legacy fallback support)
      const legacyOrders = await MarketplaceOrder.find().sort({ createdAt: -1 }).lean();
      const legacyBids = await TransportBid.find().sort({ createdAt: -1 }).lean();
      return res.json({ success: true, orders: legacyOrders, bids: legacyBids });

    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // ─── POST ROUTE: Enquiries, Quotes & Bargaining ──────────────────────────────
  if (req.method === 'POST') {
    const { action, ...payload } = req.body || {};

    try {
      // 1. Customer creates Enquiry with Pinned GPS & Instructions
      if (action === 'create_enquiry') {
        const newEnquiry = await Enquiry.create({
          customerId: payload.customerId || 'cust-demo',
          customerName: payload.customerName || 'Customer',
          customerPhone: payload.customerPhone || '',
          materialName: payload.materialName || 'River Sand',
          quantity: parseFloat(payload.quantity) || 1,
          unitType: payload.unitType || 'ton',
          deliveryDate: payload.deliveryDate || 'Today',
          timeWindow: payload.timeWindow || '10 AM - 1 PM',
          siteLocation: {
            lat: parseFloat(payload.siteLat) || 11.0168,
            lng: parseFloat(payload.siteLng) || 76.9558,
            address: payload.siteAddress || 'Site Address',
            landmark: payload.landmark || '',
            contactPerson: payload.contactPerson || payload.customerName || 'Site Engineer',
            contactPhone: payload.contactPhone || payload.customerPhone || '',
            deliveryInstructions: payload.instructions || 'Enter through main gate',
            maxVehicleWeightTon: parseFloat(payload.maxVehicleWeightTon) || 20,
          },
          status: 'open',
        });

        // Real-time Push to Quarry Owners
        await pushEvent('enquiry-created', {
          enquiryId: newEnquiry._id.toString(),
          customerName: newEnquiry.customerName,
          materialName: newEnquiry.materialName,
          quantity: newEnquiry.quantity,
          unitType: newEnquiry.unitType,
          siteAddress: newEnquiry.siteLocation.address,
        });

        return res.json({ success: true, enquiry: newEnquiry });
      }

      // 2. Quarry Owner submits Quote
      if (action === 'submit_quote') {
        const { enquiryId, quarryId, quarryName, materialPrice, transportPrice } = payload;
        const matPrice = parseFloat(materialPrice) || 0;
        const transPrice = parseFloat(transportPrice) || 500;
        const platformFee = 150;
        const tax = parseFloat(((matPrice + transPrice) * 0.05).toFixed(2));
        const totalPrice = matPrice + transPrice + platformFee + tax;

        const newQuote = await Quote.create({
          enquiryId,
          quarryId: quarryId || 'quarry-1',
          quarryName: quarryName || 'Sri Murugan Quarry',
          materialPrice: matPrice,
          transportPrice: transPrice,
          platformFee,
          tax,
          totalPrice,
          estDeliveryHours: parseFloat(payload.estDeliveryHours) || 4,
          status: 'pending',
          negotiationHistory: [{ proposedBy: 'quarry', materialPrice: matPrice, transportPrice: transPrice, note: 'Initial Quote' }],
        });

        await Enquiry.findByIdAndUpdate(enquiryId, { status: 'quoted' });

        // Real-time Push to Customer
        await pushEvent('quote-received', {
          enquiryId,
          quoteId: newQuote._id.toString(),
          quarryName: newQuote.quarryName,
          totalPrice: newQuote.totalPrice,
        });

        return res.json({ success: true, quote: newQuote });
      }

      // 3. Controlled Bargaining Counter-Offer
      if (action === 'counter_quote') {
        const { quoteId, proposedBy, materialPrice, transportPrice, note } = payload;
        const quote = await Quote.findById(quoteId);
        if (!quote) return res.status(404).json({ success: false, error: 'Quote not found' });

        const matPrice = parseFloat(materialPrice) || quote.materialPrice;
        const transPrice = parseFloat(transportPrice) || quote.transportPrice;
        const tax = parseFloat(((matPrice + transPrice) * 0.05).toFixed(2));
        const totalPrice = matPrice + transPrice + quote.platformFee + tax;

        quote.materialPrice = matPrice;
        quote.transportPrice = transPrice;
        quote.tax = tax;
        quote.totalPrice = totalPrice;
        quote.status = 'countered';
        quote.negotiationHistory.push({
          proposedBy: proposedBy || 'customer',
          materialPrice: matPrice,
          transportPrice: transPrice,
          note: note || 'Counter Offer',
          createdAt: new Date(),
        });

        await quote.save();
        await Enquiry.findByIdAndUpdate(quote.enquiryId, { status: 'negotiating' });

        // Audit Log
        await AuditLog.create({
          action: 'quote_negotiation',
          performedBy: payload.userName || proposedBy,
          userRole: proposedBy,
          entityType: 'Quote',
          entityId: quoteId,
          details: { matPrice, transPrice, totalPrice, note },
        });

        // Real-time Push
        await pushEvent('negotiation-countered', {
          quoteId,
          enquiryId: quote.enquiryId,
          proposedBy,
          totalPrice,
        });

        return res.json({ success: true, quote });
      }

      // 4. Accept Quote & Freeze Commercial Order + Multi-Trip Decomposition
      if (action === 'accept_quote') {
        const { quoteId } = payload;
        const quote = await Quote.findById(quoteId);
        if (!quote) return res.status(404).json({ success: false, error: 'Quote not found' });

        const enquiry = await Enquiry.findById(quote.enquiryId);
        if (!enquiry) return res.status(404).json({ success: false, error: 'Enquiry not found' });

        // Update Quote and Enquiry statuses
        quote.status = 'accepted';
        await quote.save();
        await Quote.updateMany({ enquiryId: enquiry._id, _id: { $ne: quoteId } }, { status: 'rejected' });
        enquiry.status = 'accepted';
        await enquiry.save();

        // 1 Order = N Trips Decomposition
        const LORRY_CAPACITY_TON = 10;
        const totalQty = enquiry.quantity;
        const totalTripsRequired = Math.ceil(totalQty / LORRY_CAPACITY_TON);

        // Freeze Commercial Terms Snapshot
        const newOrder = await Order.create({
          enquiryId: enquiry._id.toString(),
          quoteId: quote._id.toString(),
          customerId: enquiry.customerId,
          customerName: enquiry.customerName,
          customerPhone: enquiry.customerPhone,
          quarryId: quote.quarryId,
          quarryName: quote.quarryName,
          materialName: enquiry.materialName,
          totalQuantity: totalQty,
          unitType: enquiry.unitType,
          priceSnapshot: {
            materialPrice: quote.materialPrice,
            transportPrice: quote.transportPrice,
            platformFee: quote.platformFee,
            tax: quote.tax,
            totalAmount: quote.totalPrice,
          },
          siteLocation: enquiry.siteLocation,
          totalTripsRequired,
          completedTrips: 0,
          status: 'confirmed',
        });

        // Generate N Individual Trips for Lorries
        const tripsToCreate = [];
        let remainingQty = totalQty;
        for (let i = 1; i <= totalTripsRequired; i++) {
          const loadQty = Math.min(remainingQty, LORRY_CAPACITY_TON);
          remainingQty -= loadQty;
          tripsToCreate.push({
            orderId: newOrder._id.toString(),
            tripNumber: i,
            loadQuantityTon: loadQty,
            quarryId: quote.quarryId,
            quarryName: quote.quarryName,
            quarryAddress: quote.quarryAddress,
            quarryLat: quote.quarryLat,
            quarryLng: quote.quarryLng,
            customerName: enquiry.customerName,
            customerPhone: enquiry.customerPhone,
            customerAddress: enquiry.siteLocation.address,
            customerLat: enquiry.siteLocation.lat,
            customerLng: enquiry.siteLocation.lng,
            landmark: enquiry.siteLocation.landmark,
            siteContact: enquiry.siteLocation.contactPerson,
            instructions: enquiry.siteLocation.deliveryInstructions,
            driverEarnings: loadQty * 250, // ₹250 per ton transport payout
            tripState: 'UNASSIGNED',
          });
        }
        const createdTrips = await Trip.insertMany(tripsToCreate);

        // Audit Log
        await AuditLog.create({
          action: 'order_created_and_snapshotted',
          performedBy: enquiry.customerName,
          userRole: 'customer',
          entityType: 'Order',
          entityId: newOrder._id.toString(),
          details: { priceSnapshot: newOrder.priceSnapshot, tripsCreated: createdTrips.length },
        });

        // Real-time Push
        await pushEvent('order-created', {
          orderId: newOrder._id.toString(),
          quarryId: newOrder.quarryId,
          totalTrips: totalTripsRequired,
          materialName: newOrder.materialName,
        });

        return res.json({ success: true, order: newOrder, trips: createdTrips });
      }

      // Legacy fallback: Create legacy order directly if called without parameters
      if (action === 'legacy_create_order') {
        const newOrder = await MarketplaceOrder.create(payload);
        return res.json({ success: true, order: newOrder });
      }

    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // ─── PATCH ROUTE: Logistics, Driver Assignment & Trip State Machine ──────────
  if (req.method === 'PATCH') {
    const { action, tripId, orderId, driverId, ...payload } = req.body || {};

    try {
      // 1. Driver Online/Offline Switch
      if (action === 'toggle_driver_online') {
        const { state } = payload; // 'ONLINE' | 'OFFLINE'
        const updatedUser = await User.findByIdAndUpdate(driverId, { currentOperationalState: state }, { new: true });
        return res.json({ success: true, state: updatedUser.currentOperationalState });
      }

      // 2. Assign Trip to Driver (from Delivery Radar or Quarry Dispatcher)
      if (action === 'accept_trip_offer') {
        const trip = await Trip.findById(tripId);
        if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });

        if (trip.tripState !== 'UNASSIGNED' && trip.driverId && trip.driverId !== driverId) {
          return res.status(400).json({ success: false, error: 'Trip already assigned to another driver' });
        }

        const driver = await User.findById(driverId);

        trip.driverId = driverId;
        trip.driverName = driver ? driver.name : (payload.driverName || 'Ramesh Lorry');
        trip.driverPhone = driver ? driver.phone : (payload.driverPhone || '9876543210');
        trip.vehicleNo = driver ? driver.vehicleNo : (payload.vehicleNo || 'TN 38 AB 1234');
        trip.tripState = 'ACCEPTED';
        await trip.save();

        if (driver) {
          driver.currentOperationalState = 'ACCEPTED';
          await driver.save();
        }

        // Update main Order status to in_progress
        await Order.findByIdAndUpdate(trip.orderId, { status: 'in_progress' });

        // Audit Log
        await AuditLog.create({
          action: 'driver_assigned_to_trip',
          performedBy: trip.driverName,
          userRole: 'driver',
          entityType: 'Trip',
          entityId: tripId,
          details: { vehicleNo: trip.vehicleNo, tripNumber: trip.tripNumber },
        });

        // Real-time Push: Now full details are revealed
        await pushEvent('trip-accepted', {
          tripId,
          orderId: trip.orderId,
          driverName: trip.driverName,
          vehicleNo: trip.vehicleNo,
        });

        return res.json({ success: true, trip });
      }

      // 3. Advance Trip Operational State Machine
      if (action === 'update_trip_state') {
        const { nextState } = payload;
        // States: GOING_TO_QUARRY -> ARRIVED_AT_QUARRY -> LOADING -> LOADED -> IN_TRANSIT -> ARRIVED_AT_SITE -> UNLOADING -> DELIVERED
        const trip = await Trip.findById(tripId);
        if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });

        trip.tripState = nextState;
        await trip.save();

        // Update driver operational state
        if (trip.driverId) {
          await User.findByIdAndUpdate(trip.driverId, { currentOperationalState: nextState });
        }

        // Real-time Push to Quarry & Customer trackers
        await pushEvent('trip-state-changed', {
          tripId,
          orderId: trip.orderId,
          tripNumber: trip.tripNumber,
          nextState,
          driverName: trip.driverName,
        });

        return res.json({ success: true, trip });
      }

      // 4. Submit Proof of Delivery (PoD)
      if (action === 'submit_pod') {
        const { photoUri, weighbridgeSlipUri, vehiclePhotoUri, otp, customerSignature, lat, lng } = payload;
        const trip = await Trip.findById(tripId);
        if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });

        trip.proofOfDelivery = {
          photoUri: photoUri || '',
          weighbridgeSlipUri: weighbridgeSlipUri || '',
          vehiclePhotoUri: vehiclePhotoUri || '',
          otp: otp || '1234',
          customerSignature: customerSignature || '',
          timestamp: new Date(),
          lat: parseFloat(lat) || trip.customerLat,
          lng: parseFloat(lng) || trip.customerLng,
        };
        trip.tripState = 'DELIVERED';
        await trip.save();

        if (trip.driverId) {
          await User.findByIdAndUpdate(trip.driverId, { currentOperationalState: 'ONLINE' });
        }

        // Check if all trips for this order are delivered
        const orderTrips = await Trip.find({ orderId: trip.orderId });
        const completedCount = orderTrips.filter(t => t.tripState === 'DELIVERED').length;

        const order = await Order.findById(trip.orderId);
        if (order) {
          order.completedTrips = completedCount;
          if (completedCount >= order.totalTripsRequired) {
            order.status = 'completed';
          }
          await order.save();
        }

        // Audit Log
        await AuditLog.create({
          action: 'proof_of_delivery_submitted',
          performedBy: trip.driverName,
          userRole: 'driver',
          entityType: 'Trip',
          entityId: tripId,
          details: { completedCount, totalTrips: order ? order.totalTripsRequired : 1 },
        });

        // Real-time Push
        await pushEvent('pod-submitted', {
          tripId,
          orderId: trip.orderId,
          completedCount,
          isOrderCompleted: order ? order.status === 'completed' : false,
        });

        return res.json({ success: true, trip, isOrderCompleted: order ? order.status === 'completed' : false });
      }

      // 5. Admin Document Verification
      if (action === 'verify_driver') {
        const { driverUserId, status } = payload; // 'approved' | 'rejected'
        const updated = await User.findByIdAndUpdate(driverUserId, { verificationStatus: status }, { new: true });
        return res.json({ success: true, driver: updated });
      }

    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }

    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
