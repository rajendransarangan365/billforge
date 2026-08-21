const { connectToDatabase } = require('./db');
const { seedInitialData } = require('./seed');

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { db } = await connectToDatabase();
    await seedInitialData();

    const quarries = await db.collection('quarries').find({
      status: { $ne: 'rejected' },
      is_verified: { $ne: false },
    }).toArray();

    const catalogs = [];
    for (const q of quarries) {
      const materials = await db.collection('materials').find({
        quarry_id: q.id,
        is_active: { $ne: false },
      }).toArray();

      if (materials.length > 0) {
        catalogs.push({
          ...q,
          materials,
          material_count: materials.length,
          min_price: Math.min(...materials.map(m => m.price || 0)),
          max_price: Math.max(...materials.map(m => m.price || 0)),
        });
      }
    }

    return res.status(200).json({ success: true, catalogs });
  } catch (error) {
    console.error('Marketplace API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
