// Vercel Serverless Function: Enquiries API
const { connectToDatabase, Enquiry } = require('./_db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const db = await connectToDatabase();

  if (req.method === 'GET') {
    if (db) {
      try {
        const enquiries = await Enquiry.find().sort({ createdAt: -1 });
        return res.json({ success: true, enquiries });
      } catch (e) { console.error(e); }
    }
    return res.json({ success: true, enquiries: [] });
  }

  if (req.method === 'POST') {
    if (db) {
      try {
        const enquiry = await Enquiry.create(req.body);
        return res.json({ success: true, enquiry });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    }
    return res.json({ success: true, enquiry: { ...req.body, id: Date.now().toString() } });
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body || {};
    if (db && id) {
      try {
        const enquiry = await Enquiry.findByIdAndUpdate(id, updates, { new: true });
        return res.json({ success: true, enquiry });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    }
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
