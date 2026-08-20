# BillForge — Multi-Quarry Operations, Billing & Supply Chain Platform

Complete architectural specification, data schemas, role-based portal endpoints, and feature guide for **BillForge**.

---

## 📌 1. System Overview

BillForge is a serverless, multi-tenant operations and supply chain management system designed for quarry owners, transport drivers, customers, and platform administrators.

- **Architecture**: 100% Serverless & Client-Side Powered (`expo-sqlite` on native / `localStorage` fallback on Web). Zero backend server or API dependencies.
- **Multi-Tenancy**: Data is strictly isolated per quarry using a deterministic keying structure (`bf_quarry_${quarryId}_*`).

---

## 🔐 2. Role-Based Portals & Endpoints

| Portal | Route | Auth Credentials | Core Responsibilities & Functionalities |
|--------|-------|------------------|-----------------------------------------|
| **Admin Control Tower** | `/admin-portal` | Master PIN (`admin123`) | • Onboard new Quarry Owners<br/>• Issue temporary unlock passwords (`resetQuarryPassword`) for lost accounts<br/>• Platform metrics (total quarries, drivers, active outlets)<br/>• Switch into any quarry for audit/impersonation |
| **Quarry Owner Portal** | `/(tabs)` & `/quarry` | Phone + Password | • Create bills using custom Word (`.docx`) templates<br/>• Auto sequential bill numbering (`0001`, `0002`...)<br/>• Auto line-item pricing per unit<br/>• Auto-recorded unsaved drafts with **Resume Draft** prompt<br/>• Material catalog default rates<br/>• Customer Directory, Ledger & Payment Dues<br/>• Payment Reminders & WhatsApp notifications<br/>• Receive & reply to Live Customer Chats<br/>• Assign transport drivers & attach legal **eWay Bills / Gate Passes** |
| **Transport & Driver Portal** | `/driver-portal` | Phone + Password (`9876543210` / `driver123`) | • View assigned pickup and delivery trips<br/>• Google Maps 1-tap navigation to quarry & delivery sites<br/>• **Per-Kilometer Rate Card** (Rate/km, Min charge, Loading charge, Waiting charge)<br/>• **Legal Transport Docs Viewer** (eWay Bill / Delivery Challan attached by Quarry Owner)<br/>• Delivery status updates (Reached Quarry, Loaded, Delivered) |
| **Customer Marketplace** | `/customer-marketplace` | Mobile Number | • Browse live material catalogs across all registered quarries<br/>• Price search & comparison (River Sand, M-Sand, Blue Metal...)<br/>• Submit formal material rate enquiries<br/>• **Live Chat / Negotiation Window** with Quarry Owners |

---

## 💾 3. Data Storage & Schema Architecture

All data operations are handled by `src/database/db.js`.

### Global Storage Keys
- `bf_admin`: Admin configuration `{ pin: 'admin123' }`
- `bf_quarries`: Array of registered quarry profiles `[{ id, name, owner_name, phone, password, address, location, status, created_at }]`
- `bf_drivers`: Global driver pool `[{ id, name, phone, vehicle_no, password, status, quarry_id, created_at }]`
- `bf_customers`: Global customer registry `[{ id, name, phone, created_at }]`
- `bf_user_session`: Active user session `{ role, quarry_id, id, name, phone }`

### Quarry-Scoped Storage Keys (`bf_quarry_${quarryId}_*`)
- `bf_quarry_${qid}_bills`: Bills list `[{ id, template_id, bill_number, customer_name, header_data_json, row_data_json, total_amount, pdf_uri, created_at }]`
- `bf_quarry_${qid}_materials`: Material catalog `[{ id, name, price_per_unit, unit_type, created_at }]`
- `bf_quarry_${qid}_customers`: Customer directory `[{ id, name, phone, address, created_at }]`
- `bf_quarry_${qid}_payments`: Payments recorded `[{ id, bill_id, customer_name, amount, note, paid_at }]`
- `bf_quarry_${qid}_reminders`: Payment reminders `[{ id, bill_id, customer_name, promised_amount, promised_date, status }]`
- `bf_quarry_${qid}_enquiries`: Material enquiries `[{ id, customer_name, customer_phone, material_name, quantity, unit_type, quoted_rate, status, pickup_address, customer_address }]`
- `bf_quarry_${qid}_consignments`: Delivery trips `[{ id, enquiry_id, driver_id, driver_name, customer_name, customer_phone, material_name, quantity, unit_type, agreed_rate, pickup_address, customer_address, status }]`
- `bf_quarry_${qid}_templates`: Bill templates `[{ id, name, file_base64, header_fields_json, table_fields_json, all_fields_json }]`
- `bf_quarry_${qid}_drafts_${templateId}`: Unsaved bill draft data

### Feature-Specific Storage Keys
- `bf_chat_${quarryId}_${customerPhone}`: Chat messages `[{ id, quarry_id, customer_phone, sender, sender_name, text, timestamp }]`
- `bf_quarry_${quarryId}_chats_index`: Active chats index `[{ customer_phone, customer_name, last_updated }]`
- `bf_driver_rate_${driverId}`: Driver rate card `{ rate_per_km, min_charge, loading_charge, waiting_charge_per_hr }`
- `bf_quarry_${quarryId}_docs_${consignmentId}`: Legal transport documents `[{ id, consignment_id, doc_name, doc_type, doc_content, created_at }]`

---

## 🎨 4. Layout & UI Deduplication System

- **Desktop Web Sidebar** (`src/components/SidebarNav.tsx`):
  - Renders a clean left panel on Web (`Platform.OS === 'web'`).
  - Hides automatically on full-page portal routes (`/select-role`, `/admin-portal`, `/owner-login`, `/driver-login`, `/customer-login`, `/customer-marketplace`, `/driver-portal`).
- **Bottom Navigation Bar**:
  - Configured with `tabBarStyle: Platform.OS === 'web' ? { display: 'none' } : ...` in `app/(tabs)/_layout.tsx`.
  - Prevents duplicate tab bar rendering below the left sidebar on Web browsers.
- **Button Animation & Double-Submit Protection**:
  - All Save, Submit, Login, Register, and Edit buttons feature `ActivityIndicator` spinners and `disabled={saving}` click-blocking to prevent double submissions.

---

## ⌨️ 5. Keyboard Shortcuts for Billing (`/bill-form/[templateId]`)

- `Ctrl + S`: Save & Generate Bill
- `Alt + N`: Add New Line Item Row
- `Alt + P`: Open PDF Preview

---

## 🛠️ 6. Verification & CLI Commands

```bash
# Type-check TypeScript codebase
npx tsc --noEmit

# Run application locally on web
npx expo start --web

# Build static bundle for Vercel deployment
npx expo export -p web
```
