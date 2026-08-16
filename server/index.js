// Express Server for Render (100% Free Web Service)
// Handles Driver Auth, Material Enquiries, Consignment Dispatch & Live Location Tracking

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data_store.json');

// Initialize local JSON storage if not present
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const initialData = {
      users: [
        { id: 1, name: 'Admin Owner', phone: '9999999999', role: 'admin', passwordHash: hashPassword('admin123') }
      ],
      drivers: [
        { id: 1, name: 'Ramesh (Driver)', phone: '9876543210', vehicleNo: 'TN 38 AB 1234', passwordHash: hashPassword('driver123'), status: 'Available', lat: 11.0168, lng: 76.9558, updatedAt: new Date().toISOString() }
      ],
      enquiries: [
        {
          id: 1,
          customerName: 'Karthik Construction',
          customerPhone: '9123456789',
          materialName: 'River Sand',
          quantity: 1,
          unitType: 'ton',
          quotedRate: 3200,
          agreedRate: 3200,
          status: 'agreed',
          pickupAddress: 'Karur Sand Quarry, Tamil Nadu',
          pickupLat: 10.9601,
          pickupLng: 78.0766,
          customerAddress: 'Coimbatore Site 4, Gandhipuram',
          customerLat: 11.0168,
          customerLng: 76.9558,
          createdAt: new Date().toISOString()
        }
      ],
      consignments: [
        {
          id: 101,
          enquiryId: 1,
          driverId: 1,
          driverName: 'Ramesh (Driver)',
          customerName: 'Karthik Construction',
          customerPhone: '9123456789',
          materialName: 'River Sand',
          quantity: 1,
          unitType: 'ton',
          agreedRate: 3200,
          pickupAddress: 'Karur Sand Quarry, Tamil Nadu',
          pickupLat: 10.9601,
          pickupLng: 78.0766,
          customerAddress: 'Coimbatore Site 4, Gandhipuram',
          customerLat: 11.0168,
          customerLng: 76.9558,
          status: 'assigned', // assigned -> reached_pickup -> picked_up -> reached_customer -> delivered
          driverLat: 11.0168,
          driverLng: 76.9558,
          lastUpdated: new Date().toISOString()
        }
      ],
      notifications: []
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error('Error loading data file:', e);
    return { users: [], drivers: [], enquiries: [], consignments: [], notifications: [] };
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error saving data:', e);
  }
}

function hashPassword(pass) {
  return crypto.createHash('sha256').update(pass || '').digest('hex');
}

// ── Auth Endpoints ──────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { phone, password } = req.body;
  const data = loadData();
  const passHash = hashPassword(password);

  // Check admin
  const admin = data.users.find(u => u.phone === phone && u.passwordHash === passHash);
  if (admin) {
    return res.json({ success: true, user: { id: admin.id, name: admin.name, phone: admin.phone, role: 'admin' }, token: `admin-token-${admin.id}` });
  }

  // Check driver
  const driver = data.drivers.find(d => d.phone === phone && d.passwordHash === passHash);
  if (driver) {
    return res.json({ success: true, user: { id: driver.id, name: driver.name, phone: driver.phone, vehicleNo: driver.vehicleNo, role: 'driver' }, token: `driver-token-${driver.id}` });
  }

  return res.status(401).json({ success: false, error: 'Invalid phone or password' });
});

// ── Driver Management ───────────────────────────────────────────────────────
app.get('/api/drivers', (req, res) => {
  const data = loadData();
  const driversClean = data.drivers.map(({ passwordHash, ...rest }) => rest);
  res.json({ success: true, drivers: driversClean });
});

app.post('/api/drivers', (req, res) => {
  const { name, phone, vehicleNo, password } = req.body;
  if (!name || !phone || !password) {
    return res.status(400).json({ success: false, error: 'Name, phone and password required' });
  }
  const data = loadData();
  const nextId = data.drivers.reduce((max, d) => d.id > max ? d.id : max, 0) + 1;
  const newDriver = {
    id: nextId,
    name,
    phone,
    vehicleNo: vehicleNo || '',
    passwordHash: hashPassword(password),
    status: 'Available',
    lat: 11.0168,
    lng: 76.9558,
    updatedAt: new Date().toISOString()
  };
  data.drivers.push(newDriver);
  saveData(data);
  const { passwordHash, ...clean } = newDriver;
  res.json({ success: true, driver: clean });
});

// ── Enquiries & Quotations ───────────────────────────────────────────────────
app.get('/api/enquiries', (req, res) => {
  const data = loadData();
  res.json({ success: true, enquiries: data.enquiries || [] });
});

app.post('/api/enquiries', (req, res) => {
  const { customerName, customerPhone, materialName, quantity, unitType, quotedRate, pickupAddress, customerAddress, pickupLat, pickupLng, customerLat, customerLng } = req.body;
  const data = loadData();
  const nextId = data.enquiries.reduce((max, e) => e.id > max ? e.id : max, 0) + 1;
  const newEnquiry = {
    id: nextId,
    customerName,
    customerPhone,
    materialName,
    quantity: parseFloat(quantity) || 1,
    unitType: unitType || 'ton',
    quotedRate: parseFloat(quotedRate) || 0,
    agreedRate: parseFloat(quotedRate) || 0,
    status: 'pending', // pending, agreed, assigned, rejected
    pickupAddress: pickupAddress || 'Quarry / Warehouse',
    pickupLat: parseFloat(pickupLat) || 10.9601,
    pickupLng: parseFloat(pickupLng) || 78.0766,
    customerAddress: customerAddress || 'Customer Site',
    customerLat: parseFloat(customerLat) || 11.0168,
    customerLng: parseFloat(customerLng) || 76.9558,
    createdAt: new Date().toISOString()
  };
  data.enquiries.unshift(newEnquiry);
  saveData(data);
  res.json({ success: true, enquiry: newEnquiry });
});

app.patch('/api/enquiries/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const data = loadData();
  const idx = data.enquiries.findIndex(e => e.id === id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Enquiry not found' });

  data.enquiries[idx] = { ...data.enquiries[idx], ...req.body };
  saveData(data);
  res.json({ success: true, enquiry: data.enquiries[idx] });
});

// ── Consignments & Dispatch ─────────────────────────────────────────────────
app.get('/api/consignments', (req, res) => {
  const data = loadData();
  res.json({ success: true, consignments: data.consignments || [] });
});

app.post('/api/consignments/assign', (req, res) => {
  const { enquiryId, driverId } = req.body;
  const data = loadData();
  const enquiry = data.enquiries.find(e => e.id === parseInt(enquiryId));
  const driver = data.drivers.find(d => d.id === parseInt(driverId));

  if (!enquiry || !driver) {
    return res.status(400).json({ success: false, error: 'Enquiry or driver not found' });
  }

  // Update enquiry status
  enquiry.status = 'assigned';

  const nextId = data.consignments.reduce((max, c) => c.id > max ? c.id : max, 100) + 1;
  const newConsignment = {
    id: nextId,
    enquiryId: enquiry.id,
    driverId: driver.id,
    driverName: driver.name,
    customerName: enquiry.customerName,
    customerPhone: enquiry.customerPhone,
    materialName: enquiry.materialName,
    quantity: enquiry.quantity,
    unitType: enquiry.unitType,
    agreedRate: enquiry.agreedRate,
    pickupAddress: enquiry.pickupAddress,
    pickupLat: enquiry.pickupLat,
    pickupLng: enquiry.pickupLng,
    customerAddress: enquiry.customerAddress,
    customerLat: enquiry.customerLat,
    customerLng: enquiry.customerLng,
    status: 'assigned',
    driverLat: driver.lat,
    driverLng: driver.lng,
    lastUpdated: new Date().toISOString()
  };

  driver.status = 'On Duty';
  data.consignments.unshift(newConsignment);
  saveData(data);
  res.json({ success: true, consignment: newConsignment });
});

// Driver view consignments
app.get('/api/driver/:driverId/consignments', (req, res) => {
  const driverId = parseInt(req.params.driverId);
  const data = loadData();
  const list = data.consignments.filter(c => c.driverId === driverId && c.status !== 'delivered');
  res.json({ success: true, consignments: list });
});

// Update Consignment Status & Trigger Notification
app.patch('/api/consignments/:id/status', (req, res) => {
  const id = parseInt(req.params.id);
  const { status, lat, lng } = req.body;
  const data = loadData();
  const consignment = data.consignments.find(c => c.id === id);

  if (!consignment) return res.status(404).json({ success: false, error: 'Consignment not found' });

  consignment.status = status;
  consignment.lastUpdated = new Date().toISOString();
  if (lat && lng) {
    consignment.driverLat = parseFloat(lat);
    consignment.driverLng = parseFloat(lng);
  }

  let notificationMessage = '';
  if (status === 'reached_pickup') {
    notificationMessage = `📍 Driver ${consignment.driverName} reached Pickup Location (${consignment.pickupAddress})!`;
  } else if (status === 'reached_customer') {
    notificationMessage = `🏁 Driver ${consignment.driverName} reached Customer Location (${consignment.customerName})!`;
  } else if (status === 'delivered') {
    notificationMessage = `✅ Consignment #${consignment.id} delivered to ${consignment.customerName}!`;
    // Set driver back to available
    const driver = data.drivers.find(d => d.id === consignment.driverId);
    if (driver) driver.status = 'Available';
  }

  if (notificationMessage) {
    data.notifications.unshift({
      id: Date.now(),
      message: notificationMessage,
      timestamp: new Date().toISOString(),
      read: false
    });
  }

  saveData(data);
  res.json({ success: true, consignment, notification: notificationMessage });
});

// ── Live GPS Location Update Endpoint ─────────────────────────────────────────
app.post('/api/location/update', (req, res) => {
  const { driverId, lat, lng } = req.body;
  if (!driverId || !lat || !lng) return res.status(400).json({ success: false, error: 'Missing driverId or coordinates' });

  const data = loadData();
  const driver = data.drivers.find(d => d.id === parseInt(driverId));
  if (driver) {
    driver.lat = parseFloat(lat);
    driver.lng = parseFloat(lng);
    driver.updatedAt = new Date().toISOString();

    // Update active consignments for this driver
    data.consignments.forEach(c => {
      if (c.driverId === parseInt(driverId) && c.status !== 'delivered') {
        c.driverLat = parseFloat(lat);
        c.driverLng = parseFloat(lng);
        c.lastUpdated = new Date().toISOString();
      }
    });
    saveData(data);
  }
  res.json({ success: true });
});

// Get Live Driver Tracking Data
app.get('/api/location/active', (req, res) => {
  const data = loadData();
  const activeConsignments = data.consignments.filter(c => c.status !== 'delivered');
  const notifications = (data.notifications || []).slice(0, 10);
  res.json({ success: true, activeConsignments, drivers: data.drivers, notifications });
});

app.get('/health', (req, res) => res.json({ status: 'ok', server: 'BillForge Free Render Backend' }));

app.listen(PORT, () => {
  console.log(`🚀 BillForge Server running on port ${PORT}`);
});
