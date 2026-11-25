// ===== Core Entity Types =====
// All monetary values in paise (integer). Quantities in scaled integers (×1000).

import type { Timestamp } from 'firebase/firestore';

// ===== User & Auth =====
export type UserRole = 'owner' | 'admin' | 'salesman' | 'production_supervisor' | 'accountant';

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  phone?: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ===== Customer =====
export interface Customer {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  gstin?: string;
  panNumber?: string;
  billingAddress: Address;
  shippingAddress?: Address;
  state: string; // For GST interstate detection
  customerType: 'retailer' | 'distributor' | 'wholesale';
  assignedSalesmanId?: string;
  creditLimitPaise: number;
  outstandingPaise: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}

// ===== Products =====
export interface Product {
  id: string;
  name: string;
  code: string;
  category: string;
  description?: string;
  unitId: string;
  unitName: string;
  weightGrams: number; // e.g. 200 for 200g packet
  hsnCode: string;
  gstRatePercent: number; // e.g. 5
  sellingPricePaise: number; // per unit, before GST
  mrpPaise: number;
  imageUrl?: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ===== Raw Materials & Packaging =====
export type MaterialType = 'raw_material' | 'packaging_material';

export interface Material {
  id: string;
  name: string;
  code: string;
  type: MaterialType;
  unitId: string;
  unitName: string;
  currentRatePaise: number; // weighted average cost in paise per unit
  reorderLevel: number; // scaled quantity
  currentStock: number; // scaled quantity
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ===== Units =====
export interface Unit {
  id: string;
  name: string;
  abbreviation: string;
  type: 'weight' | 'volume' | 'count' | 'length';
}

// ===== BOM (Bill of Materials) =====
export interface BOMHeader {
  id: string;
  productId: string;
  productName: string;
  batchSize: number; // number of finished packets per batch
  version: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface BOMItem {
  id: string;
  bomHeaderId: string;
  materialId: string;
  materialName: string;
  materialUnit: string;
  standardQuantity: number; // scaled quantity for the batch
  sortOrder: number;
}

// ===== Supplier =====
export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  gstin?: string;
  address: Address;
  materials: string[]; // material IDs they supply
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ===== Purchase Orders =====
export type PurchaseOrderStatus = 'draft' | 'submitted' | 'received' | 'cancelled';

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  items: PurchaseOrderItem[];
  totalAmountPaise: number;
  notes?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PurchaseOrderItem {
  materialId: string;
  materialName: string;
  materialUnit: string;
  quantity: number; // scaled
  ratePaise: number; // per unit in paise
  amountPaise: number;
}

// ===== Purchase Receipts =====
export interface PurchaseReceipt {
  id: string;
  receiptNumber: string;
  purchaseOrderId?: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseReceiptItem[];
  totalAmountPaise: number;
  invoiceNumber?: string;
  invoiceDate?: Timestamp;
  notes?: string;
  idempotencyKey: string;
  createdBy: string;
  createdAt: Timestamp;
}

export interface PurchaseReceiptItem {
  materialId: string;
  materialName: string;
  materialUnit: string;
  quantity: number; // scaled
  ratePaise: number;
  amountPaise: number;
}

// ===== Sales Orders =====
export type SalesOrderStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'invoiced'
  | 'dispatched'
  | 'completed';

export interface SalesOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerState: string;
  salesmanId: string;
  salesmanName: string;
  status: SalesOrderStatus;
  items: SalesOrderItem[];
  totalAmountPaise: number;
  taxableAmountPaise: number;
  gstAmountPaise: number;
  grandTotalPaise: number;
  rejectionReason?: string;
  notes?: string;
  hasStockShortage: boolean;
  shortageDetails?: StockShortage[];
  offlineCreated?: boolean;
  idempotencyKey: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SalesOrderItem {
  productId: string;
  productName: string;
  productCode: string;
  quantity: number; // scaled
  unitPricePaise: number;
  gstRatePercent: number;
  amountPaise: number;
  availableStock?: number;
}

export interface StockShortage {
  productId: string;
  productName: string;
  requested: number;
  available: number;
  shortage: number;
}

// ===== Invoices =====
export type InvoiceStatus = 'draft' | 'posted' | 'cancelled';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  salesOrderId: string;
  customerId: string;
  customerName: string;
  customerGstin?: string;
  customerAddress: Address;
  sellerGstin: string;
  sellerAddress: Address;
  isInterstate: boolean;
  items: InvoiceItem[];
  taxableAmountPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  grandTotalPaise: number;
  grandTotalRounded: number;
  status: InvoiceStatus;
  pdfUrl?: string;
  idempotencyKey: string;
  financialYear: string;
  invoiceDate: Timestamp;
  createdBy: string;
  createdAt: Timestamp;
  cancelledAt?: Timestamp;
  cancelledBy?: string;
  cancellationReason?: string;
}

export interface InvoiceItem {
  productId: string;
  productName: string;
  hsnCode: string;
  quantity: number;
  unitPricePaise: number;
  taxableAmountPaise: number;
  gstRatePercent: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
}

// ===== Dispatch =====
export interface Dispatch {
  id: string;
  dispatchNumber: string;
  salesOrderId: string;
  invoiceId: string;
  customerId: string;
  customerName: string;
  items: DispatchItem[];
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  notes?: string;
  idempotencyKey: string;
  dispatchedBy: string;
  dispatchedAt: Timestamp;
}

export interface DispatchItem {
  productId: string;
  productName: string;
  quantity: number;
}

// ===== Production =====
export type ProductionRunStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export interface ProductionRun {
  id: string;
  runNumber: string;
  productId: string;
  productName: string;
  bomHeaderId: string;
  batchSize: number;
  status: ProductionRunStatus;
  plannedMaterials: ProductionMaterial[];
  actualMaterials: ProductionMaterial[];
  goodOutput: number; // scaled qty — good packets
  rejectedOutput: number;
  damagedPackaging: number;
  wastageNotes?: string;
  yieldVariancePercent?: number;
  totalMaterialCostPaise?: number;
  labourCostPaise?: number;
  overheadCostPaise?: number;
  totalProductionCostPaise?: number;
  costPerGoodPacketPaise?: number;
  idempotencyKey: string;
  createdBy: string;
  completedBy?: string;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ProductionMaterial {
  materialId: string;
  materialName: string;
  materialUnit: string;
  quantity: number; // scaled
  ratePaise?: number;
  amountPaise?: number;
}

// ===== Inventory =====
export type StockMovementType =
  | 'opening_balance'
  | 'purchase_receipt'
  | 'production_issue'
  | 'production_receipt'
  | 'sales_dispatch'
  | 'adjustment_in'
  | 'adjustment_out'
  | 'wastage';

export interface StockLedgerEntry {
  id: string;
  itemId: string;
  itemName: string;
  itemType: 'raw_material' | 'packaging_material' | 'finished_good';
  movementType: StockMovementType;
  quantityIn: number; // scaled
  quantityOut: number; // scaled
  previousBalance: number; // scaled
  newBalance: number; // scaled
  ratePaise?: number;
  valuePaise?: number;
  sourceDocumentId: string;
  sourceDocumentType: string;
  userId: string;
  remarks?: string;
  timestamp: Timestamp;
}

export interface InventoryBalance {
  id: string; // same as itemId
  itemId: string;
  itemName: string;
  itemType: 'raw_material' | 'packaging_material' | 'finished_good';
  currentStock: number; // scaled
  unitName: string;
  weightedAvgRatePaise: number;
  valuePaise: number;
  reorderLevel: number;
  isLowStock: boolean;
  lastMovementAt?: Timestamp;
  updatedAt: Timestamp;
}

// ===== Payments =====
export type PaymentMode = 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other';

export interface Payment {
  id: string;
  paymentNumber: string;
  customerId: string;
  customerName: string;
  amountPaise: number;
  paymentMode: PaymentMode;
  referenceNumber?: string;
  notes?: string;
  allocations: PaymentAllocation[];
  unallocatedPaise: number;
  idempotencyKey: string;
  receivedBy: string;
  paymentDate: Timestamp;
  createdAt: Timestamp;
}

export interface PaymentAllocation {
  invoiceId: string;
  invoiceNumber: string;
  allocatedPaise: number;
}

// ===== Expenses & Costing =====
export type ExpenseCategory = 'labour' | 'gas_power' | 'transport' | 'maintenance' | 'other';

export interface Expense {
  id: string;
  category: ExpenseCategory;
  description: string;
  amountPaise: number;
  productionRunId?: string;
  date: Timestamp;
  createdBy: string;
  createdAt: Timestamp;
}

export interface ProductionCost {
  productionRunId: string;
  materialCostPaise: number;
  labourCostPaise: number;
  overheadCostPaise: number;
  totalCostPaise: number;
  goodPackets: number;
  costPerPacketPaise: number;
  sellingPricePaise: number;
  grossContributionPaise: number;
  grossMarginPercent: number;
}

// ===== Notifications =====
export type NotificationType =
  | 'new_order'
  | 'order_approved'
  | 'order_rejected'
  | 'low_stock'
  | 'production_complete'
  | 'payment_received'
  | 'dispatch_confirmed'
  | 'payment_reminder';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  recipientId: string;
  recipientRole?: UserRole;
  isRead: boolean;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
}

// ===== Audit Log =====
export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  userName: string;
  changes?: Record<string, { before: unknown; after: unknown }>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  timestamp: Timestamp;
}

// ===== Settings =====
export interface AppSettings {
  companyName: string;
  companyGstin: string;
  companyPan: string;
  companyAddress: Address;
  companyPhone: string;
  companyEmail: string;
  companyLogo?: string;
  factoryState: string; // 'Tamil Nadu' — for GST intra/interstate
  financialYearStart: number; // month (4 = April)
  invoicePrefix: string;
  nextInvoiceSerial: number;
  gstRates: number[];
  defaultGstRate: number;
}

