// Vercel Serverless: Marketplace API with Pusher Real-Time Events
const { connectToDatabase, MarketplaceOrder, TransportBid } = require('./_db');

// Initialize Pusher server-side (triggers events to all subscribed clients)
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

// Fire a Pusher event safely (won't throw if Pusher is not configured)
async function pushEvent(event, data) {
  if (!pusher) return;
  try {
    await pusher.trigger('quarry-live', event, data);
  } catch (e) {
    console.warn(`Pusher trigger failed for ${event}:`, e.message);
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const db = await connectToDatabase();

  // ─── GET: Fetch orders and bids ───────────────────────────────────────────
  if (req.method === 'GET') {
    const { orderId, driverId } = req.query || {};

    if (!db) {
      return res.json({ success: true, orders: [], bids: [], offline: true });
    }

    try {
      if (orderId) {
        const order = await MarketplaceOrder.findById(orderId).lean();
        const bids = await TransportBid.find({ orderId }).sort({ createdAt: -1 }).lean();
        return res.json({ success: true, order, bids });
      }

      const orders = await MarketplaceOrder.find().sort({ createdAt: -1 }).lean();
      const bids = await TransportBid.find().sort({ createdAt: -1 }).lean();
      return res.json({ success: true, orders, bids });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // ─── POST: Create order or submit bid ─────────────────────────────────────
  if (req.method === 'POST') {
    const { action, ...payload } = req.body || {};

    // 1. Customer posts material requirement
    if (action === 'create_order' || !action) {
      if (!db) {
        return res.json({
          success: true,
          offline: true,
          order: { ...payload, id: Date.now().toString(), _id: Date.now().toString(), status: 'requirement_posted', createdAt: new Date().toISOString() },
        });
      }
      try {
        const newOrder = await MarketplaceOrder.create({
          customerName: payload.customerName || 'Customer',
          customerPhone: payload.customerPhone || '',
          customerAddress: payload.customerAddress || 'Customer Site',
          materialName: payload.materialName || 'River Sand',
          quantity: parseFloat(payload.quantity) || 1,
          unitType: payload.unitType || 'ton',
          status: 'requirement_posted',
        });

        // REAL-TIME: Notify all quarry owners immediately
        await pushEvent('order-created', {
          orderId: newOrder._id.toString(),
          customerName: newOrder.customerName,
          materialName: newOrder.materialName,
          quantity: newOrder.quantity,
          unitType: newOrder.unitType,
          customerAddress: newOrder.customerAddress,
          status: 'requirement_posted',
          createdAt: newOrder.createdAt,
        });

        return res.json({ success: true, order: newOrder });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    }

    // 2. Driver submits transport bid
    if (action === 'submit_bid') {
      const { orderId, driverId, driverName, vehicleNo, fareQuote, distanceKm } = payload;
      if (!db) return res.json({ success: true, offline: true });
      try {
        const newBid = await TransportBid.create({
          orderId,
          driverId,
          driverName,
          vehicleNo: vehicleNo || '',
          fareQuote: parseFloat(fareQuote) || 0,
          distanceKm: parseFloat(distanceKm) || 10,
          status: 'pending',
        });

        await MarketplaceOrder.findByIdAndUpdate(orderId, { status: 'bidding_active' });

        // REAL-TIME: Notify quarry owner that a new bid came in
        await pushEvent('bid-submitted', {
          orderId,
          bidId: newBid._id.toString(),
          driverId,
          driverName,
          vehicleNo,
          fareQuote: parseFloat(fareQuote) || 0,
          distanceKm: parseFloat(distanceKm) || 10,
        });

        return res.json({ success: true, bid: newBid });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    }
  }

  // ─── PATCH: Update order status ────────────────────────────────────────────
  if (req.method === 'PATCH') {
    const { action, orderId, ...payload } = req.body || {};

    if (!db || !orderId) return res.json({ success: true });

    try {
      const order = await MarketplaceOrder.findById(orderId);
      if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

      // Quarry owner quotes material rate
      if (action === 'quote_rate') {
        order.materialPrice = parseFloat(payload.materialPrice) || 0;
        order.totalPrice = order.materialPrice + order.transportPrice;
        order.status = 'rate_quoted';
        await order.save();

        // REAL-TIME: Notify customer of the quoted rate
        await pushEvent('order-updated', {
          orderId: order._id.toString(),
          status: 'rate_quoted',
          materialPrice: order.materialPrice,
          customerPhone: order.customerPhone,
        });

        return res.json({ success: true, order });
      }

      // Customer agrees with rate
      if (action === 'agree_rate') {
        order.status = 'rate_agreed';
        await order.save();

        // REAL-TIME: Notify quarry owner + broadcast to drivers
        await pushEvent('order-updated', {
          orderId: order._id.toString(),
          status: 'rate_agreed',
          materialName: order.materialName,
          quantity: order.quantity,
          unitType: order.unitType,
          customerAddress: order.customerAddress,
        });

        return res.json({ success: true, order });
      }

      // Quarry owner accepts a driver bid
      if (action === 'accept_bid') {
        const { bidId, driverId, driverName, driverPhone, vehicleNo, transportPrice } = payload;
        order.driverId = driverId;
        order.driverName = driverName;
        order.driverPhone = driverPhone || '';
        order.vehicleNo = vehicleNo || '';
        order.transportPrice = parseFloat(transportPrice) || 0;
        order.totalPrice = order.materialPrice + order.transportPrice;
        order.status = 'driver_assigned';
        await order.save();

        await TransportBid.findByIdAndUpdate(bidId, { status: 'accepted' });
        await TransportBid.updateMany({ orderId, _id: { $ne: bidId } }, { status: 'rejected' });

        // REAL-TIME: Notify the assigned driver directly
        await pushEvent('driver-assigned', {
          orderId: order._id.toString(),
          driverId,
          driverName,
          vehicleNo,
          materialName: order.materialName,
          quantity: order.quantity,
          unitType: order.unitType,
          quarryAddress: order.quarryAddress,
          customerAddress: order.customerAddress,
          transportPrice: order.transportPrice,
          status: 'driver_assigned',
        });

        return res.json({ success: true, order });
      }

      // Driver updates trip status (loaded, in_transit, delivered)
      if (action === 'update_status') {
        const prevStatus = order.status;
        order.status = payload.status;
        await order.save();

        // REAL-TIME: Notify both customer and quarry owner of status change
        await pushEvent('order-updated', {
          orderId: order._id.toString(),
          status: payload.status,
          prevStatus,
          driverName: order.driverName,
          customerName: order.customerName,
        });

        return res.json({ success: true, order });
      }

      // Quarry owner settles payment
      if (action === 'settle') {
        order.status = 'settled';
        await order.save();

        await pushEvent('order-updated', {
          orderId: order._id.toString(),
          status: 'settled',
        });

        return res.json({ success: true, order });
      }

    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }

    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
