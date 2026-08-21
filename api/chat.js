const { connectToDatabase } = require('./db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { db } = await connectToDatabase();
    const chatCol = db.collection('messages');

    if (req.method === 'GET') {
      const { quarryId, customerPhone, tripId, role } = req.query;

      let query = {};
      if (tripId) {
        query.tripId = tripId;
      } else if (quarryId && customerPhone) {
        query.quarryId = parseInt(quarryId);
        query.customerPhone = customerPhone.trim();
      } else {
        return res.status(400).json({ success: false, error: 'Missing thread parameters' });
      }

      // Automatically update message status to 'read' (blue tick) when target user views the thread
      if (role) {
        await chatCol.updateMany(
          { ...query, senderRole: { $ne: role }, status: { $ne: 'read' } },
          { $set: { status: 'read' } }
        );
      }

      const messages = await chatCol.find(query).sort({ timestamp: 1 }).toArray();
      return res.status(200).json({ success: true, messages });
    }

    if (req.method === 'POST') {
      const { quarryId, customerPhone, tripId, sender, senderRole, senderName, text } = req.body;

      if (!text || !text.trim()) {
        return res.status(400).json({ success: false, error: 'Text message required' });
      }

      const messageObj = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        quarryId: quarryId ? parseInt(quarryId) : null,
        customerPhone: customerPhone ? customerPhone.trim() : null,
        tripId: tripId || null,
        sender,
        senderRole: senderRole || 'customer',
        senderName: senderName || 'User',
        text: text.trim(),
        status: 'delivered', // Delivered to database (double tick)
        timestamp: new Date().toISOString(),
      };

      await chatCol.insertOne(messageObj);

      return res.status(201).json({ success: true, message: messageObj });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Chat API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
