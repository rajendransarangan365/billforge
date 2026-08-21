const { connectToDatabase } = require('./db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { db } = await connectToDatabase();
    const enquiriesCol = db.collection('enquiries');

    if (req.method === 'GET') {
      const { quarryId, customerPhone } = req.query;
      let query = {};
      if (quarryId) query.quarry_id = parseInt(quarryId);
      if (customerPhone) query.customer_phone = customerPhone.trim();

      const enquiries = await enquiriesCol.find(query).sort({ created_at: -1 }).toArray();
      return res.status(200).json({ success: true, enquiries });
    }

    if (req.method === 'POST') {
      const { quarry_id, customer_name, customer_phone, material_name, quantity, unit_type, address, notes, agreed_rate } = req.body;

      const enquiry = {
        id: `enq_${Date.now()}`,
        quarry_id: parseInt(quarry_id),
        customer_name: customer_name.trim(),
        customer_phone: customer_phone.trim(),
        material_name: material_name.trim(),
        quantity: parseFloat(quantity) || 1,
        unit_type: unit_type || 'unit',
        address: address || '',
        notes: notes || '',
        status: 'pending',
        agreed_rate: parseFloat(agreed_rate) || 0,
        created_at: new Date().toISOString(),
      };

      await enquiriesCol.insertOne(enquiry);

      // System notification message to chat thread
      const chatCol = db.collection('messages');
      await chatCol.insertOne({
        id: `msg_${Date.now()}`,
        quarryId: parseInt(quarry_id),
        customerPhone: customer_phone.trim(),
        sender: customer_name.trim(),
        senderRole: 'customer',
        senderName: customer_name.trim(),
        text: `📦 NEW ENQUIRY REQUEST:\nMaterial: ${material_name}\nQuantity: ${quantity} ${unit_type}\nAddress: ${address || 'Not specified'}`,
        status: 'delivered',
        timestamp: new Date().toISOString(),
      });

      return res.status(201).json({ success: true, enquiry });
    }

    if (req.method === 'PUT') {
      const { enquiry_id, status, agreed_rate, delivery_address } = req.body;

      const updateData = { status };
      if (agreed_rate !== undefined) updateData.agreed_rate = parseFloat(agreed_rate);
      if (delivery_address) updateData.address = delivery_address;

      await enquiriesCol.updateOne({ id: enquiry_id }, { $set: updateData });
      const updated = await enquiriesCol.findOne({ id: enquiry_id });

      return res.status(200).json({ success: true, enquiry: updated });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Enquiries API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
