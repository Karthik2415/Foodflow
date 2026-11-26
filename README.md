<p align="center">
  <img src="public/logo.png" alt="FoodFlow Enterprise ERP" width="320" />
</p>

<h1 align="center">FoodFlow — Order-to-Audit Enterprise ERP</h1>

<p align="center">
  End-to-end manufacturing, inventory, GST invoicing, and financial management platform built for packaged food manufacturers.
</p>

<p align="center">
  <strong>Live App:</strong> <a href="https://foodflow-gamma.vercel.app">https://foodflow-gamma.vercel.app</a>
</p>

---

## Overview

**FoodFlow** is a full-stack **Order-to-Audit ERP** built with **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS v4**, and **Firebase** (Authentication, Cloud Firestore, and Cloud Functions), integrated with a **Gemini AI ERP Assistant**.

It unifies field sales capture, warehouse stock control, Bill of Materials (BOM) production, GST-compliant invoicing, payment reconciliation, batch costing, and immutable audit logging in a single real-time platform.

---

## Important Details of the Project

| Aspect | Implementation Detail |
| --- | --- |
| **Financial Precision** | All monetary values are stored and calculated in **integer paise** (`1 ₹ = 100 paise`) to eliminate floating-point rounding errors. |
| **Quantity Precision** | Stock and BOM quantities use **scaled integers (`×1000`)** so fractional raw materials (e.g., `0.25 kg` spices) remain exact. |
| **Inventory Valuation** | Real-time **Weighted Average Rate** updated atomically on every Purchase Receipt and Production Completion. |
| **Source of Truth** | **Append-only immutable Stock Ledger** (`allow update, delete: if false` in Firestore Rules) with one-click balance reconciliation. |
| **GST Compliance** | Automatic **CGST + SGST** (intra-state) vs. **IGST** (inter-state) calculation based on customer state vs. factory state, with HSN codes. |
| **Atomic Operations** | Sales dispatch, material issue, production completion, and purchase receipts execute inside **Firestore Transactions**. |
| **Security & RBAC** | 5 roles (`Owner`, `Admin`, `Salesman`, `Production Supervisor`, `Accountant`) enforced in UI routes and `firestore.rules` (dashboard role switching disabled in live mode). |
| **Deletion Safety Guards** | Prevents deleting products with stock `> 0`, customers with outstanding balances, in-progress/completed production runs, or invoiced/dispatched orders. |
| **Product Media** | Client-side image compression (`max 480px` JPEG) stored with products and rendered across Sales, Inventory, Production, Invoices, Costing, and Reports. |
| **AI ERP Assistant** | Server-side `/api/chat` Gemini integration with role-aware ERP context and persistent `localStorage` chat history. |
| **Offline / Demo Support** | Runs on live Firebase when configured, or falls back automatically to **Local Demo Mode** (`localStorage`) when Firebase env vars are absent. |

---

## Problems Overcome

1. **Disconnected Spreadsheets & Delayed Order Visibility**
   - *Before:* Salesmen booked orders on WhatsApp/paper without knowing warehouse stock, causing fulfillment delays.
   - *Solved:* Live stock availability checks run during order creation and flag exact packet shortages immediately.

2. **Floating-Point Rounding Mismatches in Accounting & Inventory**
   - *Before:* Decimal math in JS/spreadsheets caused ₹0.01–₹1.00 GST and ledger discrepancies.
   - *Solved:* Integer paise accounting and `×1000` scaled quantities guarantee deterministic totals.

3. **Unaccounted Raw Material Loss & Unknown Batch Cost**
   - *Before:* Factories could not easily compare standard BOM recipes against actual shop-floor consumption or damaged pouches.
   - *Solved:* Material Issue vs. Good Output & Packaging Loss tracking computes **Yield Variance %** and **Cost per Packet** (including overheads).

4. **Silent Stock Tampering & Broken Audit Trails**
   - *Before:* Editable stock sheets made it hard to trace why inventory numbers changed.
   - *Solved:* Every stock movement appends an immutable `stockLedger` entry, and posted invoices/receipts cannot be deleted.

5. **Accidental Deletion of Active Business Records**
   - *Before:* Deleting a product or customer mid-cycle could corrupt invoices or balances.
   - *Solved:* Context-aware delete guards block unsafe deletions while allowing clean removal of unused drafts, planned runs, and zero-stock items.

6. **Unauthorized Role Escalation**
   - *Before:* Dashboard-level role switchers allowed users to view or alter restricted modules.
   - *Solved:* Removed runtime role switching in live mode and locked `users/{userId}` role updates in `firestore.rules`.

---

## Comparison: Manual Workflow vs. FoodFlow ERP

| Area | Traditional / Manual (Excel + Tally + Paper) | FoodFlow ERP |
| --- | --- | --- |
| **Order-to-Dispatch** | Manual phone/WhatsApp checks across teams | Single workflow: Draft → Submitted → Review → Approved → Invoiced → Dispatched |
| **Stock Verification** | Checked manually after order is received | Instant stock check & shortage calculation during order entry |
| **BOM & Production** | Static recipe sheets; manual stock deduction | Auto-scaled BOM quantities, atomic material issue, and finished-goods credit |
| **Costing & Yield** | Estimated monthly; variance rarely tracked per batch | Per-batch Material Cost, Overhead absorption, Unit Cost, and Yield Variance % |
| **GST Calculation** | Manual CGST/SGST vs. IGST selection | Automated by comparing Customer State against Factory State |
| **Audit & Compliance** | Mutable spreadsheets; easy to overwrite history | Immutable Stock Ledger, Purchase Receipts, Invoices, and Audit Logs |
| **Data Access Control** | Shared files with all-or-nothing access | 5-role RBAC across navigation, actions, and Firestore Security Rules |
| **Reporting & Insights** | Hours of manual pivot tables | Live KPIs, Recharts analytics, CSV export, Print/PDF, and AI Q&A |

---

## Key Advantages

- **Zero-Setup Cloud Architecture:** Serverless Next.js + Firebase stack with real-time Firestore listeners—no separate backend server to maintain.
- **End-to-End Traceability:** Every finished packet can be traced back to its production batch, issued raw materials, purchase receipts, and sales invoice.
- **Fast Field Adoption:** Clean, responsive UI with product thumbnails, `⌘K` / `Ctrl+K` quick command palette, and mobile drawer navigation.
- **Built-in AI Operations Assistant:** Non-technical staff can ask natural-language questions about orders, stock, and production directly inside the dashboard.

---

## Tech Stack

- **Frontend:** Next.js 16 (`App Router`, Turbopack), React 19, TypeScript, Tailwind CSS v4, Framer Motion, Lucide React, Recharts
- **Backend & Database:** Firebase Authentication, Cloud Firestore, Firebase Cloud Functions
- **AI:** Google Gemini API (`/api/chat`)
- **Hosting:** Vercel ([https://foodflow-gamma.vercel.app](https://foodflow-gamma.vercel.app))

---

## Project Structure

```text
├── public/                 # App logo, favicon, and PWA icons
├── functions/              # Firebase Cloud Functions
├── src/
│   ├── app/
│   │   ├── api/chat/       # Server-side Gemini AI chat route
│   │   ├── dashboard/      # ERP modules (sales, production, inventory, invoices, etc.)
│   │   └── login/          # Login & user registration
│   ├── components/
│   │   ├── chatbot/        # Floating AI ERP Assistant
│   │   ├── layout/         # AppShell, sidebar, command palette (⌘K / Ctrl+K)
│   │   └── ui/             # Reusable UI primitives & ProductThumbnail
│   └── lib/
│       ├── auth/           # Firebase Auth & RBAC context (with Demo Mode fallback)
│       ├── firebase/       # Firebase client initialization
│       └── store/          # Firestore real-time listeners & transactional ERP actions
└── firestore.rules         # Role-based Firestore security rules
```

---

## Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/Karthik2415/Foodflow.git
cd Foodflow
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and add your Firebase credentials:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Optional: Server-side Gemini API key for the AI Assistant
GEMINI_API_KEY=
```

### 3. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Build & Deploy

```bash
npm run build
npm run start
```

Deploy Firestore security rules:

```bash
firebase deploy --only firestore:rules
```

---

## License

ISC
