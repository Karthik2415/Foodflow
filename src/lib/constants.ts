import type { UserRole } from '@/lib/types';

// ===== Application Constants =====

export const APP_NAME = 'FoodFlow';
export const APP_DESCRIPTION = 'Order-to-Audit Management Platform';
export const COMPANY_NAME = 'FoodFlow Foods Pvt. Ltd.';
export const FACTORY_STATE = 'Tamil Nadu';

// ===== Company Details (Default Settings) =====
export const DEFAULT_SETTINGS = {
  companyName: COMPANY_NAME,
  companyGstin: '33AABCF1234Q1ZV',
  companyPan: 'AABCF1234Q',
  companyAddress: {
    line1: '42, Industrial Estate',
    line2: 'Ambattur',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600058',
  },
  companyPhone: '+91 44 2636 1234',
  companyEmail: 'info@foodflow.in',
  factoryState: FACTORY_STATE,
  financialYearStart: 4, // April
  invoicePrefix: 'FF',
  nextInvoiceSerial: 1,
  gstRates: [0, 5, 12, 18, 28],
  defaultGstRate: 5,
};

// ===== Navigation =====
export const NAV_ITEMS = {
  owner: [
    { label: 'Overview', href: '/dashboard', icon: 'LayoutDashboard' },
    { label: 'Sales & Orders', href: '/dashboard/sales', icon: 'ShoppingCart' },
    { label: 'Customers', href: '/dashboard/customers', icon: 'Users' },
    { label: 'Products', href: '/dashboard/products', icon: 'Package' },
    { label: 'Inventory', href: '/dashboard/inventory', icon: 'Warehouse' },
    { label: 'Production', href: '/dashboard/production', icon: 'Factory' },
    { label: 'Purchases', href: '/dashboard/purchases', icon: 'PackagePlus' },
    { label: 'Invoices', href: '/dashboard/invoices', icon: 'FileText' },
    { label: 'Payments', href: '/dashboard/payments', icon: 'IndianRupee' },
    { label: 'Costing', href: '/dashboard/costing', icon: 'Calculator' },
    { label: 'Reports', href: '/dashboard/reports', icon: 'BarChart3' },
    { label: 'Audit Trail', href: '/dashboard/audit', icon: 'Shield' },
    { label: 'Settings', href: '/dashboard/settings', icon: 'Settings' },
  ],
  admin: [
    { label: 'Overview', href: '/dashboard', icon: 'LayoutDashboard' },
    { label: 'Sales & Orders', href: '/dashboard/sales', icon: 'ShoppingCart' },
    { label: 'Customers', href: '/dashboard/customers', icon: 'Users' },
    { label: 'Products', href: '/dashboard/products', icon: 'Package' },
    { label: 'Inventory', href: '/dashboard/inventory', icon: 'Warehouse' },
    { label: 'Production', href: '/dashboard/production', icon: 'Factory' },
    { label: 'Purchases', href: '/dashboard/purchases', icon: 'PackagePlus' },
    { label: 'Invoices', href: '/dashboard/invoices', icon: 'FileText' },
    { label: 'Payments', href: '/dashboard/payments', icon: 'IndianRupee' },
  ],
  salesman: [
    { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
    { label: 'Sales & Orders', href: '/dashboard/sales', icon: 'ShoppingCart' },
    { label: 'Customers', href: '/dashboard/customers', icon: 'Users' },
    { label: 'Products', href: '/dashboard/products', icon: 'Package' },
  ],
  production_supervisor: [
    { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
    { label: 'Production & BOM', href: '/dashboard/production', icon: 'Factory' },
    { label: 'Products', href: '/dashboard/products', icon: 'Package' },
    { label: 'Materials', href: '/dashboard/inventory', icon: 'Warehouse' },
  ],
  accountant: [
    { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
    { label: 'Invoices', href: '/dashboard/invoices', icon: 'FileText' },
    { label: 'Payments', href: '/dashboard/payments', icon: 'IndianRupee' },
    { label: 'Costing', href: '/dashboard/costing', icon: 'Calculator' },
    { label: 'Reports', href: '/dashboard/reports', icon: 'BarChart3' },
    { label: 'Audit Trail', href: '/dashboard/audit', icon: 'Shield' },
  ],
} as const;

export interface NavItemConfig {
  label: string;
  href: string;
  icon: string;
  roles: UserRole[];
}

export interface NavGroupConfig {
  id: string;
  label: string;
  items: NavItemConfig[];
}

export const NAV_GROUPS: NavGroupConfig[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      { label: 'Overview', href: '/dashboard', icon: 'LayoutDashboard', roles: ['owner', 'admin', 'salesman', 'production_supervisor', 'accountant'] },
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    items: [
      { label: 'Orders', href: '/dashboard/sales', icon: 'ShoppingCart', roles: ['owner', 'admin', 'salesman'] },
      { label: 'Customers', href: '/dashboard/customers', icon: 'Users', roles: ['owner', 'admin', 'salesman', 'accountant'] },
      { label: 'Invoices', href: '/dashboard/invoices', icon: 'FileText', roles: ['owner', 'admin', 'accountant'] },
      { label: 'Payments', href: '/dashboard/payments', icon: 'IndianRupee', roles: ['owner', 'admin', 'accountant'] },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { label: 'Production & BOM', href: '/dashboard/production', icon: 'Factory', roles: ['owner', 'admin', 'production_supervisor'] },
      { label: 'Purchases & Suppliers', href: '/dashboard/purchases', icon: 'PackagePlus', roles: ['owner', 'admin', 'production_supervisor', 'accountant'] },
      { label: 'Inventory & Stock Ledger', href: '/dashboard/inventory', icon: 'Warehouse', roles: ['owner', 'admin', 'production_supervisor', 'accountant'] },
    ],
  },
  {
    id: 'masters',
    label: 'Masters',
    items: [
      { label: 'Products & HSN', href: '/dashboard/products', icon: 'Package', roles: ['owner', 'admin', 'salesman', 'production_supervisor'] },
      { label: 'Raw Materials', href: '/dashboard/inventory?tab=raw', icon: 'ClipboardList', roles: ['owner', 'admin', 'production_supervisor'] },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    items: [
      { label: 'Costing & Profitability', href: '/dashboard/costing', icon: 'Calculator', roles: ['owner', 'accountant', 'production_supervisor'] },
      { label: 'Reports', href: '/dashboard/reports', icon: 'BarChart3', roles: ['owner', 'admin', 'accountant'] },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    items: [
      { label: 'Audit Trail', href: '/dashboard/audit', icon: 'Shield', roles: ['owner', 'admin', 'accountant'] },
      { label: 'Settings', href: '/dashboard/settings', icon: 'Settings', roles: ['owner', 'admin'] },
    ],
  },
];

// ===== Order Statuses =====
export const ORDER_STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-surface-200 text-surface-700', dotColor: 'bg-surface-400' },
  submitted: { label: 'Submitted', color: 'bg-info-100 text-info-700', dotColor: 'bg-info-500' },
  under_review: { label: 'Under Review', color: 'bg-warning-100 text-warning-700', dotColor: 'bg-warning-500' },
  approved: { label: 'Approved', color: 'bg-success-100 text-success-700', dotColor: 'bg-success-500' },
  rejected: { label: 'Rejected', color: 'bg-error-100 text-error-700', dotColor: 'bg-error-500' },
  cancelled: { label: 'Cancelled', color: 'bg-surface-200 text-surface-600', dotColor: 'bg-surface-500' },
  invoiced: { label: 'Ready to Dispatch', color: 'bg-primary-100 text-primary-700', dotColor: 'bg-primary-500' },
  dispatched: { label: 'Dispatched', color: 'bg-success-100 text-success-700', dotColor: 'bg-success-500' },
  completed: { label: 'Completed', color: 'bg-success-50 text-success-800', dotColor: 'bg-success-600' },
} as const;

// ===== Production Statuses =====
export const PRODUCTION_STATUS_CONFIG = {
  planned: { label: 'Planned', color: 'bg-info-100 text-info-700' },
  in_progress: { label: 'In Progress', color: 'bg-warning-100 text-warning-700' },
  completed: { label: 'Completed', color: 'bg-success-100 text-success-700' },
  cancelled: { label: 'Cancelled', color: 'bg-error-100 text-error-700' },
} as const;

// ===== Invoice Statuses =====
export const INVOICE_STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-surface-200 text-surface-700' },
  posted: { label: 'Posted', color: 'bg-success-100 text-success-700' },
  cancelled: { label: 'Cancelled', color: 'bg-error-100 text-error-700' },
} as const;

