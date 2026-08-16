// Vercel Serverless Function: Auth API
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, password } = req.body || {};
  const passHash = hashPassword(password);

  const db = await connectToDatabase();
  if (db) {
    try {
      const user = await User.findOne({ phone, passwordHash: passHash });
      if (user) {
        return res.json({
          success: true,
          user: { id: user._id, name: user.name, phone: user.phone, vehicleNo: user.vehicleNo, role: user.role },
          token: `token-${user._id}`,
        });
      }
    } catch (e) {
      console.error('Mongo Auth Error:', e);
    }
  }

  // Fallback demo driver login
  if (phone === '9876543210' && (password === 'driver123' || passHash)) {
    return res.json({
      success: true,
      user: { id: 'demo-driver-1', name: 'Ramesh (Driver)', phone: '9876543210', vehicleNo: 'TN 38 AB 1234', role: 'driver' },
      token: 'demo-token-1',
    });
  }

  return res.status(401).json({ success: false, error: 'Invalid phone or password' });
};
