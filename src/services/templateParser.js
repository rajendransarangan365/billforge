import PizZip from 'pizzip';

/**
 * Parse a Word (.docx) template and extract all placeholder fields.
 * Placeholders use <FieldName> notation (angle brackets).
 * 
 * @param {string} base64Content - The base64-encoded content of the .docx file
 * @returns {Object} - { headerFields, tableFields, allFields }
 */
export function parseTemplate(base64Content) {
  try {
    const zip = new PizZip(base64Content, { base64: true });
    
    // Read the main document XML
    const documentXml = zip.file('word/document.xml');
    if (!documentXml) {
      throw new Error('Invalid Word document: cannot find document.xml');
    }
    
    const xmlContent = documentXml.asText();
    
    // Extract all text content, preserving structure info
    const allFields = [];
    const fieldSet = new Set();
    
    // Find all <FieldName> patterns in the XML text content
    // We need to handle cases where the angle bracket field might be split across XML runs
    const cleanedText = extractTextFromXml(xmlContent);
    
    // Also try to find fields directly in the raw XML (handles split runs)
    const rawFields = findFieldsInRawXml(xmlContent);
    
    // Extract fields from cleaned text  
    // Updated regex to allow spaces and numbers inside brackets
    const fieldPattern = /<([A-Za-z0-9_\s\u0900-\u097F]+)>/g;
    let match;
    
    while ((match = fieldPattern.exec(cleanedText)) !== null) {
      const fieldName = match[1].trim();
      if (fieldName && !fieldSet.has(fieldName)) {
        fieldSet.add(fieldName);
        allFields.push({
          name: fieldName,
          type: detectFieldType(fieldName),
          label: formatFieldLabel(fieldName),
        });
      }
    }
    
    // Merge with raw XML fields
    for (const fieldName of rawFields) {
      const trimmedName = fieldName.trim();
      if (trimmedName && !fieldSet.has(trimmedName)) {
        fieldSet.add(trimmedName);
        allFields.push({
          name: trimmedName,
          type: detectFieldType(trimmedName),
          label: formatFieldLabel(trimmedName),
        });
      }
    }
    
    // Determine which fields are table/row fields vs header fields
    // based on whether they appear inside table row elements in the XML
    const tableFieldNames = findTableFields(xmlContent, fieldSet);
    
    const headerFields = allFields.filter(f => !tableFieldNames.has(f.name));
    const tableFields = allFields.filter(f => tableFieldNames.has(f.name));
    
    return {
      headerFields,
      tableFields,
      allFields,
      success: true,
    };
  } catch (error) {
    console.error('Template parsing error:', error);
    return {
      headerFields: [],
      tableFields: [],
      allFields: [],
      success: false,
      error: error.message,
    };
  }
}

/**
 * Extract clean text content from Word XML, preserving paragraph boundaries.
 */
function extractTextFromXml(xml) {
  // Remove XML tags but keep text content
  // Decode common entities first
  const decoded = xml
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  const textParts = [];
  const textPattern = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  let match;
  
  while ((match = textPattern.exec(decoded)) !== null) {
    textParts.push(match[1]);
  }
  
  return textParts.join('');
}

/**
 * Find fields even when angle brackets are split across XML runs.
 */
function findFieldsInRawXml(xml) {
  const fields = new Set();
  
  // Decode XML entities
  const decoded = xml
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
  
  // Extract all text content in order, grouped by paragraph
  const paragraphs = decoded.split(/<\/w:p>/);
  
  for (const para of paragraphs) {
    const textParts = [];
    const textPattern = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    let match;
    
    while ((match = textPattern.exec(para)) !== null) {
      textParts.push(match[1]);
    }
    
    const fullText = textParts.join('');
    const fieldPattern = /<([A-Za-z0-9_\s\u0900-\u097F]+)>/g;
    
    while ((match = fieldPattern.exec(fullText)) !== null) {
      const name = match[1].trim();
      if (name) fields.add(name);
    }
  }
  
  return fields;
}

/**
 * Determine which fields appear inside table rows in the Word XML.
 */
function findTableFields(xml, allFieldNames) {
  const tableFields = new Set();
  
  // Find all table row content <w:tr>...</w:tr>
  const tableRowPattern = /<w:tr[\s>][\s\S]*?<\/w:tr>/g;
  let rowMatch;
  const rows = [];
  
  while ((rowMatch = tableRowPattern.exec(xml)) !== null) {
    rows.push(rowMatch[0]);
  }
  
  // A field is a table field if it appears in a row that looks like a data row
  // (i.e., not a pure header row with just static text)
  rows.forEach((rowText, index) => {
    const decoded = rowText
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    
    // Extract text from this row
    const textParts = [];
    const textPattern = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    let match;
    while ((match = textPattern.exec(decoded)) !== null) {
      textParts.push(match[1]);
    }
    const fullText = textParts.join('');
    
    for (const fieldName of allFieldNames) {
      // If the row contains <FieldName>, it's a candidate for a table field
      if (fullText.includes(`<${fieldName}>`)) {
        // Heuristic: If it's the first row, it might be a header if there are other rows
        // But if it's the ONLY row with fields, it's definitely a table row.
        // For simplicity, if it's in any row, it's a table field UNLESS it's a known header field
        tableFields.add(fieldName);
      }
    }
  });
  
  // Specific header fields that should NEVER be table fields
  const headerOnly = ['bn', 'shopname', 'shoplocation', 'shopnumber', 'partyname', 'billdate', 'deliveryloc', 'total', 'balance', 'balanceamount', 'unclearedbalance'];
  const normalizeKeyStr = (name) => name ? name.toLowerCase().replace(/[\s_-]/g, '') : '';
  
  for (const field of tableFields) {
    if (headerOnly.includes(normalizeKeyStr(field))) {
      tableFields.delete(field);
    }
  }
  
  return tableFields;
}

/**
 * Auto-detect field type from field name.
 */
function detectFieldType(fieldName) {
  const lower = fieldName.toLowerCase();
  
  if (lower.includes('datetime') || (lower.includes('date') && lower.includes('time'))) {
    return 'datetime';
  }
  if (lower.includes('date') || lower === 'billdate' || lower === 'invoicedate') {
    return 'date';
  }
  if (lower.includes('time')) {
    return 'time';
  }
  if (lower.includes('phone') || lower.includes('mobile') || lower.includes('contact') ||
      lower.includes('number') && !lower.includes('bill')) {
    return 'phone';
  }
  if (lower === 'sno' || lower === 'slno' || lower === 'srno' || lower === 'serialno') {
    return 'number';
  }
  if (lower.includes('qty') || lower.includes('quantity') || lower.includes('units') ||
      lower.includes('trip') || lower.includes('amount') || lower.includes('price') ||
      lower.includes('rate') || lower.includes('value') || lower.includes('total')) {
    return 'numeric';
  }
  if (lower.includes('email')) {
    return 'email';
  }
  
  return 'text';
}

/**
 * Convert camelCase/PascalCase field name to a readable label.
 */
function formatFieldLabel(fieldName) {
  const norm = fieldName.toLowerCase().replace(/[\s_-]/g, '');
  if (norm === 'balance' || norm === 'balanceamount' || norm === 'unclearedbalance') {
    return 'Uncleared Balance';
  }
  // Insert space before uppercase letters
  let label = fieldName.replace(/([A-Z])/g, ' $1').trim();
  // Capitalize first letter
  label = label.charAt(0).toUpperCase() + label.slice(1);
  return label;
}

/**
 * Get the keyboard type for a field based on its detected type.
 */
export function getKeyboardTypeForField(fieldType) {
  switch (fieldType) {
    case 'number':
    case 'numeric':
      return 'numeric';
    case 'phone':
      return 'phone-pad';
    case 'email':
      return 'email-address';
    default:
      return 'default';
  }
}
