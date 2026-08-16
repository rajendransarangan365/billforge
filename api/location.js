// Vercel Serverless Function: Live GPS Location API with Pusher Real-Time Event Trigger
const Pusher = require('pusher');
const { connectToDatabase, User, Consignment } = require('./_db');

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || '10000',
  key: process.env.PUSHER_KEY || 'billforge_demo_key',
  secret: process.env.PUSHER_SECRET || 'billforge_demo_secret',
  cluster: process.env.PUSHER_CLUSTER || 'ap2',
  useTLS: true,
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const db = await connectToDatabase();

  if (req.method === 'POST') {
    const { driverId, driverName, lat, lng, vehicleNo } = req.body || {};

    if (db && driverId) {
      try {
        await User.findByIdAndUpdate(driverId, { lat, lng, updatedAt: new Date() });
        await Consignment.updateMany(
          { driverId, status: { $ne: 'delivered' } },
          { driverLat: lat, driverLng: lng, lastUpdated: new Date() }
        );
      } catch (e) { console.error(e); }
    }

    // Trigger Pusher Real-Time Event for instant map update
    try {
      await pusher.trigger('quarry-live', 'driver-location-changed', {
        driverId,
        driverName,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        vehicleNo,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Pusher location trigger error:', err);
    }

    return res.json({ success: true });
  }

  if (req.method === 'GET') {
    if (db) {
      try {
        const activeConsignments = await Consignment.find({ status: { $ne: 'delivered' } });
        const drivers = await User.find({ role: 'driver' }).select('-passwordHash');
        return res.json({ success: true, activeConsignments, drivers });
      } catch (e) { console.error(e); }
    }
    return res.json({ success: true, activeConsignments: [], drivers: [] });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
