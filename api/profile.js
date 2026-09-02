const { connectToDatabase } = require('./db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { db } = await connectToDatabase();
    const quarriesCol = db.collection('quarries');

    if (req.method === 'GET') {
      const quarryId = parseInt(req.query.id || req.query.quarryId || '1');
      const quarry = await quarriesCol.findOne({ id: quarryId });
      if (quarry) {
        return res.status(200).json({ success: true, profile: quarry });
      }
      return res.status(200).json({
        success: true,
        profile: {
          id: quarryId,
          name: 'MS Blue Metals & Quarries',
          owner_name: 'MS Blue Metals',
          phone: '9894698049',
          address: 'Uthukuli',
          location: 'Tiruppur, Tamil Nadu - 638751',
        },
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const quarryId = parseInt(body.id || body.quarryId || body.quarry_id || '1');

      const updateData = {
        id: quarryId,
        quarry_id: quarryId,
        name: (body.name || body.companyName || '').trim(),
        owner_name: (body.owner_name || body.name || '').trim(),
        phone: (body.phone || '').trim(),
        email: (body.email || '').trim(),
        address: (body.address || '').trim(),
        location: (body.location || body.address || '').trim(),
        lat: parseFloat(body.lat) || 0,
        lng: parseFloat(body.lng) || 0,
        updated_at: new Date().toISOString(),
      };

      await quarriesCol.updateOne(
        { id: quarryId },
        { $set: updateData },
        { upsert: true }
      );

      return res.status(200).json({
        success: true,
        message: 'Company profile updated successfully on server.',
        profile: updateData,
      });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('Profile API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
