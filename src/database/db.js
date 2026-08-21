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
  return authenticateCustomerAccount(db, phone, '1234');
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
export async function getNextBillNumber(db, quarryId = 1) {
  const qid = quarryId || 1;
  if (IS_WEB) {
    const bills = webGet(qKey(qid, 'bills')) || [];
    const maxBn = bills.reduce((max, b) => {
      const bnStr = b.bill_number || '';
      const num = parseInt(bnStr.replace(/\D/g, ''));
      return (!isNaN(num) && num > max) ? num : max;
    }, 0);
    return (maxBn + 1).toString().padStart(4, '0');
  }
  const bills = await db.getAllAsync('SELECT bill_number FROM bills WHERE quarry_id = ?', [qid]);
  const maxBn = (bills || []).reduce((max, b) => {
    const num = parseInt((b.bill_number || '').replace(/\D/g, ''));
    return (!isNaN(num) && num > max) ? num : max;
  }, 0);
  return (maxBn + 1).toString().padStart(4, '0');
}

export async function getBills(db, quarryId) {
  if (IS_WEB) {
    const list = webGet(qKey(quarryId, 'bills')) || [];
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  return await db.getAllAsync('SELECT * FROM bills WHERE quarry_id = ? ORDER BY created_at DESC', [quarryId]);
}

export async function getBillById(db, id, quarryId = 1) {
  const targetId = parseInt(id);
  if (isNaN(targetId)) return null;
  const qid = quarryId || 1;
  if (IS_WEB) {
    const list = webGet(qKey(qid, 'bills')) || [];
    const bill = list.find(b => parseInt(b.id) === targetId);
    if (bill) return bill;

    // Cross-quarry fallback search
    const quarries = webGet('bf_quarries') || [];
    for (const q of quarries) {
      const qBills = webGet(qKey(q.id, 'bills')) || [];
      const found = qBills.find(b => parseInt(b.id) === targetId);
      if (found) return found;
    }
    return null;
  }
  return await db.getFirstAsync('SELECT * FROM bills WHERE id = ?', [targetId]);
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
// CUSTOMER REGISTRATION & AUTHENTICATION (Global Customer Directory)
// ═══════════════════════════════════════════════════════════════════════════════
export async function registerCustomerAccount(db, details) {
  const cleanPhone = String(details.phone || '').replace(/\D/g, '');
  if (!cleanPhone || cleanPhone.length < 10) throw new Error('Please enter a valid 10-digit mobile number.');
  if (!details.password || details.password.length < 4) throw new Error('Password must be at least 4 characters.');

  if (IS_WEB) {
    const customers = webGet('bf_customers') || [];
    const existing = customers.find(c => String(c.phone).replace(/\D/g, '') === cleanPhone);
    if (existing) {
      throw new Error('An account with this mobile number already exists. Please log in.');
    }
    const nextId = customers.reduce((max, c) => c.id > max ? c.id : max, 0) + 1;
    const newCustomer = {
      id: nextId,
      name: details.name || `Customer ${cleanPhone.slice(-4)}`,
      phone: cleanPhone,
      password: details.password,
      address: details.address || '',
      company_name: details.company_name || details.name || '',
      role: 'customer',
      created_at: new Date().toISOString(),
    };
    customers.push(newCustomer);
    webSet('bf_customers', customers);

    // Also add to active quarry 1 customer directory for seamless invoicing
    const q1Customers = webGet(qKey(1, 'customers')) || [];
    if (!q1Customers.some(c => c.phone === cleanPhone)) {
      q1Customers.push(newCustomer);
      webSet(qKey(1, 'customers'), q1Customers);
    }

    return newCustomer;
  }
  return { id: Date.now(), name: details.name, phone: cleanPhone, role: 'customer' };
}

export async function authenticateCustomerAccount(db, phone, password) {
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  if (!cleanPhone || cleanPhone.length < 10) throw new Error('Please enter a valid 10-digit mobile number.');

  if (IS_WEB) {
    const customers = webGet('bf_customers') || [];
    let customer = customers.find(c => String(c.phone).replace(/\D/g, '') === cleanPhone);
    
    // Auto-create or authenticate
    if (!customer) {
      // Create guest customer account automatically on first login if no password specified
      customer = {
        id: Date.now(),
        name: `Buyer ${cleanPhone.slice(-4)}`,
        phone: cleanPhone,
        password: password || '1234',
        role: 'customer',
        created_at: new Date().toISOString(),
      };
      customers.push(customer);
      webSet('bf_customers', customers);
    } else if (password && customer.password && customer.password !== password) {
      throw new Error('Incorrect password or PIN. Please check your credentials.');
    }

    return customer;
  }
  return { id: Date.now(), phone: cleanPhone, role: 'customer' };
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
export async function getEnquiries(db, quarryId = 1) {
  const qid = quarryId || 1;
  if (IS_WEB) {
    let list = webGet(qKey(qid, 'enquiries')) || [];

    // Merge customer live chats into the enquiries list
    const chatsIndex = webGet(qKey(qid, 'chats_index')) || [];
    for (const c of chatsIndex) {
      if (c.customer_phone) {
        const exists = list.some(e => e.customer_phone === c.customer_phone);
        if (!exists) {
          const msgs = webGet(`bf_chat_${qid}_${c.customer_phone}`) || [];
          const lastMsg = msgs[msgs.length - 1];
          list.push({
            id: `chat_${c.customer_phone}`,
            quarry_id: qid,
            customer_name: c.customer_name || 'Customer',
            customer_phone: c.customer_phone,
            material_name: lastMsg ? `Chat: "${lastMsg.text.slice(0, 30)}..."` : 'General Enquiry',
            quantity: 1,
            unit_type: 'unit',
            quoted_rate: 0,
            agreed_rate: 0,
            status: 'pending',
            created_at: c.last_updated || new Date().toISOString(),
          });
        }
      }
    }

    // Fallback: If no enquiries exist for specific quarry ID, pull from global list
    if (list.length === 0) {
      const globalList = webGet('bf_global_enquiries') || [];
      if (globalList.length > 0) {
        list = [...globalList];
      }
    }

    return list.sort((a, b) => new Date(b.created_at || b.updated_at) - new Date(a.created_at || a.updated_at));
  }
  return await db.getAllAsync('SELECT * FROM enquiries WHERE quarry_id = ? ORDER BY created_at DESC', [qid]);
}

export async function saveEnquiry(db, enquiry) {
  const qid = enquiry.quarry_id || 1;
  if (IS_WEB) {
    const list = webGet(qKey(qid, 'enquiries')) || [];
    let savedId = enquiry.id;
    if (enquiry.id) {
      const idx = list.findIndex(e => e.id === parseInt(enquiry.id));
      if (idx !== -1) { list[idx] = { ...list[idx], ...enquiry }; }
      webSet(qKey(qid, 'enquiries'), list);
    } else {
      const nextId = list.reduce((max, e) => e.id > max ? e.id : max, 0) + 1;
      savedId = nextId;
      const newEnq = { ...enquiry, id: nextId, quarry_id: qid, status: enquiry.status || 'pending', created_at: new Date().toISOString() };
      list.push(newEnq);
      webSet(qKey(qid, 'enquiries'), list);

      // Save copy to global fallback registry
      const globalList = webGet('bf_global_enquiries') || [];
      globalList.push(newEnq);
      webSet('bf_global_enquiries', globalList);
    }
    return savedId;
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
  const r = await db.runAsync('INSERT INTO consignments (enquiry_id, driver_id, quarry_id, driver_name, customer_name, customer_phone, material_name, quantity, unit_type, agreed_rate, pickup_address, customer_address, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [c.enquiry_id || null, c.driver_id, qid, c.driver_name || '', c.customer_name || '', c.customer_phone || '', c.material_name || '', c.quantity || 0, c.unit_type || '', c.agreed_rate || 0, c.pickup_address || '', c.customer_address || '', 'assigned']);
  return r.lastInsertRowId;
}

export async function getOpenDeliveryOrders(db) {
  if (IS_WEB) {
    const quarries = webGet('bf_quarries') || [];
    const openOrders = [];
    for (const q of quarries) {
      const consignments = webGet(qKey(q.id, 'consignments')) || [];
      const unassigned = consignments.filter(c => !c.driver_id || c.status === 'unassigned' || c.status === 'pending_pickup');
      for (const u of unassigned) {
        openOrders.push({ ...u, quarry_name: q.name, quarry_location: q.location, quarry_phone: q.phone });
      }
    }
    if (openOrders.length === 0) {
      return [
        {
          id: 901,
          quarry_id: 1,
          quarry_name: 'Demo Quarry & Crushers',
          quarry_location: 'Madukkarai, Coimbatore',
          customer_name: 'Anand Construction',
          customer_phone: '9876543210',
          pickup_address: 'Madukkarai Quarry Gate #2',
          customer_address: 'Site #42, Avinashi Road, Tiruppur',
          material_name: 'M-Sand Grade A',
          quantity: 12,
          unit_type: 'tons',
          distance_km: 42,
          estimated_payout: 3570,
          status: 'unassigned',
          created_at: new Date().toISOString(),
        },
        {
          id: 902,
          quarry_id: 1,
          quarry_name: 'Demo Quarry & Crushers',
          quarry_location: 'Madukkarai, Coimbatore',
          customer_name: 'Kovai Builders Pvt Ltd',
          customer_phone: '9123456789',
          pickup_address: 'Quarry Yard 1',
          customer_address: 'Saravanampatti, Coimbatore',
          material_name: '20mm Jelly Metal',
          quantity: 20,
          unit_type: 'tons',
          distance_km: 18,
          estimated_payout: 1800,
          status: 'unassigned',
          created_at: new Date().toISOString(),
        },
        {
          id: 903,
          quarry_id: 2,
          quarry_name: 'Kongu Granite Quarry',
          quarry_location: 'Palladam, Tiruppur',
          customer_name: 'Surya Infrastructure',
          customer_phone: '9944332211',
          pickup_address: 'Kongu Quarry Yard',
          customer_address: 'Dharapuram Main Road',
          material_name: 'P-Sand Plastering',
          quantity: 15,
          unit_type: 'tons',
          distance_km: 28,
          estimated_payout: 2500,
          status: 'unassigned',
          created_at: new Date().toISOString(),
        },
      ];
    }
    return openOrders;
  }
  return [];
}

export async function acceptDeliveryOrder(db, orderId, quarryId, driverId, driverName, vehicleNo) {
  if (IS_WEB) {
    const list = webGet(qKey(quarryId || 1, 'consignments')) || [];
    const idx = list.findIndex(c => c.id === parseInt(orderId));
    if (idx !== -1) {
      list[idx].driver_id = parseInt(driverId);
      list[idx].driver_name = driverName;
      list[idx].vehicle_no = vehicleNo;
      list[idx].status = 'assigned';
      list[idx].last_updated = new Date().toISOString();
      webSet(qKey(quarryId || 1, 'consignments'), list);
      return true;
    }
    // Fallback for mock orders
    list.push({
      id: parseInt(orderId),
      quarry_id: quarryId || 1,
      driver_id: parseInt(driverId),
      driver_name: driverName,
      vehicle_no: vehicleNo,
      status: 'assigned',
      last_updated: new Date().toISOString(),
    });
    webSet(qKey(quarryId || 1, 'consignments'), list);
    return true;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATALOG (cross-quarry browsing for customer portal)
// ═══════════════════════════════════════════════════════════════════════════════
export async function getAllQuarryCatalogs(db) {
  const DEFAULT_QUARRIES = [
    { id: 1, name: 'MS Blue Metals & Aggregates', location: 'Madukkarai, Coimbatore', phone: '9894698049', owner_name: 'Sarangan', status: 'active' },
    { id: 2, name: 'Demo Quarry & Crushers', location: 'Palladam, Tiruppur', phone: '9876543210', owner_name: 'Rajendran', status: 'active' },
    { id: 3, name: 'Sri Laxmi Granites & Sand Depot', location: 'Pollachi, Coimbatore', phone: '9123456789', owner_name: 'Anand Kumar', status: 'active' },
  ];

  const DEFAULT_MATERIALS = [
    { id: 101, name: 'River Sand Grade A', price: 3200, unit: 'unit', code: 'RS-01', hsn: '2505' },
    { id: 102, name: 'M-Sand (Manufactured Sand)', price: 2600, unit: 'unit', code: 'MS-02', hsn: '2505' },
    { id: 103, name: 'P-Sand (Plastering Sand)', price: 2900, unit: 'unit', code: 'PS-03', hsn: '2505' },
    { id: 104, name: 'Blue Metal (20mm Jelly)', price: 2400, unit: 'unit', code: 'BM-20', hsn: '2517' },
    { id: 105, name: 'Blue Metal (40mm Jelly)', price: 2200, unit: 'unit', code: 'BM-40', hsn: '2517' },
    { id: 106, name: 'Quarry Dust / Crusher Dust', price: 1200, unit: 'unit', code: 'QD-06', hsn: '2517' },
    { id: 107, name: 'Soil / Gravel Fill', price: 900, unit: 'unit', code: 'SG-07', hsn: '2505' },
  ];

  if (IS_WEB) {
    let quarries = webGet('bf_quarries') || [];
    if (quarries.length === 0) {
      quarries = DEFAULT_QUARRIES;
      webSet('bf_quarries', quarries);
    }

    const activeQuarries = quarries.filter(q => q.status === 'active' || !q.status);
    const resultList = activeQuarries.length > 0 ? activeQuarries : DEFAULT_QUARRIES;

    return resultList.map(q => {
      let materials = webGet(qKey(q.id, 'materials')) || [];
      if (materials.length === 0) {
        materials = DEFAULT_MATERIALS;
        webSet(qKey(q.id, 'materials'), materials);
      }
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
export async function getChatMessages(db, quarryId = 1, customerPhone = '9894698049') {
  const qid = parseInt(quarryId) || 1;
  const phone = (customerPhone || '9894698049').trim();
  if (IS_WEB) {
    const key = `bf_chat_${qid}_${phone}`;
    const msgs = webGet(key) || [];
    if (msgs.length === 0) {
      // Fallback: check across all quarries if phone thread exists
      const quarries = webGet('bf_quarries') || [];
      for (const q of quarries) {
        const foundMsgs = webGet(`bf_chat_${q.id}_${phone}`);
        if (foundMsgs && foundMsgs.length > 0) return foundMsgs;
      }
    }
    return msgs;
  }
  return [];
}

export async function sendChatMessage(db, quarryId = 1, customerPhone = '9894698049', sender = 'customer', senderName = 'Customer', text = '') {
  const qid = parseInt(quarryId) || 1;
  const phone = (customerPhone || '9894698049').trim();
  if (IS_WEB) {
    const key = `bf_chat_${qid}_${phone}`;
    const list = webGet(key) || [];
    const msg = {
      id: `msg-${Date.now()}`,
      quarry_id: qid,
      customer_phone: phone,
      sender,
      sender_name: senderName || (sender === 'owner' ? 'Quarry Owner' : 'Customer'),
      text,
      timestamp: new Date().toISOString(),
    };
    list.push(msg);
    webSet(key, list);

    const chatsKey = qKey(qid, 'chats_index');
    const index = webGet(chatsKey) || [];
    const existingChat = index.find(c => c.customer_phone === phone);
    if (!existingChat) {
      index.push({ customer_phone: phone, customer_name: senderName || 'Customer', last_updated: new Date().toISOString() });
    } else {
      existingChat.last_updated = new Date().toISOString();
      if (senderName) existingChat.customer_name = senderName;
    }
    webSet(chatsKey, index);

    // Auto sync with enquiries list for Quarry Owner visibility
    const enquiriesKey = qKey(qid, 'enquiries');
    const enquiries = webGet(enquiriesKey) || [];
    const existingEnq = enquiries.find(e => e.customer_phone === phone);
    if (existingEnq) {
      existingEnq.material_name = `Live Chat: "${text.slice(0, 25)}..."`;
      existingEnq.created_at = new Date().toISOString();
    } else {
      enquiries.push({
        id: Date.now(),
        quarry_id: qid,
        customer_name: senderName || 'Chat Customer',
        customer_phone: phone,
        material_name: `Live Chat: "${text.slice(0, 25)}..."`,
        quantity: 1,
        unit_type: 'unit',
        quoted_rate: 0,
        agreed_rate: 0,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
    }
    webSet(enquiriesKey, enquiries);

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

// ═══════════════════════════════════════════════════════════════════════════════
// UNIVERSAL MESSAGING SYSTEM (Owner, Admin, Driver, Customer WhatsApp-style)
// ═══════════════════════════════════════════════════════════════════════════════
export async function getUniversalContacts(db, currentRole, currentQuarryId) {
  if (IS_WEB) {
    const contacts = [];

    // 1. Platform Admin Contact
    contacts.push({
      id: 'contact_admin',
      role: 'admin',
      name: 'Platform Administrator',
      subtext: 'BillForge Admin & Technical Support',
      phone: '1234567890',
      avatarIcon: 'shield-checkmark',
      badgeBg: '#FFF3E0',
      badgeColor: '#E65100',
    });

    // 2. Quarry Owners Contacts
    const quarries = webGet('bf_quarries') || [];
    const activeQuarries = quarries.filter(q => q.status === 'active');
    if (activeQuarries.length === 0) {
      contacts.push({
        id: 'contact_quarry_1',
        quarry_id: 1,
        role: 'quarry_owner',
        name: 'Demo Quarry & Crushers',
        subtext: 'Quarry Owner • Madukkarai, Coimbatore',
        phone: '9894698049',
        avatarIcon: 'business',
        badgeBg: '#E8F5E9',
        badgeColor: '#2E7D32',
      });
    } else {
      for (const q of activeQuarries) {
        contacts.push({
          id: `contact_quarry_${q.id}`,
          quarry_id: q.id,
          role: 'quarry_owner',
          name: q.name,
          subtext: `Quarry Owner • ${q.location || 'Tamil Nadu'}`,
          phone: q.phone || '9894698049',
          avatarIcon: 'business',
          badgeBg: '#E8F5E9',
          badgeColor: '#2E7D32',
        });
      }
    }

    // 3. Drivers Contacts
    const drivers = webGet('bf_drivers') || [];
    if (drivers.length === 0) {
      contacts.push(
        {
          id: 'contact_driver_101',
          driver_id: 101,
          role: 'driver',
          name: 'Murali Transports (TN 38 AB 1234)',
          subtext: 'In-House Quarry Fleet Driver',
          phone: '9876543210',
          avatarIcon: 'car-sport',
          badgeBg: '#E3F2FD',
          badgeColor: '#1565C0',
        },
        {
          id: 'contact_driver_102',
          driver_id: 102,
          role: 'driver',
          name: 'Selvam Logistics (TN 37 C 9988)',
          subtext: 'Private Freelance Transporter',
          phone: '9123456789',
          avatarIcon: 'car-sport',
          badgeBg: '#F3E8FF',
          badgeColor: '#7C3AED',
        }
      );
    } else {
      for (const d of drivers) {
        contacts.push({
          id: `contact_driver_${d.id}`,
          driver_id: d.id,
          role: 'driver',
          name: `${d.name} (${d.vehicle_no || 'Lorry'})`,
          subtext: d.category === 'private' ? 'Private Freelance Transporter' : 'In-House Quarry Driver',
          phone: d.phone,
          avatarIcon: 'car-sport',
          badgeBg: '#E3F2FD',
          badgeColor: '#1565C0',
        });
      }
    }

    // 4. Customers Contacts
    const customers = webGet('bf_customers') || [];
    if (customers.length === 0) {
      contacts.push(
        {
          id: 'contact_customer_1',
          role: 'customer',
          name: 'Kovai Builders & Developers',
          subtext: 'Customer / Buyer • 9123456789',
          phone: '9123456789',
          avatarIcon: 'person',
          badgeBg: '#E8F5E9',
          badgeColor: '#2E7D32',
        },
        {
          id: 'contact_customer_2',
          role: 'customer',
          name: 'Sarangan Constructions',
          subtext: 'Customer / Buyer • 9894698049',
          phone: '9894698049',
          avatarIcon: 'person',
          badgeBg: '#E8F5E9',
          badgeColor: '#2E7D32',
        }
      );
    } else {
      for (const c of customers) {
        contacts.push({
          id: `contact_customer_${c.id}`,
          role: 'customer',
          name: c.name,
          subtext: `Customer / Buyer • ${c.phone || ''}`,
          phone: c.phone || '9894698049',
          avatarIcon: 'person',
          badgeBg: '#F3E8FF',
          badgeColor: '#7C3AED',
        });
      }
    }

    return contacts;
  }
  return [];
}

export function getEntityId(entity) {
  if (!entity) return 'guest';
  if (typeof entity === 'string') return entity;
  if (entity.role === 'admin' || entity.id === 'contact_admin') return 'admin_1';
  if (entity.quarry_id || entity.quarryId) return `quarry_${entity.quarry_id || entity.quarryId}`;
  if (entity.driver_id || entity.driverId) return `driver_${entity.driver_id || entity.driverId}`;
  if (entity.customer_id || entity.customerId) return `customer_${entity.customer_id || entity.customerId}`;
  if (entity.phone) return `phone_${String(entity.phone).replace(/\D/g, '')}`;
  if (entity.id) return `entity_${entity.id}`;
  return 'user';
}

export function getSharedThreadKey(contact, currentUser) {
  const idA = getEntityId(currentUser);
  const idB = getEntityId(contact);
  const pair = [String(idA), String(idB)].sort();
  return `bf_chat_${pair.join('_')}`;
}

export async function getUniversalMessages(db, contact, currentUser) {
  if (IS_WEB) {
    const threadKey = typeof contact === 'string' ? `bf_chat_${contact}` : getSharedThreadKey(contact, currentUser);
    let msgs = webGet(threadKey) || [];
    
    // Legacy fallback check if empty
    if (msgs.length === 0 && typeof contact === 'object' && contact) {
      const qid = contact.quarry_id || currentUser?.quarryId;
      const phone = contact.phone || currentUser?.phone;
      if (qid && phone) {
        const legacyMsgs = webGet(`bf_chat_${qid}_${phone}`);
        if (legacyMsgs && legacyMsgs.length > 0) {
          webSet(threadKey, legacyMsgs);
          return legacyMsgs;
        }
      }
    }

    if (msgs.length > 0) return msgs;

    const welcomeMsgs = [
      {
        id: `msg-welcome-${Date.now()}`,
        sender_role: 'system',
        sender_name: 'BillForge Live Connect',
        text: '👋 Start direct communication! Type a message below or tap the WhatsApp button to chat directly on WhatsApp.',
        timestamp: new Date().toISOString(),
      }
    ];
    webSet(threadKey, welcomeMsgs);
    return welcomeMsgs;
  }
  return [];
}

export async function sendUniversalMessage(db, contact, senderRole, senderName, text, currentUser) {
  if (IS_WEB) {
    const threadKey = typeof contact === 'string' ? `bf_chat_${contact}` : getSharedThreadKey(contact, currentUser);
    const list = webGet(threadKey) || [];
    const newMsg = {
      id: `msg-${Date.now()}`,
      sender_role: senderRole,
      sender_name: senderName,
      sender: senderRole === 'quarry_owner' ? 'owner' : senderRole === 'customer' ? 'customer' : 'driver',
      text,
      timestamp: new Date().toISOString(),
    };
    list.push(newMsg);
    webSet(threadKey, list);

    // Broadcast event across browser tabs if available
    try {
      if (typeof window !== 'undefined' && window.BroadcastChannel) {
        const bc = new window.BroadcastChannel('billforge_chat');
        bc.postMessage({ type: 'NEW_MESSAGE', threadKey });
        bc.close();
      }
    } catch (e) {}

    // Legacy sync fallback for enquiry feeds
    if (typeof contact === 'object' && contact) {
      const targetQuarryId = contact.quarry_id || currentUser?.quarryId || 1;
      const targetPhone = contact.phone || currentUser?.phone || '9894698049';
      if (targetQuarryId && targetPhone) {
        const legacyKey = `bf_chat_${targetQuarryId}_${targetPhone}`;
        webSet(legacyKey, list);
      }
    }

    return newMsg;
  }
  return null;
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

// ═══════════════════════════════════════════════════════════════════════════════
// GEO-FENCING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

// Haversine formula — returns distance in meters between two lat/lng points
export function calculateDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateDistanceKm(lat1, lng1, lat2, lng2) {
  return calculateDistanceMeters(lat1, lng1, lat2, lng2) / 1000;
}

// Check if driver is within radius (default 150m) of target location
export function isWithinGeoFence(driverLat, driverLng, targetLat, targetLng, radiusMeters = 150) {
  if (!driverLat || !driverLng || !targetLat || !targetLng) return false;
  const distance = calculateDistanceMeters(driverLat, driverLng, targetLat, targetLng);
  return distance <= radiusMeters;
}

// Get current GPS position (browser Geolocation API, returns Promise)
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(new Error(`Location access denied: ${err.message}`)),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSPORT REQUESTS (Enquiry → Agreed → Transport)
// ═══════════════════════════════════════════════════════════════════════════════
export async function createTransportRequest(db, payload) {
  if (IS_WEB) {
    const requests = webGet('bf_transport_requests') || [];
    const newId = `tr_${Date.now()}`;
    const req = {
      id: newId,
      enquiry_id: payload.enquiry_id,
      quarry_id: payload.quarry_id,
      customer_id: payload.customer_id,
      customer_name: payload.customer_name || '',
      customer_phone: payload.customer_phone || '',
      material_name: payload.material_name || '',
      quantity: payload.quantity || 1,
      unit_type: payload.unit_type || 'unit',
      agreed_rate: payload.agreed_rate || 0,
      from_lat: payload.from_lat || null,
      from_lng: payload.from_lng || null,
      from_address: payload.from_address || '',
      to_lat: payload.to_lat || null,
      to_lng: payload.to_lng || null,
      to_address: payload.to_address || '',
      distance_km: payload.distance_km || 0,
      transport_mode: payload.transport_mode || 'auto', // 'auto' | 'manual' | 'own'
      status: 'pending_assignment', // pending_assignment | assigned | in_progress | delivered
      created_at: new Date().toISOString(),
    };
    requests.push(req);
    webSet('bf_transport_requests', requests);
    // Also broadcast via BroadcastChannel
    try {
      const bc = new BroadcastChannel('billforge_chat');
      bc.postMessage({ type: 'transport_request_created', data: req });
      bc.close();
    } catch {}
    return req;
  }
  return null;
}

export async function getTransportRequests(db, quarryId) {
  if (IS_WEB) {
    const requests = webGet('bf_transport_requests') || [];
    return requests.filter(r => r.quarry_id === parseInt(quarryId));
  }
  return [];
}

export async function getPendingTransportRequests(db, quarryId) {
  const all = await getTransportRequests(db, quarryId);
  return all.filter(r => r.status === 'pending_assignment');
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRIVER AVAILABILITY & AUTO-ASSIGN
// ═══════════════════════════════════════════════════════════════════════════════
export async function getAvailableDrivers(db) {
  if (IS_WEB) {
    const drivers = webGet('bf_drivers') || [];
    const trips = webGet('bf_trips') || [];
    const busyDriverIds = new Set(trips.filter(t => ['assigned', 'en_route_quarry', 'reached_quarry', 'picked_up', 'en_route_customer'].includes(t.status)).map(t => t.driver_id));
    return drivers.filter(d => !busyDriverIds.has(d.id));
  }
  return [];
}

export async function autoAssignLowestCostDriver(db, fromLat, fromLng, toLat, toLng) {
  const drivers = await getAvailableDrivers(db);
  if (drivers.length === 0) return null;

  const distanceKm = calculateDistanceKm(fromLat || 11.0, fromLng || 76.9, toLat || 11.1, toLng || 77.0);

  // Calculate estimated cost for each driver
  const scored = drivers.map(d => {
    const rateCard = webGet(`bf_driver_ratecard_${d.id}`) || { rate_per_km: 45, min_charge: 1200 };
    const cost = Math.max(rateCard.min_charge || 1200, (rateCard.rate_per_km || 45) * distanceKm);
    return { ...d, estimated_cost: Math.round(cost), distance_km: Math.round(distanceKm * 10) / 10, rate_per_km: rateCard.rate_per_km || 45 };
  });

  return scored.sort((a, b) => a.estimated_cost - b.estimated_cost);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRIPS (Full lifecycle)
// ═══════════════════════════════════════════════════════════════════════════════
export async function createTrip(db, payload) {
  if (IS_WEB) {
    const trips = webGet('bf_trips') || [];
    const newId = `trip_${Date.now()}`;
    const trip = {
      id: newId,
      transport_request_id: payload.transport_request_id || null,
      enquiry_id: payload.enquiry_id || null,
      quarry_id: payload.quarry_id,
      driver_id: payload.driver_id,
      driver_name: payload.driver_name || '',
      driver_phone: payload.driver_phone || '',
      vehicle_no: payload.vehicle_no || '',
      customer_name: payload.customer_name || '',
      customer_phone: payload.customer_phone || '',
      material_name: payload.material_name || '',
      quantity: payload.quantity || 1,
      from_address: payload.from_address || '',
      from_lat: payload.from_lat || null,
      from_lng: payload.from_lng || null,
      to_address: payload.to_address || '',
      to_lat: payload.to_lat || null,
      to_lng: payload.to_lng || null,
      distance_km: payload.distance_km || 0,
      estimated_cost: payload.estimated_cost || 0,
      status: 'assigned', // assigned | en_route_quarry | reached_quarry | picked_up | en_route_customer | reached_customer | delivered
      payment_status: 'unpaid', // unpaid | partial | paid
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
    trips.push(trip);
    webSet('bf_trips', trips);

    // Update transport request status
    const requests = webGet('bf_transport_requests') || [];
    const rIdx = requests.findIndex(r => r.id === payload.transport_request_id);
    if (rIdx !== -1) { requests[rIdx].status = 'assigned'; requests[rIdx].trip_id = newId; webSet('bf_transport_requests', requests); }

    // Notify driver via BroadcastChannel
    try {
      const bc = new BroadcastChannel('billforge_chat');
      bc.postMessage({ type: 'trip_assigned', tripId: newId, driverId: payload.driver_id });
      bc.close();
    } catch {}

    // Seed trip chat thread
    const chatKey = `bf_trip_chat_${newId}`;
    const initMsg = {
      id: `m_${Date.now()}`,
      sender: 'system',
      senderName: 'BillForge System',
      text: `🚚 Trip assigned!\n\n📦 Material: ${payload.material_name} (${payload.quantity} unit)\n📍 Pickup: ${payload.from_address}\n🏠 Delivery: ${payload.to_address}\n🚗 Driver: ${payload.driver_name} (${payload.vehicle_no})\n💰 Est. Transport Cost: ₹${payload.estimated_cost}`,
      timestamp: new Date().toISOString(),
      status: 'delivered',
    };
    webSet(chatKey, [initMsg]);

    return trip;
  }
  return null;
}

export async function updateTripStatus(db, tripId, newStatus, geo = null) {
  if (IS_WEB) {
    const trips = webGet('bf_trips') || [];
    const idx = trips.findIndex(t => t.id === tripId);
    if (idx === -1) throw new Error('Trip not found');
    trips[idx].status = newStatus;
    if (!trips[idx].timestamps) trips[idx].timestamps = {};
    trips[idx].timestamps[newStatus] = new Date().toISOString();
    if (geo) { trips[idx].driver_lat = geo.lat; trips[idx].driver_lng = geo.lng; }
    webSet('bf_trips', trips);

    // Broadcast status update
    try {
      const bc = new BroadcastChannel('billforge_chat');
      bc.postMessage({ type: 'trip_status_updated', tripId, status: newStatus });
      bc.close();
    } catch {}

    // Add status update message to trip chat
    const statusLabels = {
      en_route_quarry: '🚗 Driver is on the way to quarry...',
      reached_quarry: '✅ Driver has arrived at quarry. Loading in progress...',
      picked_up: '📦 Materials loaded! En route to delivery location...',
      en_route_customer: '🚛 Driver is heading to your delivery site!',
      reached_customer: '📍 Driver has arrived at delivery site!',
      delivered: '✅ DELIVERY COMPLETE! Materials delivered successfully.',
    };
    if (statusLabels[newStatus]) {
      const chatKey = `bf_trip_chat_${tripId}`;
      const msgs = webGet(chatKey) || [];
      msgs.push({ id: `m_${Date.now()}`, sender: 'system', senderName: 'BillForge System', text: statusLabels[newStatus], timestamp: new Date().toISOString(), status: 'delivered' });
      webSet(chatKey, msgs);
    }
    return trips[idx];
  }
  return null;
}

export async function getTripsForDriver(db, driverId) {
  if (IS_WEB) {
    const trips = webGet('bf_trips') || [];
    return trips.filter(t => String(t.driver_id) === String(driverId)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  return [];
}

export async function getTripsForQuarry(db, quarryId) {
  if (IS_WEB) {
    const trips = webGet('bf_trips') || [];
    return trips.filter(t => String(t.quarry_id) === String(quarryId)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  return [];
}

export async function getTripById(db, tripId) {
  if (IS_WEB) {
    const trips = webGet('bf_trips') || [];
    return trips.find(t => t.id === tripId) || null;
  }
  return null;
}

export async function getTripChatMessages(db, tripId) {
  if (IS_WEB) {
    return webGet(`bf_trip_chat_${tripId}`) || [];
  }
  return [];
}

export async function sendTripChatMessage(db, tripId, sender, senderName, text) {
  if (IS_WEB) {
    const chatKey = `bf_trip_chat_${tripId}`;
    const msgs = webGet(chatKey) || [];
    const msg = { id: `m_${Date.now()}`, sender, senderName, text, timestamp: new Date().toISOString(), status: 'sent' };
    msgs.push(msg);
    webSet(chatKey, msgs);
    try {
      const bc = new BroadcastChannel('billforge_chat');
      bc.postMessage({ type: 'trip_chat', tripId, msg });
      bc.close();
    } catch {}
    return msg;
  }
  return null;
}

export async function updateTripPaymentStatus(db, tripId, field, status) {
  if (IS_WEB) {
    const trips = webGet('bf_trips') || [];
    const idx = trips.findIndex(t => t.id === tripId);
    if (idx !== -1) { trips[idx][field] = status; webSet('bf_trips', trips); return trips[idx]; }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EARNINGS DASHBOARDS
// ═══════════════════════════════════════════════════════════════════════════════
export async function getQuarryEarnings(db, quarryId) {
  if (IS_WEB) {
    const bills = webGet(qKey(quarryId, 'bills')) || [];
    const payments = webGet(qKey(quarryId, 'payments')) || [];
    const trips = await getTripsForQuarry(db, quarryId);

    const totalBilled = bills.reduce((s, b) => s + (b.total_amount || 0), 0);
    const totalCollected = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const totalOutstanding = totalBilled - totalCollected;

    const tripRevenue = trips.filter(t => t.status === 'delivered').reduce((s, t) => s + (t.estimated_cost || 0), 0);
    const pendingTrips = trips.filter(t => !['delivered'].includes(t.status)).length;
    const completedTrips = trips.filter(t => t.status === 'delivered').length;

    return { totalBilled, totalCollected, totalOutstanding, tripRevenue, pendingTrips, completedTrips, recentBills: bills.slice(-5).reverse(), recentTrips: trips.slice(0, 5) };
  }
  return { totalBilled: 0, totalCollected: 0, totalOutstanding: 0, tripRevenue: 0, pendingTrips: 0, completedTrips: 0, recentBills: [], recentTrips: [] };
}

export async function getDriverEarnings(db, driverId) {
  if (IS_WEB) {
    const trips = await getTripsForDriver(db, driverId);
    const completed = trips.filter(t => t.status === 'delivered');
    const active = trips.filter(t => !['delivered'].includes(t.status));
    const totalEarned = completed.reduce((s, t) => s + (t.estimated_cost || 0), 0);
    const paid = completed.filter(t => t.payment_status === 'paid').reduce((s, t) => s + (t.estimated_cost || 0), 0);
    const unpaid = totalEarned - paid;
    const totalKm = completed.reduce((s, t) => s + (t.distance_km || 0), 0);
    return { totalEarned, paid, unpaid, completedTrips: completed.length, activeTrips: active.length, totalKm: Math.round(totalKm * 10) / 10, recentTrips: trips.slice(0, 10) };
  }
  return { totalEarned: 0, paid: 0, unpaid: 0, completedTrips: 0, activeTrips: 0, totalKm: 0, recentTrips: [] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATERIAL CATALOG (Quarry Owner CRUD)
// ═══════════════════════════════════════════════════════════════════════════════
export async function getMaterialCatalog(db, quarryId) {
  if (IS_WEB) {
    return webGet(qKey(quarryId, 'materials')) || [];
  }
  return [];
}

export async function saveMaterialListing(db, quarryId, listing) {
  if (IS_WEB) {
    const materials = webGet(qKey(quarryId, 'materials')) || [];
    if (listing.id) {
      const idx = materials.findIndex(m => m.id === listing.id);
      if (idx !== -1) { materials[idx] = { ...materials[idx], ...listing, updated_at: new Date().toISOString() }; }
    } else {
      const newId = materials.reduce((max, m) => m.id > max ? m.id : max, 100) + 1;
      materials.push({ ...listing, id: newId, quarry_id: quarryId, is_active: true, created_at: new Date().toISOString() });
    }
    webSet(qKey(quarryId, 'materials'), materials);
    return materials;
  }
  return [];
}

export async function deleteMaterialListing(db, quarryId, materialId) {
  if (IS_WEB) {
    const materials = webGet(qKey(quarryId, 'materials')) || [];
    webSet(qKey(quarryId, 'materials'), materials.filter(m => m.id !== materialId));
  }
}

export async function toggleMaterialActive(db, quarryId, materialId) {
  if (IS_WEB) {
    const materials = webGet(qKey(quarryId, 'materials')) || [];
    const idx = materials.findIndex(m => m.id === materialId);
    if (idx !== -1) { materials[idx].is_active = !materials[idx].is_active; webSet(qKey(quarryId, 'materials'), materials); }
  }
}


