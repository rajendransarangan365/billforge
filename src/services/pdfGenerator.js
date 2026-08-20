import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { documentDirectory } from 'expo-file-system';
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
  themeColor = null,
  fontFamily = null,
  borderStyle = null,
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
      themeColor,
      fontFamily,
      borderStyle,
    });

    if (Platform.OS === 'web') {
      const bn = headerData.BN || headerData.billnumber || '0001';
      const cust = (headerData.partyname || headerData.customername || 'Party').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_');
      const fileName = `${cust}_BN${bn}_${timestamp}.html`;

      // Close placeholder window if open
      if (printWindow && !printWindow.closed) {
        try { printWindow.close(); } catch (e) {}
      }

      // Silent Background Auto-Save
      try {
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error('Silent auto-save error:', e);
      }

      return { uri: 'web-auto-saved', fileName, success: true };
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
export async function savePDFPermanently(tempUri, billNumber, customerName = '') {
  try {
    const cleanCustomer = customerName ? customerName.trim().replace(/[^A-Za-z0-9]/g, '_') : 'Customer';
    const cleanBillNo = billNumber ? billNumber.trim().replace(/[^A-Za-z0-9_-]/g, '_') : 'BF';
    
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[now.getMonth()];
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');
    
    const timestamp = `${day}${month}${year}_${hours}${mins}${secs}`;
    const fileName = `${cleanCustomer}_${cleanBillNo}_${timestamp}.pdf`;

    if (Platform.OS === 'web') {
      try {
        if (tempUri && (tempUri.startsWith('blob:') || tempUri.startsWith('data:'))) {
          const a = document.createElement('a');
          a.href = tempUri;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } catch (e) {
        console.error('Web PDF download trigger error:', e);
      }
      return tempUri;
    }

    const dir = `${documentDirectory}BillForge_Invoices/`;
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    
    const destUri = `${dir}${fileName}`;
    await FileSystem.copyAsync({ from: tempUri, to: destUri });
    console.log(`[PDF Saved] File saved permanently to ${destUri}`);
    return destUri;
  } catch (error) {
    console.error('Error saving PDF:', error);
    return tempUri;
  }
}

/**
 * Build the HTML template for the PDF.
 */
function buildHTML({ companyProfile, headerData, rowData, headerFields, tableFields, templateName, totalAmount, themeColor, fontFamily, borderStyle }) {
  const primaryThemeColor = themeColor || '#0F2050';
  const selectedFont = fontFamily || 'Arial';
  const selectedBorderStyle = borderStyle || 'single';

  let cssFontStack = "Arial, sans-serif";
  if (selectedFont === 'Georgia') cssFontStack = "Georgia, serif";
  else if (selectedFont === 'Times New Roman') cssFontStack = "'Times New Roman', Times, serif";
  else if (selectedFont === 'Courier New') cssFontStack = "'Courier New', Courier, monospace";

  const borderStyleCss = selectedBorderStyle === 'none' ? 'border: none; border-bottom: 1px solid #EEEEEE;' : selectedBorderStyle === 'double' ? 'border: 3px double ' + primaryThemeColor + ';' : selectedBorderStyle === 'fine' ? 'border: 1px solid #DDDDDD;' : 'border: 1px solid ' + primaryThemeColor + ';';
  const tableHeaderBg = selectedBorderStyle === 'none' ? 'transparent' : '#F8FAFC';

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

  // Extract Balance Amount and Paid Amount if present
  const balanceAmount = parseFloat(getFieldVal(headerData, ['balance', 'balanceamount', 'unclearedbalance']) || '0') || 0;
  const paidAmount = parseFloat(getFieldVal(headerData, ['paid', 'paidamount', 'amountpaid']) || '0') || 0;
  const rawPaidDate = getFieldVal(headerData, ['paiddate', 'datepaid', 'paymentdate']);
  let paidDateFormatted = '';
  if (rawPaidDate) {
    paidDateFormatted = formatDisplayValue(rawPaidDate, 'date');
  }

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

  // 1. Pre-calculate totals across all rowData first (essential for multi-page invoices)
  let colTotals = {};
  activeTableFields.forEach(f => {
    const norm = normalize(f.name);
    if (f.type === 'numeric' || norm.startsWith('cal') || norm.includes('total') || norm.includes('amount') || f.isVirtual) {
      colTotals[f.name] = 0;
    }
  });

  rowData.forEach(row => {
    activeTableFields.forEach(field => {
      const val = row[field.name] || '';
      const normName = normalize(field.name);
      const isNumeric = field.type === 'numeric' || normName.startsWith('cal') || normName.includes('total') || normName.includes('amount') || field.isVirtual;
      if (isNumeric && val) {
        const num = parseFloat(val);
        if (!isNaN(num)) {
          colTotals[field.name] = (colTotals[field.name] || 0) + num;
        }
      }
    });
  });

  // Calculate grand total
  const calFieldName = activeTableFields.find(f => {
    const norm = normalize(f.name);
    return norm.startsWith('cal') || norm.includes('total') || norm.includes('amount');
  })?.name;
  
  const subTotal = (calFieldName && colTotals[calFieldName]) ? colTotals[calFieldName] : (totalAmount - balanceAmount + paidAmount);

  // Custom calculations settings from headerData
  const calcMultiplyTrip = headerData.calc_multiply_trip === 'true';
  const calcIncludeTax = headerData.calc_include_tax === 'true';
  const calcTaxRate = parseFloat(headerData.calc_tax_rate || '18');
  const calcShowTimeInTable = headerData.calc_show_time_in_table === 'true';

  let taxAmount = 0;
  if (calcIncludeTax) {
    taxAmount = subTotal * (calcTaxRate / 100);
  }
  const grandTotal = subTotal + balanceAmount + taxAmount - paidAmount;

  // Extract dynamic custom fields
  const normalizedStandardFields = ['bn', 'shopname', 'shoplocation', 'shopnumber', 'partyname', 'billdate', 'deliveryloc', 'total', 'balance', 'balanceamount', 'unclearedbalance', 'paid', 'paidamount', 'amountpaid', 'paiddate', 'datepaid', 'paymentdate'];
  const customHeaderFields = headerFields.filter(f => !normalizedStandardFields.includes(normalize(f.name)));
  
  let customFieldsHTML = '';
  if (customHeaderFields.length > 0) {
    customFieldsHTML = `
      <div style="display: flex; flex-wrap: wrap; margin-top: 15px; margin-bottom: 15px; font-size: 14px; border: 1.5px solid ${primaryThemeColor}; padding: 12px; border-radius: 4px; gap: 8px 0; font-family: ${cssFontStack};">
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

  // 2. Chunk rowData into exactly 10 materials per page
  const chunks = [];
  for (let i = 0; i < rowData.length; i += 10) {
    chunks.push(rowData.slice(i, i + 10));
  }
  if (chunks.length === 0) {
    chunks.push([{}]); // Render at least one blank row on one page
  }

  const colSpan = activeTableFields.length - 1;
  let pagesHTML = '';

  chunks.forEach((chunk, pageIdx) => {
    const isLastPage = pageIdx === chunks.length - 1;
    const pageNumText = chunks.length > 1 ? `<div style="text-align: right; font-size: 11px; margin-bottom: 5px; font-style: italic; font-weight: bold;">Page ${pageIdx + 1} of ${chunks.length}</div>` : '';
    
    // Build rows HTML for this page's chunk
    let tableRowsHTML = '';
    const displayRows = [...chunk];
    
    // Pad to 5 rows if it's the last page and too short (to preserve the formal "bill book" layout)
    if (isLastPage) {
      while (displayRows.length < 5) displayRows.push({});
    }

    displayRows.forEach((row, idx) => {
      tableRowsHTML += '<tr>';
      activeTableFields.forEach(field => {
        const val = row[field.name] || '';
        const normName = normalize(field.name);
        const isNumeric = field.type === 'numeric' || normName.startsWith('cal') || normName.includes('total') || normName.includes('amount') || field.isVirtual;
        const align = isNumeric ? 'right' : 'center';
        
        let displayVal = val;
        if (field.type === 'date' || field.type === 'time' || field.type === 'datetime') {
          if (field.type === 'date') {
            displayVal = formatDisplayValue(val, 'date');
          } else if (field.type === 'time') {
            displayVal = formatDisplayValue(val, 'time');
          } else {
            // For datetime, format based on user's table time format preference
            displayVal = formatDisplayValue(val, calcShowTimeInTable ? 'datetime' : 'date');
          }
        } else if (isNumeric && val) {
          const num = parseFloat(val);
          if (!isNaN(num)) {
            displayVal = formatIndianNumber(num);
          }
        }
        
        tableRowsHTML += `<td style="border: ${borderStyleCss}; padding: 10px 6px; text-align: ${align}; font-size: 13px; height: 35px; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; max-width: 150px;">${displayVal}</td>`;
      });
      tableRowsHTML += '</tr>';
    });

    // Page-specific table footer rows
    let footerRowsHTML = '';
    if (isLastPage) {
      const hasSecondaryRows = calcIncludeTax || balanceAmount > 0 || paidAmount > 0;
      if (hasSecondaryRows) {
        footerRowsHTML += `
          <tr>
            <td colspan="${colSpan}" style="border: ${borderStyleCss}; padding: 10px 15px; font-weight: bold; text-align: right; font-size: 14px;">Subtotal</td>
            <td style="border: ${borderStyleCss}; padding: 10px 6px; font-weight: bold; text-align: right; font-size: 14px;">${formatIndianNumber(subTotal)}</td>
          </tr>
        `;
      }
      if (calcIncludeTax) {
        footerRowsHTML += `
          <tr>
            <td colspan="${colSpan}" style="border: ${borderStyleCss}; padding: 10px 15px; font-weight: bold; text-align: right; font-size: 14px;">GST (${calcTaxRate}%)</td>
            <td style="border: ${borderStyleCss}; padding: 10px 6px; font-weight: bold; text-align: right; font-size: 14px;">${formatIndianNumber(taxAmount)}</td>
          </tr>
        `;
      }
      if (balanceAmount > 0) {
        footerRowsHTML += `
          <tr>
            <td colspan="${colSpan}" style="border: ${borderStyleCss}; padding: 10px 15px; font-weight: bold; text-align: right; font-size: 14px;">Uncleared Balance</td>
            <td style="border: ${borderStyleCss}; padding: 10px 6px; font-weight: bold; text-align: right; font-size: 14px;">${formatIndianNumber(balanceAmount)}</td>
          </tr>
        `;
      }
      if (paidAmount > 0) {
        const paidLabel = paidDateFormatted ? `Paid (${paidDateFormatted})` : 'Paid';
        footerRowsHTML += `
          <tr>
            <td colspan="${colSpan}" style="border: ${borderStyleCss}; padding: 10px 15px; font-weight: bold; text-align: right; font-size: 14px;">${paidLabel}</td>
            <td style="border: ${borderStyleCss}; padding: 10px 6px; font-weight: bold; text-align: right; font-size: 14px;">${formatIndianNumber(paidAmount)}</td>
          </tr>
        `;
      }
      footerRowsHTML += `
        <tr>
          <td colspan="${colSpan}" style="border: ${borderStyleCss}; padding: 10px 15px; font-weight: bold; text-align: right; font-size: 16px;">Total</td>
          <td style="border: ${borderStyleCss}; padding: 10px 6px; font-weight: bold; text-align: right; font-size: 16px;">${formatIndianNumber(grandTotal)}</td>
        </tr>
      `;
    } else {
      // Multi-page subtotal indicator at the bottom of intermediate tables
      footerRowsHTML += `
        <tr>
          <td colspan="${activeTableFields.length}" style="border: ${borderStyleCss}; padding: 12px; font-weight: bold; text-align: right; font-size: 13px; font-style: italic; background-color: #FDFEFE; letter-spacing: 0.5px; color: #555;">
            Continued on next page...
          </td>
        </tr>
      `;
    }

    pagesHTML += `
      <div class="page-container" style="${isLastPage ? '' : 'page-break-after: always;'}">
        ${pageNumText}
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
                return `<th style="border: ${borderStyleCss}; background-color: ${tableHeaderBg}; color: ${primaryThemeColor}; padding: 10px; font-size: 14px; text-align: center; font-weight: bold; word-wrap: break-word; overflow-wrap: break-word;">${f.label || f.name}</th>`;
              }).join('')}
            </tr>
          </thead>
          <tbody>
            ${tableRowsHTML}
            ${footerRowsHTML}
          </tbody>
        </table>

        ${isLastPage ? `
          <div class="signature">
            Receiver's Signature: <span class="sig-line"></span>
          </div>
        ` : ''}
      </div>
    `;
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page { 
          size: A4;
          margin: 0mm; 
        }
        body { 
          font-family: ${cssFontStack}; 
          color: #000; 
          margin: 0;
          padding: 0;
          background-color: #fff;
        }
        .page-container {
          padding: 15mm 20mm;
          box-sizing: border-box;
          page-break-inside: avoid;
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
          color: ${primaryThemeColor};
        }
        .shop-phone { font-size: 14px; text-align: right; width: 180px; font-weight: bold; }
        .shop-loc { text-align: center; font-size: 14px; margin-top: -5px; font-weight: bold; }
        
        .info-section { display: flex; justify-content: space-between; margin-top: 30px; margin-bottom: 25px; font-size: 16px; }
        .party-info { flex: 1; }
        .date-place { text-align: left; width: 220px; }
        .underline { border-bottom: 1px dotted #000; display: inline-block; min-width: 150px; padding-bottom: 2px; }
        
        .data-table { width: 100%; border-collapse: collapse; margin-bottom: 0px; }
        .data-table th { border: ${borderStyleCss}; padding: 10px; font-size: 14px; text-align: center; font-weight: bold; word-wrap: break-word; overflow-wrap: break-word; }
        .data-table td { border: ${borderStyleCss}; }
        
        .signature { margin-top: 60px; font-size: 15px; page-break-inside: avoid; }
        .sig-line { border-bottom: 1px solid #000; display: inline-block; width: 300px; margin-left: 10px; }
      </style>
    </head>
    <body>
      ${pagesHTML}
    </body>
    </html>
  `;
}

/**
 * Format a number in Indian numbering system (e.g., 5,12,600).
 */
function formatIndianNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  const n = Number(num);
  if (isNaN(n)) return '0';

  const numStr = Number.isInteger(n) ? n.toString() : parseFloat(n.toFixed(2)).toString();
  const parts = numStr.split('.');
  const isNegative = parts[0].startsWith('-');
  const intStr = isNegative ? parts[0].slice(1) : parts[0];

  let result = '';
  let count = 0;
  for (let i = intStr.length - 1; i >= 0; i--) {
    if (count === 3 || (count > 3 && (count - 3) % 2 === 0)) {
      result = ',' + result;
    }
    result = intStr[i] + result;
    count++;
  }

  if (isNegative) result = '-' + result;

  if (parts.length > 1 && parts[1]) {
    result = `${result}.${parts[1]}`;
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
