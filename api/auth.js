const { connectToDatabase } = require('./db');
const { seedInitialData } = require('./seed');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { db } = await connectToDatabase();
    await seedInitialData();

    const { type, action, phone, password, name, address, location, vehicle_no, company_name, site_address } = req.body;
    const cleanPhone = (phone || '').trim();

    if (type === 'customer') {
      const customersCol = db.collection('customers');
      if (action === 'register') {
        const existing = await customersCol.findOne({ phone: cleanPhone });
        if (existing) {
          return res.status(400).json({ success: false, error: 'Account with this phone number already exists.' });
        }
        const newCustomer = {
          id: Date.now(),
          name: name.trim(),
          phone: cleanPhone,
          password: password || '1234',
          company_name: company_name || '',
          site_address: site_address || address || '',
          role: 'customer',
          created_at: new Date().toISOString(),
        };
        await customersCol.insertOne(newCustomer);
        return res.status(201).json({ success: true, user: newCustomer });
      } else {
        // Login / Auth
        let customer = await customersCol.findOne({ phone: cleanPhone });
        if (!customer) {
          // Auto-register customer if logging in for first time
          customer = {
            id: Date.now(),
            name: name ? name.trim() : `Customer (${cleanPhone.slice(-4)})`,
            phone: cleanPhone,
            password: password || '1234',
            role: 'customer',
            created_at: new Date().toISOString(),
          };
          await customersCol.insertOne(customer);
        } else if (password && customer.password && customer.password !== password) {
          return res.status(401).json({ success: false, error: 'Incorrect PIN or password.' });
        }
        return res.status(200).json({ success: true, user: customer });
      }
    }

    if (type === 'driver') {
      const driversCol = db.collection('drivers');
      const driver = await driversCol.findOne({ phone: cleanPhone, password: password || 'driver123' });
      if (driver) {
        return res.status(200).json({ success: true, user: { ...driver, role: 'driver' } });
      }
      return res.status(401).json({ success: false, error: 'Invalid driver mobile or password.' });
    }

    if (type === 'quarry') {
      const quarriesCol = db.collection('quarries');
      if (action === 'register') {
        const existing = await quarriesCol.findOne({ phone: cleanPhone });
        if (existing) {
          return res.status(400).json({ success: false, error: 'Quarry with this phone number already exists.' });
        }
        const newQuarry = {
          id: Date.now(),
          name: name.trim(),
          owner_name: name.trim(),
          phone: cleanPhone,
          password: password || 'admin123',
          address: address || '',
          location: location || address || '',
          status: 'active',
          is_verified: true,
          created_at: new Date().toISOString(),
        };
        await quarriesCol.insertOne(newQuarry);
        return res.status(201).json({ success: true, user: newQuarry });
      } else {
        const quarry = await quarriesCol.findOne({ phone: cleanPhone, password: password || 'admin123' });
        if (quarry) {
          return res.status(200).json({ success: true, user: { ...quarry, role: 'quarry_owner' } });
        }
        return res.status(401).json({ success: false, error: 'Invalid quarry mobile or password.' });
      }
    }

    return res.status(400).json({ success: false, error: 'Invalid authentication type' });
  } catch (error) {
    console.error('Auth API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
