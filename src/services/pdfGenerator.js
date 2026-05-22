import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * Generate a PDF from filled bill data.
 * 
 * @param {Object} params
 * @param {Object} params.companyProfile - Company info { name, address, location, phone }
 * @param {Object} params.headerData - Filled header field values { fieldName: value }
 * @param {Array} params.rowData - Array of row objects [{ fieldName: value, ... }, ...]
 * @param {Array} params.headerFields - Field definitions [{ name, type, label }]
 * @param {Array} params.tableFields - Table field definitions [{ name, type, label }]
 * @param {string} params.templateName - Name of the template
 * @param {number} params.totalAmount - Total amount
 * @returns {Object} - { uri, success }
 */
export async function generatePDF({
  companyProfile = {},
  headerData = {},
  rowData = [],
  headerFields = [],
  tableFields = [],
  templateName = 'Invoice',
  totalAmount = 0,
  printWindow = null,
}) {
  try {
    const html = buildHTML({
      companyProfile,
      headerData,
      rowData,
      headerFields,
      tableFields,
      templateName,
      totalAmount,
    });

    if (Platform.OS === 'web') {
      const targetWindow = printWindow || window.open('', '_blank');
      if (targetWindow) {
        targetWindow.document.open();
        targetWindow.document.write(html);
        targetWindow.document.close();
        
        setTimeout(() => {
          try {
            targetWindow.focus();
            targetWindow.print();
          } catch (e) {
            console.error('Error printing in new window:', e);
          }
        }, 500);
      } else {
        alert('Please allow popups to print and generate the PDF.');
      }
      return { uri: 'web-print', success: true };
    }

    const { uri } = await Print.printToFileAsync({
      html,
      width: 595,  // A4 width in points
      height: 842, // A4 height in points
    });

    return { uri, success: true };
  } catch (error) {
    console.error('PDF generation error:', error);
    return { uri: null, success: false, error: error.message };
  }
}

/**
 * Share a generated PDF file.
 */
export async function sharePDF(uri) {
  try {
    if (Platform.OS === 'web') return; // Not applicable on web
    await shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share Bill PDF',
      UTI: 'com.adobe.pdf',
    });
  } catch (error) {
    console.error('Error sharing PDF:', error);
  }
}

/**
 * Save PDF to a persistent location.
 */
export async function savePDFPermanently(tempUri, billNumber) {
  try {
    if (Platform.OS === 'web') return tempUri; // Not applicable on web
    const dir = `${FileSystem.documentDirectory}bills/`;
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    
    const fileName = `bill_${billNumber}_${Date.now()}.pdf`;
    const destUri = `${dir}${fileName}`;
    await FileSystem.copyAsync({ from: tempUri, to: destUri });
    return destUri;
  } catch (error) {
    console.error('Error saving PDF:', error);
    return tempUri;
  }
}

/**
 * Build the HTML template for the PDF.
 */
function buildHTML({ companyProfile, headerData, rowData, headerFields, tableFields, templateName, totalAmount }) {
  const normalize = (name) => name ? name.toLowerCase().replace(/[\s_-]/g, '') : '';
  const getFieldVal = (obj, targets) => {
    const matchedKey = Object.keys(obj || {}).find(k => targets.includes(normalize(k)));
    return matchedKey ? obj[matchedKey] : undefined;
  };

  const companyName = getFieldVal(headerData, ['shopname', 'companyname']) || companyProfile.name || templateName;
  
  let companyAddress = getFieldVal(headerData, ['shoplocation', 'shopaddress', 'address']);
  if (!companyAddress && companyProfile) {
    companyAddress = [companyProfile.address, companyProfile.location].filter(p => p && p.trim() !== '').join(', ');
  }
  if (!companyAddress) companyAddress = '';

  const companyPhone = getFieldVal(headerData, ['shopnumber', 'shopphone', 'phone']) || companyProfile.phone || '';
  const billNumber = getFieldVal(headerData, ['bn', 'billnumber']) || '';

  // Arrangement based on user's screenshot
  const partyName = getFieldVal(headerData, ['partyname', 'customername', 'clientname']) || '';
  const billDate = formatDisplayValue(getFieldVal(headerData, ['billdate', 'date']), 'date') || '';
  const deliveryLoc = getFieldVal(headerData, ['deliveryloc', 'place', 'location']) || '';

  // Extract Balance Amount if present
  const balanceAmount = parseFloat(getFieldVal(headerData, ['balance', 'balanceamount', 'unclearedbalance']) || '0') || 0;

  const activeTableFields = tableFields.filter(f => {
    const norm = normalize(f.name);
    return !(
      norm === 'materialtypecost' || 
      norm.includes('priceperunit') || 
      norm.includes('priceper') || 
      norm.includes('rate') || 
      norm.includes('cost') || 
      norm.includes('perunit') || 
      norm.includes('unitprice') || 
      norm.includes('unitrate') || 
      norm.includes('unitcost') || 
      norm.includes('priceunit') || 
      norm.includes('rateunit') || 
      norm.includes('costunit') || 
      (norm.includes('price') && !norm.includes('total') && !norm.includes('subtotal') && !norm.includes('grand'))
    );
  });

  // Build table rows
  let tableRowsHTML = '';
  let colTotals = {};
  activeTableFields.forEach(f => {
    const norm = normalize(f.name);
    if (f.type === 'numeric' || norm.startsWith('cal') || norm.includes('total') || norm.includes('amount') || f.isVirtual) {
      colTotals[f.name] = 0;
    }
  });

  if (rowData.length > 0) {
    // Ensure we have at least a few empty rows for that "bill book" look if needed
    const displayRows = [...rowData];
    while (displayRows.length < 5) displayRows.push({});

    displayRows.forEach((row, idx) => {
      tableRowsHTML += '<tr>';
      activeTableFields.forEach(field => {
        const val = row[field.name] || '';
        const normName = normalize(field.name);
        const isNumeric = field.type === 'numeric' || normName.startsWith('cal') || normName.includes('total') || normName.includes('amount') || field.isVirtual;
        const align = isNumeric ? 'right' : 'center';
        
        let displayVal = val;
        if (field.type === 'date' || field.type === 'time' || field.type === 'datetime') {
          displayVal = formatDisplayValue(val, field.type);
        } else if (isNumeric && val) {
          const num = parseFloat(val);
          if (!isNaN(num)) {
            displayVal = formatIndianNumber(num);
            if (idx < rowData.length) colTotals[field.name] = (colTotals[field.name] || 0) + num;
          }
        }
        
        tableRowsHTML += `<td style="border: 1px solid #000; padding: 10px 6px; text-align: ${align}; font-size: 13px; height: 35px; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; max-width: 150px;">${displayVal}</td>`;
      });
      tableRowsHTML += '</tr>';
    });
  }

  // Calculate grand total
  const calFieldName = activeTableFields.find(f => {
    const norm = normalize(f.name);
    return norm.startsWith('cal') || norm.includes('total') || norm.includes('amount');
  })?.name;
  
  const subTotal = (calFieldName && colTotals[calFieldName]) ? colTotals[calFieldName] : (totalAmount - balanceAmount);

  // Extract dynamic custom fields
  const normalizedStandardFields = ['bn', 'shopname', 'shoplocation', 'shopnumber', 'partyname', 'billdate', 'deliveryloc', 'total', 'balance', 'balanceamount', 'unclearedbalance'];
  const customHeaderFields = headerFields.filter(f => !normalizedStandardFields.includes(normalize(f.name)));
  
  let customFieldsHTML = '';
  if (customHeaderFields.length > 0) {
    customFieldsHTML = `
      <div style="display: flex; flex-wrap: wrap; margin-top: 15px; margin-bottom: 15px; font-size: 14px; border: 1.5px solid #000; padding: 12px; border-radius: 4px; gap: 8px 0; font-family: 'Times New Roman', Times, serif;">
    `;
    customHeaderFields.forEach(f => {
      const val = formatDisplayValue(headerData[f.name], f.type);
      if (val) {
        customFieldsHTML += `
          <div style="width: 50%; box-sizing: border-box; padding-right: 10px; word-wrap: break-word; overflow-wrap: break-word;">
            <strong style="color: #333;">${f.label}:</strong> <span>${val}</span>
          </div>
        `;
      }
    });
    customFieldsHTML += '</div>';
  }

  // Footer totals and balance rows
  const colSpan = activeTableFields.length - 1;
  let footerRowsHTML = '';
  if (balanceAmount > 0) {
    footerRowsHTML += `
      <tr>
        <td colspan="${colSpan}" style="border: 1px solid #000; padding: 10px 15px; font-weight: bold; text-align: right; font-size: 14px;">Subtotal</td>
        <td style="border: 1px solid #000; padding: 10px 6px; font-weight: bold; text-align: right; font-size: 14px;">${formatIndianNumber(subTotal)}</td>
      </tr>
      <tr>
        <td colspan="${colSpan}" style="border: 1px solid #000; padding: 10px 15px; font-weight: bold; text-align: right; font-size: 14px;">Uncleared Balance</td>
        <td style="border: 1px solid #000; padding: 10px 6px; font-weight: bold; text-align: right; font-size: 14px;">${formatIndianNumber(balanceAmount)}</td>
      </tr>
    `;
  }
  footerRowsHTML += `
    <tr>
      <td colspan="${colSpan}" style="border: 1px solid #000; padding: 10px 15px; font-weight: bold; text-align: right; font-size: 16px;">Total</td>
      <td style="border: 1px solid #000; padding: 10px 6px; font-weight: bold; text-align: right; font-size: 16px;">${formatIndianNumber(subTotal + balanceAmount)}</td>
    </tr>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page { 
          size: auto;
          margin: 0mm; 
        }
        body { 
          font-family: 'Times New Roman', Times, serif; 
          color: #000; 
          padding: 15mm 20mm;
          line-height: 1.2;
        }
        .header-section { margin-bottom: 25px; }
        .top-row { display: flex; justify-content: space-between; align-items: flex-start; }
        .bn { font-weight: bold; font-size: 16px; width: 100px; }
        .shop-name { 
          font-size: ${companyName.length > 22 ? '22px' : (companyName.length > 15 ? '26px' : '32px')}; 
          font-weight: 900; 
          text-align: center; 
          flex: 1; 
          text-transform: uppercase;
          letter-spacing: 2px;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .shop-phone { font-size: 14px; text-align: right; width: 180px; font-weight: bold; }
        .shop-loc { text-align: center; font-size: 14px; margin-top: -5px; font-weight: bold; }
        
        .info-section { display: flex; justify-content: space-between; margin-top: 30px; margin-bottom: 25px; font-size: 16px; }
        .party-info { flex: 1; }
        .date-place { text-align: left; width: 220px; }
        .underline { border-bottom: 1px dotted #000; display: inline-block; min-width: 150px; padding-bottom: 2px; }
        
        .data-table { width: 100%; border-collapse: collapse; margin-bottom: 0px; }
        .data-table th { border: 1px solid #000; padding: 10px; font-size: 14px; text-align: center; font-weight: bold; word-wrap: break-word; overflow-wrap: break-word; }
        .data-table td { border: 1px solid #000; }
        
        .signature { margin-top: 100px; font-size: 15px; }
        .sig-line { border-bottom: 1px solid #000; display: inline-block; width: 300px; margin-left: 10px; }
      </style>
    </head>
    <body>
      <div class="header-section">
        <div class="top-row">
          <div class="bn">${billNumber}</div>
          <div class="shop-name">${companyName}</div>
          <div class="shop-phone">Phone: ${companyPhone}</div>
        </div>
        <div class="shop-loc">${companyAddress}</div>
      </div>

      <div class="info-section">
        <div class="party-info">
          M/s: <span class="underline" style="min-width: 350px;">${partyName}</span>
        </div>
        <div class="date-place">
          Date: <span class="underline" style="min-width: 120px;">${billDate}</span><br/>
          Place: <span class="underline" style="min-width: 120px; margin-top: 8px;">${deliveryLoc}</span>
        </div>
      </div>

      ${customFieldsHTML}

      <table class="data-table">
        <thead>
          <tr>
            ${activeTableFields.map(f => {
              let label = f.label;
              const norm = normalize(f.name);
              if (norm.startsWith('cal')) label = 'Each Value ₹';
              if (['materialtype', 'materialstype', 'material', 'materials'].includes(norm)) label = 'Materials Type';
              if (norm === 'sno' || norm === 'slno') label = 'S/No';
              if (norm.includes('date')) label = 'DATE';
              return `<th>${label}</th>`;
            }).join('')}
          </tr>
        </thead>
        <tbody>
          ${tableRowsHTML}
          ${footerRowsHTML}
        </tbody>
      </table>

      <div class="signature">
        Receiver's Signature: <span class="sig-line"></span>
      </div>
    </body>
    </html>
  `;
}

/**
 * Format a number in Indian numbering system (e.g., 5,12,600).
 */
function formatIndianNumber(num) {
  if (isNaN(num)) return '0';
  const str = Math.round(num).toString();
  let result = '';
  let count = 0;
  
  for (let i = str.length - 1; i >= 0; i--) {
    if (count === 3 || (count > 3 && (count - 3) % 2 === 0)) {
      result = ',' + result;
    }
    result = str[i] + result;
    count++;
  }
  
  return result;
}

/**
 * Format a value for display based on its field type.
 */
function formatDisplayValue(value, type) {
  if (!value) return '';
  let dateObj = value;
  if (!(value instanceof Date)) {
    try {
      dateObj = new Date(value);
      if (isNaN(dateObj.getTime())) return String(value);
    } catch (e) {
      return String(value);
    }
  }
  
  if (type === 'date') {
    return dateObj.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
  if (type === 'time') {
    return dateObj.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
  if (type === 'datetime') {
    return dateObj.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }) + ' ' + dateObj.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
  
  return String(value);
}
