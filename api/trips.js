const { connectToDatabase } = require('./db');

function calculateDistanceKm(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lng1 || !lat2 || !lng2) return 15; // default 15km fallback
  const R = 6371; // Earth radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(1, Math.round(R * c * 10) / 10);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { db } = await connectToDatabase();
    const transportCol = db.collection('transport_requests');
    const tripsCol = db.collection('trips');
    const driversCol = db.collection('drivers');
    const chatCol = db.collection('messages');

    if (req.method === 'GET') {
      const { quarryId, driverId, action, requestId } = req.query;

      if (action === 'availableDrivers') {
        const activeTrips = await tripsCol.find({
          status: { $in: ['assigned', 'en_route_quarry', 'reached_quarry', 'picked_up', 'en_route_customer'] }
        }).toArray();

        const busyDriverIds = new Set(activeTrips.map(t => String(t.driver_id)));
        const allDrivers = await driversCol.find().toArray();
        const available = allDrivers.filter(d => !busyDriverIds.has(String(d.id)));

        // Score drivers by distance & cost
        const scored = available.map(d => {
          const distKm = 12; // estimated
          const ratePerKm = d.rate_per_km || 45;
          const minCharge = d.min_charge || 1200;
          const estimatedCost = Math.max(minCharge, ratePerKm * distKm);
          return {
            ...d,
            estimated_cost: Math.round(estimatedCost),
            distance_km: distKm,
            rate_per_km: ratePerKm,
          };
        }).sort((a, b) => a.estimated_cost - b.estimated_cost);

        return res.status(200).json({ success: true, drivers: scored });
      }

      if (driverId) {
        const trips = await tripsCol.find({ driver_id: parseInt(driverId) }).sort({ created_at: -1 }).toArray();
        return res.status(200).json({ success: true, trips });
      }

      if (quarryId) {
        const trips = await tripsCol.find({ quarry_id: parseInt(quarryId) }).sort({ created_at: -1 }).toArray();
        const requests = await transportCol.find({ quarry_id: parseInt(quarryId) }).sort({ created_at: -1 }).toArray();
        return res.status(200).json({ success: true, trips, transportRequests: requests });
      }

      return res.status(400).json({ success: false, error: 'Missing parameters' });
    }

    if (req.method === 'POST') {
      const { action } = req.body;

      if (action === 'createTransportRequest') {
        const { enquiry_id, quarry_id, customer_id, customer_name, customer_phone, material_name, quantity, unit_type, agreed_rate, from_address, to_address } = req.body;

        const reqObj = {
          id: `tr_${Date.now()}`,
          enquiry_id: enquiry_id || null,
          quarry_id: parseInt(quarry_id),
          customer_id: customer_id || null,
          customer_name: customer_name || 'Customer',
          customer_phone: customer_phone || '',
          material_name: material_name || '',
          quantity: parseFloat(quantity) || 1,
          unit_type: unit_type || 'unit',
          agreed_rate: parseFloat(agreed_rate) || 0,
          from_address: from_address || 'Quarry Yard',
          to_address: to_address || 'Customer Site',
          status: 'pending_assignment',
          created_at: new Date().toISOString(),
        };

        await transportCol.insertOne(reqObj);
        return res.status(201).json({ success: true, request: reqObj });
      }

      if (action === 'createTrip') {
        const { transport_request_id, enquiry_id, quarry_id, driver_id, driver_name, driver_phone, vehicle_no, customer_name, customer_phone, material_name, quantity, from_address, to_address, distance_km, estimated_cost } = req.body;

        const tripId = `trip_${Date.now()}`;
        const tripObj = {
          id: tripId,
          transport_request_id: transport_request_id || null,
          enquiry_id: enquiry_id || null,
          quarry_id: parseInt(quarry_id),
          driver_id: parseInt(driver_id),
          driver_name: driver_name || '',
          driver_phone: driver_phone || '',
          vehicle_no: vehicle_no || '',
          customer_name: customer_name || '',
          customer_phone: customer_phone || '',
          material_name: material_name || '',
          quantity: parseFloat(quantity) || 1,
          from_address: from_address || 'Quarry Yard',
          to_address: to_address || 'Customer Site',
          distance_km: parseFloat(distance_km) || 10,
          estimated_cost: parseFloat(estimated_cost) || 1200,
          status: 'assigned',
          payment_status: 'unpaid',
          material_payment_status: 'unpaid',
          timestamps: {
            assigned: new Date().toISOString(),
            en_route_quarry: null,
            reached_quarry: null,
            picked_up: null,
            en_route_customer: null,
            reached_customer: null,
            delivered: null,
          },
          created_at: new Date().toISOString(),
        };

        await tripsCol.insertOne(tripObj);

        // Mark transport request as assigned
        if (transport_request_id) {
          await transportCol.updateOne({ id: transport_request_id }, { $set: { status: 'assigned', trip_id: tripId } });
        }

        // Seed system message into trip chat
        await chatCol.insertOne({
          id: `msg_${Date.now()}`,
          tripId: tripId,
          quarryId: parseInt(quarry_id),
          sender: 'system',
          senderRole: 'system',
          senderName: 'BillForge Dispatch System',
          text: `🚚 TRIP ASSIGNED!\n\n📦 Material: ${material_name} (${quantity} unit)\n📍 Pickup: ${from_address}\n🏠 Delivery: ${to_address}\n🚗 Driver: ${driver_name} (${vehicle_no})\n💰 Transport Est: ₹${estimated_cost}`,
          status: 'delivered',
          timestamp: new Date().toISOString(),
        });

        return res.status(201).json({ success: true, trip: tripObj });
      }
    }

    if (req.method === 'PUT') {
      const { trip_id, status, geo, field, payment_status } = req.body;

      if (field && payment_status) {
        await tripsCol.updateOne({ id: trip_id }, { $set: { [field]: payment_status } });
        const updated = await tripsCol.findOne({ id: trip_id });
        return res.status(200).json({ success: true, trip: updated });
      }

      if (trip_id && status) {
        const updateDoc = {
          status,
          [`timestamps.${status}`]: new Date().toISOString(),
        };
        if (geo) {
          updateDoc.driver_lat = geo.lat;
          updateDoc.driver_lng = geo.lng;
        }

        await tripsCol.updateOne({ id: trip_id }, { $set: updateDoc });
        const updated = await tripsCol.findOne({ id: trip_id });

        // Add status log to trip chat
        const statusLabels = {
          en_route_quarry: '🚗 Driver is on the way to quarry...',
          reached_quarry: '✅ Driver has arrived at quarry. Loading in progress...',
          picked_up: '📦 Materials loaded! En route to delivery location...',
          en_route_customer: '🚛 Driver is heading to your delivery site!',
          reached_customer: '📍 Driver has arrived at delivery site!',
          delivered: '✅ DELIVERY COMPLETE! Materials delivered successfully.',
        };

        if (statusLabels[status]) {
          await chatCol.insertOne({
            id: `msg_${Date.now()}`,
            tripId: trip_id,
            quarryId: updated.quarry_id,
            sender: 'system',
            senderRole: 'system',
            senderName: 'BillForge Tracking',
            text: statusLabels[status],
            status: 'delivered',
            timestamp: new Date().toISOString(),
          });
        }

        return res.status(200).json({ success: true, trip: updated });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Trips API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
