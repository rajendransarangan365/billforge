const { connectToDatabase } = require('./db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { db } = await connectToDatabase();
    const materialsCol = db.collection('materials');

    if (req.method === 'GET') {
      const { quarryId } = req.query;
      const materials = await materialsCol.find({ quarry_id: parseInt(quarryId) }).toArray();
      return res.status(200).json({ success: true, materials });
    }

    if (req.method === 'POST') {
      const { id, quarry_id, name, price, unit, min_order, stock, hsn, description, is_active } = req.body;

      if (id) {
        // Edit existing
        await materialsCol.updateOne(
          { id: parseInt(id) },
          {
            $set: {
              name: name.trim(),
              price: parseFloat(price) || 0,
              unit: unit || 'unit',
              min_order: parseFloat(min_order) || 1,
              stock: stock ? parseFloat(stock) : null,
              hsn: hsn || '',
              description: description || '',
              is_active: is_active !== false,
              updated_at: new Date().toISOString(),
            }
          }
        );
      } else {
        // Create new
        const newId = Date.now();
        await materialsCol.insertOne({
          id: newId,
          quarry_id: parseInt(quarry_id),
          name: name.trim(),
          price: parseFloat(price) || 0,
          unit: unit || 'unit',
          min_order: parseFloat(min_order) || 1,
          stock: stock ? parseFloat(stock) : null,
          hsn: hsn || '',
          description: description || '',
          is_active: true,
          created_at: new Date().toISOString(),
        });
      }

      const updatedList = await materialsCol.find({ quarry_id: parseInt(quarry_id) }).toArray();
      return res.status(200).json({ success: true, materials: updatedList });
    }

    if (req.method === 'DELETE') {
      const { id, quarryId } = req.query;
      await materialsCol.deleteOne({ id: parseInt(id) });
      const updatedList = await materialsCol.find({ quarry_id: parseInt(quarryId) }).toArray();
      return res.status(200).json({ success: true, materials: updatedList });
    }

    if (req.method === 'PUT') {
      const { id, quarry_id } = req.body;
      const item = await materialsCol.findOne({ id: parseInt(id) });
      if (item) {
        await materialsCol.updateOne({ id: parseInt(id) }, { $set: { is_active: !item.is_active } });
      }
      const updatedList = await materialsCol.find({ quarry_id: parseInt(quarry_id) }).toArray();
      return res.status(200).json({ success: true, materials: updatedList });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Materials API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
