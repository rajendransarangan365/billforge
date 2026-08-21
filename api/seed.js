const { connectToDatabase } = require('./db');

async function seedInitialData() {
  const { db } = await connectToDatabase();

  // 1. Quarries Collection
  const quarriesCol = db.collection('quarries');
  const countQuarries = await quarriesCol.countDocuments();

  if (countQuarries === 0) {
    console.log('Seeding initial Quarries into MongoDB...');
    await quarriesCol.insertMany([
      {
        id: 901,
        name: 'Sri Murugan Granite & Quarry',
        owner_name: 'Murugan S',
        phone: '9944112233',
        password: 'demo123',
        address: 'Mettur Dam Road, Salem, Tamil Nadu 636401',
        location: 'Salem, Tamil Nadu',
        lat: 11.7870,
        lng: 77.8420,
        gstin: '33AABCS1234A1Z5',
        is_verified: true,
        status: 'active',
        created_at: new Date().toISOString(),
      },
      {
        id: 902,
        name: 'Annamalai Blue Metal Works',
        owner_name: 'Annamalai R',
        phone: '9876501122',
        password: 'demo123',
        address: 'NH-47, Avinashi Road, Coimbatore, Tamil Nadu 641014',
        location: 'Coimbatore, Tamil Nadu',
        lat: 11.0168,
        lng: 76.9558,
        gstin: '33AACCA9876B1Z2',
        is_verified: true,
        status: 'active',
        created_at: new Date().toISOString(),
      },
      {
        id: 903,
        name: 'Velu Sand & Aggregates Pvt Ltd',
        owner_name: 'Veluchamy P',
        phone: '9443300221',
        password: 'demo123',
        address: 'Thiruvallur Bypass, Chennai, Tamil Nadu 602001',
        location: 'Chennai, Tamil Nadu',
        lat: 13.1067,
        lng: 79.9477,
        gstin: '33AABCV5555C1Z9',
        is_verified: true,
        status: 'active',
        created_at: new Date().toISOString(),
      },
    ]);
  }

  // 2. Materials Collection
  const materialsCol = db.collection('materials');
  const countMaterials = await materialsCol.countDocuments();

  if (countMaterials === 0) {
    console.log('Seeding initial Materials into MongoDB...');
    await materialsCol.insertMany([
      // Quarry 901
      { id: 1, quarry_id: 901, name: 'River Sand Grade A', price: 3200, unit: 'unit', min_order: 5, stock: 800, hsn: '2505', description: 'Premium river sand for construction', is_active: true, created_at: new Date().toISOString() },
      { id: 2, quarry_id: 901, name: 'M-Sand (Manufactured Sand)', price: 2600, unit: 'unit', min_order: 5, stock: 1200, hsn: '2505', description: 'ISI certified M-Sand', is_active: true, created_at: new Date().toISOString() },
      { id: 3, quarry_id: 901, name: 'Blue Metal 20mm (Jelly)', price: 2800, unit: 'unit', min_order: 5, stock: 600, hsn: '2517', description: '20mm well-graded aggregate', is_active: true, created_at: new Date().toISOString() },
      { id: 4, quarry_id: 901, name: 'Quarry Dust', price: 1100, unit: 'unit', min_order: 10, stock: 2000, hsn: '2517', description: 'Fine quarry dust for filling', is_active: true, created_at: new Date().toISOString() },
      // Quarry 902
      { id: 5, quarry_id: 902, name: 'Blue Metal 12mm', price: 2600, unit: 'unit', min_order: 5, stock: 500, hsn: '2517', description: '12mm crushed granite', is_active: true, created_at: new Date().toISOString() },
      { id: 6, quarry_id: 902, name: 'Blue Metal 40mm (Jelly)', price: 2400, unit: 'unit', min_order: 5, stock: 700, hsn: '2517', description: '40mm aggregate for base layer', is_active: true, created_at: new Date().toISOString() },
      { id: 7, quarry_id: 902, name: 'P-Sand (Plastering Sand)', price: 2900, unit: 'unit', min_order: 5, stock: 400, hsn: '2505', description: 'Fine plastering sand', is_active: true, created_at: new Date().toISOString() },
      { id: 8, quarry_id: 902, name: 'Granite Gravel', price: 3400, unit: 'MT', min_order: 2, stock: 300, hsn: '2516', description: 'Crushed granite gravel', is_active: true, created_at: new Date().toISOString() },
      // Quarry 903
      { id: 9, quarry_id: 903, name: 'River Sand Grade A', price: 3500, unit: 'unit', min_order: 5, stock: 600, hsn: '2505', description: 'High-quality river sand Chennai region', is_active: true, created_at: new Date().toISOString() },
      { id: 10, quarry_id: 903, name: 'M-Sand (Manufactured Sand)', price: 2700, unit: 'unit', min_order: 5, stock: 900, hsn: '2505', description: 'M-Sand conforming to IS:383', is_active: true, created_at: new Date().toISOString() },
      { id: 11, quarry_id: 903, name: 'Blue Metal 6mm', price: 2500, unit: 'unit', min_order: 10, stock: 1000, hsn: '2517', description: '6mm chips for RCC work', is_active: true, created_at: new Date().toISOString() },
      { id: 12, quarry_id: 903, name: 'Soil / Fill Gravel', price: 1600, unit: 'unit', min_order: 10, stock: 3000, hsn: '2517', description: 'Fill gravel for levelling', is_active: true, created_at: new Date().toISOString() },
    ]);
  }

  // 3. Drivers Collection
  const driversCol = db.collection('drivers');
  const countDrivers = await driversCol.countDocuments();

  if (countDrivers === 0) {
    console.log('Seeding initial Drivers into MongoDB...');
    await driversCol.insertMany([
      { id: 1, name: 'Ramesh K', phone: '9876543210', vehicle_no: 'TN 38 AB 1234', password: 'driver123', status: 'Available', rate_per_km: 45, min_charge: 1200, loading_charge: 500, created_at: new Date().toISOString() },
      { id: 2, name: 'Vel Murugan', phone: '9876500002', vehicle_no: 'TN 11 AK 5678', password: 'driver123', status: 'Available', rate_per_km: 42, min_charge: 1100, loading_charge: 450, created_at: new Date().toISOString() },
      { id: 3, name: 'Senthil Kumar', phone: '9876500003', vehicle_no: 'TN 45 CD 9012', password: 'driver123', status: 'Available', rate_per_km: 40, min_charge: 1000, loading_charge: 400, created_at: new Date().toISOString() },
    ]);
  }
}

module.exports = { seedInitialData };
