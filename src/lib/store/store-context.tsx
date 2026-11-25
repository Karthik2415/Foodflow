'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  setDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase/config';
import { useAuth } from '@/lib/auth/auth-context';
import { DEFAULT_SETTINGS } from '@/lib/constants';
import type {
  Customer, Product, Material, Supplier, BOMHeader, BOMItem,
  SalesOrder, Invoice, PurchaseOrder, PurchaseReceipt,
  ProductionRun, StockLedgerEntry, InventoryBalance,
  Payment, PaymentAllocation, Expense, Notification, AuditLogEntry, AppSettings,
} from '@/lib/types';
import {
  calculateGST,
  generateId,
  toScaledQty,
  fromScaledQty,
  calculateVariance,
  getFinancialYear,
} from '@/lib/utils';

// ===== Store State =====
interface StoreState {
  customers: Customer[];
  products: Product[];
  materials: Material[];
  suppliers: Supplier[];
  bomHeaders: BOMHeader[];
  bomItems: BOMItem[];
  salesOrders: SalesOrder[];
  invoices: Invoice[];
  purchaseOrders: PurchaseOrder[];
  purchaseReceipts: PurchaseReceipt[];
  productionRuns: ProductionRun[];
  stockLedger: StockLedgerEntry[];
  inventoryBalances: InventoryBalance[];
  payments: Payment[];
  expenses: Expense[];
  notifications: Notification[];
  auditLog: AuditLogEntry[];
  settings: AppSettings;
  firestoreLoading: boolean;
  isLiveFirestore: boolean;
}

export interface ReconciliationResult {
  reconciled: boolean;
  checkedItems: number;
  mismatches: { itemId: string; itemName: string; balanceDoc: number; ledgerSum: number }[];
}

export interface ActionResult {
  ok: boolean;
  id?: string;
  error?: string;
}

interface StoreActions {
  // Master Data
  createCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'outstandingPaise' | 'isActive'>) => Promise<string>;
  createProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>) => Promise<string>;
  createMaterial: (
    material: Omit<Material, 'id' | 'createdAt' | 'updatedAt' | 'isActive' | 'currentStock'>,
    openingQty?: number,
    openingRatePaise?: number
  ) => Promise<string>;
  createSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>) => Promise<string>;
  createBOM: (
    productId: string,
    productName: string,
    batchSize: number,
    items: { materialId: string; materialName: string; materialUnit: string; standardQuantity: number }[]
  ) => Promise<string>;
  // Operations
  createPurchaseReceipt: (receipt: Omit<PurchaseReceipt, 'id' | 'createdAt'>) => Promise<ActionResult>;
  createProductionRun: (run: Partial<ProductionRun>) => string;
  issueProductionMaterials: (runId: string, materials: { materialId: string; quantity: number }[]) => Promise<ActionResult>;
  completeProductionRun: (runId: string, goodOutput: number, rejectedOutput: number, damagedPackaging: number) => Promise<ActionResult>;
  createSalesOrder: (order: Partial<SalesOrder>) => string;
  submitSalesOrder: (orderId: string) => void;
  markOrderUnderReview: (orderId: string) => void;
  approveSalesOrder: (orderId: string, approvedBy: string) => void;
  rejectSalesOrder: (orderId: string, reason: string) => void;
  cancelSalesOrder: (orderId: string, reason: string) => void;
  createInvoice: (salesOrderId: string, createdBy: string) => string;
  cancelInvoice: (invoiceId: string, reason: string, cancelledBy: string) => Promise<ActionResult>;
  dispatchOrder: (salesOrderId: string, dispatchedBy: string) => Promise<ActionResult>;
  recordPayment: (payment: Partial<Payment> & { targetInvoiceId?: string }) => Promise<ActionResult>;
  recordExpense: (expense: Partial<Expense>) => void;
  reconcileStockLedger: (autoFix?: boolean) => Promise<ReconciliationResult>;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  // Queries
  checkStockAvailability: (productId: string, qty: number) => { available: boolean; currentStock: number; shortage: number };
  getStockBalance: (itemId: string) => number;
  getProductionCost: (runId: string) => any;
  getCustomerOutstanding: (customerId: string) => number;
  getMonthlyRevenue: () => { month: string; revenue: number }[];
}

type StoreContextType = StoreState & StoreActions;

const StoreContext = createContext<StoreContextType | null>(null);

const EMPTY_STATE: StoreState = {
  customers: [],
  products: [],
  materials: [],
  suppliers: [],
  bomHeaders: [],
  bomItems: [],
  salesOrders: [],
  invoices: [],
  purchaseOrders: [],
  purchaseReceipts: [],
  productionRuns: [],
  stockLedger: [],
  inventoryBalances: [],
  payments: [],
  expenses: [],
  notifications: [],
  auditLog: [],
  settings: DEFAULT_SETTINGS as AppSettings,
  firestoreLoading: isFirebaseConfigured,
  isLiveFirestore: isFirebaseConfigured,
};

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) clean[k] = v;
  }
  return clean as T;
}

/**
 * Compute next sequential integer by scanning existing formatted document numbers
 * (e.g., SO-0001 -> 1, FF/2026-27/0003 -> 3), avoiding collisions when records are filtered or deleted.
 */
function getNextSerialFromList(existingNumbers: (string | undefined)[]): number {
  let max = 0;
  for (const num of existingNumbers) {
    if (!num) continue;
    const match = num.match(/(\d+)$/);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (!Number.isNaN(parsed) && parsed > max) max = parsed;
    }
  }
  return max + 1;
}

/**
 * Pure integer-paise stock movement computation.
 * - Prevents negative stock on outbound movements.
 * - Preserves exact total inventory valuePaise (no intermediate rounding drift on weighted avg).
 */
function computeStockMovement(
  currentBalance: InventoryBalance | undefined,
  itemId: string,
  itemName: string,
  itemType: 'raw_material' | 'packaging_material' | 'finished_good',
  movementType: StockLedgerEntry['movementType'],
  quantityIn: number,
  quantityOut: number,
  sourceDocId: string,
  sourceDocType: string,
  userId: string,
  remarks: string,
  ratePaise?: number,
  unitName?: string,
  reorderLevel?: number
): { ledgerEntry: StockLedgerEntry; updatedBalance: InventoryBalance; movementValuePaise: number } {
  const prevBal = currentBalance?.currentStock ?? 0;
  const prevValuePaise = currentBalance?.valuePaise ?? 0;
  const newBal = prevBal + quantityIn - quantityOut;

  if (quantityOut > 0 && newBal < 0) {
    throw new Error(
      `Insufficient stock for ${itemName}: requested ${fromScaledQty(quantityOut)} ${unitName || currentBalance?.unitName || ''}, available ${fromScaledQty(prevBal)}.`
    );
  }

  const nowTs = Timestamp.now();
  let newValuePaise = prevValuePaise;
  let movementValuePaise = 0;
  let effectiveRatePaise = currentBalance?.weightedAvgRatePaise ?? ratePaise ?? 0;

  if (quantityIn > 0) {
    const unitRate = ratePaise ?? effectiveRatePaise;
    movementValuePaise = Math.round((quantityIn * unitRate) / 1000);
    newValuePaise = prevValuePaise + movementValuePaise;
    effectiveRatePaise = newBal > 0 ? Math.round((newValuePaise * 1000) / newBal) : 0;
  } else if (quantityOut > 0) {
    // Exact proportional value deduction from total inventory value (zero rounding drift on weighted avg)
    movementValuePaise = prevBal > 0 ? Math.round((prevValuePaise * quantityOut) / prevBal) : 0;
    newValuePaise = Math.max(0, prevValuePaise - movementValuePaise);
    effectiveRatePaise = prevBal > 0 ? Math.round((prevValuePaise * 1000) / prevBal) : 0;
  }

  const entry: StockLedgerEntry = {
    id: generateId('stk'),
    itemId,
    itemName,
    itemType,
    movementType,
    quantityIn,
    quantityOut,
    previousBalance: prevBal,
    newBalance: newBal,
    ratePaise: effectiveRatePaise,
    valuePaise: movementValuePaise,
    sourceDocumentId: sourceDocId,
    sourceDocumentType: sourceDocType,
    userId,
    remarks,
    timestamp: nowTs as any,
  };

  const updBalance: InventoryBalance = {
    id: itemId,
    itemId,
    itemName,
    itemType,
    currentStock: newBal,
    unitName: unitName ?? currentBalance?.unitName ?? '',
    weightedAvgRatePaise: newBal > 0 ? Math.round((newValuePaise * 1000) / newBal) : effectiveRatePaise,
    valuePaise: newValuePaise,
    reorderLevel: reorderLevel ?? currentBalance?.reorderLevel ?? 0,
    isLowStock: newBal < (reorderLevel ?? currentBalance?.reorderLevel ?? 0),
    lastMovementAt: nowTs as any,
    updatedAt: nowTs as any,
  };

  return { ledgerEntry: entry, updatedBalance: updBalance, movementValuePaise };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<StoreState>(EMPTY_STATE);

  const update = useCallback((fn: (prev: StoreState) => Partial<StoreState>) => {
    setState((prev) => ({ ...prev, ...fn(prev) }));
  }, []);

  // ===== Real-time Cloud Firestore Subscriptions =====
  useEffect(() => {
    if (!isFirebaseConfigured || !user) {
      setState((prev) => ({ ...prev, firestoreLoading: false }));
      return;
    }

    const collections: { name: string; key: keyof StoreState }[] = [
      { name: 'customers', key: 'customers' },
      { name: 'products', key: 'products' },
      { name: 'rawMaterials', key: 'materials' },
      { name: 'suppliers', key: 'suppliers' },
      { name: 'bomHeaders', key: 'bomHeaders' },
      { name: 'bomItems', key: 'bomItems' },
      { name: 'salesOrders', key: 'salesOrders' },
      { name: 'invoices', key: 'invoices' },
      { name: 'purchaseReceipts', key: 'purchaseReceipts' },
      { name: 'productionRuns', key: 'productionRuns' },
      { name: 'stockLedger', key: 'stockLedger' },
      { name: 'inventoryBalances', key: 'inventoryBalances' },
      { name: 'payments', key: 'payments' },
      { name: 'expenses', key: 'expenses' },
      { name: 'notifications', key: 'notifications' },
      { name: 'auditLogs', key: 'auditLog' },
    ];

    const unsubscribes = collections.map(({ name, key }) =>
      onSnapshot(
        collection(db, name),
        (snapshot) => {
          const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          setState((prev) => ({
            ...prev,
            [key]: items,
            firestoreLoading: false,
          }));
        },
        (err) => {
          console.error(`Firestore listener error on ${name}:`, err);
          setState((prev) => ({ ...prev, firestoreLoading: false }));
        }
      )
    );

    const unsubSettings = onSnapshot(doc(db, 'settings', 'company'), (snap) => {
      if (snap.exists()) {
        setState((prev) => ({ ...prev, settings: snap.data() as AppSettings }));
      }
    });

    return () => {
      unsubscribes.forEach((u) => u());
      unsubSettings();
    };
  }, [user]);

  const appendAudit = useCallback(
    (action: string, entityType: string, entityId: string, metadata?: Record<string, unknown>): AuditLogEntry => {
      return {
        id: generateId('aud'),
        action,
        entityType,
        entityId,
        userId: user?.id || 'system',
        userName: user?.displayName || 'System',
        metadata,
        timestamp: Timestamp.now() as any,
      };
    },
    [user]
  );

  // ===== MASTER DATA CREATION =====
  const createCustomer = useCallback(async (
    customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'outstandingPaise' | 'isActive'>
  ): Promise<string> => {
    const id = generateId('cust');
    const nowTs = Timestamp.now();
    const newCustomer: Customer = {
      ...customer,
      id,
      outstandingPaise: 0,
      isActive: true,
      createdAt: nowTs as any,
      updatedAt: nowTs as any,
    };

    if (isFirebaseConfigured && user) {
      await setDoc(doc(db, 'customers', id), stripUndefined(newCustomer));
      return id;
    }

    update((prev) => ({ customers: [...prev.customers, newCustomer] }));
    return id;
  }, [update, user]);

  const createProduct = useCallback(async (
    product: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>
  ): Promise<string> => {
    const id = generateId('prod');
    const nowTs = Timestamp.now();
    const newProduct: Product = {
      ...product,
      id,
      isActive: true,
      createdAt: nowTs as any,
      updatedAt: nowTs as any,
    };

    const initialBalance: InventoryBalance = {
      id,
      itemId: id,
      itemName: product.name,
      itemType: 'finished_good',
      currentStock: 0,
      unitName: product.unitName,
      weightedAvgRatePaise: 0,
      valuePaise: 0,
      reorderLevel: toScaledQty(20),
      isLowStock: false,
      updatedAt: nowTs as any,
    };

    if (isFirebaseConfigured && user) {
      await runTransaction(db, async (tx) => {
        tx.set(doc(db, 'products', id), stripUndefined(newProduct));
        tx.set(doc(db, 'inventoryBalances', id), stripUndefined(initialBalance));
      });
      return id;
    }

    update((prev) => ({
      products: [...prev.products, newProduct],
      inventoryBalances: [...prev.inventoryBalances, initialBalance],
    }));
    return id;
  }, [update, user]);

  const createMaterial = useCallback(async (
    material: Omit<Material, 'id' | 'createdAt' | 'updatedAt' | 'isActive' | 'currentStock'>,
    openingQty = 0,
    openingRatePaise = 0
  ): Promise<string> => {
    const id = generateId('mat');
    const nowTs = Timestamp.now();
    const scaledOpening = toScaledQty(openingQty);
    const newMaterial: Material = {
      ...material,
      id,
      currentStock: scaledOpening,
      currentRatePaise: openingRatePaise || material.currentRatePaise || 0,
      isActive: true,
      createdAt: nowTs as any,
      updatedAt: nowTs as any,
    };

    const { ledgerEntry, updatedBalance } = computeStockMovement(
      undefined,
      id,
      material.name,
      material.type,
      'opening_balance',
      scaledOpening,
      0,
      id,
      'opening_balance',
      user?.displayName || 'System',
      `Opening balance for ${material.name}`,
      openingRatePaise || material.currentRatePaise || 0,
      material.unitName,
      material.reorderLevel
    );

    if (isFirebaseConfigured && user) {
      await runTransaction(db, async (tx) => {
        tx.set(doc(db, 'rawMaterials', id), stripUndefined(newMaterial));
        tx.set(doc(db, 'inventoryBalances', id), stripUndefined(updatedBalance));
        if (scaledOpening > 0) {
          tx.set(doc(db, 'stockLedger', ledgerEntry.id), stripUndefined(ledgerEntry));
        }
      });
      return id;
    }

    update((prev) => ({
      materials: [...prev.materials, newMaterial],
      inventoryBalances: [...prev.inventoryBalances, updatedBalance],
      stockLedger: scaledOpening > 0 ? [...prev.stockLedger, ledgerEntry] : prev.stockLedger,
    }));
    return id;
  }, [update, user]);

  const createSupplier = useCallback(async (
    supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>
  ): Promise<string> => {
    const id = generateId('sup');
    const nowTs = Timestamp.now();
    const newSupplier: Supplier = {
      ...supplier,
      id,
      isActive: true,
      createdAt: nowTs as any,
      updatedAt: nowTs as any,
    };

    if (isFirebaseConfigured && user) {
      await setDoc(doc(db, 'suppliers', id), stripUndefined(newSupplier));
      return id;
    }

    update((prev) => ({ suppliers: [...prev.suppliers, newSupplier] }));
    return id;
  }, [update, user]);

  const createBOM = useCallback(async (
    productId: string,
    productName: string,
    batchSize: number,
    items: { materialId: string; materialName: string; materialUnit: string; standardQuantity: number }[]
  ): Promise<string> => {
    const headerId = generateId('bom');
    const nowTs = Timestamp.now();
    const header: BOMHeader = {
      id: headerId,
      productId,
      productName,
      batchSize,
      version: 1,
      isActive: true,
      createdAt: nowTs as any,
      updatedAt: nowTs as any,
    };

    const bomItemDocs: BOMItem[] = items.map((item, idx) => ({
      id: generateId('bomi'),
      bomHeaderId: headerId,
      materialId: item.materialId,
      materialName: item.materialName,
      materialUnit: item.materialUnit,
      standardQuantity: toScaledQty(item.standardQuantity),
      sortOrder: idx + 1,
    }));

    if (isFirebaseConfigured && user) {
      await runTransaction(db, async (tx) => {
        tx.set(doc(db, 'bomHeaders', headerId), stripUndefined(header));
        bomItemDocs.forEach((bi) => tx.set(doc(db, 'bomItems', bi.id), stripUndefined(bi)));
      });
      return headerId;
    }

    update((prev) => ({
      bomHeaders: [...prev.bomHeaders, header],
      bomItems: [...prev.bomItems, ...bomItemDocs],
    }));
    return headerId;
  }, [update, user]);

  // ===== PURCHASE RECEIPT (Atomic + Idempotent + Exact Weighted Avg) =====
  const createPurchaseReceipt = useCallback(async (
    receipt: Omit<PurchaseReceipt, 'id' | 'createdAt'>
  ): Promise<ActionResult> => {
    // Validate quantities and rates
    for (const item of receipt.items) {
      if (item.quantity <= 0) {
        return { ok: false, error: `Quantity for ${item.materialName} must be greater than 0.` };
      }
      if (item.ratePaise < 0) {
        return { ok: false, error: `Rate for ${item.materialName} cannot be negative.` };
      }
    }

    // Prevent duplicate submission by idempotencyKey
    if (receipt.idempotencyKey && state.purchaseReceipts.some((p) => p.idempotencyKey === receipt.idempotencyKey)) {
      return { ok: false, error: 'Duplicate purchase receipt prevented.' };
    }

    const receiptId = generateId('pr');
    const serial = getNextSerialFromList(state.purchaseReceipts.map((p) => p.receiptNumber));
    const newReceipt: PurchaseReceipt = {
      ...receipt,
      id: receiptId,
      receiptNumber: receipt.receiptNumber || `PR-${serial.toString().padStart(4, '0')}`,
      createdAt: Timestamp.now() as any,
    };

    if (isFirebaseConfigured && user) {
      try {
        await runTransaction(db, async (tx) => {
          // Read all affected inventoryBalances inside the transaction
          const balMap: Record<string, InventoryBalance | undefined> = {};
          for (const item of receipt.items) {
            const balSnap = await tx.get(doc(db, 'inventoryBalances', item.materialId));
            balMap[item.materialId] = balSnap.exists() ? (balSnap.data() as InventoryBalance) : undefined;
          }

          tx.set(doc(db, 'purchaseReceipts', receiptId), stripUndefined(newReceipt));

          for (const item of receipt.items) {
            const mat = state.materials.find((m) => m.id === item.materialId);
            const { ledgerEntry, updatedBalance } = computeStockMovement(
              balMap[item.materialId],
              item.materialId,
              item.materialName,
              mat?.type || 'raw_material',
              'purchase_receipt',
              item.quantity,
              0,
              receiptId,
              'purchase_receipt',
              receipt.createdBy,
              `Purchase ${newReceipt.receiptNumber} from ${receipt.supplierName}`,
              item.ratePaise,
              item.materialUnit,
              mat?.reorderLevel
            );
            balMap[item.materialId] = updatedBalance;
            tx.set(doc(db, 'stockLedger', ledgerEntry.id), stripUndefined(ledgerEntry));
            tx.set(doc(db, 'inventoryBalances', item.materialId), stripUndefined(updatedBalance));
          }

          const aud = appendAudit('PURCHASE_RECEIPT_POSTED', 'purchase_receipt', receiptId, {
            receiptNumber: newReceipt.receiptNumber,
            totalAmountPaise: newReceipt.totalAmountPaise,
          });
          tx.set(doc(db, 'auditLogs', aud.id), stripUndefined(aud));
        });
        return { ok: true, id: receiptId };
      } catch (err: any) {
        console.error('Failed to commit purchase receipt:', err);
        return { ok: false, error: err?.message || 'Failed to record purchase receipt' };
      }
    }

    update((prev) => {
      const ledger = [...prev.stockLedger];
      const balances = [...prev.inventoryBalances];

      for (const item of receipt.items) {
        const mat = prev.materials.find((m) => m.id === item.materialId);
        const curBal = balances.find((b) => b.itemId === item.materialId);
        const { ledgerEntry, updatedBalance } = computeStockMovement(
          curBal,
          item.materialId,
          item.materialName,
          mat?.type || 'raw_material',
          'purchase_receipt',
          item.quantity,
          0,
          newReceipt.id,
          'purchase_receipt',
          receipt.createdBy,
          `Purchase ${newReceipt.receiptNumber} from ${receipt.supplierName}`,
          item.ratePaise,
          item.materialUnit,
          mat?.reorderLevel
        );
        ledger.push(ledgerEntry);
        const idx = balances.findIndex((b) => b.itemId === item.materialId);
        if (idx >= 0) balances[idx] = updatedBalance;
        else balances.push(updatedBalance);
      }

      return {
        purchaseReceipts: [...prev.purchaseReceipts, newReceipt],
        stockLedger: ledger,
        inventoryBalances: balances,
        auditLog: [...prev.auditLog, appendAudit('PURCHASE_RECEIPT_POSTED', 'purchase_receipt', receiptId)],
      };
    });
    return { ok: true, id: receiptId };
  }, [update, state.purchaseReceipts, state.materials, user, appendAudit]);

  // ===== PRODUCTION =====
  const createProductionRun = useCallback((run: Partial<ProductionRun>): string => {
    const id = generateId('prod');
    const serial = getNextSerialFromList(state.productionRuns.map((r) => r.runNumber));
    const newRun: ProductionRun = {
      id,
      runNumber: `PR-${serial.toString().padStart(4, '0')}`,
      status: 'planned',
      goodOutput: 0,
      rejectedOutput: 0,
      damagedPackaging: 0,
      idempotencyKey: generateId('idem'),
      createdAt: Timestamp.now() as any,
      updatedAt: Timestamp.now() as any,
      ...run,
    } as ProductionRun;

    if (isFirebaseConfigured && user) {
      setDoc(doc(db, 'productionRuns', id), stripUndefined(newRun)).catch(console.error);
      return id;
    }

    update((prev) => ({
      productionRuns: [...prev.productionRuns, newRun],
    }));
    return id;
  }, [update, state.productionRuns, user]);

  const issueProductionMaterials = useCallback(async (
    runId: string,
    materialsToIssue: { materialId: string; quantity: number }[]
  ): Promise<ActionResult> => {
    if (isFirebaseConfigured && user) {
      try {
        await runTransaction(db, async (tx) => {
          const runRef = doc(db, 'productionRuns', runId);
          const runSnap = await tx.get(runRef);
          if (!runSnap.exists()) throw new Error('Production run not found.');
          const run = runSnap.data() as ProductionRun;
          if (run.status !== 'planned') {
            throw new Error(`Materials already issued (run status: ${run.status}).`);
          }

          const balMap: Record<string, InventoryBalance | undefined> = {};
          for (const m of materialsToIssue) {
            if (m.quantity < 0) throw new Error('Issued quantity cannot be negative.');
            const balSnap = await tx.get(doc(db, 'inventoryBalances', m.materialId));
            balMap[m.materialId] = balSnap.exists() ? (balSnap.data() as InventoryBalance) : undefined;
          }

          const actualMats = materialsToIssue.map((m) => {
            const mat = state.materials.find((rm) => rm.id === m.materialId);
            const curBal = balMap[m.materialId];
            if (m.quantity === 0) {
              return {
                materialId: m.materialId,
                materialName: mat?.name ?? curBal?.itemName ?? '',
                materialUnit: mat?.unitName ?? curBal?.unitName ?? '',
                quantity: 0,
                ratePaise: curBal?.weightedAvgRatePaise ?? 0,
                amountPaise: 0,
              };
            }
            const { ledgerEntry, updatedBalance, movementValuePaise } = computeStockMovement(
              curBal,
              m.materialId,
              mat?.name ?? curBal?.itemName ?? '',
              mat?.type === 'packaging_material' ? 'packaging_material' : 'raw_material',
              'production_issue',
              0,
              m.quantity,
              runId,
              'production_run',
              run.createdBy,
              `Issued for ${run.runNumber}`,
              curBal?.weightedAvgRatePaise,
              mat?.unitName ?? curBal?.unitName
            );
            balMap[m.materialId] = updatedBalance;
            tx.set(doc(db, 'stockLedger', ledgerEntry.id), stripUndefined(ledgerEntry));
            tx.set(doc(db, 'inventoryBalances', m.materialId), stripUndefined(updatedBalance));

            return {
              materialId: m.materialId,
              materialName: mat?.name ?? curBal?.itemName ?? '',
              materialUnit: mat?.unitName ?? curBal?.unitName ?? '',
              quantity: m.quantity,
              ratePaise: ledgerEntry.ratePaise,
              amountPaise: movementValuePaise,
            };
          });

          tx.update(runRef, {
            actualMaterials: actualMats,
            status: 'in_progress',
            startedAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });

          const aud = appendAudit('PRODUCTION_MATERIALS_ISSUED', 'production_run', runId, {
            runNumber: run.runNumber,
          });
          tx.set(doc(db, 'auditLogs', aud.id), stripUndefined(aud));
        });
        return { ok: true };
      } catch (err: any) {
        console.error('Issue materials failed:', err);
        return { ok: false, error: err?.message || 'Failed to issue materials' };
      }
    }

    try {
      let resultError: string | undefined;
      update((prev) => {
        const target = prev.productionRuns.find((r) => r.id === runId);
        if (!target) {
          resultError = 'Production run not found.';
          return {};
        }
        if (target.status !== 'planned') {
          resultError = `Materials already issued (status: ${target.status}).`;
          return {};
        }

        const ledger = [...prev.stockLedger];
        const balances = [...prev.inventoryBalances];

        const actualMats = materialsToIssue.map((m) => {
          const mat = prev.materials.find((rm) => rm.id === m.materialId);
          const curBal = balances.find((b) => b.itemId === m.materialId);
          if (m.quantity === 0) {
            return {
              materialId: m.materialId,
              materialName: mat?.name ?? curBal?.itemName ?? '',
              materialUnit: mat?.unitName ?? curBal?.unitName ?? '',
              quantity: 0,
              ratePaise: curBal?.weightedAvgRatePaise ?? 0,
              amountPaise: 0,
            };
          }
          const { ledgerEntry, updatedBalance, movementValuePaise } = computeStockMovement(
            curBal,
            m.materialId,
            mat?.name ?? curBal?.itemName ?? '',
            mat?.type === 'packaging_material' ? 'packaging_material' : 'raw_material',
            'production_issue',
            0,
            m.quantity,
            runId,
            'production_run',
            target.createdBy,
            `Issued for ${target.runNumber}`,
            curBal?.weightedAvgRatePaise,
            mat?.unitName ?? curBal?.unitName
          );
          ledger.push(ledgerEntry);
          const idx = balances.findIndex((b) => b.itemId === m.materialId);
          if (idx >= 0) balances[idx] = updatedBalance;

          return {
            materialId: m.materialId,
            materialName: mat?.name ?? curBal?.itemName ?? '',
            materialUnit: mat?.unitName ?? curBal?.unitName ?? '',
            quantity: m.quantity,
            ratePaise: ledgerEntry.ratePaise,
            amountPaise: movementValuePaise,
          };
        });

        const runs = prev.productionRuns.map((r) =>
          r.id === runId ? { ...r, actualMaterials: actualMats, status: 'in_progress' as const } : r
        );
        return { productionRuns: runs, stockLedger: ledger, inventoryBalances: balances };
      });
      if (resultError) return { ok: false, error: resultError };
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Insufficient stock' };
    }
  }, [update, state.materials, user, appendAudit]);

  const completeProductionRun = useCallback(async (
    runId: string,
    goodOutput: number,
    rejectedOutput: number,
    damagedPackaging: number
  ): Promise<ActionResult> => {
    if (goodOutput < 0 || rejectedOutput < 0 || damagedPackaging < 0) {
      return { ok: false, error: 'Output and wastage quantities cannot be negative.' };
    }

    if (isFirebaseConfigured && user) {
      try {
        await runTransaction(db, async (tx) => {
          const runRef = doc(db, 'productionRuns', runId);
          const runSnap = await tx.get(runRef);
          if (!runSnap.exists()) throw new Error('Production run not found.');
          const r = runSnap.data() as ProductionRun;
          if (r.status !== 'in_progress') {
            throw new Error(`Cannot complete run in status: ${r.status}`);
          }

          const product = state.products.find((p) => p.id === r.productId);
          const balSnap = await tx.get(doc(db, 'inventoryBalances', r.productId));
          const curBal = balSnap.exists() ? (balSnap.data() as InventoryBalance) : undefined;

          const totalMatCost = r.actualMaterials.reduce((sum, m) => sum + (m.amountPaise ?? 0), 0);
          const unitCostPaise = goodOutput > 0 ? Math.round(totalMatCost / goodOutput) : 0;

          const { ledgerEntry, updatedBalance } = computeStockMovement(
            curBal,
            r.productId,
            product?.name ?? r.productName,
            'finished_good',
            'production_receipt',
            toScaledQty(goodOutput),
            0,
            runId,
            'production_run',
            r.createdBy,
            `Production output from ${r.runNumber}`,
            unitCostPaise,
            product?.unitName || 'packets'
          );

          tx.set(doc(db, 'stockLedger', ledgerEntry.id), stripUndefined(ledgerEntry));
          tx.set(doc(db, 'inventoryBalances', r.productId), stripUndefined(updatedBalance));

          const yieldVar = r.batchSize > 0 ? calculateVariance(r.batchSize, goodOutput) : 0;
          tx.update(runRef, {
            goodOutput: toScaledQty(goodOutput),
            rejectedOutput: toScaledQty(rejectedOutput),
            damagedPackaging: toScaledQty(damagedPackaging),
            status: 'completed',
            totalMaterialCostPaise: totalMatCost,
            yieldVariancePercent: yieldVar,
            completedBy: user.displayName,
            completedAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });

          const aud = appendAudit('PRODUCTION_RUN_COMPLETED', 'production_run', runId, {
            runNumber: r.runNumber,
            goodOutput,
            yieldVariancePercent: yieldVar,
          });
          tx.set(doc(db, 'auditLogs', aud.id), stripUndefined(aud));
        });
        return { ok: true };
      } catch (err: any) {
        console.error('Complete production run failed:', err);
        return { ok: false, error: err?.message || 'Failed to complete production run' };
      }
    }

    let resultError: string | undefined;
    update((prev) => {
      const target = prev.productionRuns.find((r) => r.id === runId);
      if (!target) {
        resultError = 'Production run not found.';
        return {};
      }
      if (target.status !== 'in_progress') {
        resultError = `Cannot complete run in status: ${target.status}`;
        return {};
      }

      const ledger = [...prev.stockLedger];
      const balances = [...prev.inventoryBalances];
      const product = prev.products.find((p) => p.id === target.productId);
      const curBal = balances.find((b) => b.itemId === target.productId);

      const totalMatCost = target.actualMaterials.reduce((sum, m) => sum + (m.amountPaise ?? 0), 0);
      const unitCostPaise = goodOutput > 0 ? Math.round(totalMatCost / goodOutput) : 0;

      const { ledgerEntry, updatedBalance } = computeStockMovement(
        curBal,
        target.productId,
        product?.name ?? target.productName,
        'finished_good',
        'production_receipt',
        toScaledQty(goodOutput),
        0,
        runId,
        'production_run',
        target.createdBy,
        `Production output from ${target.runNumber}`,
        unitCostPaise,
        product?.unitName || 'packets'
      );
      ledger.push(ledgerEntry);
      const idx = balances.findIndex((b) => b.itemId === target.productId);
      if (idx >= 0) balances[idx] = updatedBalance;
      else balances.push(updatedBalance);

      const yieldVar = target.batchSize > 0 ? calculateVariance(target.batchSize, goodOutput) : 0;
      const runs = prev.productionRuns.map((r) =>
        r.id === runId
          ? {
              ...r,
              goodOutput: toScaledQty(goodOutput),
              rejectedOutput: toScaledQty(rejectedOutput),
              damagedPackaging: toScaledQty(damagedPackaging),
              status: 'completed' as const,
              totalMaterialCostPaise: totalMatCost,
              yieldVariancePercent: yieldVar,
              completedAt: Timestamp.now() as any,
            }
          : r
      );
      return { productionRuns: runs, stockLedger: ledger, inventoryBalances: balances };
    });
    if (resultError) return { ok: false, error: resultError };
    return { ok: true };
  }, [update, state.products, user, appendAudit]);

  // ===== SALES ORDERS =====
  const createSalesOrder = useCallback((order: Partial<SalesOrder>): string => {
    const id = generateId('so');
    const shortages: any[] = [];
    for (const item of order.items || []) {
      const bal = state.inventoryBalances.find((b) => b.itemId === item.productId);
      const available = bal ? fromScaledQty(bal.currentStock) : 0;
      const requested = fromScaledQty(item.quantity);
      if (requested > available) {
        shortages.push({
          productId: item.productId,
          productName: item.productName,
          requested: item.quantity,
          available: bal?.currentStock ?? 0,
          shortage: item.quantity - (bal?.currentStock ?? 0),
        });
      }
    }

    const serial = getNextSerialFromList(state.salesOrders.map((o) => o.orderNumber));
    const newOrder: SalesOrder = {
      id,
      orderNumber: `SO-${serial.toString().padStart(4, '0')}`,
      status: order.status || 'submitted',
      hasStockShortage: shortages.length > 0,
      shortageDetails: shortages.length > 0 ? shortages : undefined,
      idempotencyKey: generateId('idem'),
      createdAt: Timestamp.now() as any,
      updatedAt: Timestamp.now() as any,
      ...order,
    } as SalesOrder;

    if (isFirebaseConfigured && user) {
      setDoc(doc(db, 'salesOrders', id), stripUndefined(newOrder)).catch(console.error);
      return id;
    }

    update((prev) => ({
      salesOrders: [...prev.salesOrders, newOrder],
    }));
    return id;
  }, [update, state.inventoryBalances, state.salesOrders, user]);

  const updateOrderStatus = useCallback(
    (orderId: string, status: SalesOrder['status'], extraFields: Record<string, any> = {}) => {
      if (isFirebaseConfigured && user) {
        updateDoc(doc(db, 'salesOrders', orderId), {
          status,
          ...extraFields,
          updatedAt: Timestamp.now(),
        }).catch(console.error);
        return;
      }

      update((prev) => ({
        salesOrders: prev.salesOrders.map((o) =>
          o.id === orderId ? { ...o, status, ...extraFields } : o
        ),
      }));
    },
    [update, user]
  );

  const submitSalesOrder = useCallback(
    (orderId: string) => updateOrderStatus(orderId, 'submitted'),
    [updateOrderStatus]
  );

  const markOrderUnderReview = useCallback(
    (orderId: string) => updateOrderStatus(orderId, 'under_review'),
    [updateOrderStatus]
  );

  const approveSalesOrder = useCallback(
    (orderId: string, approvedBy: string) =>
      updateOrderStatus(orderId, 'approved', { approvedBy, approvedAt: Timestamp.now() }),
    [updateOrderStatus]
  );

  const rejectSalesOrder = useCallback(
    (orderId: string, reason: string) =>
      updateOrderStatus(orderId, 'rejected', { rejectionReason: reason }),
    [updateOrderStatus]
  );

  const cancelSalesOrder = useCallback(
    (orderId: string, reason: string) =>
      updateOrderStatus(orderId, 'cancelled', { rejectionReason: reason }),
    [updateOrderStatus]
  );

  // ===== INVOICES (Idempotent + Atomic + Statutory Cancellation) =====
  const createInvoice = useCallback((salesOrderId: string, createdBy: string): string => {
    const order = state.salesOrders.find((o) => o.id === salesOrderId);
    if (!order) return '';

    // Prevent duplicate invoice for the same order
    const existingPosted = state.invoices.find(
      (inv) => inv.salesOrderId === salesOrderId && inv.status === 'posted'
    );
    if (existingPosted) return existingPosted.id;

    const id = generateId('inv');
    const customer = state.customers.find((c) => c.id === order.customerId);
    const isInterstate = (customer?.state || order.customerState) !== state.settings.factoryState;

    const items = order.items.map((item) => {
      const prod = state.products.find((p) => p.id === item.productId);
      const gst = calculateGST(item.amountPaise, item.gstRatePercent, isInterstate);
      return {
        productId: item.productId,
        productName: item.productName,
        hsnCode: prod?.hsnCode || '19059040',
        quantity: item.quantity,
        unitPricePaise: item.unitPricePaise,
        taxableAmountPaise: item.amountPaise,
        gstRatePercent: item.gstRatePercent,
        cgstPaise: gst.cgstPaise,
        sgstPaise: gst.sgstPaise,
        igstPaise: gst.igstPaise,
        totalPaise: gst.totalPaise,
      };
    });

    const taxable = items.reduce((s, i) => s + i.taxableAmountPaise, 0);
    const cgst = items.reduce((s, i) => s + i.cgstPaise, 0);
    const sgst = items.reduce((s, i) => s + i.sgstPaise, 0);
    const igst = items.reduce((s, i) => s + i.igstPaise, 0);
    const grand = taxable + cgst + sgst + igst;
    const fy = getFinancialYear();
    const serial = getNextSerialFromList(state.invoices.map((i) => i.invoiceNumber));
    const invoiceNum = `${state.settings.invoicePrefix}/${fy}/${serial.toString().padStart(4, '0')}`;

    const invoice: Invoice = {
      id,
      invoiceNumber: invoiceNum,
      salesOrderId,
      customerId: order.customerId,
      customerName: order.customerName,
      customerGstin: customer?.gstin,
      customerAddress: customer?.billingAddress ?? { line1: '', city: '', state: order.customerState || '', pincode: '' },
      sellerGstin: state.settings.companyGstin,
      sellerAddress: state.settings.companyAddress,
      isInterstate,
      items,
      taxableAmountPaise: taxable,
      cgstPaise: cgst,
      sgstPaise: sgst,
      igstPaise: igst,
      grandTotalPaise: grand,
      grandTotalRounded: Math.round(grand / 100) * 100,
      status: 'posted',
      paidPaise: 0,
      paymentStatus: 'unpaid',
      idempotencyKey: generateId('idem'),
      financialYear: fy,
      invoiceDate: Timestamp.now() as any,
      createdBy,
      createdAt: Timestamp.now() as any,
    };

    if (isFirebaseConfigured && user) {
      runTransaction(db, async (tx) => {
        const orderRef = doc(db, 'salesOrders', salesOrderId);
        const orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists()) throw new Error('Sales order not found');
        if (orderSnap.data().status !== 'approved') {
          throw new Error('Only approved orders can be invoiced.');
        }

        const custRef = doc(db, 'customers', order.customerId);
        const custSnap = await tx.get(custRef);
        const currentOutstanding = custSnap.exists() ? (custSnap.data().outstandingPaise || 0) : 0;

        tx.set(doc(db, 'invoices', id), stripUndefined(invoice));
        tx.update(orderRef, { status: 'invoiced', updatedAt: Timestamp.now() });
        tx.update(custRef, { outstandingPaise: currentOutstanding + grand, updatedAt: Timestamp.now() });
      }).catch(console.error);
      return id;
    }

    update((prev) => ({
      invoices: [...prev.invoices, invoice],
      salesOrders: prev.salesOrders.map((o) =>
        o.id === salesOrderId ? { ...o, status: 'invoiced' as const } : o
      ),
      customers: prev.customers.map((c) =>
        c.id === order.customerId
          ? { ...c, outstandingPaise: c.outstandingPaise + grand }
          : c
      ),
    }));
    return id;
  }, [update, state.salesOrders, state.invoices, state.customers, state.products, state.settings, user]);

  const cancelInvoice = useCallback(async (
    invoiceId: string,
    reason: string,
    cancelledBy: string
  ): Promise<ActionResult> => {
    if (!reason.trim()) return { ok: false, error: 'Cancellation reason is required.' };

    if (isFirebaseConfigured && user) {
      try {
        await runTransaction(db, async (tx) => {
          const invRef = doc(db, 'invoices', invoiceId);
          const invSnap = await tx.get(invRef);
          if (!invSnap.exists()) throw new Error('Invoice not found.');
          const inv = invSnap.data() as Invoice;
          if (inv.status === 'cancelled') throw new Error('Invoice is already cancelled.');

          const unpaidAmount = Math.max(0, inv.grandTotalPaise - (inv.paidPaise || 0));
          const custRef = doc(db, 'customers', inv.customerId);
          const custSnap = await tx.get(custRef);
          const currentOutstanding = custSnap.exists() ? (custSnap.data().outstandingPaise || 0) : 0;

          tx.update(invRef, {
            status: 'cancelled',
            cancelledAt: Timestamp.now(),
            cancelledBy,
            cancellationReason: reason,
          });
          tx.update(custRef, {
            outstandingPaise: Math.max(0, currentOutstanding - unpaidAmount),
            updatedAt: Timestamp.now(),
          });

          const aud = appendAudit('INVOICE_CANCELLED', 'invoice', invoiceId, {
            invoiceNumber: inv.invoiceNumber,
            reason,
          });
          tx.set(doc(db, 'auditLogs', aud.id), stripUndefined(aud));
        });
        return { ok: true };
      } catch (err: any) {
        return { ok: false, error: err?.message || 'Failed to cancel invoice' };
      }
    }

    update((prev) => {
      const inv = prev.invoices.find((i) => i.id === invoiceId);
      if (!inv || inv.status === 'cancelled') return {};
      const unpaid = Math.max(0, inv.grandTotalPaise - (inv.paidPaise || 0));
      return {
        invoices: prev.invoices.map((i) =>
          i.id === invoiceId
            ? { ...i, status: 'cancelled' as const, cancellationReason: reason, cancelledBy, cancelledAt: Timestamp.now() as any }
            : i
        ),
        customers: prev.customers.map((c) =>
          c.id === inv.customerId ? { ...c, outstandingPaise: Math.max(0, c.outstandingPaise - unpaid) } : c
        ),
      };
    });
    return { ok: true };
  }, [update, user, appendAudit]);

  // ===== DISPATCH (Atomic Transaction + Negative Stock Prevention) =====
  const dispatchOrder = useCallback(async (
    salesOrderId: string,
    dispatchedBy: string
  ): Promise<ActionResult> => {
    const order = state.salesOrders.find((o) => o.id === salesOrderId);
    if (!order) return { ok: false, error: 'Sales order not found.' };
    if (order.status !== 'invoiced') {
      return { ok: false, error: `Order must be invoiced before dispatch (current status: ${order.status}).` };
    }

    if (isFirebaseConfigured && user) {
      try {
        await runTransaction(db, async (tx) => {
          const orderRef = doc(db, 'salesOrders', salesOrderId);
          const orderSnap = await tx.get(orderRef);
          if (!orderSnap.exists()) throw new Error('Sales order not found.');
          const liveOrder = orderSnap.data() as SalesOrder;
          if (liveOrder.status !== 'invoiced') {
            throw new Error(`Order already ${liveOrder.status}. Duplicate dispatch prevented.`);
          }

          const balMap: Record<string, InventoryBalance | undefined> = {};
          for (const item of liveOrder.items) {
            const balSnap = await tx.get(doc(db, 'inventoryBalances', item.productId));
            balMap[item.productId] = balSnap.exists() ? (balSnap.data() as InventoryBalance) : undefined;
          }

          for (const item of liveOrder.items) {
            const product = state.products.find((p) => p.id === item.productId);
            const { ledgerEntry, updatedBalance } = computeStockMovement(
              balMap[item.productId],
              item.productId,
              product?.name ?? item.productName,
              'finished_good',
              'sales_dispatch',
              0,
              item.quantity,
              salesOrderId,
              'sales_order',
              dispatchedBy,
              `Dispatched for ${liveOrder.orderNumber}`,
              undefined,
              product?.unitName || 'packets'
            );
            balMap[item.productId] = updatedBalance;
            tx.set(doc(db, 'stockLedger', ledgerEntry.id), stripUndefined(ledgerEntry));
            tx.set(doc(db, 'inventoryBalances', item.productId), stripUndefined(updatedBalance));
          }

          tx.update(orderRef, { status: 'dispatched', updatedAt: Timestamp.now() });
          const aud = appendAudit('ORDER_DISPATCHED', 'sales_order', salesOrderId, {
            orderNumber: liveOrder.orderNumber,
          });
          tx.set(doc(db, 'auditLogs', aud.id), stripUndefined(aud));
        });
        return { ok: true };
      } catch (err: any) {
        console.error('Dispatch failed:', err);
        return { ok: false, error: err?.message || 'Dispatch failed due to insufficient stock' };
      }
    }

    try {
      let resultError: string | undefined;
      update((prev) => {
        const liveOrder = prev.salesOrders.find((o) => o.id === salesOrderId);
        if (!liveOrder || liveOrder.status !== 'invoiced') {
          resultError = 'Order is not ready for dispatch.';
          return {};
        }

        const ledger = [...prev.stockLedger];
        const balances = [...prev.inventoryBalances];

        for (const item of liveOrder.items) {
          const product = prev.products.find((p) => p.id === item.productId);
          const curBal = balances.find((b) => b.itemId === item.productId);
          const { ledgerEntry, updatedBalance } = computeStockMovement(
            curBal,
            item.productId,
            product?.name ?? item.productName,
            'finished_good',
            'sales_dispatch',
            0,
            item.quantity,
            salesOrderId,
            'sales_order',
            dispatchedBy,
            `Dispatched for ${liveOrder.orderNumber}`,
            undefined,
            product?.unitName || 'packets'
          );
          ledger.push(ledgerEntry);
          const idx = balances.findIndex((b) => b.itemId === item.productId);
          if (idx >= 0) balances[idx] = updatedBalance;
        }

        return {
          salesOrders: prev.salesOrders.map((o) =>
            o.id === salesOrderId ? { ...o, status: 'dispatched' as const } : o
          ),
          stockLedger: ledger,
          inventoryBalances: balances,
        };
      });
      if (resultError) return { ok: false, error: resultError };
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Insufficient stock to dispatch' };
    }
  }, [update, state.salesOrders, state.products, user, appendAudit]);

  // ===== PAYMENTS (Atomic + Invoice Allocation) =====
  const recordPayment = useCallback(async (
    payment: Partial<Payment> & { targetInvoiceId?: string }
  ): Promise<ActionResult> => {
    const amountPaise = payment.amountPaise || 0;
    if (amountPaise <= 0) return { ok: false, error: 'Payment amount must be greater than 0.' };
    if (!payment.customerId) return { ok: false, error: 'Customer is required.' };

    const id = generateId('pay');
    const serial = getNextSerialFromList(state.payments.map((p) => p.paymentNumber));
    const paymentNumber = `PAY-${serial.toString().padStart(4, '0')}`;

    // Compute invoice allocations (target invoice first, then FIFO open posted invoices)
    const openInvoices = state.invoices
      .filter((inv) => inv.customerId === payment.customerId && inv.status === 'posted')
      .filter((inv) => (inv.grandTotalPaise - (inv.paidPaise || 0)) > 0)
      .sort((a, b) => {
        if (payment.targetInvoiceId && a.id === payment.targetInvoiceId) return -1;
        if (payment.targetInvoiceId && b.id === payment.targetInvoiceId) return 1;
        return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
      });

    let remaining = amountPaise;
    const allocations: PaymentAllocation[] = [];
    const invoiceUpdates: { id: string; newPaidPaise: number; paymentStatus: 'partial' | 'paid' }[] = [];

    for (const inv of openInvoices) {
      if (remaining <= 0) break;
      const due = inv.grandTotalPaise - (inv.paidPaise || 0);
      const alloc = Math.min(remaining, due);
      if (alloc > 0) {
        allocations.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          allocatedPaise: alloc,
        });
        const newPaid = (inv.paidPaise || 0) + alloc;
        invoiceUpdates.push({
          id: inv.id,
          newPaidPaise: newPaid,
          paymentStatus: newPaid >= inv.grandTotalPaise ? 'paid' : 'partial',
        });
        remaining -= alloc;
      }
    }

    const newPayment: Payment = {
      id,
      paymentNumber,
      customerId: payment.customerId,
      customerName: payment.customerName || '',
      amountPaise,
      paymentMode: payment.paymentMode || 'bank_transfer',
      referenceNumber: payment.referenceNumber,
      notes: payment.notes,
      allocations,
      unallocatedPaise: remaining,
      idempotencyKey: generateId('idem'),
      receivedBy: payment.receivedBy || '',
      paymentDate: Timestamp.now() as any,
      createdAt: Timestamp.now() as any,
    };

    if (isFirebaseConfigured && user) {
      try {
        await runTransaction(db, async (tx) => {
          const custRef = doc(db, 'customers', newPayment.customerId);
          const custSnap = await tx.get(custRef);
          const currentOutstanding = custSnap.exists() ? (custSnap.data().outstandingPaise || 0) : 0;

          tx.set(doc(db, 'payments', id), stripUndefined(newPayment));
          tx.update(custRef, {
            outstandingPaise: Math.max(0, currentOutstanding - amountPaise),
            updatedAt: Timestamp.now(),
          });

          for (const upd of invoiceUpdates) {
            tx.update(doc(db, 'invoices', upd.id), {
              paidPaise: upd.newPaidPaise,
              paymentStatus: upd.paymentStatus,
            });
          }

          const aud = appendAudit('PAYMENT_RECORDED', 'payment', id, {
            paymentNumber,
            amountPaise,
            allocationsCount: allocations.length,
          });
          tx.set(doc(db, 'auditLogs', aud.id), stripUndefined(aud));
        });
        return { ok: true, id };
      } catch (err: any) {
        return { ok: false, error: err?.message || 'Failed to record payment' };
      }
    }

    update((prev) => ({
      payments: [...prev.payments, newPayment],
      customers: prev.customers.map((c) =>
        c.id === newPayment.customerId
          ? { ...c, outstandingPaise: Math.max(0, c.outstandingPaise - amountPaise) }
          : c
      ),
      invoices: prev.invoices.map((inv) => {
        const upd = invoiceUpdates.find((u) => u.id === inv.id);
        return upd ? { ...inv, paidPaise: upd.newPaidPaise, paymentStatus: upd.paymentStatus } : inv;
      }),
    }));
    return { ok: true, id };
  }, [update, state.payments, state.invoices, user, appendAudit]);

  // ===== EXPENSES =====
  const recordExpense = useCallback((expense: Partial<Expense>) => {
    const id = generateId('exp');
    const newExpense: Expense = {
      id,
      category: expense.category || 'other',
      description: expense.description || '',
      amountPaise: expense.amountPaise || 0,
      productionRunId: expense.productionRunId,
      date: Timestamp.now() as any,
      createdBy: expense.createdBy || '',
      createdAt: Timestamp.now() as any,
    };

    if (isFirebaseConfigured && user) {
      setDoc(doc(db, 'expenses', id), stripUndefined(newExpense)).catch(console.error);
      return;
    }

    update((prev) => ({
      expenses: [...prev.expenses, newExpense],
    }));
  }, [update, user]);

  // ===== LEDGER RECONCILIATION =====
  const reconcileStockLedger = useCallback(async (autoFix = false): Promise<ReconciliationResult> => {
    const totals: Record<string, number> = {};
    for (const entry of state.stockLedger) {
      totals[entry.itemId] = (totals[entry.itemId] || 0) + (entry.quantityIn || 0) - (entry.quantityOut || 0);
    }

    const mismatches: ReconciliationResult['mismatches'] = [];
    for (const bal of state.inventoryBalances) {
      const ledgerSum = totals[bal.itemId] || 0;
      if (bal.currentStock !== ledgerSum) {
        mismatches.push({
          itemId: bal.itemId,
          itemName: bal.itemName,
          balanceDoc: bal.currentStock,
          ledgerSum,
        });
      }
    }

    if (autoFix && mismatches.length > 0) {
      if (isFirebaseConfigured && user) {
        await runTransaction(db, async (tx) => {
          for (const m of mismatches) {
            const bal = state.inventoryBalances.find((b) => b.itemId === m.itemId);
            if (!bal) continue;
            const newValuePaise = Math.round((m.ledgerSum * bal.weightedAvgRatePaise) / 1000);
            tx.update(doc(db, 'inventoryBalances', m.itemId), {
              currentStock: m.ledgerSum,
              valuePaise: newValuePaise,
              isLowStock: m.ledgerSum < bal.reorderLevel,
              updatedAt: Timestamp.now(),
            });
          }
        });
      } else {
        update((prev) => ({
          inventoryBalances: prev.inventoryBalances.map((bal) => {
            const m = mismatches.find((x) => x.itemId === bal.itemId);
            if (!m) return bal;
            return {
              ...bal,
              currentStock: m.ledgerSum,
              valuePaise: Math.round((m.ledgerSum * bal.weightedAvgRatePaise) / 1000),
              isLowStock: m.ledgerSum < bal.reorderLevel,
            };
          }),
        }));
      }
    }

    return {
      reconciled: mismatches.length === 0,
      checkedItems: state.inventoryBalances.length,
      mismatches,
    };
  }, [state.stockLedger, state.inventoryBalances, user, update]);

  // ===== SETTINGS UPDATE =====
  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    const nextSettings: AppSettings = { ...state.settings, ...updates };
    if (isFirebaseConfigured && user) {
      await setDoc(doc(db, 'settings', 'company'), stripUndefined(nextSettings), { merge: true });
      return;
    }
    update(() => ({ settings: nextSettings }));
  }, [state.settings, user, update]);

  // ===== STOCK QUERIES =====
  const checkStockAvailability = useCallback((productId: string, qty: number) => {
    const bal = state.inventoryBalances.find((b) => b.itemId === productId);
    const current = bal?.currentStock ?? 0;
    return {
      available: current >= qty,
      currentStock: current,
      shortage: Math.max(0, qty - current),
    };
  }, [state.inventoryBalances]);

  const getStockBalance = useCallback((itemId: string) => {
    return state.inventoryBalances.find((b) => b.itemId === itemId)?.currentStock ?? 0;
  }, [state.inventoryBalances]);

  // ===== PRODUCTION COST =====
  const getProductionCost = useCallback((runId: string) => {
    const run = state.productionRuns.find((r) => r.id === runId);
    if (!run) return null;
    const matCost = run.actualMaterials.reduce((s, m) => s + (m.amountPaise ?? 0), 0);
    const runExpenses = state.expenses.filter((e) => e.productionRunId === runId);
    const labourCost = runExpenses.filter((e) => e.category === 'labour').reduce((s, e) => s + e.amountPaise, 0);
    const overheadCost = runExpenses
      .filter((e) => e.category === 'gas_power' || e.category === 'maintenance' || e.category === 'other')
      .reduce((s, e) => s + e.amountPaise, 0);
    const totalCost = matCost + labourCost + overheadCost;
    const goodPackets = fromScaledQty(run.goodOutput);
    const costPerPacket = goodPackets > 0 ? Math.round(totalCost / goodPackets) : 0;
    const product = state.products.find((p) => p.id === run.productId);
    const sellingPrice = product?.sellingPricePaise ?? 0;

    return {
      materialCostPaise: matCost,
      labourCostPaise: labourCost,
      overheadCostPaise: overheadCost,
      totalCostPaise: totalCost,
      goodPackets,
      costPerPacketPaise: costPerPacket,
      sellingPricePaise: sellingPrice,
      grossContributionPaise: sellingPrice - costPerPacket,
      grossMarginPercent: sellingPrice > 0 ? ((sellingPrice - costPerPacket) / sellingPrice) * 100 : 0,
    };
  }, [state.productionRuns, state.expenses, state.products]);

  const getCustomerOutstanding = useCallback((customerId: string) => {
    return state.customers.find((c) => c.id === customerId)?.outstandingPaise ?? 0;
  }, [state.customers]);

  const getMonthlyRevenue = useCallback(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const totals = new Array(12).fill(0);

    for (const inv of state.invoices) {
      if (inv.status !== 'posted') continue;
      const ms = inv.invoiceDate?.seconds ? inv.invoiceDate.seconds * 1000 : Date.now();
      const monthIdx = new Date(ms).getMonth();
      totals[monthIdx] += inv.grandTotalPaise;
    }

    return months.map((month, i) => ({
      month,
      revenue: totals[i],
    }));
  }, [state.invoices]);

  const value: StoreContextType = {
    ...state,
    createCustomer,
    createProduct,
    createMaterial,
    createSupplier,
    createBOM,
    createPurchaseReceipt,
    createProductionRun,
    issueProductionMaterials,
    completeProductionRun,
    createSalesOrder,
    submitSalesOrder,
    markOrderUnderReview,
    approveSalesOrder,
    rejectSalesOrder,
    cancelSalesOrder,
    createInvoice,
    cancelInvoice,
    dispatchOrder,
    recordPayment,
    recordExpense,
    reconcileStockLedger,
    updateSettings,
    checkStockAvailability,
    getStockBalance,
    getProductionCost,
    getCustomerOutstanding,
    getMonthlyRevenue,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextType {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
