// Express Server for Render (100% Free Web Service) with MongoDB Atlas Support
// Handles Admin & Driver Auth, Material Enquiries, Consignments, Live GPS & Bills

require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const connectDB = require('./config/db');

// Mongoose Models
const User = require('./models/User');
const Enquiry = require('./models/Enquiry');
const Consignment = require('./models/Consignment');
const Bill = require('./models/Bill');
const Payment = require('./models/Payment');
const Reminder = require('./models/Reminder');

const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;
let isMongoConnected = false;

// Connect to MongoDB Atlas
connectDB().then((connected) => {
  isMongoConnected = connected;
  if (connected) {
    seedInitialAdmin();
  }
});

function hashPassword(pass) {
  return crypto.createHash('sha256').update(pass || '').digest('hex');
}

// Seed default admin and driver if DB is empty
async function seedInitialAdmin() {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      await User.create([
        {
          name: 'Admin Owner',
          phone: '9999999999',
          passwordHash: hashPassword('admin123'),
          role: 'admin',
        },
        {
          name: 'Ramesh (Driver)',
          phone: '9876543210',
          passwordHash: hashPassword('driver123'),
          role: 'driver',
          vehicleNo: 'TN 38 AB 1234',
          status: 'Available',
          lat: 11.0168,
          lng: 76.9558,
        },
      ]);
      console.log('🌱 Seeded default Admin and Driver accounts into MongoDB Atlas.');
    }
  } catch (e) {
    console.error('Error seeding initial data:', e.message);
  }
}

// ── Auth Endpoints ──────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { phone, password } = req.body;
  const passHash = hashPassword(password);

  if (isMongoConnected) {
    try {
      const user = await User.findOne({ phone, passwordHash: passHash });
      if (user) {
        return res.json({
          success: true,
          user: { id: user._id, name: user.name, phone: user.phone, vehicleNo: user.vehicleNo, role: user.role },
          token: `token-${user._id}`,
        });
      }
    } catch (e) {
      console.error('Mongo Login error:', e);
    }
  }

  // Fallback demo credentials
  if (phone === '9876543210' && (password === 'driver123' || passHash)) {
    return res.json({
      success: true,
      user: { id: 'demo-driver-1', name: 'Ramesh (Driver)', phone: '9876543210', vehicleNo: 'TN 38 AB 1234', role: 'driver' },
      token: 'demo-token-1',
    });
  }

  return res.status(401).json({ success: false, error: 'Invalid phone or password' });
});

// ── Driver Management ───────────────────────────────────────────────────────
app.get('/api/drivers', async (req, res) => {
  if (isMongoConnected) {
    try {
      const drivers = await User.find({ role: 'driver' }).select('-passwordHash');
      return res.json({ success: true, drivers });
    } catch (e) {
      console.error(e);
    }
  }
  res.json({
    success: true,
    drivers: [
      { id: '1', name: 'Ramesh (Driver)', phone: '9876543210', vehicleNo: 'TN 38 AB 1234', status: 'Available', lat: 11.0168, lng: 76.9558 }
    ]
  });
});

app.post('/api/drivers', async (req, res) => {
  const { name, phone, vehicleNo, password } = req.body;
  if (!name || !phone) return res.status(400).json({ success: false, error: 'Name and phone required' });

  if (isMongoConnected) {
    try {
      const newDriver = await User.create({
        name,
        phone,
        vehicleNo: vehicleNo || '',
        passwordHash: hashPassword(password || 'driver123'),
        role: 'driver',
        status: 'Available',
      });
      return res.json({ success: true, driver: newDriver });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  res.json({ success: true, driver: { id: Date.now().toString(), name, phone, vehicleNo, status: 'Available' } });
});

// ── Enquiries & Quotations ───────────────────────────────────────────────────
app.get('/api/enquiries', async (req, res) => {
  if (isMongoConnected) {
    try {
      const enquiries = await Enquiry.find().sort({ createdAt: -1 });
      return res.json({ success: true, enquiries });
    } catch (e) { console.error(e); }
  }
  res.json({ success: true, enquiries: [] });
});

app.post('/api/enquiries', async (req, res) => {
  if (isMongoConnected) {
    try {
      const enquiry = await Enquiry.create(req.body);
      return res.json({ success: true, enquiry });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }
  res.json({ success: true, enquiry: { ...req.body, id: Date.now().toString() } });
});

app.patch('/api/enquiries/:id', async (req, res) => {
  if (isMongoConnected) {
    try {
      const enquiry = await Enquiry.findByIdAndUpdate(req.params.id, req.body, { new: true });
      return res.json({ success: true, enquiry });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }
  res.json({ success: true });
});

// ── Consignments & Dispatch ─────────────────────────────────────────────────
app.get('/api/consignments', async (req, res) => {
  if (isMongoConnected) {
    try {
      const consignments = await Consignment.find().sort({ createdAt: -1 });
      return res.json({ success: true, consignments });
    } catch (e) { console.error(e); }
  }
  res.json({ success: true, consignments: [] });
});

app.post('/api/consignments/assign', async (req, res) => {
  const { enquiryId, driverId } = req.body;
  if (isMongoConnected) {
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

  res.json({ success: true });
});

app.patch('/api/consignments/:id/status', async (req, res) => {
  const { status, lat, lng } = req.body;
  if (isMongoConnected) {
    try {
      const consignment = await Consignment.findById(req.params.id);
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
  res.json({ success: true });
});

// ── Live GPS Updates ────────────────────────────────────────────────────────
app.post('/api/location/update', async (req, res) => {
  const { driverId, lat, lng } = req.body;
  if (isMongoConnected) {
    try {
      await User.findByIdAndUpdate(driverId, { lat, lng, updatedAt: new Date() });
      await Consignment.updateMany(
        { driverId, status: { $ne: 'delivered' } },
        { driverLat: lat, driverLng: lng, lastUpdated: new Date() }
      );
    } catch (e) { console.error(e); }
  }
  res.json({ success: true });
});

app.get('/api/location/active', async (req, res) => {
  if (isMongoConnected) {
    try {
      const activeConsignments = await Consignment.find({ status: { $ne: 'delivered' } });
      const drivers = await User.find({ role: 'driver' });
      return res.json({ success: true, activeConsignments, drivers });
    } catch (e) { console.error(e); }
  }
  res.json({ success: true, activeConsignments: [], drivers: [] });
});

// ── Socket.io Real-Time WebSockets Engine ─────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`⚡ Socket client connected: ${socket.id}`);

  socket.on('join-room', (data) => {
    const room = data.role === 'quarry_owner' ? 'quarry-owner' : `driver-${data.userId}`;
    socket.join(room);
    socket.join('quarry-channel');
    console.log(`⚡ Socket ${socket.id} joined room: ${room}`);
  });

  // Real-time GPS location update event
  socket.on('location-update', (data) => {
    // Broadcast instantly to quarry owner live map
    io.to('quarry-owner').emit('driver-location-changed', data);
  });

  // Walkie-Talkie (PTT) Audio Stream Events
  socket.on('ptt-start', (data) => {
    socket.to('quarry-channel').emit('ptt-active-start', { ...data, senderId: socket.id });
  });

  socket.on('ptt-audio-chunk', (data) => {
    socket.to('quarry-channel').emit('ptt-incoming-audio', { ...data, senderId: socket.id });
  });

  socket.on('ptt-stop', (data) => {
    socket.to('quarry-channel').emit('ptt-active-stop', { ...data, senderId: socket.id });
  });

  // Voice Call Signaling Events
  socket.on('call-signal', (data) => {
    socket.to('quarry-channel').emit('call-signal-received', { ...data, senderId: socket.id });
  });

  socket.on('disconnect', () => {
    console.log(`⚡ Socket client disconnected: ${socket.id}`);
  });
});

app.get('/health', (req, res) => res.json({
  status: 'ok',
  server: 'BillForge Render Service with WebSockets',
  database: isMongoConnected ? 'MongoDB Atlas (Connected)' : 'Fallback Local/Memory'
}));

server.listen(PORT, () => {
  console.log(`🚀 BillForge Express & WebSockets Server running on port ${PORT}`);
});

