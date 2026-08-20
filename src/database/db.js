import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { generateDefaultTemplateDocxBase64 } from '../services/templateParser';

const DB_NAME = 'billforge.db';
const IS_WEB = Platform.OS === 'web';

let dbInstance = null;

// === Web LocalStorage Fallback Utilities ===
function webGetItems(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error(`Error reading ${key} from localStorage`, e);
    return null;
  }
}

function webSetItems(key, items) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (e) {
    console.error(`Error writing ${key} to localStorage`, e);
  }
}

function webInitializeSchema() {
  // 1. Company Profile
  let profiles = webGetItems('billforge_company_profiles');
  if (!profiles || profiles.length === 0) {
    profiles = [{
      id: 1,
      name: '',
      address: '',
      location: '',
      phone: '',
      logo_base64: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }];
    webSetItems('billforge_company_profiles', profiles);
  }

  // 2. Materials
  let materials = webGetItems('billforge_materials');
  if (!materials || materials.length === 0) {
    const defaultMaterials = [
      { name: 'River Sand', price_per_unit: 3200, unit_type: 'unit' },
      { name: 'M-Sand', price_per_unit: 2600, unit_type: 'unit' },
      { name: 'P-Sand', price_per_unit: 2900, unit_type: 'unit' },
      { name: 'Blue Metal (20mm)', price_per_unit: 2400, unit_type: 'unit' },
      { name: 'Blue Metal (40mm)', price_per_unit: 2200, unit_type: 'unit' },
      { name: 'Quarry Dust', price_per_unit: 1200, unit_type: 'unit' },
      { name: 'Soil / Gravel', price_per_unit: 1800, unit_type: 'unit' }
    ].map((m, idx) => ({ ...m, id: idx + 1, created_at: new Date().toISOString() }));
    webSetItems('billforge_materials', defaultMaterials);
  }

  // 3. Templates
  let templates = webGetItems('billforge_templates');
  if (!templates || templates.length === 0) {
    const defaultTemplate = {
      id: 1,
      name: 'Standard Billing Template',
      file_uri: '',
      file_base64: generateDefaultTemplateDocxBase64(),
      header_fields_json: JSON.stringify([
        { name: 'BN', type: 'numeric', label: 'Bill Number' },
        { name: 'PartyName', type: 'text', label: 'Customer / Party Name' },
        { name: 'BillDate', type: 'datetime', label: 'Billing Date' },
        { name: 'DeliveryLoc', type: 'text', label: 'Place of Delivery' }
      ]),
      table_fields_json: JSON.stringify([
        { name: 'Sno', type: 'numeric', label: 'S/No' },
        { name: 'DateTime', type: 'datetime', label: 'DATE' },
        { name: 'MaterialType', type: 'text', label: 'Materials Type' },
        { name: 'Trip', type: 'numeric', label: 'Trip' },
        { name: 'Units', type: 'numeric', label: 'Units' },
        { name: 'Cal1s', type: 'numeric', label: 'Each Value ₹', isVirtual: true }
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
        { name: 'Cal1s', type: 'numeric', label: 'Each Value ₹', isVirtual: true }
      ]),
      created_at: new Date().toISOString()
    };
    webSetItems('billforge_templates', [defaultTemplate]);
  } else {
    // Migration: Update default template base64 if empty
    let updated = false;
    const migratedTemplates = templates.map(t => {
      if (t.id === 1 && !t.file_base64) {
        updated = true;
        return { ...t, file_base64: generateDefaultTemplateDocxBase64() };
      }
      return t;
    });
    if (updated) {
      webSetItems('billforge_templates', migratedTemplates);
    }
  }

  // 4. Bills
  let bills = webGetItems('billforge_bills');
  if (!bills) {
    webSetItems('billforge_bills', []);
  }

  // 5. Customers
  let customers = webGetItems('billforge_customers');
  if (!customers) {
    webSetItems('billforge_customers', []);
  }

  // 6. Payments
  let payments = webGetItems('billforge_payments');
  if (!payments) {
    webSetItems('billforge_payments', []);
  }

  // 7. Reminders
  let reminders = webGetItems('billforge_reminders');
  if (!reminders) {
    webSetItems('billforge_reminders', []);
  }

  // 8. Enquiries
  let enquiries = webGetItems('billforge_enquiries');
  if (!enquiries) {
    webSetItems('billforge_enquiries', []);
  }

  // 9. Drivers
  let drivers = webGetItems('billforge_drivers');
  if (!drivers) {
    webSetItems('billforge_drivers', [
      { id: 1, name: 'Ramesh (Driver)', phone: '9876543210', vehicleNo: 'TN 38 AB 1234', status: 'Available', lat: 11.0168, lng: 76.9558, updatedAt: new Date().toISOString() }
    ]);
  }

  // 10. Consignments
  let consignments = webGetItems('billforge_consignments');
  if (!consignments) {
    webSetItems('billforge_consignments', []);
  }
}

// === SQLite initialization ===
export async function getDatabase() {
  if (IS_WEB) {
    webInitializeSchema();
    return { isWeb: true };
  }
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
  await dbInstance.execAsync('PRAGMA journal_mode = WAL;');
  await initializeSchema(dbInstance);
  return dbInstance;
}

async function initializeSchema(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS company_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '',
      address TEXT DEFAULT '',
      location TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      logo_base64 TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      file_uri TEXT,
      file_base64 TEXT,
      header_fields_json TEXT DEFAULT '[]',
      table_fields_json TEXT DEFAULT '[]',
      all_fields_json TEXT DEFAULT '[]',
      theme_color TEXT DEFAULT '#0F2050',
      font_family TEXT DEFAULT 'Arial',
      border_style TEXT DEFAULT 'single',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER,
      company_id INTEGER,
      bill_number TEXT,
      customer_name TEXT DEFAULT '',
      header_data_json TEXT DEFAULT '{}',
      row_data_json TEXT DEFAULT '[]',
      total_amount REAL DEFAULT 0,
      pdf_uri TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
      FOREIGN KEY (company_id) REFERENCES company_profiles(id)
    );

    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price_per_unit REAL NOT NULL,
      unit_type TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER,
      customer_name TEXT DEFAULT '',
      amount REAL DEFAULT 0,
      note TEXT DEFAULT '',
      paid_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER,
      customer_name TEXT DEFAULT '',
      customer_phone TEXT DEFAULT '',
      promised_amount REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      promised_date TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      paid_amount REAL DEFAULT 0,
      note TEXT DEFAULT '',
      notification_id TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS enquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT DEFAULT '',
      material_name TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit_type TEXT DEFAULT 'ton',
      quoted_rate REAL DEFAULT 0,
      agreed_rate REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      pickup_address TEXT DEFAULT '',
      pickup_lat REAL DEFAULT 10.9601,
      pickup_lng REAL DEFAULT 78.0766,
      customer_address TEXT DEFAULT '',
      customer_lat REAL DEFAULT 11.0168,
      customer_lng REAL DEFAULT 76.9558,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      vehicle_no TEXT DEFAULT '',
      password TEXT DEFAULT 'driver123',
      status TEXT DEFAULT 'Available',
      lat REAL DEFAULT 11.0168,
      lng REAL DEFAULT 76.9558,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS consignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      enquiry_id INTEGER,
      driver_id INTEGER,
      driver_name TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      material_name TEXT,
      quantity REAL,
      unit_type TEXT,
      agreed_rate REAL,
      pickup_address TEXT,
      pickup_lat REAL,
      pickup_lng REAL,
      customer_address TEXT,
      customer_lat REAL,
      customer_lng REAL,
      status TEXT DEFAULT 'assigned',
      driver_lat REAL,
      driver_lng REAL,
      last_updated TEXT DEFAULT (datetime('now'))
    );
  `);

  // Ensure at least one company profile exists
  const profile = await db.getFirstAsync('SELECT id FROM company_profiles LIMIT 1');
  if (!profile) {
    await db.runAsync(
      'INSERT INTO company_profiles (name, address, location, phone) VALUES (?, ?, ?, ?)',
      ['', '', '', '']
    );
  }

  // Pre-populate professional construction materials if empty
  const materialCount = await db.getFirstAsync('SELECT COUNT(*) as count FROM materials');
  if (materialCount?.count === 0) {
    const defaultMaterials = [
      ['River Sand', 3200, 'unit'],
      ['M-Sand', 2600, 'unit'],
      ['P-Sand', 2900, 'unit'],
      ['Blue Metal (20mm)', 2400, 'unit'],
      ['Blue Metal (40mm)', 2200, 'unit'],
      ['Quarry Dust', 1200, 'unit'],
      ['Soil / Gravel', 1800, 'unit']
    ];
    for (const [name, price, unit] of defaultMaterials) {
      await db.runAsync(
        'INSERT INTO materials (name, price_per_unit, unit_type) VALUES (?, ?, ?)',
        [name, price, unit]
      );
    }
  }

  // Ensure at least one template exists
  const templateCount = await db.getFirstAsync('SELECT COUNT(*) as count FROM templates');
  const defaultTemplateBase64 = generateDefaultTemplateDocxBase64();
  if (templateCount?.count === 0) {
    await db.runAsync(
      `INSERT INTO templates (name, file_uri, file_base64, header_fields_json, table_fields_json, all_fields_json) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'Standard Billing Template',
        '',
        defaultTemplateBase64,
        JSON.stringify([
          { name: 'BN', type: 'numeric', label: 'Bill Number' },
          { name: 'PartyName', type: 'text', label: 'Customer / Party Name' },
          { name: 'BillDate', type: 'datetime', label: 'Billing Date' },
          { name: 'DeliveryLoc', type: 'text', label: 'Place of Delivery' }
        ]),
        JSON.stringify([
          { name: 'Sno', type: 'numeric', label: 'S/No' },
          { name: 'DateTime', type: 'datetime', label: 'DATE' },
          { name: 'MaterialType', type: 'text', label: 'Materials Type' },
          { name: 'Trip', type: 'numeric', label: 'Trip' },
          { name: 'Units', type: 'numeric', label: 'Units' },
          { name: 'Cal1s', type: 'numeric', label: 'Each Value ₹', isVirtual: true }
        ]),
        JSON.stringify([
          { name: 'BN', type: 'numeric', label: 'Bill Number' },
          { name: 'PartyName', type: 'text', label: 'Customer / Party Name' },
          { name: 'BillDate', type: 'datetime', label: 'Billing Date' },
          { name: 'DeliveryLoc', type: 'text', label: 'Place of Delivery' },
          { name: 'Sno', type: 'numeric', label: 'S/No' },
          { name: 'DateTime', type: 'datetime', label: 'DATE' },
          { name: 'MaterialType', type: 'text', label: 'Materials Type' },
          { name: 'Trip', type: 'numeric', label: 'Trip' },
          { name: 'Units', type: 'numeric', label: 'Units' },
          { name: 'Cal1s', type: 'numeric', label: 'Each Value ₹', isVirtual: true }
        ])
      ]
    );
  } else {
    // Migration: Update default template's file_base64 if empty
    const defaultTemplate = await db.getFirstAsync('SELECT file_base64 FROM templates WHERE id = 1');
    if (defaultTemplate && !defaultTemplate.file_base64) {
      await db.runAsync(
        'UPDATE templates SET file_base64 = ? WHERE id = 1',
        [defaultTemplateBase64]
      );
    }
  }

  // Safe migrations for existing SQLite databases
  try {
    await db.execAsync('ALTER TABLE templates ADD COLUMN theme_color TEXT DEFAULT "#0F2050";');
  } catch (e) {}
  try {
    await db.execAsync('ALTER TABLE templates ADD COLUMN font_family TEXT DEFAULT "Arial";');
  } catch (e) {}
  try {
    await db.execAsync('ALTER TABLE templates ADD COLUMN border_style TEXT DEFAULT "single";');
  } catch (e) {}
}

/**
 * Get the next sequential bill number for a company.
 */
export async function getNextBillNumber(db, companyId = 1) {
  if (IS_WEB) {
    const bills = webGetItems('billforge_bills') || [];
    const count = bills.filter(b => !companyId || b.company_id === parseInt(companyId)).length;
    return (count + 1).toString().padStart(4, '0');
  }
  const result = await db.getFirstAsync('SELECT COUNT(*) as count FROM bills WHERE company_id = ?', [companyId || 1]);
  const count = result?.count || 0;
  return (count + 1).toString().padStart(4, '0');
}

// === Materials ===
export async function getMaterials(db, companyId) {
  if (IS_WEB) {
    const list = webGetItems('billforge_materials') || [];
    if (companyId) {
      const companyMaterials = list.filter(m => !m.company_id || m.company_id === parseInt(companyId));
      return companyMaterials.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return await db.getAllAsync('SELECT * FROM materials ORDER BY name ASC');
}

export async function saveMaterial(db, material) {
  if (IS_WEB) {
    const list = webGetItems('billforge_materials') || [];
    if (material.id) {
      const idx = list.findIndex(m => m.id === parseInt(material.id));
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          name: material.name,
          price_per_unit: parseFloat(material.price_per_unit),
          unit_type: material.unit_type || ''
        };
      }
      webSetItems('billforge_materials', list);
      return material.id;
    } else {
      const nextId = list.reduce((max, m) => m.id > max ? m.id : max, 0) + 1;
      const newMaterial = {
        id: nextId,
        name: material.name,
        price_per_unit: parseFloat(material.price_per_unit),
        unit_type: material.unit_type || '',
        created_at: new Date().toISOString()
      };
      list.push(newMaterial);
      webSetItems('billforge_materials', list);
      return nextId;
    }
  }

  if (material.id) {
    await db.runAsync(
      'UPDATE materials SET name = ?, price_per_unit = ?, unit_type = ? WHERE id = ?',
      [material.name, material.price_per_unit, material.unit_type || '', material.id]
    );
    return material.id;
  } else {
    const result = await db.runAsync(
      'INSERT INTO materials (name, price_per_unit, unit_type) VALUES (?, ?, ?)',
      [material.name, material.price_per_unit, material.unit_type || '']
    );
    return result.lastInsertRowId;
  }
}

export async function deleteMaterial(db, id) {
  if (IS_WEB) {
    const list = webGetItems('billforge_materials') || [];
    const updated = list.filter(m => m.id !== parseInt(id));
    webSetItems('billforge_materials', updated);
    return;
  }
  await db.runAsync('DELETE FROM materials WHERE id = ?', [id]);
}

// === Company Profile & Registration ===
export async function getCompanyProfile(db, companyId) {
  if (IS_WEB) {
    const list = webGetItems('billforge_company_profiles') || [];
    if (companyId) {
      return list.find(p => p.id === parseInt(companyId)) || list[0] || null;
    }
    return list[0] || null;
  }
  if (companyId) {
    return await db.getFirstAsync('SELECT * FROM company_profiles WHERE id = ?', [companyId]);
  }
  return await db.getFirstAsync('SELECT * FROM company_profiles ORDER BY id LIMIT 1');
}

export async function registerCompanyOwner(db, details) {
  const { name, ownerName, phone, password, address, location, materials = [], drivers = [] } = details;
  
  if (IS_WEB) {
    let profiles = webGetItems('billforge_company_profiles') || [];
    const nextId = profiles.reduce((max, p) => p.id > max ? p.id : max, 0) + 1;
    
    const newProfile = {
      id: nextId,
      name: name || 'Sri Murugan Quarry',
      owner_name: ownerName || 'Owner',
      phone: phone || '',
      password: password || '',
      address: address || '',
      location: location || '',
      logo_base64: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    profiles.push(newProfile);
    webSetItems('billforge_company_profiles', profiles);
    
    // Save initial materials if provided
    if (materials && materials.length > 0) {
      let existingMat = webGetItems('billforge_materials') || [];
      materials.forEach(m => {
        const matId = existingMat.reduce((max, item) => item.id > max ? item.id : max, 0) + 1;
        existingMat.push({
          id: matId,
          company_id: nextId,
          name: m.name,
          price_per_unit: parseFloat(m.price_per_unit) || 0,
          unit_type: m.unit_type || 'unit',
          created_at: new Date().toISOString()
        });
      });
      webSetItems('billforge_materials', existingMat);
    }

    // Save initial drivers if provided
    if (drivers && drivers.length > 0) {
      let existingDrivers = webGetItems('billforge_drivers') || [];
      drivers.forEach(d => {
        const dId = existingDrivers.reduce((max, item) => item.id > max ? item.id : max, 0) + 1;
        existingDrivers.push({
          id: dId,
          company_id: nextId,
          name: d.name,
          phone: d.phone,
          vehicle_no: d.vehicle_no || '',
          password: d.password || 'driver123',
          status: 'Available',
          lat: 11.0168,
          lng: 76.9558,
          updated_at: new Date().toISOString()
        });
      });
      webSetItems('billforge_drivers', existingDrivers);
    }

    return newProfile;
  }
  
  const result = await db.runAsync(
    'INSERT INTO company_profiles (name, address, location, phone) VALUES (?, ?, ?, ?)',
    [name || '', address || '', location || '', phone || '']
  );
  return { id: result.lastInsertRowId, name, phone, address, location };
}

export async function authenticateOwner(db, phone, password) {
  const normPhone = (phone || '').trim();
  const normPass = (password || '').trim();
  
  if (IS_WEB) {
    const profiles = webGetItems('billforge_company_profiles') || [];
    // Demo fallback credentials
    if (normPhone === '9999999999' && normPass === 'admin123') {
      let demo = profiles.find(p => p.phone === '9999999999') || profiles[0];
      if (!demo) {
        demo = { id: 1, name: 'Sri Murugan Quarry', phone: '9999999999', address: 'Main Quarry Road', location: 'Tiruppur' };
      }
      return demo;
    }
    
    const matched = profiles.find(p => (p.phone === normPhone || p.phone === `+91${normPhone}`) && (!p.password || p.password === normPass));
    return matched || null;
  }

  if (normPhone === '9999999999' && normPass === 'admin123') {
    return { id: 1, name: 'Sri Murugan Quarry', phone: '9999999999' };
  }

  return await db.getFirstAsync('SELECT * FROM company_profiles WHERE phone = ?', [normPhone]);
}

export async function saveCompanyProfile(db, profile) {
  if (IS_WEB) {
    const list = webGetItems('billforge_company_profiles') || [];
    const targetId = profile.id ? parseInt(profile.id) : 1;
    const existingIdx = list.findIndex(p => p.id === targetId);
    
    if (existingIdx !== -1) {
      list[existingIdx] = {
        ...list[existingIdx],
        name: profile.name || '',
        address: profile.address || '',
        location: profile.location || '',
        phone: profile.phone || '',
        logo_base64: profile.logo_base64 || '',
        updated_at: new Date().toISOString()
      };
      webSetItems('billforge_company_profiles', list);
      return targetId;
    } else {
      const newProfile = {
        id: targetId,
        name: profile.name || '',
        address: profile.address || '',
        location: profile.location || '',
        phone: profile.phone || '',
        logo_base64: profile.logo_base64 || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      list.push(newProfile);
      webSetItems('billforge_company_profiles', list);
      return targetId;
    }
  }

  const existing = await getCompanyProfile(db, profile.id);
  if (existing) {
    await db.runAsync(
      `UPDATE company_profiles SET name = ?, address = ?, location = ?, phone = ?, logo_base64 = ?, updated_at = datetime('now') WHERE id = ?`,
      [profile.name || '', profile.address || '', profile.location || '', profile.phone || '', profile.logo_base64 || '', existing.id]
    );
    return existing.id;
  } else {
    const result = await db.runAsync(
      'INSERT INTO company_profiles (name, address, location, phone, logo_base64) VALUES (?, ?, ?, ?, ?)',
      [profile.name || '', profile.address || '', profile.location || '', profile.phone || '', profile.logo_base64 || '']
    );
    return result.lastInsertRowId;
  }
}

// === Templates ===
export async function getTemplates(db) {
  if (IS_WEB) {
    const list = webGetItems('billforge_templates') || [];
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  return await db.getAllAsync('SELECT * FROM templates ORDER BY created_at DESC');
}

export async function getTemplateById(db, id) {
  if (IS_WEB) {
    const list = webGetItems('billforge_templates') || [];
    return list.find(t => t.id === parseInt(id)) || null;
  }
  return await db.getFirstAsync('SELECT * FROM templates WHERE id = ?', [id]);
}

export async function saveTemplate(db, template) {
  if (IS_WEB) {
    const list = webGetItems('billforge_templates') || [];
    const nextId = list.reduce((max, t) => t.id > max ? t.id : max, 0) + 1;
    const newTemplate = {
      id: nextId,
      name: template.name,
      file_uri: template.file_uri || '',
      file_base64: template.file_base64 || '',
      header_fields_json: JSON.stringify(template.headerFields || []),
      table_fields_json: JSON.stringify(template.tableFields || []),
      all_fields_json: JSON.stringify(template.allFields || []),
      created_at: new Date().toISOString()
    };
    list.push(newTemplate);
    webSetItems('billforge_templates', list);
    return nextId;
  }

  const result = await db.runAsync(
    'INSERT INTO templates (name, file_uri, file_base64, header_fields_json, table_fields_json, all_fields_json) VALUES (?, ?, ?, ?, ?, ?)',
    [
      template.name,
      template.file_uri || '',
      template.file_base64 || '',
      JSON.stringify(template.headerFields || []),
      JSON.stringify(template.tableFields || []),
      JSON.stringify(template.allFields || []),
    ]
  );
  return result.lastInsertRowId;
}

export async function deleteTemplate(db, id) {
  if (IS_WEB) {
    const list = webGetItems('billforge_templates') || [];
    const updated = list.filter(t => t.id !== parseInt(id));
    webSetItems('billforge_templates', updated);
    return;
  }
  await db.runAsync('DELETE FROM templates WHERE id = ?', [id]);
}

// === Bills ===
export async function getBills(db, companyId) {
  if (IS_WEB) {
    let bills = webGetItems('billforge_bills') || [];
    if (companyId) {
      bills = bills.filter(b => !b.company_id || b.company_id === parseInt(companyId));
    }
    const templates = webGetItems('billforge_templates') || [];
    const joined = bills.map(b => {
      const t = templates.find(temp => temp.id === b.template_id);
      return {
        ...b,
        template_name: t ? t.name : 'Custom'
      };
    });
    return joined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  if (companyId) {
    return await db.getAllAsync(`
      SELECT b.*, t.name as template_name 
      FROM bills b 
      LEFT JOIN templates t ON b.template_id = t.id 
      WHERE b.company_id = ?
      ORDER BY b.created_at DESC
    `, [companyId]);
  }

  return await db.getAllAsync(`
    SELECT b.*, t.name as template_name 
    FROM bills b 
    LEFT JOIN templates t ON b.template_id = t.id 
    ORDER BY b.created_at DESC
  `);
}

export async function getBillById(db, id) {
  if (IS_WEB) {
    const bills = webGetItems('billforge_bills') || [];
    const templates = webGetItems('billforge_templates') || [];
    const b = bills.find(bill => bill.id === parseInt(id));
    if (!b) return null;
    const t = templates.find(temp => temp.id === b.template_id);
    return {
      ...b,
      template_name: t ? t.name : 'Custom'
    };
  }

  return await db.getFirstAsync(`
    SELECT b.*, t.name as template_name 
    FROM bills b 
    LEFT JOIN templates t ON b.template_id = t.id 
    WHERE b.id = ?
  `, [id]);
}

export async function saveBill(db, bill) {
  if (IS_WEB) {
    const list = webGetItems('billforge_bills') || [];
    if (bill.id) {
      const idx = list.findIndex(b => b.id === parseInt(bill.id));
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          template_id: parseInt(bill.template_id),
          company_id: bill.company_id || 1,
          bill_number: bill.bill_number || '',
          customer_name: bill.customer_name || '',
          header_data_json: JSON.stringify(bill.headerData || {}),
          row_data_json: JSON.stringify(bill.rowData || []),
          total_amount: bill.total_amount || 0,
          pdf_uri: bill.pdf_uri || '',
          updated_at: new Date().toISOString()
        };
        webSetItems('billforge_bills', list);
        return bill.id;
      }
    }
    const nextId = list.reduce((max, b) => b.id > max ? b.id : max, 0) + 1;
    const newBill = {
      id: nextId,
      template_id: parseInt(bill.template_id),
      company_id: bill.company_id || 1,
      bill_number: bill.bill_number || '',
      customer_name: bill.customer_name || '',
      header_data_json: JSON.stringify(bill.headerData || {}),
      row_data_json: JSON.stringify(bill.rowData || []),
      total_amount: bill.total_amount || 0,
      pdf_uri: bill.pdf_uri || '',
      created_at: new Date().toISOString()
    };
    list.push(newBill);
    webSetItems('billforge_bills', list);
    return nextId;
  }

  if (bill.id) {
    await db.runAsync(
      `UPDATE bills SET template_id = ?, company_id = ?, bill_number = ?, customer_name = ?, header_data_json = ?, row_data_json = ?, total_amount = ?, pdf_uri = ? WHERE id = ?`,
      [
        bill.template_id,
        bill.company_id || 1,
        bill.bill_number || '',
        bill.customer_name || '',
        JSON.stringify(bill.headerData || {}),
        JSON.stringify(bill.rowData || []),
        bill.total_amount || 0,
        bill.pdf_uri || '',
        bill.id,
      ]
    );
    return bill.id;
  }

  const result = await db.runAsync(
    `INSERT INTO bills (template_id, company_id, bill_number, customer_name, header_data_json, row_data_json, total_amount, pdf_uri) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      bill.template_id,
      bill.company_id || 1,
      bill.bill_number || '',
      bill.customer_name || '',
      JSON.stringify(bill.headerData || {}),
      JSON.stringify(bill.rowData || []),
      bill.total_amount || 0,
      bill.pdf_uri || '',
    ]
  );
  return result.lastInsertRowId;
}

export async function updateBillPdfUri(db, billId, pdfUri) {
  if (IS_WEB) {
    const list = webGetItems('billforge_bills') || [];
    const idx = list.findIndex(b => b.id === parseInt(billId));
    if (idx !== -1) {
      list[idx].pdf_uri = pdfUri;
      webSetItems('billforge_bills', list);
    }
    return;
  }
  await db.runAsync('UPDATE bills SET pdf_uri = ? WHERE id = ?', [pdfUri, billId]);
}

// === Unfinished Draft Management (Resume Left Over Work) ===
export async function saveDraft(templateId, draftData, companyId = 1) {
  try {
    const key = `billforge_draft_${companyId}_${templateId}`;
    webSetItems(key, { ...draftData, companyId, updated_at: new Date().toISOString() });
  } catch (e) {
    console.error('Error saving draft:', e);
  }
}

export async function getDraft(templateId, companyId = 1) {
  try {
    const key = `billforge_draft_${companyId}_${templateId}`;
    return webGetItems(key);
  } catch (e) {
    console.error('Error getting draft:', e);
    return null;
  }
}

export async function clearDraft(templateId, companyId = 1) {
  try {
    const key = `billforge_draft_${companyId}_${templateId}`;
    webSetItems(key, null);
  } catch (e) {
    console.error('Error clearing draft:', e);
  }
}

export async function getAllDrafts(companyId = 1) {
  try {
    const drafts = [];
    const prefix = `billforge_draft_${companyId}_`;
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          const templateId = k.replace(prefix, '');
          const d = webGetItems(k);
          if (d && d.headerData) {
            drafts.push({ templateId, ...d });
          }
        }
      }
    }
    return drafts;
  } catch (e) {
    return [];
  }
}

export async function deleteBill(db, id) {
  if (IS_WEB) {
    const list = webGetItems('billforge_bills') || [];
    const updated = list.filter(b => b.id !== parseInt(id));
    webSetItems('billforge_bills', updated);
    return;
  }
  await db.runAsync('DELETE FROM bills WHERE id = ?', [id]);
}

export async function getBillCount(db) {
  if (IS_WEB) {
    const list = webGetItems('billforge_bills') || [];
    return list.length;
  }
  const result = await db.getFirstAsync('SELECT COUNT(*) as count FROM bills');
  return result?.count || 0;
}

export async function getBillsThisMonth(db) {
  if (IS_WEB) {
    const list = webGetItems('billforge_bills') || [];
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthBills = list.filter(b => new Date(b.created_at) >= startOfMonth);
    const total = thisMonthBills.reduce((sum, b) => sum + (b.total_amount || 0), 0);
    return { count: thisMonthBills.length, total };
  }

  const result = await db.getFirstAsync(
    `SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total 
     FROM bills 
     WHERE created_at >= date('now', 'start of month')`
  );
  return { count: result?.count || 0, total: result?.total || 0 };
}

// === Customers ===
export async function getCustomers(db) {
  if (IS_WEB) {
    const list = webGetItems('billforge_customers') || [];
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return await db.getAllAsync('SELECT * FROM customers ORDER BY name ASC');
}

export async function getCustomersWithSummary(db) {
  const customers = await getCustomers(db);
  const bills = await getBills(db);

  return customers.map(c => {
    const normCustomer = (c.name || '').toLowerCase().replace(/[\s_-]/g, '');
    const customerBills = bills.filter(b => {
      const bCustomer = (b.customer_name || '').toLowerCase().replace(/[\s_-]/g, '');
      return bCustomer === normCustomer && bCustomer.length > 0;
    });

    const totalBilled = customerBills.reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const billCount = customerBills.length;
    const lastBill = customerBills.length > 0 ? customerBills[0] : null;

    let unclearedBalance = 0;
    if (lastBill) {
      try {
        const header = JSON.parse(lastBill.header_data_json || '{}');
        unclearedBalance = parseFloat(header.Balance || header.UnclearedBalance || '0') || 0;
      } catch (e) {}
    }

    return {
      ...c,
      billCount,
      totalBilled,
      unclearedBalance,
      lastBillDate: lastBill ? lastBill.created_at : null,
      bills: customerBills,
    };
  });
}

export async function saveCustomer(db, customer) {
  if (IS_WEB) {
    const list = webGetItems('billforge_customers') || [];
    if (customer.id) {
      const idx = list.findIndex(c => c.id === parseInt(customer.id));
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          name: customer.name,
          phone: customer.phone || '',
          address: customer.address || '',
        };
      }
      webSetItems('billforge_customers', list);
      return customer.id;
    } else {
      const nextId = list.reduce((max, c) => c.id > max ? c.id : max, 0) + 1;
      const newCustomer = {
        id: nextId,
        name: customer.name,
        phone: customer.phone || '',
        address: customer.address || '',
        created_at: new Date().toISOString()
      };
      list.push(newCustomer);
      webSetItems('billforge_customers', list);
      return nextId;
    }
  }

  if (customer.id) {
    await db.runAsync(
      'UPDATE customers SET name = ?, phone = ?, address = ? WHERE id = ?',
      [customer.name, customer.phone || '', customer.address || '', customer.id]
    );
    return customer.id;
  } else {
    const result = await db.runAsync(
      'INSERT INTO customers (name, phone, address) VALUES (?, ?, ?)',
      [customer.name, customer.phone || '', customer.address || '']
    );
    return result.lastInsertRowId;
  }
}

export async function deleteCustomer(db, id) {
  if (IS_WEB) {
    const list = webGetItems('billforge_customers') || [];
    const updated = list.filter(c => c.id !== parseInt(id));
    webSetItems('billforge_customers', updated);
    return;
  }
  await db.runAsync('DELETE FROM customers WHERE id = ?', [id]);
}

// === Payments ===
export async function savePayment(db, payment) {
  if (IS_WEB) {
    const list = webGetItems('billforge_payments') || [];
    const nextId = list.reduce((max, p) => p.id > max ? p.id : max, 0) + 1;
    const newPayment = {
      id: nextId,
      bill_id: payment.bill_id,
      customer_name: payment.customer_name || '',
      amount: parseFloat(payment.amount) || 0,
      note: payment.note || '',
      paid_at: new Date().toISOString(),
    };
    list.push(newPayment);
    webSetItems('billforge_payments', list);
    return nextId;
  }
  const result = await db.runAsync(
    'INSERT INTO payments (bill_id, customer_name, amount, note, paid_at) VALUES (?, ?, ?, ?, datetime("now"))',
    [payment.bill_id, payment.customer_name || '', parseFloat(payment.amount) || 0, payment.note || '']
  );
  return result.lastInsertRowId;
}

export async function getPaymentsForBill(db, billId) {
  if (IS_WEB) {
    const list = webGetItems('billforge_payments') || [];
    return list.filter(p => p.bill_id === parseInt(billId))
               .sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at));
  }
  return await db.getAllAsync(
    'SELECT * FROM payments WHERE bill_id = ? ORDER BY paid_at DESC', [billId]
  );
}

export async function deletePayment(db, id) {
  if (IS_WEB) {
    const list = webGetItems('billforge_payments') || [];
    webSetItems('billforge_payments', list.filter(p => p.id !== parseInt(id)));
    return;
  }
  await db.runAsync('DELETE FROM payments WHERE id = ?', [id]);
}

export async function getAllPayments(db) {
  if (IS_WEB) {
    return webGetItems('billforge_payments') || [];
  }
  return await db.getAllAsync('SELECT * FROM payments ORDER BY paid_at DESC');
}

// === Ledger Queries ===
// Customer Ledger: per customer — total billed, total paid, balance, bill list
export async function getCustomerLedger(db) {
  const bills = await getBills(db);
  const payments = await getAllPayments(db);

  // Group bills by normalized customer name
  const customerMap = {};
  for (const bill of bills) {
    const name = (bill.customer_name || 'Unknown').trim();
    const key = name.toLowerCase().replace(/[\s_-]/g, '');
    if (!customerMap[key]) {
      customerMap[key] = { customerName: name, bills: [], totalBilled: 0, totalPaid: 0 };
    }
    const billPayments = payments.filter(p => p.bill_id === bill.id);
    const paidForBill = billPayments.reduce((s, p) => s + (p.amount || 0), 0);
    customerMap[key].bills.push({ ...bill, paidAmount: paidForBill, balanceDue: (bill.total_amount || 0) - paidForBill });
    customerMap[key].totalBilled += bill.total_amount || 0;
    customerMap[key].totalPaid += paidForBill;
  }

  return Object.values(customerMap)
    .map(c => ({ ...c, balanceDue: c.totalBilled - c.totalPaid }))
    .sort((a, b) => b.balanceDue - a.balanceDue);
}

// Material Ledger: per material — total trips, units, revenue
export async function getMaterialLedger(db) {
  const bills = await getBills(db);
  const materialMap = {};

  for (const bill of bills) {
    let rowData = [];
    try { rowData = JSON.parse(bill.row_data_json || '[]'); } catch (e) {}

    for (const row of rowData) {
      // Find material name in row
      const materialName = Object.entries(row).find(([k]) => {
        const n = k.toLowerCase().replace(/[\s_-]/g, '');
        return n === 'materialtype' || n === 'materialstype' || n === 'material' || n === 'materials';
      })?.[1];

      if (!materialName || !String(materialName).trim()) continue;
      const key = String(materialName).trim();

      // Find numeric values
      const findVal = (keys) => {
        const entry = Object.entries(row).find(([k]) => {
          const n = k.toLowerCase().replace(/[\s_-]/g, '');
          return keys.some(kk => n.includes(kk));
        });
        return parseFloat(entry?.[1] || '0') || 0;
      };

      const units = findVal(['unit', 'units', 'qty', 'quantity']);
      const trips = findVal(['trip', 'trips']);
      const amount = findVal(['eachvalue', 'cal', 'total', 'amount']);
      const price = findVal(['price', 'cost', 'rate']);

      if (!materialMap[key]) {
        materialMap[key] = { materialName: key, totalTrips: 0, totalUnits: 0, totalRevenue: 0, billCount: 0, prices: [] };
      }
      materialMap[key].totalTrips += trips;
      materialMap[key].totalUnits += units;
      materialMap[key].totalRevenue += amount;
      materialMap[key].billCount += 1;
      if (price > 0) materialMap[key].prices.push(price);
    }
  }

  return Object.values(materialMap)
    .map(m => ({
      ...m,
      avgPrice: m.prices.length > 0
        ? m.prices.reduce((s, p) => s + p, 0) / m.prices.length
        : 0
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

// === Reminders ===
export async function saveReminder(db, reminder) {
  if (IS_WEB) {
    const list = webGetItems('billforge_reminders') || [];
    if (reminder.id) {
      const idx = list.findIndex(r => r.id === parseInt(reminder.id));
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...reminder };
        webSetItems('billforge_reminders', list);
        return reminder.id;
      }
    }
    const nextId = list.reduce((max, r) => r.id > max ? r.id : max, 0) + 1;
    const newR = {
      id: nextId,
      bill_id: reminder.bill_id || null,
      customer_name: reminder.customer_name || '',
      customer_phone: reminder.customer_phone || '',
      promised_amount: parseFloat(reminder.promised_amount) || 0,
      discount_amount: parseFloat(reminder.discount_amount) || 0,
      promised_date: reminder.promised_date,
      status: reminder.status || 'pending',
      paid_amount: parseFloat(reminder.paid_amount) || 0,
      note: reminder.note || '',
      notification_id: reminder.notification_id || '',
      created_at: new Date().toISOString(),
    };
    list.push(newR);
    webSetItems('billforge_reminders', list);
    return nextId;
  }

  if (reminder.id) {
    await db.runAsync(
      `UPDATE reminders SET bill_id=?, customer_name=?, customer_phone=?, promised_amount=?,
       discount_amount=?, promised_date=?, status=?, paid_amount=?, note=?, notification_id=? WHERE id=?`,
      [
        reminder.bill_id || null,
        reminder.customer_name || '',
        reminder.customer_phone || '',
        parseFloat(reminder.promised_amount) || 0,
        parseFloat(reminder.discount_amount) || 0,
        reminder.promised_date,
        reminder.status || 'pending',
        parseFloat(reminder.paid_amount) || 0,
        reminder.note || '',
        reminder.notification_id || '',
        reminder.id,
      ]
    );
    return reminder.id;
  }

  const result = await db.runAsync(
    `INSERT INTO reminders (bill_id, customer_name, customer_phone, promised_amount,
     discount_amount, promised_date, status, paid_amount, note, notification_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      reminder.bill_id || null,
      reminder.customer_name || '',
      reminder.customer_phone || '',
      parseFloat(reminder.promised_amount) || 0,
      parseFloat(reminder.discount_amount) || 0,
      reminder.promised_date,
      reminder.status || 'pending',
      parseFloat(reminder.paid_amount) || 0,
      reminder.note || '',
      reminder.notification_id || '',
    ]
  );
  return result.lastInsertRowId;
}

export async function getReminders(db) {
  if (IS_WEB) {
    const list = webGetItems('billforge_reminders') || [];
    return list.sort((a, b) => new Date(a.promised_date) - new Date(b.promised_date));
  }
  return await db.getAllAsync('SELECT * FROM reminders ORDER BY promised_date ASC');
}

export async function getActiveReminders(db) {
  const all = await getReminders(db);
  return all.filter(r => r.status === 'pending');
}

export async function getOverdueReminders(db) {
  const now = new Date().toISOString();
  const all = await getReminders(db);
  return all.filter(r => r.status === 'pending' && r.promised_date < now);
}

export async function deleteReminder(db, id) {
  if (IS_WEB) {
    const list = webGetItems('billforge_reminders') || [];
    webSetItems('billforge_reminders', list.filter(r => r.id !== parseInt(id)));
    return;
  }
  await db.runAsync('DELETE FROM reminders WHERE id = ?', [id]);
}

// === Enquiries ===
export async function getEnquiries(db) {
  if (IS_WEB) {
    return webGetItems('billforge_enquiries') || [];
  }
  return await db.getAllAsync('SELECT * FROM enquiries ORDER BY id DESC');
}

export async function saveEnquiry(db, enquiry) {
  if (IS_WEB) {
    const list = webGetItems('billforge_enquiries') || [];
    if (enquiry.id) {
      const idx = list.findIndex(e => e.id === parseInt(enquiry.id));
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...enquiry };
        webSetItems('billforge_enquiries', list);
        return enquiry.id;
      }
    }
    const nextId = list.reduce((max, e) => e.id > max ? e.id : max, 0) + 1;
    const newE = {
      id: nextId,
      customer_name: enquiry.customer_name || '',
      customer_phone: enquiry.customer_phone || '',
      material_name: enquiry.material_name || '',
      quantity: parseFloat(enquiry.quantity) || 1,
      unit_type: enquiry.unit_type || 'ton',
      quoted_rate: parseFloat(enquiry.quoted_rate) || 0,
      agreed_rate: parseFloat(enquiry.agreed_rate || enquiry.quoted_rate) || 0,
      status: enquiry.status || 'pending',
      pickup_address: enquiry.pickup_address || 'Quarry Location',
      pickup_lat: parseFloat(enquiry.pickup_lat) || 10.9601,
      pickup_lng: parseFloat(enquiry.pickup_lng) || 78.0766,
      customer_address: enquiry.customer_address || 'Customer Delivery Site',
      customer_lat: parseFloat(enquiry.customer_lat) || 11.0168,
      customer_lng: parseFloat(enquiry.customer_lng) || 76.9558,
      created_at: new Date().toISOString(),
    };
    list.unshift(newE);
    webSetItems('billforge_enquiries', list);
    return nextId;
  }

  if (enquiry.id) {
    await db.runAsync(
      `UPDATE enquiries SET customer_name=?, customer_phone=?, material_name=?, quantity=?, unit_type=?,
       quoted_rate=?, agreed_rate=?, status=?, pickup_address=?, pickup_lat=?, pickup_lng=?,
       customer_address=?, customer_lat=?, customer_lng=? WHERE id=?`,
      [
        enquiry.customer_name, enquiry.customer_phone, enquiry.material_name, enquiry.quantity, enquiry.unit_type,
        enquiry.quoted_rate, enquiry.agreed_rate, enquiry.status, enquiry.pickup_address, enquiry.pickup_lat, enquiry.pickup_lng,
        enquiry.customer_address, enquiry.customer_lat, enquiry.customer_lng, enquiry.id
      ]
    );
    return enquiry.id;
  }

  const result = await db.runAsync(
    `INSERT INTO enquiries (customer_name, customer_phone, material_name, quantity, unit_type, quoted_rate, agreed_rate, status, pickup_address, pickup_lat, pickup_lng, customer_address, customer_lat, customer_lng)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      enquiry.customer_name, enquiry.customer_phone, enquiry.material_name, enquiry.quantity || 1, enquiry.unit_type || 'ton',
      enquiry.quoted_rate || 0, enquiry.agreed_rate || enquiry.quoted_rate || 0, enquiry.status || 'pending',
      enquiry.pickup_address || '', enquiry.pickup_lat || 10.9601, enquiry.pickup_lng || 78.0766,
      enquiry.customer_address || '', enquiry.customer_lat || 11.0168, enquiry.customer_lng || 76.9558
    ]
  );
  return result.lastInsertRowId;
}

// === Drivers ===
export async function getDrivers(db) {
  if (IS_WEB) {
    return webGetItems('billforge_drivers') || [];
  }
  return await db.getAllAsync('SELECT * FROM drivers ORDER BY name ASC');
}

export async function saveDriver(db, driver) {
  if (IS_WEB) {
    const list = webGetItems('billforge_drivers') || [];
    if (driver.id) {
      const idx = list.findIndex(d => d.id === parseInt(driver.id));
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...driver };
        webSetItems('billforge_drivers', list);
        return driver.id;
      }
    }
    const nextId = list.reduce((max, d) => d.id > max ? d.id : max, 0) + 1;
    const newD = {
      id: nextId,
      name: driver.name,
      phone: driver.phone,
      vehicle_no: driver.vehicle_no || '',
      password: driver.password || 'driver123',
      status: 'Available',
      lat: 11.0168,
      lng: 76.9558,
      updated_at: new Date().toISOString()
    };
    list.push(newD);
    webSetItems('billforge_drivers', list);
    return nextId;
  }

  const result = await db.runAsync(
    'INSERT INTO drivers (name, phone, vehicle_no, password, status) VALUES (?, ?, ?, ?, ?)',
    [driver.name, driver.phone, driver.vehicle_no || '', driver.password || 'driver123', 'Available']
  );
  return result.lastInsertRowId;
}

// === Consignments ===
export async function getConsignments(db) {
  if (IS_WEB) {
    return webGetItems('billforge_consignments') || [];
  }
  return await db.getAllAsync('SELECT * FROM consignments ORDER BY id DESC');
}

export async function saveConsignment(db, c) {
  if (IS_WEB) {
    const list = webGetItems('billforge_consignments') || [];
    if (c.id) {
      const idx = list.findIndex(item => item.id === parseInt(c.id));
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...c };
        webSetItems('billforge_consignments', list);
        return c.id;
      }
    }
    const nextId = list.reduce((max, item) => item.id > max ? item.id : max, 100) + 1;
    const newC = { ...c, id: nextId, last_updated: new Date().toISOString() };
    list.unshift(newC);
    webSetItems('billforge_consignments', list);
    return nextId;
  }

  if (c.id) {
    await db.runAsync(
      `UPDATE consignments SET status=?, driver_lat=?, driver_lng=?, last_updated=datetime('now') WHERE id=?`,
      [c.status, c.driver_lat, c.driver_lng, c.id]
    );
    return c.id;
  }

  const result = await db.runAsync(
    `INSERT INTO consignments (enquiry_id, driver_id, driver_name, customer_name, customer_phone, material_name, quantity, unit_type, agreed_rate, pickup_address, pickup_lat, pickup_lng, customer_address, customer_lat, customer_lng, status, driver_lat, driver_lng)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      c.enquiry_id, c.driver_id, c.driver_name, c.customer_name, c.customer_phone,
      c.material_name, c.quantity, c.unit_type, c.agreed_rate,
      c.pickup_address, c.pickup_lat, c.pickup_lng,
      c.customer_address, c.customer_lat, c.customer_lng,
      c.status || 'assigned', c.driver_lat || 11.0168, c.driver_lng || 76.9558
    ]
  );
  return result.lastInsertRowId;
}
