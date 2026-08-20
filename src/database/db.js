import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { generateDefaultTemplateDocxBase64 } from '../services/templateParser';

const DB_NAME = 'billforge.db';
const IS_WEB = Platform.OS === 'web';
let dbInstance = null;

// ═══════════════════════════════════════════════════════════════════════════════
// MULTI-TENANT SERVERLESS DATA LAYER
// All data keyed by quarryId: bf_quarry_${qid}_bills, bf_quarry_${qid}_materials, etc.
// Global keys: bf_admin, bf_quarries, bf_drivers, bf_customers, bf_user_session
// ═══════════════════════════════════════════════════════════════════════════════

// === Web LocalStorage Utilities ===
function webGet(key) {
  try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : null; } catch { return null; }
}
function webSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// Quarry-scoped key helper
function qKey(quarryId, suffix) { return `bf_quarry_${quarryId}_${suffix}`; }

// === Initialize Web Schema ===
function webInitializeSchema() {
  // Admin seed
  if (!webGet('bf_admin')) {
    webSet('bf_admin', { pin: 'admin123', created_at: new Date().toISOString() });
  }
  // Quarries registry
  if (!webGet('bf_quarries')) { webSet('bf_quarries', []); }
  // Global drivers
  if (!webGet('bf_drivers')) {
    webSet('bf_drivers', [
      { id: 1, name: 'Ramesh K', phone: '9876543210', vehicle_no: 'TN 38 AB 1234', password: 'driver123', status: 'Available', quarry_id: null, created_at: new Date().toISOString() }
    ]);
  }
  // Global customers
  if (!webGet('bf_customers')) { webSet('bf_customers', []); }

  // MIGRATION: Move old billforge_* data to new schema for quarry 1 if exists
  migrateOldData();
}

function migrateOldData() {
  const oldBills = webGet('billforge_bills');
  const quarries = webGet('bf_quarries') || [];
  if (oldBills && oldBills.length > 0 && quarries.length === 0) {
    // Migrate old single-quarry data into quarry id=1
    const oldProfile = webGet('billforge_company_profiles');
    const profile = oldProfile && oldProfile[0] ? oldProfile[0] : { name: 'My Quarry', phone: '', address: '', location: '' };
    const quarry = {
      id: 1,
      name: profile.name || 'My Quarry',
      owner_name: profile.name || 'Owner',
      phone: profile.phone || '9999999999',
      password: 'admin123',
      address: profile.address || '',
      location: profile.location || '',
      status: 'active',
      created_at: profile.created_at || new Date().toISOString(),
    };
    quarries.push(quarry);
    webSet('bf_quarries', quarries);
    // Move keyed data
    webSet(qKey(1, 'bills'), oldBills);
    webSet(qKey(1, 'materials'), webGet('billforge_materials') || getDefaultMaterials());
    webSet(qKey(1, 'customers'), webGet('billforge_customers') || []);
    webSet(qKey(1, 'payments'), webGet('billforge_payments') || []);
    webSet(qKey(1, 'reminders'), webGet('billforge_reminders') || []);
    webSet(qKey(1, 'enquiries'), webGet('billforge_enquiries') || []);
    webSet(qKey(1, 'consignments'), webGet('billforge_consignments') || []);
    webSet(qKey(1, 'templates'), webGet('billforge_templates') || [getDefaultTemplate()]);
    const oldDrivers = webGet('billforge_drivers') || [];
    webSet(qKey(1, 'drivers'), oldDrivers.map(d => d.id));
    // Merge old drivers into global
    const globalDrivers = webGet('bf_drivers') || [];
    for (const d of oldDrivers) {
      if (!globalDrivers.find(g => g.phone === d.phone)) {
        globalDrivers.push({ ...d, quarry_id: 1 });
      }
    }
    webSet('bf_drivers', globalDrivers);
  }
}

function getDefaultMaterials() {
  return [
    { name: 'River Sand', price_per_unit: 3200, unit_type: 'unit' },
    { name: 'M-Sand', price_per_unit: 2600, unit_type: 'unit' },
    { name: 'P-Sand', price_per_unit: 2900, unit_type: 'unit' },
    { name: 'Blue Metal (20mm)', price_per_unit: 2400, unit_type: 'unit' },
    { name: 'Blue Metal (40mm)', price_per_unit: 2200, unit_type: 'unit' },
    { name: 'Quarry Dust', price_per_unit: 1200, unit_type: 'unit' },
    { name: 'Soil / Gravel', price_per_unit: 1800, unit_type: 'unit' },
  ].map((m, i) => ({ ...m, id: i + 1, created_at: new Date().toISOString() }));
}

function getDefaultTemplate() {
  return {
    id: 1,
    name: 'Standard Billing Template',
    file_uri: '', file_base64: generateDefaultTemplateDocxBase64(),
    header_fields_json: JSON.stringify([
      { name: 'BN', type: 'numeric', label: 'Bill Number' },
      { name: 'PartyName', type: 'text', label: 'Customer / Party Name' },
      { name: 'BillDate', type: 'datetime', label: 'Billing Date' },
      { name: 'DeliveryLoc', type: 'text', label: 'Place of Delivery' },
    ]),
    table_fields_json: JSON.stringify([
      { name: 'Sno', type: 'numeric', label: 'S/No' },
      { name: 'DateTime', type: 'datetime', label: 'DATE' },
      { name: 'MaterialType', type: 'text', label: 'Materials Type' },
      { name: 'Trip', type: 'numeric', label: 'Trip' },
      { name: 'Units', type: 'numeric', label: 'Units' },
      { name: 'Cal1s', type: 'numeric', label: 'Each Value ₹', isVirtual: true },
    ]),
    all_fields_json: JSON.stringify([
      { name: 'BN', type: 'numeric', label: 'Bill Number' },
      { name: 'PartyName', type: 'text', label: 'Customer / Party Name' },
      { name: 'BillDate', type: 'datetime', label: 'Billing Date' },
      { name: 'DeliveryLoc', type: 'text', label: 'Place of Delivery' },
      { name: 'Sno', type: 'numeric', label: 'S/No' },
      { name: 'DateTime', type: 'datetime', label: 'DATE' },
      { name: 'MaterialType', type: 'text', label: 'Materials Type' },
      { name: 'Trip', type: 'numeric', label: 'Trip' },
      { name: 'Units', type: 'numeric', label: 'Units' },
      { name: 'Cal1s', type: 'numeric', label: 'Each Value ₹', isVirtual: true },
    ]),
    created_at: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE INIT
// ═══════════════════════════════════════════════════════════════════════════════
export async function getDatabase() {
  if (IS_WEB) { webInitializeSchema(); return { isWeb: true }; }
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
  await dbInstance.execAsync('PRAGMA journal_mode = WAL;');
  await initializeSchema(dbInstance);
  return dbInstance;
}

async function initializeSchema(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS quarries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, owner_name TEXT DEFAULT '',
      phone TEXT NOT NULL, password TEXT DEFAULT 'admin123',
      address TEXT DEFAULT '', location TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT, quarry_id INTEGER,
      name TEXT NOT NULL, file_uri TEXT, file_base64 TEXT,
      header_fields_json TEXT DEFAULT '[]', table_fields_json TEXT DEFAULT '[]',
      all_fields_json TEXT DEFAULT '[]', theme_color TEXT DEFAULT '#0F2050',
      font_family TEXT DEFAULT 'Arial', border_style TEXT DEFAULT 'single',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT, template_id INTEGER, quarry_id INTEGER,
      bill_number TEXT, customer_name TEXT DEFAULT '',
      header_data_json TEXT DEFAULT '{}', row_data_json TEXT DEFAULT '[]',
      total_amount REAL DEFAULT 0, pdf_uri TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT, quarry_id INTEGER,
      name TEXT NOT NULL, price_per_unit REAL NOT NULL, unit_type TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, quarry_id INTEGER,
      name TEXT NOT NULL, phone TEXT DEFAULT '', address TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, bill_id INTEGER, quarry_id INTEGER,
      customer_name TEXT DEFAULT '', amount REAL DEFAULT 0, note TEXT DEFAULT '',
      paid_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT, bill_id INTEGER, quarry_id INTEGER,
      customer_name TEXT DEFAULT '', customer_phone TEXT DEFAULT '',
      promised_amount REAL DEFAULT 0, discount_amount REAL DEFAULT 0,
      promised_date TEXT NOT NULL, status TEXT DEFAULT 'pending',
      paid_amount REAL DEFAULT 0, note TEXT DEFAULT '', notification_id TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS enquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT, quarry_id INTEGER,
      customer_name TEXT NOT NULL, customer_phone TEXT DEFAULT '',
      material_name TEXT NOT NULL, quantity REAL DEFAULT 1, unit_type TEXT DEFAULT 'ton',
      quoted_rate REAL DEFAULT 0, agreed_rate REAL DEFAULT 0, status TEXT DEFAULT 'pending',
      pickup_address TEXT DEFAULT '', customer_address TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, quarry_id INTEGER,
      name TEXT NOT NULL, phone TEXT NOT NULL, vehicle_no TEXT DEFAULT '',
      password TEXT DEFAULT 'driver123', status TEXT DEFAULT 'Available',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS consignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, enquiry_id INTEGER,
      driver_id INTEGER, quarry_id INTEGER,
      driver_name TEXT, customer_name TEXT, customer_phone TEXT,
      material_name TEXT, quantity REAL, unit_type TEXT, agreed_rate REAL,
      pickup_address TEXT, customer_address TEXT,
      status TEXT DEFAULT 'assigned', last_updated TEXT DEFAULT (datetime('now'))
    );
  `);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════
export async function authenticateAdmin(db, pin) {
  if (IS_WEB) {
    const admin = webGet('bf_admin');
    return admin && admin.pin === pin ? { role: 'admin', id: 'admin' } : null;
  }
  return pin === 'admin123' ? { role: 'admin', id: 'admin' } : null;
}

export async function getAllQuarries(db) {
  if (IS_WEB) { return webGet('bf_quarries') || []; }
  return await db.getAllAsync('SELECT * FROM quarries ORDER BY created_at DESC');
}

export async function registerQuarry(db, details) {
  const { name, owner_name, phone, password, address, location, materials = [], drivers = [], status = 'pending_approval' } = details;
  if (IS_WEB) {
    const quarries = webGet('bf_quarries') || [];
    const nextId = quarries.reduce((max, q) => q.id > max ? q.id : max, 0) + 1;
    const quarry = {
      id: nextId, name, owner_name: owner_name || name, phone,
      password: password || 'admin123', address: address || '', location: location || '',
      status: status || 'pending_approval', created_at: new Date().toISOString(),
    };
    quarries.push(quarry);
    webSet('bf_quarries', quarries);
    // Initialize quarry-scoped data
    const mats = materials.length > 0 ? materials.map((m, i) => ({
      id: i + 1, name: m.name, price_per_unit: parseFloat(m.price_per_unit) || 0,
      unit_type: m.unit_type || 'unit', created_at: new Date().toISOString(),
    })) : getDefaultMaterials();
    webSet(qKey(nextId, 'materials'), mats);
    webSet(qKey(nextId, 'bills'), []);
    webSet(qKey(nextId, 'customers'), []);
    webSet(qKey(nextId, 'payments'), []);
    webSet(qKey(nextId, 'reminders'), []);
    webSet(qKey(nextId, 'enquiries'), []);
    webSet(qKey(nextId, 'consignments'), []);
    webSet(qKey(nextId, 'templates'), [getDefaultTemplate()]);
    webSet(qKey(nextId, 'drivers'), []);
    // Register drivers to global pool
    const globalDrivers = webGet('bf_drivers') || [];
    for (const d of drivers) {
      if (d.name && d.phone) {
        const did = globalDrivers.reduce((max, g) => g.id > max ? g.id : max, 0) + 1;
        globalDrivers.push({
          id: did, name: d.name, phone: d.phone,
          vehicle_no: d.vehicle_no || '', password: d.password || 'driver123',
          status: 'Available', quarry_id: nextId, created_at: new Date().toISOString(),
        });
      }
    }
    webSet('bf_drivers', globalDrivers);
    return nextId;
  }
  const result = await db.runAsync(
    'INSERT INTO quarries (name, owner_name, phone, password, address, location, status) VALUES (?,?,?,?,?,?,?)',
    [name, owner_name || name, phone, password || 'admin123', address || '', location || '', status || 'pending_approval']
  );
  return result.lastInsertRowId;
}

export async function approveQuarry(db, quarryId) {
  if (IS_WEB) {
    const quarries = webGet('bf_quarries') || [];
    const idx = quarries.findIndex(q => q.id === parseInt(quarryId));
    if (idx !== -1) { quarries[idx].status = 'active'; webSet('bf_quarries', quarries); return true; }
    return false;
  }
  await db.runAsync('UPDATE quarries SET status = "active" WHERE id = ?', [quarryId]);
  return true;
}

export async function rejectQuarry(db, quarryId) {
  if (IS_WEB) {
    const quarries = webGet('bf_quarries') || [];
    const idx = quarries.findIndex(q => q.id === parseInt(quarryId));
    if (idx !== -1) { quarries[idx].status = 'rejected'; webSet('bf_quarries', quarries); return true; }
    return false;
  }
  await db.runAsync('UPDATE quarries SET status = "rejected" WHERE id = ?', [quarryId]);
  return true;
}

export async function getQuarryStats(db, quarryId) {
  if (IS_WEB) {
    const bills = webGet(qKey(quarryId, 'bills')) || [];
    const payments = webGet(qKey(quarryId, 'payments')) || [];
    const enquiries = webGet(qKey(quarryId, 'enquiries')) || [];
    const totalBilled = bills.reduce((s, b) => s + (b.total_amount || 0), 0);
    const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
    return {
      totalBills: bills.length, totalBilled, totalPaid,
      outstanding: totalBilled - totalPaid,
      pendingEnquiries: enquiries.filter(e => e.status === 'pending').length,
    };
  }
  return { totalBills: 0, totalBilled: 0, totalPaid: 0, outstanding: 0, pendingEnquiries: 0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUARRY OWNER AUTH
// ═══════════════════════════════════════════════════════════════════════════════
export async function authenticateOwner(db, phone, password) {
  if (IS_WEB) {
    const quarries = webGet('bf_quarries') || [];
    const q = quarries.find(q => q.phone === phone && q.password === password);
    if (q) {
      if (q.status === 'pending_approval') {
        return { error: 'pending_approval', message: 'Your quarry account is waiting for approval by Admin. Please contact administrator to activate your portal.' };
      }
      if (q.status === 'rejected') {
        return { error: 'rejected', message: 'Your quarry registration request was rejected by Admin. Please contact administrator.' };
      }
      return { id: q.id, quarry_id: q.id, name: q.name, owner_name: q.owner_name, phone: q.phone, role: 'quarry_owner' };
    }
    // Demo fallback
    if (phone === '9999999999' && password === 'admin123') {
      return { id: 1, quarry_id: 1, name: 'Demo Quarry', owner_name: 'Demo Owner', phone, role: 'quarry_owner' };
    }
    return null;
  }
  const q = await db.getFirstAsync('SELECT * FROM quarries WHERE phone = ? AND password = ?', [phone, password]);
  if (q) {
    if (q.status === 'pending_approval') {
      return { error: 'pending_approval', message: 'Your quarry account is waiting for approval by Admin.' };
    }
    if (q.status === 'rejected') {
      return { error: 'rejected', message: 'Your quarry registration was rejected by Admin.' };
    }
    return { id: q.id, quarry_id: q.id, name: q.name, owner_name: q.owner_name, phone: q.phone, role: 'quarry_owner' };
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRIVER AUTH
// ═══════════════════════════════════════════════════════════════════════════════
export async function authenticateDriver(db, phone, password) {
  if (IS_WEB) {
    const drivers = webGet('bf_drivers') || [];
    const d = drivers.find(d => d.phone === phone && (d.password || 'driver123') === password);
    if (d) return { id: d.id, name: d.name, phone: d.phone, vehicle_no: d.vehicle_no, quarry_id: d.quarry_id, role: 'driver' };
    return null;
  }
  const d = await db.getFirstAsync('SELECT * FROM drivers WHERE phone = ? AND password = ?', [phone, password]);
  if (d) return { id: d.id, name: d.name, phone: d.phone, vehicle_no: d.vehicle_no, quarry_id: d.quarry_id, role: 'driver' };
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER AUTH
// ═══════════════════════════════════════════════════════════════════════════════
export async function authenticateCustomer(db, phone) {
  if (IS_WEB) {
    const customers = webGet('bf_customers') || [];
    let c = customers.find(c => c.phone === phone);
    if (!c) {
      // Auto-register customer on first login
      const nextId = customers.reduce((max, c) => c.id > max ? c.id : max, 0) + 1;
      c = { id: nextId, name: `Customer ${phone.slice(-4)}`, phone, created_at: new Date().toISOString() };
      customers.push(c);
      webSet('bf_customers', customers);
    }
    return { id: c.id, name: c.name, phone: c.phone, role: 'customer' };
  }
  return { id: 1, name: 'Customer', phone, role: 'customer' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUARRY PROFILE
// ═══════════════════════════════════════════════════════════════════════════════
export async function getCompanyProfile(db, quarryId) {
  if (IS_WEB) {
    const quarries = webGet('bf_quarries') || [];
    return quarries.find(q => q.id === parseInt(quarryId)) || null;
  }
  return await db.getFirstAsync('SELECT * FROM quarries WHERE id = ?', [quarryId]);
}

export async function saveCompanyProfile(db, profile) {
  if (IS_WEB) {
    const quarries = webGet('bf_quarries') || [];
    const idx = quarries.findIndex(q => q.id === parseInt(profile.id));
    if (idx !== -1) {
      quarries[idx] = { ...quarries[idx], name: profile.name, address: profile.address, location: profile.location, phone: profile.phone };
      webSet('bf_quarries', quarries);
    }
    return;
  }
  await db.runAsync('UPDATE quarries SET name=?, address=?, location=?, phone=? WHERE id=?',
    [profile.name, profile.address || '', profile.location || '', profile.phone || '', profile.id]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATERIALS (quarry-scoped)
// ═══════════════════════════════════════════════════════════════════════════════
export async function getMaterials(db, quarryId = 1) {
  const qid = quarryId || 1;
  if (IS_WEB) {
    let list = webGet(qKey(qid, 'materials'));
    if (!list || list.length === 0) {
      list = getDefaultMaterials();
      webSet(qKey(qid, 'materials'), list);
    }
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }
  const rows = await db.getAllAsync('SELECT * FROM materials WHERE quarry_id = ? ORDER BY name', [qid]);
  if (!rows || rows.length === 0) {
    const defaults = getDefaultMaterials();
    for (const m of defaults) {
      await db.runAsync('INSERT INTO materials (quarry_id, name, price_per_unit, unit_type) VALUES (?,?,?,?)', [qid, m.name, m.price_per_unit, m.unit_type || 'unit']);
    }
    return defaults;
  }
  return rows;
}

export async function saveMaterial(db, material) {
  const qid = material.quarry_id || material.company_id;
  if (IS_WEB) {
    const list = webGet(qKey(qid, 'materials')) || [];
    if (material.id) {
      const idx = list.findIndex(m => m.id === parseInt(material.id));
      if (idx !== -1) { list[idx] = { ...list[idx], name: material.name, price_per_unit: parseFloat(material.price_per_unit), unit_type: material.unit_type || '' }; }
      webSet(qKey(qid, 'materials'), list);
      return material.id;
    }
    const nextId = list.reduce((max, m) => m.id > max ? m.id : max, 0) + 1;
    list.push({ id: nextId, name: material.name, price_per_unit: parseFloat(material.price_per_unit), unit_type: material.unit_type || '', created_at: new Date().toISOString() });
    webSet(qKey(qid, 'materials'), list);
    return nextId;
  }
  if (material.id) {
    await db.runAsync('UPDATE materials SET name=?, price_per_unit=?, unit_type=? WHERE id=?', [material.name, material.price_per_unit, material.unit_type || '', material.id]);
    return material.id;
  }
  const r = await db.runAsync('INSERT INTO materials (quarry_id, name, price_per_unit, unit_type) VALUES (?,?,?,?)', [qid, material.name, material.price_per_unit, material.unit_type || '']);
  return r.lastInsertRowId;
}

export async function deleteMaterial(db, id, quarryId) {
  if (IS_WEB) {
    const list = webGet(qKey(quarryId, 'materials')) || [];
    webSet(qKey(quarryId, 'materials'), list.filter(m => m.id !== parseInt(id)));
    return;
  }
  await db.runAsync('DELETE FROM materials WHERE id = ?', [id]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATES (quarry-scoped)
// ═══════════════════════════════════════════════════════════════════════════════
export async function getTemplates(db, quarryId) {
  if (IS_WEB) {
    let list = webGet(qKey(quarryId, 'templates'));
    if (!list || list.length === 0) {
      list = [getDefaultTemplate()];
      webSet(qKey(quarryId, 'templates'), list);
    }
    return list;
  }
  return await db.getAllAsync('SELECT * FROM templates WHERE quarry_id = ? ORDER BY id', [quarryId]);
}

export async function getTemplateById(db, id, quarryId) {
  if (IS_WEB) {
    const list = webGet(qKey(quarryId, 'templates')) || [];
    return list.find(t => t.id === parseInt(id)) || null;
  }
  return await db.getFirstAsync('SELECT * FROM templates WHERE id = ?', [id]);
}

export async function saveTemplate(db, template, quarryId) {
  if (IS_WEB) {
    const list = webGet(qKey(quarryId, 'templates')) || [];
    if (template.id) {
      const idx = list.findIndex(t => t.id === parseInt(template.id));
      if (idx !== -1) { list[idx] = { ...list[idx], ...template }; }
      webSet(qKey(quarryId, 'templates'), list);
      return template.id;
    }
    const nextId = list.reduce((max, t) => t.id > max ? t.id : max, 0) + 1;
    list.push({ ...template, id: nextId, created_at: new Date().toISOString() });
    webSet(qKey(quarryId, 'templates'), list);
    return nextId;
  }
  if (template.id) {
    await db.runAsync('UPDATE templates SET name=?, file_uri=?, file_base64=?, header_fields_json=?, table_fields_json=?, all_fields_json=? WHERE id=?',
      [template.name, template.file_uri || '', template.file_base64 || '', template.header_fields_json || '[]', template.table_fields_json || '[]', template.all_fields_json || '[]', template.id]);
    return template.id;
  }
  const r = await db.runAsync('INSERT INTO templates (quarry_id, name, file_uri, file_base64, header_fields_json, table_fields_json, all_fields_json) VALUES (?,?,?,?,?,?,?)',
    [quarryId, template.name, template.file_uri || '', template.file_base64 || '', template.header_fields_json || '[]', template.table_fields_json || '[]', template.all_fields_json || '[]']);
  return r.lastInsertRowId;
}

export async function deleteTemplate(db, id, quarryId) {
  if (IS_WEB) {
    const list = webGet(qKey(quarryId, 'templates')) || [];
    webSet(qKey(quarryId, 'templates'), list.filter(t => t.id !== parseInt(id)));
    return;
  }
  await db.runAsync('DELETE FROM templates WHERE id = ?', [id]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BILLS (quarry-scoped)
// ═══════════════════════════════════════════════════════════════════════════════
export async function getNextBillNumber(db, quarryId) {
  if (IS_WEB) {
    const bills = webGet(qKey(quarryId, 'bills')) || [];
    return (bills.length + 1).toString().padStart(4, '0');
  }
  const r = await db.getFirstAsync('SELECT COUNT(*) as count FROM bills WHERE quarry_id = ?', [quarryId]);
  return ((r?.count || 0) + 1).toString().padStart(4, '0');
}

export async function getBills(db, quarryId) {
  if (IS_WEB) {
    const list = webGet(qKey(quarryId, 'bills')) || [];
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  return await db.getAllAsync('SELECT * FROM bills WHERE quarry_id = ? ORDER BY created_at DESC', [quarryId]);
}

export async function getBillById(db, id, quarryId) {
  if (IS_WEB) {
    const list = webGet(qKey(quarryId, 'bills')) || [];
    return list.find(b => b.id === parseInt(id)) || null;
  }
  return await db.getFirstAsync('SELECT * FROM bills WHERE id = ?', [id]);
}

export async function saveBill(db, bill) {
  const qid = bill.quarry_id || bill.company_id || 1;
  const headerStr = typeof bill.header_data_json === 'string' ? bill.header_data_json : JSON.stringify(bill.header_data_json || bill.headerData || {});
  const rowStr = typeof bill.row_data_json === 'string' ? bill.row_data_json : JSON.stringify(bill.row_data_json || bill.rowData || []);
  const totalAmt = parseFloat(bill.total_amount) || 0;

  if (IS_WEB) {
    const list = webGet(qKey(qid, 'bills')) || [];
    if (bill.id) {
      const idx = list.findIndex(b => b.id === parseInt(bill.id));
      if (idx !== -1) {
        const existing = list[idx];
        const currentVersion = existing.version || 1;
        const pastVersions = existing.versions || [];
        pastVersions.push({
          version: currentVersion,
          total_amount: existing.total_amount,
          customer_name: existing.customer_name,
          header_data_json: existing.header_data_json,
          row_data_json: existing.row_data_json,
          saved_at: existing.updated_at || existing.created_at || new Date().toISOString(),
        });

        list[idx] = {
          ...existing,
          template_id: bill.template_id || existing.template_id,
          bill_number: bill.bill_number || existing.bill_number,
          customer_name: bill.customer_name || existing.customer_name || '',
          header_data_json: headerStr,
          row_data_json: rowStr,
          total_amount: totalAmt,
          version: currentVersion + 1,
          versions: pastVersions,
          updated_at: new Date().toISOString(),
        };
      }
      webSet(qKey(qid, 'bills'), list);
      return bill.id;
    }
    const nextId = list.reduce((max, b) => b.id > max ? b.id : max, 0) + 1;
    list.push({
      id: nextId, template_id: bill.template_id, quarry_id: qid, bill_number: bill.bill_number,
      customer_name: bill.customer_name || '',
      header_data_json: headerStr,
      row_data_json: rowStr,
      total_amount: totalAmt, pdf_uri: bill.pdf_uri || '', created_at: new Date().toISOString(),
      status: 'active', version: 1, versions: [],
    });
    webSet(qKey(qid, 'bills'), list);
    return nextId;
  }

  if (bill.id) {
    await db.runAsync(
      'UPDATE bills SET template_id=?, bill_number=?, customer_name=?, header_data_json=?, row_data_json=?, total_amount=? WHERE id=?',
      [bill.template_id, bill.bill_number, bill.customer_name || '', headerStr, rowStr, totalAmt, bill.id]
    );
    return bill.id;
  }
  const r = await db.runAsync(
    'INSERT INTO bills (template_id, quarry_id, bill_number, customer_name, header_data_json, row_data_json, total_amount, status) VALUES (?,?,?,?,?,?,?,?)',
    [bill.template_id, qid, bill.bill_number, bill.customer_name || '', headerStr, rowStr, totalAmt, 'active']
  );
  return r.lastInsertRowId;
}

export async function voidBill(db, id, quarryId = 1) {
  if (IS_WEB) {
    const list = webGet(qKey(quarryId, 'bills')) || [];
    const idx = list.findIndex(b => b.id === parseInt(id));
    if (idx !== -1) {
      list[idx].status = 'voided';
      list[idx].voided_at = new Date().toISOString();
      webSet(qKey(quarryId, 'bills'), list);
    }
    return;
  }
  await db.runAsync('UPDATE bills SET status = "voided" WHERE id = ?', [id]);
}

export async function restoreBill(db, id, quarryId = 1) {
  if (IS_WEB) {
    const list = webGet(qKey(quarryId, 'bills')) || [];
    const idx = list.findIndex(b => b.id === parseInt(id));
    if (idx !== -1) {
      list[idx].status = 'active';
      delete list[idx].voided_at;
      webSet(qKey(quarryId, 'bills'), list);
    }
    return;
  }
  await db.runAsync('UPDATE bills SET status = "active" WHERE id = ?', [id]);
}

export async function deleteBillsBulk(db, ids = [], quarryId = 1) {
  const numericIds = ids.map(i => parseInt(i));
  if (IS_WEB) {
    const list = webGet(qKey(quarryId, 'bills')) || [];
    const filtered = list.filter(b => !numericIds.includes(b.id));
    webSet(qKey(quarryId, 'bills'), filtered);
    const payments = webGet(qKey(quarryId, 'payments')) || [];
    webSet(qKey(quarryId, 'payments'), payments.filter(p => !numericIds.includes(p.bill_id)));
    return;
  }
  for (const id of numericIds) {
    await db.runAsync('DELETE FROM payments WHERE bill_id = ?', [id]);
    await db.runAsync('DELETE FROM bills WHERE id = ?', [id]);
  }
}

export async function restoreBillVersion(db, id, targetVersionNum, quarryId = 1) {
  if (IS_WEB) {
    const list = webGet(qKey(quarryId, 'bills')) || [];
    const idx = list.findIndex(b => b.id === parseInt(id));
    if (idx !== -1) {
      const bill = list[idx];
      const targetSnap = (bill.versions || []).find(v => v.version === targetVersionNum);
      if (targetSnap) {
        const currentVersion = bill.version || 1;
        bill.versions.push({
          version: currentVersion,
          total_amount: bill.total_amount,
          customer_name: bill.customer_name,
          header_data_json: bill.header_data_json,
          row_data_json: bill.row_data_json,
          saved_at: new Date().toISOString(),
        });
        bill.header_data_json = targetSnap.header_data_json;
        bill.row_data_json = targetSnap.row_data_json;
        bill.customer_name = targetSnap.customer_name;
        bill.total_amount = targetSnap.total_amount;
        bill.version = currentVersion + 1;
        bill.updated_at = new Date().toISOString();
        webSet(qKey(quarryId, 'bills'), list);
        return true;
      }
    }
  }
  return false;
}

export async function updateBillPdfUri(db, billId, pdfUri, quarryId) {
  if (IS_WEB) {
    const list = webGet(qKey(quarryId, 'bills')) || [];
    const idx = list.findIndex(b => b.id === parseInt(billId));
    if (idx !== -1) { list[idx].pdf_uri = pdfUri; webSet(qKey(quarryId, 'bills'), list); }
    return;
  }
  await db.runAsync('UPDATE bills SET pdf_uri = ? WHERE id = ?', [pdfUri, billId]);
}

export async function deleteBill(db, id, quarryId) {
  if (IS_WEB) {
    const list = webGet(qKey(quarryId, 'bills')) || [];
    webSet(qKey(quarryId, 'bills'), list.filter(b => b.id !== parseInt(id)));
    const payments = webGet(qKey(quarryId, 'payments')) || [];
    webSet(qKey(quarryId, 'payments'), payments.filter(p => p.bill_id !== parseInt(id)));
    return;
  }
  await db.runAsync('DELETE FROM payments WHERE bill_id = ?', [id]);
  await db.runAsync('DELETE FROM bills WHERE id = ?', [id]);
}

export async function getBillCount(db, quarryId) {
  if (IS_WEB) { return (webGet(qKey(quarryId, 'bills')) || []).length; }
  const r = await db.getFirstAsync('SELECT COUNT(*) as count FROM bills WHERE quarry_id = ?', [quarryId]);
  return r?.count || 0;
}

export async function getBillsThisMonth(db, quarryId) {
  if (IS_WEB) {
    const bills = webGet(qKey(quarryId, 'bills')) || [];
    const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
    return bills.filter(b => { const d = new Date(b.created_at); return d.getFullYear() === y && d.getMonth() === m; }).length;
  }
  const r = await db.getFirstAsync("SELECT COUNT(*) as count FROM bills WHERE quarry_id = ? AND created_at >= date('now','start of month')", [quarryId]);
  return r?.count || 0;
}

// === Drafts (quarry-scoped) ===
export function isMeaningfulDraft(draft) {
  if (!draft) return false;
  const hData = draft.headerData || {};
  // Check if any non-default field is populated
  const hasUserField = Object.entries(hData).some(([key, val]) => {
    if (!val || typeof val !== 'string') return false;
    const v = val.trim();
    if (!v) return false;
    // Exclude auto-filled default fields like Bill No, Dates, Shop Name
    if (v.match(/^(000\d|\d{4}-\d{2}-\d{2})/)) return false;
    if (v.toLowerCase().includes('quarry') || v.toLowerCase().includes('shop')) return false;
    return v.length > 1;
  });
  const hasPhone = Boolean(draft.customerPhone && draft.customerPhone.trim().length > 0);
  const hasAddress = Boolean(draft.customerAddress && draft.customerAddress.trim().length > 0);
  const rData = draft.rowData || [];
  const hasRowData = rData.some(row => Object.entries(row).some(([k, v]) => {
    if (k.toLowerCase() === 'sno' || k.toLowerCase() === 'slno') return false;
    return v && String(v).trim().length > 0 && String(v).trim() !== '0';
  }));

  return hasUserField || hasPhone || hasAddress || hasRowData;
}

export async function saveDraft(templateId, draftData, quarryId = 1) {
  if (!isMeaningfulDraft(draftData)) return;
  const key = qKey(quarryId, `draft_${templateId}`);
  try { localStorage.setItem(key, JSON.stringify(draftData)); } catch {}
}

export async function minimizeDraft(templateId, draftData, quarryId = 1) {
  if (!isMeaningfulDraft(draftData)) return;
  const key = qKey(quarryId, `draft_${templateId}`);
  const payload = { ...draftData, isMinimized: true, lastSaved: new Date().toISOString() };
  try { localStorage.setItem(key, JSON.stringify(payload)); } catch {}
}

export async function getDraft(templateId, quarryId = 1) {
  const key = qKey(quarryId, `draft_${templateId}`);
  try {
    const d = localStorage.getItem(key);
    if (!d) return null;
    const parsed = JSON.parse(d);
    if (!isMeaningfulDraft(parsed)) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch { return null; }
}

export async function clearDraft(templateId, quarryId = 1) {
  const key = qKey(quarryId, `draft_${templateId}`);
  try { localStorage.removeItem(key); } catch {}
}

export async function getAllDrafts(quarryId = 1) {
  const drafts = [];
  try {
    const prefix = `bf_quarry_${quarryId}_draft_`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        const data = JSON.parse(localStorage.getItem(k));
        if (data && isMeaningfulDraft(data)) {
          const tid = k.replace(prefix, '');
          drafts.push({ templateId: tid, data });
        }
      }
    }
  } catch {}
  return drafts;
}

export async function getMinimizedDrafts(quarryId = 1) {
  const all = await getAllDrafts(quarryId);
  return all.filter(d => d.data && d.data.isMinimized);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMERS (quarry-scoped)
// ═══════════════════════════════════════════════════════════════════════════════
export async function getCustomers(db, quarryId) {
  if (IS_WEB) { return webGet(qKey(quarryId, 'customers')) || []; }
  return await db.getAllAsync('SELECT * FROM customers WHERE quarry_id = ? ORDER BY name', [quarryId]);
}

export async function getCustomersWithSummary(db, quarryId) {
  if (IS_WEB) {
    const customers = webGet(qKey(quarryId, 'customers')) || [];
    const bills = webGet(qKey(quarryId, 'bills')) || [];
    const payments = webGet(qKey(quarryId, 'payments')) || [];
    return customers.map(c => {
      const cBills = bills.filter(b => (b.customer_name || '').toLowerCase() === (c.name || '').toLowerCase());
      const totalBilled = cBills.reduce((s, b) => s + (b.total_amount || 0), 0);
      const billIds = new Set(cBills.map(b => b.id));
      const totalPaid = payments.filter(p => billIds.has(p.bill_id)).reduce((s, p) => s + (p.amount || 0), 0);
      return { ...c, total_billed: totalBilled, total_paid: totalPaid, balance: totalBilled - totalPaid, bill_count: cBills.length };
    });
  }
  return await db.getAllAsync('SELECT * FROM customers WHERE quarry_id = ? ORDER BY name', [quarryId]);
}

export async function saveCustomer(db, customer) {
  const qid = customer.quarry_id;
  if (IS_WEB) {
    const list = webGet(qKey(qid, 'customers')) || [];
    if (customer.id) {
      const idx = list.findIndex(c => c.id === parseInt(customer.id));
      if (idx !== -1) { list[idx] = { ...list[idx], name: customer.name, phone: customer.phone || '', address: customer.address || '' }; }
      webSet(qKey(qid, 'customers'), list);
      return customer.id;
    }
    const nextId = list.reduce((max, c) => c.id > max ? c.id : max, 0) + 1;
    list.push({ id: nextId, name: customer.name, phone: customer.phone || '', address: customer.address || '', created_at: new Date().toISOString() });
    webSet(qKey(qid, 'customers'), list);
    return nextId;
  }
  if (customer.id) {
    await db.runAsync('UPDATE customers SET name=?, phone=?, address=? WHERE id=?', [customer.name, customer.phone || '', customer.address || '', customer.id]);
    return customer.id;
  }
  const r = await db.runAsync('INSERT INTO customers (quarry_id, name, phone, address) VALUES (?,?,?,?)', [qid, customer.name, customer.phone || '', customer.address || '']);
  return r.lastInsertRowId;
}

export async function deleteCustomer(db, id, quarryId) {
  if (IS_WEB) {
    const list = webGet(qKey(quarryId, 'customers')) || [];
    webSet(qKey(quarryId, 'customers'), list.filter(c => c.id !== parseInt(id)));
    return;
  }
  await db.runAsync('DELETE FROM customers WHERE id = ?', [id]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENTS (quarry-scoped)
// ═══════════════════════════════════════════════════════════════════════════════
export async function savePayment(db, payment) {
  const qid = payment.quarry_id || 1;
  if (IS_WEB) {
    const list = webGet(qKey(qid, 'payments')) || [];
    const nextId = list.reduce((max, p) => p.id > max ? p.id : max, 0) + 1;
    list.push({ id: nextId, bill_id: payment.bill_id, customer_name: payment.customer_name || '', amount: parseFloat(payment.amount) || 0, note: payment.note || '', paid_at: new Date().toISOString() });
    webSet(qKey(qid, 'payments'), list);
    return nextId;
  }
  const r = await db.runAsync('INSERT INTO payments (bill_id, quarry_id, customer_name, amount, note) VALUES (?,?,?,?,?)',
    [payment.bill_id, qid, payment.customer_name || '', payment.amount || 0, payment.note || '']);
  return r.lastInsertRowId;
}

export async function getPaymentsForBill(db, billId, quarryId) {
  if (IS_WEB) {
    const list = webGet(qKey(quarryId, 'payments')) || [];
    return list.filter(p => p.bill_id === parseInt(billId));
  }
  return await db.getAllAsync('SELECT * FROM payments WHERE bill_id = ? ORDER BY paid_at DESC', [billId]);
}

export async function deletePayment(db, id, quarryId) {
  if (IS_WEB) {
    const list = webGet(qKey(quarryId, 'payments')) || [];
    webSet(qKey(quarryId, 'payments'), list.filter(p => p.id !== parseInt(id)));
    return;
  }
  await db.runAsync('DELETE FROM payments WHERE id = ?', [id]);
}

export async function getAllPayments(db, quarryId) {
  if (IS_WEB) { return webGet(qKey(quarryId, 'payments')) || []; }
  return await db.getAllAsync('SELECT * FROM payments WHERE quarry_id = ? ORDER BY paid_at DESC', [quarryId]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEDGER (quarry-scoped)
// ═══════════════════════════════════════════════════════════════════════════════
export async function getCustomerLedger(db, quarryId) {
  if (IS_WEB) {
    const bills = webGet(qKey(quarryId, 'bills')) || [];
    const payments = webGet(qKey(quarryId, 'payments')) || [];
    const map = {};
    for (const b of bills) {
      const name = (b.customer_name || 'Unknown').trim();
      if (!map[name]) map[name] = { name, total_billed: 0, total_paid: 0 };
      map[name].total_billed += b.total_amount || 0;
    }
    for (const p of payments) {
      const bill = bills.find(b => b.id === p.bill_id);
      const name = (bill?.customer_name || p.customer_name || 'Unknown').trim();
      if (!map[name]) map[name] = { name, total_billed: 0, total_paid: 0 };
      map[name].total_paid += p.amount || 0;
    }
    return Object.values(map).map(c => ({ ...c, balance: c.total_billed - c.total_paid })).sort((a, b) => b.balance - a.balance);
  }
  return [];
}

export async function getMaterialLedger(db, quarryId) {
  if (IS_WEB) {
    const bills = webGet(qKey(quarryId, 'bills')) || [];
    const map = {};
    for (const b of bills) {
      try {
        const rows = typeof b.row_data_json === 'string' ? JSON.parse(b.row_data_json) : (b.row_data_json || []);
        for (const row of rows) {
          const mat = row.MaterialType || row.materialtype || row.material_type || 'Unknown';
          if (!map[mat]) map[mat] = { name: mat, total_qty: 0, total_value: 0, trip_count: 0 };
          map[mat].total_qty += parseFloat(row.Units || row.units || 0);
          map[mat].total_value += parseFloat(row.Cal1s || row.cal1s || row.each_value || 0);
          map[mat].trip_count += parseFloat(row.Trip || row.trip || 1);
        }
      } catch {}
    }
    return Object.values(map).sort((a, b) => b.total_value - a.total_value);
  }
  return [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// REMINDERS (quarry-scoped)
// ═══════════════════════════════════════════════════════════════════════════════
export async function saveReminder(db, reminder) {
  const qid = reminder.quarry_id || 1;
  if (IS_WEB) {
    const list = webGet(qKey(qid, 'reminders')) || [];
    if (reminder.id) {
      const idx = list.findIndex(r => r.id === parseInt(reminder.id));
      if (idx !== -1) { list[idx] = { ...list[idx], ...reminder }; }
      webSet(qKey(qid, 'reminders'), list);
      return reminder.id;
    }
    const nextId = list.reduce((max, r) => r.id > max ? r.id : max, 0) + 1;
    list.push({ ...reminder, id: nextId, status: reminder.status || 'pending', created_at: new Date().toISOString() });
    webSet(qKey(qid, 'reminders'), list);
    return nextId;
  }
  return 0;
}

export async function getReminders(db, quarryId) {
  if (IS_WEB) { return webGet(qKey(quarryId, 'reminders')) || []; }
  return await db.getAllAsync('SELECT * FROM reminders WHERE quarry_id = ? ORDER BY promised_date ASC', [quarryId]);
}

export async function getActiveReminders(db, quarryId) {
  if (IS_WEB) {
    const list = webGet(qKey(quarryId, 'reminders')) || [];
    return list.filter(r => r.status === 'pending' || r.status === 'reminded').length;
  }
  return 0;
}

export async function getOverdueReminders(db, quarryId) {
  if (IS_WEB) {
    const list = webGet(qKey(quarryId, 'reminders')) || [];
    const now = new Date().toISOString();
    return list.filter(r => (r.status === 'pending' || r.status === 'reminded') && r.promised_date < now).length;
  }
  return 0;
}

export async function deleteReminder(db, id, quarryId) {
  if (IS_WEB) {
    const list = webGet(qKey(quarryId, 'reminders')) || [];
    webSet(qKey(quarryId, 'reminders'), list.filter(r => r.id !== parseInt(id)));
    return;
  }
  await db.runAsync('DELETE FROM reminders WHERE id = ?', [id]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENQUIRIES (quarry-scoped)
// ═══════════════════════════════════════════════════════════════════════════════
export async function getEnquiries(db, quarryId) {
  if (IS_WEB) {
    const list = webGet(qKey(quarryId, 'enquiries')) || [];
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  return await db.getAllAsync('SELECT * FROM enquiries WHERE quarry_id = ? ORDER BY created_at DESC', [quarryId]);
}

export async function saveEnquiry(db, enquiry) {
  const qid = enquiry.quarry_id || 1;
  if (IS_WEB) {
    const list = webGet(qKey(qid, 'enquiries')) || [];
    if (enquiry.id) {
      const idx = list.findIndex(e => e.id === parseInt(enquiry.id));
      if (idx !== -1) { list[idx] = { ...list[idx], ...enquiry }; }
      webSet(qKey(qid, 'enquiries'), list);
      return enquiry.id;
    }
    const nextId = list.reduce((max, e) => e.id > max ? e.id : max, 0) + 1;
    list.push({ ...enquiry, id: nextId, status: enquiry.status || 'pending', created_at: new Date().toISOString() });
    webSet(qKey(qid, 'enquiries'), list);
    return nextId;
  }
  if (enquiry.id) {
    await db.runAsync('UPDATE enquiries SET status=?, agreed_rate=? WHERE id=?', [enquiry.status, enquiry.agreed_rate || 0, enquiry.id]);
    return enquiry.id;
  }
  const r = await db.runAsync('INSERT INTO enquiries (quarry_id, customer_name, customer_phone, material_name, quantity, unit_type, quoted_rate, status, pickup_address, customer_address) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [qid, enquiry.customer_name, enquiry.customer_phone || '', enquiry.material_name, enquiry.quantity || 1, enquiry.unit_type || 'ton', enquiry.quoted_rate || 0, 'pending', enquiry.pickup_address || '', enquiry.customer_address || '']);
  return r.lastInsertRowId;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRIVERS (global + quarry assignment)
// ═══════════════════════════════════════════════════════════════════════════════
export async function getDrivers(db, quarryId) {
  if (IS_WEB) {
    const all = webGet('bf_drivers') || [];
    if (quarryId) return all.filter(d => d.quarry_id === parseInt(quarryId));
    return all;
  }
  if (quarryId) return await db.getAllAsync('SELECT * FROM drivers WHERE quarry_id = ? ORDER BY name', [quarryId]);
  return await db.getAllAsync('SELECT * FROM drivers ORDER BY name');
}

export async function getGlobalDrivers(db) {
  if (IS_WEB) { return webGet('bf_drivers') || []; }
  return await db.getAllAsync('SELECT * FROM drivers ORDER BY name');
}

export async function saveDriver(db, driver) {
  if (IS_WEB) {
    const list = webGet('bf_drivers') || [];
    if (driver.id) {
      const idx = list.findIndex(d => d.id === parseInt(driver.id));
      if (idx !== -1) { list[idx] = { ...list[idx], ...driver }; }
      webSet('bf_drivers', list);
      return driver.id;
    }
    const nextId = list.reduce((max, d) => d.id > max ? d.id : max, 0) + 1;
    list.push({ ...driver, id: nextId, status: driver.status || 'Available', created_at: new Date().toISOString() });
    webSet('bf_drivers', list);
    return nextId;
  }
  if (driver.id) {
    await db.runAsync('UPDATE drivers SET name=?, phone=?, vehicle_no=?, status=? WHERE id=?', [driver.name, driver.phone, driver.vehicle_no || '', driver.status || 'Available', driver.id]);
    return driver.id;
  }
  const r = await db.runAsync('INSERT INTO drivers (quarry_id, name, phone, vehicle_no, password, status) VALUES (?,?,?,?,?,?)',
    [driver.quarry_id || null, driver.name, driver.phone, driver.vehicle_no || '', driver.password || 'driver123', 'Available']);
  return r.lastInsertRowId;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSIGNMENTS (quarry-scoped)
// ═══════════════════════════════════════════════════════════════════════════════
export async function getConsignments(db, quarryId) {
  if (IS_WEB) {
    const list = webGet(qKey(quarryId, 'consignments')) || [];
    return list.sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated));
  }
  return await db.getAllAsync('SELECT * FROM consignments WHERE quarry_id = ? ORDER BY last_updated DESC', [quarryId]);
}

export async function getDriverTrips(db, driverId) {
  if (IS_WEB) {
    // Search all quarry consignments for this driver
    const quarries = webGet('bf_quarries') || [];
    const trips = [];
    for (const q of quarries) {
      const consignments = webGet(qKey(q.id, 'consignments')) || [];
      trips.push(...consignments.filter(c => c.driver_id === parseInt(driverId)));
    }
    return trips.sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated));
  }
  return await db.getAllAsync('SELECT * FROM consignments WHERE driver_id = ? ORDER BY last_updated DESC', [driverId]);
}

export async function saveConsignment(db, c) {
  const qid = c.quarry_id || 1;
  if (IS_WEB) {
    const list = webGet(qKey(qid, 'consignments')) || [];
    if (c.id) {
      const idx = list.findIndex(x => x.id === parseInt(c.id));
      if (idx !== -1) { list[idx] = { ...list[idx], ...c, last_updated: new Date().toISOString() }; }
      webSet(qKey(qid, 'consignments'), list);
      return c.id;
    }
    const nextId = list.reduce((max, x) => x.id > max ? x.id : max, 0) + 1;
    list.push({ ...c, id: nextId, status: c.status || 'assigned', last_updated: new Date().toISOString() });
    webSet(qKey(qid, 'consignments'), list);
    return nextId;
  }
  if (c.id) {
    await db.runAsync('UPDATE consignments SET status=?, last_updated=datetime(\'now\') WHERE id=?', [c.status, c.id]);
    return c.id;
  }
  const r = await db.runAsync('INSERT INTO consignments (enquiry_id, driver_id, quarry_id, driver_name, customer_name, customer_phone, material_name, quantity, unit_type, agreed_rate, pickup_address, customer_address, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [c.enquiry_id || null, c.driver_id, qid, c.driver_name || '', c.customer_name || '', c.customer_phone || '', c.material_name || '', c.quantity || 0, c.unit_type || '', c.agreed_rate || 0, c.pickup_address || '', c.customer_address || '', 'assigned']);
  return r.lastInsertRowId;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATALOG (cross-quarry browsing for customer portal)
// ═══════════════════════════════════════════════════════════════════════════════
export async function getAllQuarryCatalogs(db) {
  if (IS_WEB) {
    const quarries = webGet('bf_quarries') || [];
    return quarries.filter(q => q.status === 'active').map(q => {
      const materials = webGet(qKey(q.id, 'materials')) || [];
      return { quarry: { id: q.id, name: q.name, location: q.location, phone: q.phone }, materials };
    });
  }
  return [];
}

// Legacy compatibility exports
export async function registerCompanyOwner(db, details) { return registerQuarry(db, details); }

// ═══════════════════════════════════════════════════════════════════════════════
// PASSWORD RESET / UNLOCK (Admin task)
// ═══════════════════════════════════════════════════════════════════════════════
export async function resetQuarryPassword(db, quarryId, newTempPassword) {
  if (IS_WEB) {
    const quarries = webGet('bf_quarries') || [];
    const idx = quarries.findIndex(q => q.id === parseInt(quarryId));
    if (idx !== -1) {
      quarries[idx].password = newTempPassword;
      webSet('bf_quarries', quarries);
      return true;
    }
    return false;
  }
  await db.runAsync('UPDATE quarries SET password = ? WHERE id = ?', [newTempPassword, quarryId]);
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT CONVERSATIONS (Customer <-> Quarry Owner)
// ═══════════════════════════════════════════════════════════════════════════════
export async function getChatMessages(db, quarryId, customerPhone) {
  if (IS_WEB) {
    const key = `bf_chat_${quarryId}_${customerPhone}`;
    return webGet(key) || [];
  }
  return [];
}

export async function sendChatMessage(db, quarryId, customerPhone, sender, senderName, text) {
  if (IS_WEB) {
    const key = `bf_chat_${quarryId}_${customerPhone}`;
    const list = webGet(key) || [];
    const msg = {
      id: `msg-${Date.now()}`,
      quarry_id: quarryId,
      customer_phone: customerPhone,
      sender,
      sender_name: senderName,
      text,
      timestamp: new Date().toISOString(),
    };
    list.push(msg);
    webSet(key, list);

    const chatsKey = qKey(quarryId, 'chats_index');
    const index = webGet(chatsKey) || [];
    if (!index.find(c => c.customer_phone === customerPhone)) {
      index.push({ customer_phone: customerPhone, customer_name: senderName, last_updated: new Date().toISOString() });
      webSet(chatsKey, index);
    }
    return msg;
  }
  return null;
}

export async function getQuarryChats(db, quarryId) {
  if (IS_WEB) {
    return webGet(qKey(quarryId, 'chats_index')) || [];
  }
  return [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRIVER RATE CARD (Per Kilometer & Charges)
// ═══════════════════════════════════════════════════════════════════════════════
export async function getDriverRateCard(db, driverId) {
  if (IS_WEB) {
    return webGet(`bf_driver_rate_${driverId}`) || {
      rate_per_km: 45,
      min_charge: 1200,
      loading_charge: 500,
      waiting_charge_per_hr: 200,
    };
  }
  return { rate_per_km: 45, min_charge: 1200, loading_charge: 500, waiting_charge_per_hr: 200 };
}

export async function saveDriverRateCard(db, driverId, rateCard) {
  if (IS_WEB) {
    webSet(`bf_driver_rate_${driverId}`, rateCard);
    return true;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEGAL TRANSPORT DOCUMENTS (eWay Bill, Gate Pass, Delivery Challan)
// ═══════════════════════════════════════════════════════════════════════════════
export async function saveConsignmentDocument(db, consignmentId, quarryId, docName, docType, docContent) {
  if (IS_WEB) {
    const key = qKey(quarryId, `docs_${consignmentId}`);
    const docs = webGet(key) || [];
    const doc = {
      id: `doc-${Date.now()}`,
      consignment_id: consignmentId,
      doc_name: docName,
      doc_type: docType || 'eWay Bill',
      doc_content: docContent,
      created_at: new Date().toISOString(),
    };
    docs.push(doc);
    webSet(key, docs);
    return doc;
  }
  return null;
}

export async function getConsignmentDocuments(db, consignmentId, quarryId) {
  if (IS_WEB) {
    return webGet(qKey(quarryId, `docs_${consignmentId}`)) || [];
  }
  return [];
}

