// Vercel Serverless Function: Drivers API
const crypto = require('crypto');
const { connectToDatabase, User } = require('./_db');

function hashPassword(pass) {
  return crypto.createHash('sha256').update(pass || '').digest('hex');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const db = await connectToDatabase();

  if (req.method === 'GET') {
    if (db) {
      try {
        const drivers = await User.find({ role: 'driver' }).select('-passwordHash');
        return res.json({ success: true, drivers });
      } catch (e) { console.error(e); }
    }
    return res.json({
      success: true,
      drivers: [
        { id: '1', name: 'Ramesh (Driver)', phone: '9876543210', vehicleNo: 'TN 38 AB 1234', status: 'Available', lat: 11.0168, lng: 76.9558 }
      ]
    });
  }

  if (req.method === 'POST') {
    const { name, phone, vehicleNo, password } = req.body || {};
    if (!name || !phone) return res.status(400).json({ success: false, error: 'Name and phone required' });

    if (db) {
      try {
        const newDriver = await User.create({
          name,
          phone,
          vehicleNo: vehicleNo || '',
          passwordHash: hashPassword(password || 'driver123'),
          role: 'driver',
          status: 'Available',
        });
        return res.json({ success: true, driver: newDriver });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    }
    return res.json({ success: true, driver: { id: Date.now().toString(), name, phone, vehicleNo, status: 'Available' } });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
