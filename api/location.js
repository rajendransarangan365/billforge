// Vercel Serverless Function: Live GPS Location API
const { connectToDatabase, User, Consignment } = require('./_db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const db = await connectToDatabase();

  if (req.method === 'POST') {
    const { driverId, lat, lng } = req.body || {};
    if (db && driverId) {
      try {
        await User.findByIdAndUpdate(driverId, { lat, lng, updatedAt: new Date() });
        await Consignment.updateMany(
          { driverId, status: { $ne: 'delivered' } },
          { driverLat: lat, driverLng: lng, lastUpdated: new Date() }
        );
      } catch (e) { console.error(e); }
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
