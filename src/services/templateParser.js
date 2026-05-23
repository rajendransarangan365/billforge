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

/**
 * Generate a minimal, valid Microsoft Word (.docx) file containing the standard billing placeholders.
 * Uses the existing PizZip library to package the OpenXML files.
 * 
 * @returns {string} Base64 encoded string of the .docx file
 */
export function generateDefaultTemplateDocxBase64() {
  const zip = new PizZip();
  
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="36"/>
          <w:color w:val="0F2050"/>
        </w:rPr>
        <w:t>Billing365 - Standard Billing Invoice</w:t>
      </w:r>
    </w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Bill Number: </w:t></w:r>
      <w:r><w:t>&lt;BN&gt;</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Customer / Party Name: </w:t></w:r>
      <w:r><w:t>&lt;PartyName&gt;</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Billing Date: </w:t></w:r>
      <w:r><w:t>&lt;BillDate&gt;</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Place of Delivery: </w:t></w:r>
      <w:r><w:t>&lt;DeliveryLoc&gt;</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    
    <w:tbl>
      <w:tblPr>
        <w:tblBorders>
          <w:top w:val="single" w:sz="6" w:space="0" w:color="0F2050"/>
          <w:left w:val="single" w:sz="6" w:space="0" w:color="0F2050"/>
          <w:bottom w:val="single" w:sz="6" w:space="0" w:color="0F2050"/>
          <w:right w:val="single" w:sz="6" w:space="0" w:color="0F2050"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>S/No</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>DATE</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Materials Type</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Trip</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Units</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Each Value ₹</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>&lt;Sno&gt;</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>&lt;DateTime&gt;</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>&lt;MaterialType&gt;</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>&lt;Trip&gt;</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>&lt;Units&gt;</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>&lt;Cal1s&gt;</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`;

  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', relsXml);
  zip.file('word/document.xml', documentXml);
  
  return zip.generate({ type: 'base64' });
}

/**
 * Generate a customized Microsoft Word (.docx) template package based on layout designs.
 */
export function generateCustomTemplateDocxBase64(settings = {}, headerFields = [], tableFields = []) {
  const zip = new PizZip();
  
  const themeColor = (settings.themeColor || '0F2050').replace('#', '');
  const fontFamily = settings.fontFamily || 'Arial';
  const borderStyle = settings.borderStyle || 'single';
  const titleText = settings.titleText || 'Standard Billing Invoice';

  // Border style XML configuration
  let bordersXml = '';
  if (borderStyle === 'double') {
    bordersXml = `
      <w:top w:val="double" w:sz="12" w:space="0" w:color="${themeColor}"/>
      <w:left w:val="double" w:sz="12" w:space="0" w:color="${themeColor}"/>
      <w:bottom w:val="double" w:sz="12" w:space="0" w:color="${themeColor}"/>
      <w:right w:val="double" w:sz="12" w:space="0" w:color="${themeColor}"/>
      <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
      <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>`;
  } else if (borderStyle === 'none') {
    bordersXml = `
      <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
      <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
      <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>
      <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
      <w:insideH w:val="single" w:sz="4" w:space="0" w:color="EEEEEE"/>
      <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>`;
  } else if (borderStyle === 'fine') {
    bordersXml = `
      <w:top w:val="single" w:sz="4" w:space="0" w:color="${themeColor}"/>
      <w:left w:val="single" w:sz="4" w:space="0" w:color="${themeColor}"/>
      <w:bottom w:val="single" w:sz="4" w:space="0" w:color="${themeColor}"/>
      <w:right w:val="single" w:sz="4" w:space="0" w:color="${themeColor}"/>
      <w:insideH w:val="single" w:sz="2" w:space="0" w:color="DDDDDD"/>
      <w:insideV w:val="single" w:sz="2" w:space="0" w:color="DDDDDD"/>`;
  } else {
    bordersXml = `
      <w:top w:val="single" w:sz="8" w:space="0" w:color="${themeColor}"/>
      <w:left w:val="single" w:sz="8" w:space="0" w:color="${themeColor}"/>
      <w:bottom w:val="single" w:sz="8" w:space="0" w:color="${themeColor}"/>
      <w:right w:val="single" w:sz="8" w:space="0" w:color="${themeColor}"/>
      <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
      <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>`;
  }

  // Header layout matching Word template (3-column top header, 2-column details)
  const normalize = (name) => name ? name.toLowerCase().replace(/[\s_-]/g, '') : '';
  const findField = (fields, targets) => fields.find(f => targets.includes(normalize(f.name)));

  // Identify standard fields
  const bnField = findField(headerFields, ['bn', 'billnumber']);
  const shopNameField = findField(headerFields, ['shopname', 'companyname']);
  const shopLocField = findField(headerFields, ['shoplocation', 'shopaddress', 'address']);
  const shopNumField = findField(headerFields, ['shopnumber', 'shopphone', 'phone']);
  const partyNameField = findField(headerFields, ['partyname', 'customername', 'clientname']);
  const billDateField = findField(headerFields, ['billdate', 'date']);
  const deliveryLocField = findField(headerFields, ['deliveryloc', 'place', 'location']);

  // Extract custom fields (non-standard fields)
  const standardNames = ['bn', 'billnumber', 'shopname', 'companyname', 'shoplocation', 'shopaddress', 'address', 'shopnumber', 'shopphone', 'phone', 'partyname', 'customername', 'clientname', 'billdate', 'date', 'deliveryloc', 'place', 'location', 'total'];
  const customHeaderFields = headerFields.filter(f => !standardNames.includes(normalize(f.name)));

  const bnVal = bnField ? `<${bnField.name}>` : '';
  const shopNameVal = shopNameField ? `<${shopNameField.name}>` : titleText;
  const shopLocVal = shopLocField ? `<${shopLocField.name}>` : '';
  const shopNumVal = shopNumField ? `📞 <${shopNumField.name}>` : '';

  const partyNameVal = partyNameField ? `<${partyNameField.name}>` : '<PartyName>';
  const billDateVal = billDateField ? `<${billDateField.name}>` : '<BillDate>';
  const deliveryLocVal = deliveryLocField ? `<${deliveryLocField.name}>` : '<DeliveryLoc>';

  // Shop details table (3 columns, borderless)
  const shopHeaderTableXml = `
    <w:tbl>
      <w:tblPr>
        <w:tblBorders>
          <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        </w:tblBorders>
        <w:tblCellMar>
          <w:top w:w="80" w:type="dxa"/>
          <w:left w:w="80" w:type="dxa"/>
          <w:bottom w:w="80" w:type="dxa"/>
          <w:right w:w="80" w:type="dxa"/>
        </w:tblCellMar>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="2000" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="left"/></w:pPr>
            <w:r>
              <w:rPr>
                <w:b/>
                <w:sz w:val="24"/>
                <w:rFonts w:ascii="${fontFamily}" w:hAnsi="${fontFamily}"/>
              </w:rPr>
              <w:t>${bnVal}</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="5000" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr>
                <w:b/>
                <w:sz w:val="38"/>
                <w:rFonts w:ascii="${fontFamily}" w:hAnsi="${fontFamily}"/>
                <w:color w:val="${themeColor}"/>
              </w:rPr>
              <w:t>${shopNameVal}</w:t>
            </w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr>
                <w:b/>
                <w:sz w:val="20"/>
                <w:rFonts w:ascii="${fontFamily}" w:hAnsi="${fontFamily}"/>
              </w:rPr>
              <w:t>${shopLocVal}</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2000" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="right"/></w:pPr>
            <w:r>
              <w:rPr>
                <w:b/>
                <w:sz w:val="22"/>
                <w:rFonts w:ascii="${fontFamily}" w:hAnsi="${fontFamily}"/>
              </w:rPr>
              <w:t>${shopNumVal}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>
  `;

  // Customer Details (2 columns, borderless)
  const customerDetailsTableXml = `
    <w:tbl>
      <w:tblPr>
        <w:tblBorders>
          <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        </w:tblBorders>
        <w:tblCellMar>
          <w:top w:w="80" w:type="dxa"/>
          <w:left w:w="80" w:type="dxa"/>
          <w:bottom w:w="80" w:type="dxa"/>
          <w:right w:w="80" w:type="dxa"/>
        </w:tblCellMar>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="5800" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="left"/></w:pPr>
            <w:r>
              <w:rPr>
                <w:b/>
                <w:sz w:val="24"/>
                <w:rFonts w:ascii="${fontFamily}" w:hAnsi="${fontFamily}"/>
              </w:rPr>
              <w:t>M/s: </w:t>
            </w:r>
            <w:r>
              <w:rPr>
                <w:u w:val="single"/>
                <w:sz w:val="24"/>
                <w:rFonts w:ascii="${fontFamily}" w:hAnsi="${fontFamily}"/>
              </w:rPr>
              <w:t>${partyNameVal}</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="3200" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="left"/></w:pPr>
            <w:r>
              <w:rPr>
                <w:b/>
                <w:sz w:val="24"/>
                <w:rFonts w:ascii="${fontFamily}" w:hAnsi="${fontFamily}"/>
              </w:rPr>
              <w:t>Date: </w:t>
            </w:r>
            <w:r>
              <w:rPr>
                <w:u w:val="single"/>
                <w:sz w:val="24"/>
                <w:rFonts w:ascii="${fontFamily}" w:hAnsi="${fontFamily}"/>
              </w:rPr>
              <w:t>${billDateVal}</w:t>
            </w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="left"/></w:pPr>
            <w:r>
              <w:rPr>
                <w:b/>
                <w:sz w:val="24"/>
                <w:rFonts w:ascii="${fontFamily}" w:hAnsi="${fontFamily}"/>
              </w:rPr>
              <w:t>Place: </w:t>
            </w:r>
            <w:r>
              <w:rPr>
                <w:u w:val="single"/>
                <w:sz w:val="24"/>
                <w:rFonts w:ascii="${fontFamily}" w:hAnsi="${fontFamily}"/>
              </w:rPr>
              <w:t>${deliveryLocVal}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>
  `;

  // Custom Header Fields
  let customFieldsXml = '';
  if (customHeaderFields.length > 0) {
    customFieldsXml += `<w:p><w:r><w:t></w:t></w:r></w:p>`;
    customHeaderFields.forEach(f => {
      customFieldsXml += `
      <w:p>
        <w:pPr>
          <w:rPr>
            <w:rFonts w:ascii="${fontFamily}" w:hAnsi="${fontFamily}"/>
          </w:rPr>
        </w:pPr>
        <w:r><w:rPr><w:b/><w:rFonts w:ascii="${fontFamily}" w:hAnsi="${fontFamily}"/></w:rPr><w:t>${f.label}: </w:t></w:r>
        <w:r><w:rPr><w:rFonts w:ascii="${fontFamily}" w:hAnsi="${fontFamily}"/></w:rPr><w:t>&lt;${f.name}&gt;</w:t></w:r>
      </w:p>`;
    });
  }

  // Table items XML
  let tableHeadersXml = '';
  let tableCellsXml = '';
  tableFields.forEach(f => {
    tableHeadersXml += `
        <w:tc>
          <w:p>
            <w:r>
              <w:rPr>
                <w:b/>
                <w:rFonts w:ascii="${fontFamily}" w:hAnsi="${fontFamily}"/>
                <w:color w:val="${themeColor}"/>
              </w:rPr>
              <w:t>${f.label}</w:t>
            </w:r>
          </w:p>
        </w:tc>`;

    tableCellsXml += `
        <w:tc>
          <w:p>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="${fontFamily}" w:hAnsi="${fontFamily}"/>
              </w:rPr>
              <w:t>&lt;${f.name}&gt;</w:t>
            </w:r>
          </w:p>
        </w:tc>`;
  });

  // Table total footer row
  let tableFooterXml = '';
  if (tableFields.length > 0) {
    tableFooterXml += `<w:tr>`;
    tableFields.forEach((f, idx) => {
      const isLast = idx === tableFields.length - 1;
      const isSecondLast = idx === tableFields.length - 2;
      tableFooterXml += `
        <w:tc>
          <w:p>
            <w:r>
              <w:rPr>
                <w:b/>
                <w:rFonts w:ascii="${fontFamily}" w:hAnsi="${fontFamily}"/>
              </w:rPr>
              <w:t>${isSecondLast ? 'Total' : isLast ? '<Total>' : ''}</w:t>
            </w:r>
          </w:p>
        </w:tc>`;
    });
    tableFooterXml += `</w:tr>`;
  }

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${shopHeaderTableXml}
    
    <w:p><w:r><w:t></w:t></w:r></w:p>
    
    ${customerDetailsTableXml}
    
    ${customFieldsXml}
    
    <w:p><w:r><w:t></w:t></w:r></w:p>
    
    <w:tbl>
      <w:tblPr>
        <w:tblBorders>
          ${bordersXml}
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        ${tableHeadersXml}
      </w:tr>
      <w:tr>
        ${tableCellsXml}
      </w:tr>
      ${tableFooterXml}
    </w:tbl>
    
    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p>
      <w:r>
        <w:rPr>
          <w:sz w:val="24"/>
          <w:rFonts w:ascii="${fontFamily}" w:hAnsi="${fontFamily}"/>
        </w:rPr>
        <w:t>Receiver's Signature: _________________________</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;

  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', relsXml);
  zip.file('word/document.xml', documentXml);
  
  return zip.generate({ type: 'base64' });
}

