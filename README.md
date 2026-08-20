# BillForge — Multi-Quarry Operations, Customized Billing & Supply Chain Platform

BillForge is a 100% serverless multi-tenant platform for quarry operations, custom Word (`.docx`) template billing, customer marketplace & negotiation chat, and transport lorry dispatch management.

Complete architectural specifications, data schemas, role endpoints, and feature guides are documented in [PROJECT_ARCHITECTURE_AND_FEATURES.md](./PROJECT_ARCHITECTURE_AND_FEATURES.md).

---

## 🚀 Quick Start

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Web Local Server**:
   ```bash
   npx expo start --web
   ```

3. **Verify Type Check**:
   ```bash
   npx tsc --noEmit
   ```

---

## 🔑 Portals & Roles Overview

1. **Admin Control Tower** (`/admin-portal`): PIN `admin123`
   - Quarry Owner Onboarding, Temporary Password Reset, Platform Stats.

2. **Quarry Owner Portal** (`/(tabs)` & `/quarry`): Demo `9999999999` / `admin123`
   - Customized Word Template Billing, Auto Serial Numbers, Draft Auto-Resume, Material Catalogs, Dues Ledger, Customer Live Chat, Transport Driver Assignment & eWay Bill Attachments.

3. **Transport Driver Portal** (`/driver-portal`): Demo `9876543210` / `driver123`
   - Pickup & Delivery Trip Management, Google Maps Navigation, Driver Per-Kilometer Rate Card, Legal Transport Documents (eWay Bill / Challan) Viewer.

4. **Customer Marketplace** (`/customer-marketplace`):
   - Cross-Quarry Catalog Search & Live Pricing, Material Enquiries, Live Negotiating Chat Window with Quarry Owners.

---

For detailed documentation, see [PROJECT_ARCHITECTURE_AND_FEATURES.md](./PROJECT_ARCHITECTURE_AND_FEATURES.md).
