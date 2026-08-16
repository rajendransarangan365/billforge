// Vercel Serverless Function: Swiggy-Style Quarry Marketplace & Transport Bidding API
const { connectToDatabase, MarketplaceOrder, TransportBid, User } = require('./_db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const db = await connectToDatabase();

  // GET Orders or Bids
  if (req.method === 'GET') {
    const { orderId, role, driverId } = req.query || {};

    if (db) {
      try {
        if (orderId) {
          const order = await MarketplaceOrder.findById(orderId);
          const bids = await TransportBid.find({ orderId });
          return res.json({ success: true, order, bids });
        }
        const orders = await MarketplaceOrder.find().sort({ createdAt: -1 });
        const bids = await TransportBid.find().sort({ createdAt: -1 });
        return res.json({ success: true, orders, bids });
      } catch (e) {
        console.error(e);
      }
    }
    return res.json({ success: true, orders: [], bids: [] });
  }

  // POST: Create Order, Submit Bid, or Upload Document
  if (req.method === 'POST') {
    const { action, ...payload } = req.body || {};

    // 1. Customer posts material requirement
    if (action === 'create_order' || !action) {
      if (db) {
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
          return res.json({ success: true, order: newOrder });
        } catch (e) {
          return res.status(500).json({ success: false, error: e.message });
        }
      }
      return res.json({ success: true, order: { ...payload, id: Date.now().toString(), status: 'requirement_posted' } });
    }

    // 2. Driver submits transport fare bid for trip distance
    if (action === 'submit_bid') {
      const { orderId, driverId, driverName, vehicleNo, fareQuote, distanceKm } = payload;
      if (db) {
        try {
          const newBid = await TransportBid.create({
            orderId,
            driverId,
            driverName,
            vehicleNo: vehicleNo || 'TN 38 AB 1234',
            fareQuote: parseFloat(fareQuote) || 0,
            distanceKm: parseFloat(distanceKm) || 10,
            status: 'pending',
          });
          await MarketplaceOrder.findByIdAndUpdate(orderId, { status: 'bidding_active' });
          return res.json({ success: true, bid: newBid });
        } catch (e) {
          return res.status(500).json({ success: false, error: e.message });
        }
      }
      return res.json({ success: true });
    }

    // 3. Upload shared trip document / weighbridge slip / invoice
    if (action === 'upload_doc') {
      const { orderId, docName, docUri, uploadedBy } = payload;
      if (db && orderId) {
        try {
          const order = await MarketplaceOrder.findById(orderId);
          if (order) {
            order.documents.push({
              name: docName || 'Document Slip',
              uri: docUri || '',
              uploadedBy: uploadedBy || 'User',
              createdAt: new Date(),
            });
            await order.save();
            return res.json({ success: true, order });
          }
        } catch (e) {
          return res.status(500).json({ success: false, error: e.message });
        }
      }
      return res.json({ success: true });
    }
  }

  // PATCH: Update Order Status, Quote Rate, Accept Bid
  if (req.method === 'PATCH') {
    const { action, orderId, ...payload } = req.body || {};

    if (db && orderId) {
      try {
        const order = await MarketplaceOrder.findById(orderId);
        if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

        // Quarry Owner quotes material rate
        if (action === 'quote_rate') {
          order.materialPrice = parseFloat(payload.materialPrice) || 0;
          order.totalPrice = order.materialPrice + order.transportPrice;
          order.status = 'rate_quoted';
          await order.save();
          return res.json({ success: true, order });
        }

        // Customer agrees with material rate
        if (action === 'agree_rate') {
          order.status = 'rate_agreed';
          await order.save();
          return res.json({ success: true, order });
        }

        // Quarry Owner accepts a driver transport bid
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
          return res.json({ success: true, order });
        }

        // Driver marks Loaded, In Transit, Delivered, or Settled
        if (action === 'update_status') {
          order.status = payload.status;
          await order.save();
          return res.json({ success: true, order });
        }
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    }
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
