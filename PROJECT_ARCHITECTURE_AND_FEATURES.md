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
| **Product Landing Page** | `/` | Public Access | • Showcases business capabilities, modules, and platform highlights<br/>• Quick action buttons to Register Business, Access Portals, or Admin Tower |
| **Admin Control Tower** | `/admin-portal` | Master PIN (`admin123`) | • Onboard new Quarry Owners<br/>• **Pending Business Approvals**: Approve (`status: active`) or Reject registrations<br/>• Issue temporary unlock passwords (`resetQuarryPassword`) & trigger notification emails<br/>• Platform metrics & quarry management |
| **Quarry Owner Portal** | `/(tabs)` & `/quarry` | Phone + Password | • Create bills using custom Word (`.docx`) templates<br/>• Auto sequential bill numbering (`0001`, `0002`...)<br/>• Auto line-item pricing per unit<br/>• **Auto-Resume & Minimized Taskbar**: Minimize active drafts to a Windows-style bottom pill (`[ 📄 Bill #0001 - Party Name (Minimized) ✖ ]`) isolated per quarry<br/>• Material catalog default rates<br/>• Customer Directory, Ledger & Dues<br/>• Payment Reminders & WhatsApp notifications<br/>• Live Customer Chats & negotiation<br/>• Assign drivers & attach legal **eWay Bills / Gate Passes** |
| **Transport & Driver Portal** | `/driver-portal` | Phone + Password (`9876543210` / `driver123`) | • View assigned pickup and delivery trips<br/>• Google Maps 1-tap navigation to quarry & delivery sites<br/>• **Per-Kilometer Rate Card** (Rate/km, Min charge, Loading charge, Waiting charge)<br/>• **Legal Transport Docs Viewer** (eWay Bill / Delivery Challan attached by Quarry Owner)<br/>• Delivery status updates (Reached Quarry, Loaded, Delivered) |
| **Customer Marketplace** | `/customer-marketplace` | Mobile Number | • Browse live material catalogs across all registered quarries<br/>• Price search & comparison (River Sand, M-Sand, Blue Metal...)<br/>• Submit formal material rate enquiries<br/>• **Live Chat / Negotiation Window** with Quarry Owners |

---

## 📧 3. SMTP Email Notification Service (`src/services/emailService.ts`)

- **SMTP Sender**: `rightsight365@gmail.com` via `smtp.gmail.com:465`.
- **Admin Recipient**: `sarangan365@gmail.com` / Mobile: `1234567890`.
- **Email Triggers**:
  1. `sendOnboardingEmail`: Sent upon quarry registration (`pending_approval`) and Admin approval (`active`).
  2. `sendPasswordResetEmail`: Sent when Admin generates a temporary password for a quarry owner.
  3. `sendBillInvoiceEmail`: Dispatches bill summary and total amount to customer email addresses.

---

## 💾 4. Data Storage & Schema Architecture

All data operations are handled by `src/database/db.js`.

### Global Storage Keys
- `bf_admin`: Admin configuration `{ pin: 'admin123' }`
- `bf_quarries`: Array of registered quarry profiles `[{ id, name, owner_name, phone, email, password, address, location, status, created_at }]`
- `bf_drivers`: Global driver pool `[{ id, name, phone, vehicle_no, password, status, quarry_id, created_at }]`
- `bf_customers`: Global customer registry `[{ id, name, phone, created_at }]`
- `bf_user_session`: Active user session `{ role, quarry_id, id, name, phone }`

### Quarry-Scoped Storage Keys (`bf_quarry_${quarryId}_*`)
- `bf_quarry_${qid}_bills`: Bills list
- `bf_quarry_${qid}_materials`: Material catalog
- `bf_quarry_${qid}_customers`: Customer directory
- `bf_quarry_${qid}_payments`: Payments recorded
- `bf_quarry_${qid}_reminders`: Payment reminders
- `bf_quarry_${qid}_enquiries`: Material enquiries
- `bf_quarry_${qid}_consignments`: Delivery trips
- `bf_quarry_${qid}_templates`: Bill templates
- `bf_quarry_${qid}_draft_${templateId}`: Unsaved bill draft data (`{ headerData, rowData, isMinimized: true, lastSaved }`)

---

## 🛠️ 5. Verification & CLI Commands

```bash
# Type-check TypeScript codebase
npx tsc --noEmit

# Run application locally on web
npx expo start --web

# Build static bundle for Vercel deployment
npx expo export -p web
```
