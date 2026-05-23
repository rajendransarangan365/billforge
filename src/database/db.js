import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

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
  if (!templates) {
    webSetItems('billforge_templates', []);
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
}

/**
 * Get the next sequential bill number.
 */
export async function getNextBillNumber(db) {
  if (IS_WEB) {
    const bills = webGetItems('billforge_bills') || [];
    const count = bills.length;
    return (count + 1).toString().padStart(4, '0');
  }
  const result = await db.getFirstAsync('SELECT COUNT(*) as count FROM bills');
  const count = result?.count || 0;
  return (count + 1).toString().padStart(4, '0');
}

// === Materials ===
export async function getMaterials(db) {
  if (IS_WEB) {
    const list = webGetItems('billforge_materials') || [];
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

// === Company Profile ===
export async function getCompanyProfile(db) {
  if (IS_WEB) {
    const list = webGetItems('billforge_company_profiles') || [];
    return list[0] || null;
  }
  return await db.getFirstAsync('SELECT * FROM company_profiles ORDER BY id LIMIT 1');
}

export async function saveCompanyProfile(db, profile) {
  if (IS_WEB) {
    const list = webGetItems('billforge_company_profiles') || [];
    const existing = list[0];
    if (existing) {
      list[0] = {
        ...existing,
        name: profile.name || '',
        address: profile.address || '',
        location: profile.location || '',
        phone: profile.phone || '',
        logo_base64: profile.logo_base64 || '',
        updated_at: new Date().toISOString()
      };
      webSetItems('billforge_company_profiles', list);
      return existing.id;
    } else {
      const newProfile = {
        id: 1,
        name: profile.name || '',
        address: profile.address || '',
        location: profile.location || '',
        phone: profile.phone || '',
        logo_base64: profile.logo_base64 || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      webSetItems('billforge_company_profiles', [newProfile]);
      return 1;
    }
  }

  const existing = await getCompanyProfile(db);
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
export async function getBills(db) {
  if (IS_WEB) {
    const bills = webGetItems('billforge_bills') || [];
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
