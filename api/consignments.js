// Vercel Serverless Function: Consignments API
const { connectToDatabase, Consignment, Enquiry, User } = require('./_db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const db = await connectToDatabase();

  if (req.method === 'GET') {
    if (db) {
      try {
        const consignments = await Consignment.find().sort({ createdAt: -1 });
        return res.json({ success: true, consignments });
      } catch (e) { console.error(e); }
    }
    return res.json({ success: true, consignments: [] });
  }

  if (req.method === 'POST') {
    const { enquiryId, driverId } = req.body || {};
    if (db && enquiryId && driverId) {
      try {
        const enquiry = await Enquiry.findById(enquiryId);
        const driver = await User.findById(driverId);
        if (!enquiry || !driver) return res.status(400).json({ success: false, error: 'Not found' });

        enquiry.status = 'assigned';
        await enquiry.save();

        driver.status = 'On Duty';
        await driver.save();

        const consignment = await Consignment.create({
          enquiryId: enquiry._id,
          driverId: driver._id,
          driverName: driver.name,
          customerName: enquiry.customerName,
          customerPhone: enquiry.customerPhone,
          materialName: enquiry.materialName,
          quantity: enquiry.quantity,
          unitType: enquiry.unitType,
          agreedRate: enquiry.agreedRate,
          pickupAddress: enquiry.pickupAddress,
          customerAddress: enquiry.customerAddress,
          status: 'assigned',
          driverLat: driver.lat,
          driverLng: driver.lng,
        });

        return res.json({ success: true, consignment });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    }
    return res.json({ success: true });
  }

  if (req.method === 'PATCH') {
    const { id, status, lat, lng } = req.body || {};
    if (db && id) {
      try {
        const consignment = await Consignment.findById(id);
        if (!consignment) return res.status(404).json({ success: false, error: 'Consignment not found' });

        consignment.status = status;
        if (lat && lng) {
          consignment.driverLat = lat;
          consignment.driverLng = lng;
        }
        consignment.lastUpdated = new Date();
        await consignment.save();

        if (status === 'delivered') {
          await User.findByIdAndUpdate(consignment.driverId, { status: 'Available' });
        }

        return res.json({ success: true, consignment });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    }
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
