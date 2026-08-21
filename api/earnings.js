const { connectToDatabase } = require('./db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { db } = await connectToDatabase();
    const { role, quarryId, driverId } = req.query;

    if (role === 'driver' && driverId) {
      const trips = await db.collection('trips').find({ driver_id: parseInt(driverId) }).toArray();
      const completed = trips.filter(t => t.status === 'delivered');
      const active = trips.filter(t => t.status !== 'delivered');
      const totalEarned = completed.reduce((s, t) => s + (t.estimated_cost || 0), 0);
      const paid = completed.filter(t => t.payment_status === 'paid').reduce((s, t) => s + (t.estimated_cost || 0), 0);
      const unpaid = totalEarned - paid;
      const totalKm = completed.reduce((s, t) => s + (t.distance_km || 0), 0);

      return res.status(200).json({
        success: true,
        data: {
          totalEarned,
          paid,
          unpaid,
          completedTrips: completed.length,
          activeTrips: active.length,
          totalKm: Math.round(totalKm * 10) / 10,
          recentTrips: trips.reverse().slice(0, 10),
        }
      });
    }

    if (quarryId) {
      const qid = parseInt(quarryId);
      const bills = await db.collection('bills').find({ quarry_id: qid }).toArray();
      const trips = await db.collection('trips').find({ quarry_id: qid }).toArray();

      const totalBilled = bills.reduce((s, b) => s + (b.total_amount || 0), 0);
      const totalCollected = bills.filter(b => b.payment_status === 'paid').reduce((s, b) => s + (b.total_amount || 0), 0);
      const totalOutstanding = totalBilled - totalCollected;

      const tripRevenue = trips.filter(t => t.status === 'delivered').reduce((s, t) => s + (t.estimated_cost || 0), 0);
      const pendingTrips = trips.filter(t => t.status !== 'delivered').length;
      const completedTrips = trips.filter(t => t.status === 'delivered').length;

      return res.status(200).json({
        success: true,
        data: {
          totalBilled,
          totalCollected,
          totalOutstanding,
          tripRevenue,
          pendingTrips,
          completedTrips,
          recentBills: bills.reverse().slice(0, 5),
          recentTrips: trips.reverse().slice(0, 5),
        }
      });
    }

    return res.status(400).json({ success: false, error: 'Missing parameters' });
  } catch (error) {
    console.error('Earnings API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
