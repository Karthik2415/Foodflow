'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  writeBatch,
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
  Payment, Expense, Notification, AuditLogEntry, AppSettings,
} from '@/lib/types';
import { calculateGST, generateId, toScaledQty, fromScaledQty, calculateVariance } from '@/lib/utils';

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
  createPurchaseReceipt: (receipt: Omit<PurchaseReceipt, 'id' | 'createdAt'>) => void;
  createProductionRun: (run: Partial<ProductionRun>) => string;
  issueProductionMaterials: (runId: string, materials: { materialId: string; quantity: number }[]) => void;
  completeProductionRun: (runId: string, goodOutput: number, rejectedOutput: number, damagedPackaging: number) => void;
  createSalesOrder: (order: Partial<SalesOrder>) => string;
  approveSalesOrder: (orderId: string, approvedBy: string) => void;
  rejectSalesOrder: (orderId: string, reason: string) => void;
  createInvoice: (salesOrderId: string, createdBy: string) => string;
  dispatchOrder: (salesOrderId: string, dispatchedBy: string) => void;
  recordPayment: (payment: Partial<Payment>) => void;
  recordExpense: (expense: Partial<Expense>) => void;
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

  // Helper to compute stock movement
  const addStockMovement = useCallback((
    currentState: StoreState,
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
    reorderLevel?: number,
  ): { ledgerEntry: StockLedgerEntry; updatedBalance: InventoryBalance } => {
    const currentBalance = currentState.inventoryBalances.find((b) => b.itemId === itemId);
    const prevBal = currentBalance?.currentStock ?? 0;
    const newBal = prevBal + quantityIn - quantityOut;
    const nowTs = Timestamp.now();

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
      ratePaise,
      valuePaise: ratePaise ? Math.round(ratePaise * (quantityIn - quantityOut) / 1000) : undefined,
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
      weightedAvgRatePaise: currentBalance?.weightedAvgRatePaise ?? ratePaise ?? 0,
      valuePaise: 0,
      reorderLevel: reorderLevel ?? currentBalance?.reorderLevel ?? 0,
      isLowStock: false,
      lastMovementAt: nowTs as any,
      updatedAt: nowTs as any,
    };

    if (quantityIn > 0 && ratePaise && (movementType === 'purchase_receipt' || movementType === 'opening_balance')) {
      const oldValue = prevBal * (currentBalance?.weightedAvgRatePaise ?? 0) / 1000;
      const newValue = quantityIn * ratePaise / 1000;
      updBalance.weightedAvgRatePaise = prevBal + quantityIn > 0
        ? Math.round((oldValue + newValue) / ((prevBal + quantityIn) / 1000))
        : 0;
    }

    updBalance.valuePaise = Math.round(updBalance.currentStock * updBalance.weightedAvgRatePaise / 1000);
    updBalance.isLowStock = updBalance.currentStock < updBalance.reorderLevel;

    return { ledgerEntry: entry, updatedBalance: updBalance };
  }, []);

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
      const batch = writeBatch(db);
      batch.set(doc(db, 'products', id), stripUndefined(newProduct));
      batch.set(doc(db, 'inventoryBalances', id), stripUndefined(initialBalance));
      await batch.commit();
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
      currentRatePaise: openingRatePaise || material.currentRatePaise,
      currentStock: scaledOpening,
      isActive: true,
      createdAt: nowTs as any,
      updatedAt: nowTs as any,
    };

    const { ledgerEntry, updatedBalance } = addStockMovement(
      state,
      id,
      material.name,
      material.type,
      'opening_balance',
      scaledOpening,
      0,
      'OPENING',
      'opening_balance',
      user?.id || 'system',
      'Initial material setup',
      openingRatePaise || material.currentRatePaise,
      material.unitName,
      material.reorderLevel
    );

    if (isFirebaseConfigured && user) {
      const batch = writeBatch(db);
      batch.set(doc(db, 'rawMaterials', id), stripUndefined(newMaterial));
      batch.set(doc(db, 'inventoryBalances', id), stripUndefined(updatedBalance));
      if (scaledOpening > 0) {
        batch.set(doc(db, 'stockLedger', ledgerEntry.id), stripUndefined(ledgerEntry));
      }
      await batch.commit();
      return id;
    }

    update((prev) => ({
      materials: [...prev.materials, newMaterial],
      inventoryBalances: [...prev.inventoryBalances, updatedBalance],
      stockLedger: scaledOpening > 0 ? [...prev.stockLedger, ledgerEntry] : prev.stockLedger,
    }));
    return id;
  }, [update, addStockMovement, state, user]);

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
      const batch = writeBatch(db);
      batch.set(doc(db, 'bomHeaders', headerId), stripUndefined(header));
      bomItemDocs.forEach((bi) => batch.set(doc(db, 'bomItems', bi.id), stripUndefined(bi)));
      await batch.commit();
      return headerId;
    }

    update((prev) => ({
      bomHeaders: [...prev.bomHeaders, header],
      bomItems: [...prev.bomItems, ...bomItemDocs],
    }));
    return headerId;
  }, [update, user]);

  // ===== PURCHASE RECEIPT =====
  const createPurchaseReceipt = useCallback((receipt: Omit<PurchaseReceipt, 'id' | 'createdAt'>) => {
    const receiptId = generateId('pr');
    const newReceipt: PurchaseReceipt = {
      ...receipt,
      id: receiptId,
      createdAt: Timestamp.now() as any,
    };

    if (isFirebaseConfigured && user) {
      const batch = writeBatch(db);
      batch.set(doc(db, 'purchaseReceipts', receiptId), stripUndefined(newReceipt));
      let balances = [...state.inventoryBalances];

      for (const item of receipt.items) {
        const mat = state.materials.find((m) => m.id === item.materialId);
        const { ledgerEntry, updatedBalance } = addStockMovement(
          { ...state, inventoryBalances: balances },
          item.materialId,
          item.materialName,
          mat?.type || 'raw_material',
          'purchase_receipt',
          item.quantity,
          0,
          receiptId,
          'purchase_receipt',
          receipt.createdBy,
          `Purchase from ${receipt.supplierName}`,
          item.ratePaise,
          item.materialUnit,
          mat?.reorderLevel
        );
        batch.set(doc(db, 'stockLedger', ledgerEntry.id), stripUndefined(ledgerEntry));
        batch.set(doc(db, 'inventoryBalances', item.materialId), stripUndefined(updatedBalance));
        const idx = balances.findIndex((b) => b.itemId === item.materialId);
        if (idx >= 0) balances[idx] = updatedBalance;
        else balances.push(updatedBalance);
      }

      batch.commit().catch((err) => console.error('Failed to commit purchase receipt:', err));
      return;
    }

    update((prev) => {
      let ledger = [...prev.stockLedger];
      let balances = [...prev.inventoryBalances];

      for (const item of receipt.items) {
        const mat = prev.materials.find((m) => m.id === item.materialId);
        const { ledgerEntry, updatedBalance } = addStockMovement(
          { ...prev, stockLedger: ledger, inventoryBalances: balances },
          item.materialId,
          item.materialName,
          mat?.type || 'raw_material',
          'purchase_receipt',
          item.quantity,
          0,
          newReceipt.id,
          'purchase_receipt',
          receipt.createdBy,
          `Purchase from ${receipt.supplierName}`,
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
      };
    });
  }, [update, addStockMovement, state, user]);

  // ===== PRODUCTION =====
  const createProductionRun = useCallback((run: Partial<ProductionRun>): string => {
    const id = generateId('prod');
    const newRun: ProductionRun = {
      id,
      runNumber: `PR-${(state.productionRuns.length + 1).toString().padStart(4, '0')}`,
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
  }, [update, state.productionRuns.length, user]);

  const issueProductionMaterials = useCallback((runId: string, materials: { materialId: string; quantity: number }[]) => {
    if (isFirebaseConfigured && user) {
      const run = state.productionRuns.find((r) => r.id === runId);
      if (!run) return;
      const batch = writeBatch(db);
      let balances = [...state.inventoryBalances];

      const actualMats = materials.map((m) => {
        const mat = state.materials.find((rm) => rm.id === m.materialId);
        const bal = balances.find((b) => b.itemId === m.materialId);
        const { ledgerEntry, updatedBalance } = addStockMovement(
          { ...state, inventoryBalances: balances },
          m.materialId,
          mat?.name ?? '',
          mat?.type === 'packaging_material' ? 'packaging_material' : 'raw_material',
          'production_issue',
          0,
          m.quantity,
          runId,
          'production_run',
          run.createdBy,
          `Issued for ${run.runNumber}`,
          bal?.weightedAvgRatePaise,
        );
        batch.set(doc(db, 'stockLedger', ledgerEntry.id), stripUndefined(ledgerEntry));
        batch.set(doc(db, 'inventoryBalances', m.materialId), stripUndefined(updatedBalance));
        const idx = balances.findIndex((b) => b.itemId === m.materialId);
        if (idx >= 0) balances[idx] = updatedBalance;

        return {
          materialId: m.materialId,
          materialName: mat?.name ?? '',
          materialUnit: mat?.unitName ?? '',
          quantity: m.quantity,
          ratePaise: bal?.weightedAvgRatePaise,
          amountPaise: Math.round(m.quantity * (bal?.weightedAvgRatePaise ?? 0) / 1000),
        };
      });

      batch.update(doc(db, 'productionRuns', runId), {
        actualMaterials: actualMats,
        status: 'in_progress',
        updatedAt: Timestamp.now(),
      });
      batch.commit().catch(console.error);
      return;
    }

    update((prev) => {
      let ledger = [...prev.stockLedger];
      let balances = [...prev.inventoryBalances];
      const runs = prev.productionRuns.map((r) => {
        if (r.id !== runId) return r;
        const actualMats = materials.map((m) => {
          const mat = prev.materials.find((rm) => rm.id === m.materialId);
          const bal = balances.find((b) => b.itemId === m.materialId);
          const { ledgerEntry, updatedBalance } = addStockMovement(
            { ...prev, stockLedger: ledger, inventoryBalances: balances },
            m.materialId,
            mat?.name ?? '',
            mat?.type === 'packaging_material' ? 'packaging_material' : 'raw_material',
            'production_issue',
            0,
            m.quantity,
            runId,
            'production_run',
            r.createdBy,
            `Issued for ${r.runNumber}`,
            bal?.weightedAvgRatePaise,
          );
          ledger.push(ledgerEntry);
          const idx = balances.findIndex((b) => b.itemId === m.materialId);
          if (idx >= 0) balances[idx] = updatedBalance;

          return {
            materialId: m.materialId,
            materialName: mat?.name ?? '',
            materialUnit: mat?.unitName ?? '',
            quantity: m.quantity,
            ratePaise: bal?.weightedAvgRatePaise,
            amountPaise: Math.round(m.quantity * (bal?.weightedAvgRatePaise ?? 0) / 1000),
          };
        });

        return { ...r, actualMaterials: actualMats, status: 'in_progress' as const };
      });

      return { productionRuns: runs, stockLedger: ledger, inventoryBalances: balances };
    });
  }, [update, addStockMovement, state, user]);

  const completeProductionRun = useCallback((runId: string, goodOutput: number, rejectedOutput: number, damagedPackaging: number) => {
    if (isFirebaseConfigured && user) {
      const r = state.productionRuns.find((run) => run.id === runId);
      if (!r) return;
      const product = state.products.find((p) => p.id === r.productId);
      const batch = writeBatch(db);
      const { ledgerEntry, updatedBalance } = addStockMovement(
        state,
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
        undefined,
        product?.unitName || 'packets'
      );
      batch.set(doc(db, 'stockLedger', ledgerEntry.id), stripUndefined(ledgerEntry));
      batch.set(doc(db, 'inventoryBalances', r.productId), stripUndefined(updatedBalance));

      const totalMatCost = r.actualMaterials.reduce((sum, m) => sum + (m.amountPaise ?? 0), 0);
      const yieldVar = r.batchSize > 0 ? calculateVariance(r.batchSize, goodOutput) : 0;

      batch.update(doc(db, 'productionRuns', runId), {
        goodOutput: toScaledQty(goodOutput),
        rejectedOutput: toScaledQty(rejectedOutput),
        damagedPackaging: toScaledQty(damagedPackaging),
        status: 'completed',
        totalMaterialCostPaise: totalMatCost,
        yieldVariancePercent: yieldVar,
        completedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      batch.commit().catch(console.error);
      return;
    }

    update((prev) => {
      let ledger = [...prev.stockLedger];
      let balances = [...prev.inventoryBalances];
      const runs = prev.productionRuns.map((r) => {
        if (r.id !== runId) return r;

        const product = prev.products.find((p) => p.id === r.productId);
        const { ledgerEntry, updatedBalance } = addStockMovement(
          { ...prev, stockLedger: ledger, inventoryBalances: balances },
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
          undefined,
          product?.unitName || 'packets'
        );
        ledger.push(ledgerEntry);
        const idx = balances.findIndex((b) => b.itemId === r.productId);
        if (idx >= 0) balances[idx] = updatedBalance;
        else balances.push(updatedBalance);

        const totalMatCost = r.actualMaterials.reduce((sum, m) => sum + (m.amountPaise ?? 0), 0);
        const yieldVar = r.batchSize > 0 ? calculateVariance(r.batchSize, goodOutput) : 0;

        return {
          ...r,
          goodOutput: toScaledQty(goodOutput),
          rejectedOutput: toScaledQty(rejectedOutput),
          damagedPackaging: toScaledQty(damagedPackaging),
          status: 'completed' as const,
          totalMaterialCostPaise: totalMatCost,
          yieldVariancePercent: yieldVar,
          completedAt: Timestamp.now() as any,
        };
      });

      return { productionRuns: runs, stockLedger: ledger, inventoryBalances: balances };
    });
  }, [update, addStockMovement, state, user]);

  // ===== SALES ORDERS =====
  const createSalesOrder = useCallback((order: Partial<SalesOrder>): string => {
    const id = generateId('so');
    const shortages: any[] = [];
    for (const item of (order.items || [])) {
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

    const newOrder: SalesOrder = {
      id,
      orderNumber: `SO-${(state.salesOrders.length + 1).toString().padStart(4, '0')}`,
      status: 'submitted',
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
  }, [update, state.inventoryBalances, state.salesOrders.length, user]);

  const approveSalesOrder = useCallback((orderId: string, approvedBy: string) => {
    if (isFirebaseConfigured && user) {
      updateDoc(doc(db, 'salesOrders', orderId), {
        status: 'approved',
        approvedBy,
        approvedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }).catch(console.error);
      return;
    }

    update((prev) => ({
      salesOrders: prev.salesOrders.map((o) =>
        o.id === orderId
          ? { ...o, status: 'approved' as const, approvedBy, approvedAt: Timestamp.now() as any }
          : o
      ),
    }));
  }, [update, user]);

  const rejectSalesOrder = useCallback((orderId: string, reason: string) => {
    if (isFirebaseConfigured && user) {
      updateDoc(doc(db, 'salesOrders', orderId), {
        status: 'rejected',
        rejectionReason: reason,
        updatedAt: Timestamp.now(),
      }).catch(console.error);
      return;
    }

    update((prev) => ({
      salesOrders: prev.salesOrders.map((o) =>
        o.id === orderId
          ? { ...o, status: 'rejected' as const, rejectionReason: reason }
          : o
      ),
    }));
  }, [update, user]);

  // ===== INVOICE =====
  const createInvoice = useCallback((salesOrderId: string, createdBy: string): string => {
    const id = generateId('inv');
    const order = state.salesOrders.find((o) => o.id === salesOrderId);
    if (!order) return id;

    const customer = state.customers.find((c) => c.id === order.customerId);
    const isInterstate = customer?.state !== state.settings.factoryState;

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
    const invoiceNum = `${state.settings.invoicePrefix}/${new Date().getFullYear()}-${(new Date().getFullYear() + 1).toString().slice(2)}/${(state.invoices.length + 1).toString().padStart(4, '0')}`;

    const invoice: Invoice = {
      id,
      invoiceNumber: invoiceNum,
      salesOrderId,
      customerId: order.customerId,
      customerName: order.customerName,
      customerGstin: customer?.gstin,
      customerAddress: customer?.billingAddress ?? { line1: '', city: '', state: '', pincode: '' },
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
      idempotencyKey: generateId('idem'),
      financialYear: `${new Date().getFullYear()}-${(new Date().getFullYear() + 1).toString().slice(2)}`,
      invoiceDate: Timestamp.now() as any,
      createdBy,
      createdAt: Timestamp.now() as any,
    };

    if (isFirebaseConfigured && user) {
      runTransaction(db, async (tx) => {
        const custRef = doc(db, 'customers', order.customerId);
        const custSnap = await tx.get(custRef);
        const currentOutstanding = custSnap.exists() ? (custSnap.data().outstandingPaise || 0) : 0;

        tx.set(doc(db, 'invoices', id), stripUndefined(invoice));
        tx.update(doc(db, 'salesOrders', salesOrderId), { status: 'invoiced', updatedAt: Timestamp.now() });
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
  }, [update, state, user]);

  // ===== DISPATCH =====
  const dispatchOrder = useCallback((salesOrderId: string, dispatchedBy: string) => {
    const order = state.salesOrders.find((o) => o.id === salesOrderId);
    if (!order) return;

    if (isFirebaseConfigured && user) {
      const batch = writeBatch(db);
      let balances = [...state.inventoryBalances];

      for (const item of order.items) {
        const product = state.products.find((p) => p.id === item.productId);
        const { ledgerEntry, updatedBalance } = addStockMovement(
          { ...state, inventoryBalances: balances },
          item.productId,
          product?.name ?? item.productName,
          'finished_good',
          'sales_dispatch',
          0,
          item.quantity,
          salesOrderId,
          'sales_order',
          dispatchedBy,
          `Dispatched for ${order.orderNumber}`,
        );
        batch.set(doc(db, 'stockLedger', ledgerEntry.id), stripUndefined(ledgerEntry));
        batch.set(doc(db, 'inventoryBalances', item.productId), stripUndefined(updatedBalance));
        const idx = balances.findIndex((b) => b.itemId === item.productId);
        if (idx >= 0) balances[idx] = updatedBalance;
      }

      batch.update(doc(db, 'salesOrders', salesOrderId), { status: 'dispatched', updatedAt: Timestamp.now() });
      batch.commit().catch(console.error);
      return;
    }

    update((prev) => {
      let ledger = [...prev.stockLedger];
      let balances = [...prev.inventoryBalances];

      for (const item of order.items) {
        const product = prev.products.find((p) => p.id === item.productId);
        const { ledgerEntry, updatedBalance } = addStockMovement(
          { ...prev, stockLedger: ledger, inventoryBalances: balances },
          item.productId,
          product?.name ?? item.productName,
          'finished_good',
          'sales_dispatch',
          0,
          item.quantity,
          salesOrderId,
          'sales_order',
          dispatchedBy,
          `Dispatched for ${order.orderNumber}`,
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
  }, [update, addStockMovement, state, user]);

  // ===== PAYMENTS =====
  const recordPayment = useCallback((payment: Partial<Payment>) => {
    const id = generateId('pay');
    const newPayment: Payment = {
      id,
      paymentNumber: `PAY-${(state.payments.length + 1).toString().padStart(4, '0')}`,
      customerId: payment.customerId || '',
      customerName: payment.customerName || '',
      amountPaise: payment.amountPaise || 0,
      paymentMode: payment.paymentMode || 'bank_transfer',
      allocations: payment.allocations || [],
      unallocatedPaise: 0,
      idempotencyKey: generateId('idem'),
      receivedBy: payment.receivedBy || '',
      paymentDate: Timestamp.now() as any,
      createdAt: Timestamp.now() as any,
      ...payment,
    } as Payment;

    if (isFirebaseConfigured && user) {
      runTransaction(db, async (tx) => {
        const custRef = doc(db, 'customers', newPayment.customerId);
        const custSnap = await tx.get(custRef);
        const currentOutstanding = custSnap.exists() ? (custSnap.data().outstandingPaise || 0) : 0;

        tx.set(doc(db, 'payments', id), stripUndefined(newPayment));
        tx.update(custRef, {
          outstandingPaise: Math.max(0, currentOutstanding - newPayment.amountPaise),
          updatedAt: Timestamp.now(),
        });
      }).catch(console.error);
      return;
    }

    update((prev) => ({
      payments: [...prev.payments, newPayment],
      customers: prev.customers.map((c) =>
        c.id === newPayment.customerId
          ? { ...c, outstandingPaise: Math.max(0, c.outstandingPaise - newPayment.amountPaise) }
          : c
      ),
    }));
  }, [update, state.payments.length, user]);

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
    const runExpenses = state.expenses.filter((e) => !e.productionRunId || e.productionRunId === runId);
    const labourCost = runExpenses.filter((e) => e.category === 'labour').reduce((s, e) => s + e.amountPaise, 0);
    const overheadCost = runExpenses.filter((e) => e.category === 'gas_power').reduce((s, e) => s + e.amountPaise, 0);
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

  // Real monthly revenue computed directly from posted invoices
  const getMonthlyRevenue = useCallback(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const totals = new Array(12).fill(0);

    for (const inv of state.invoices) {
      if (inv.status !== 'posted') continue;
      const ms = inv.invoiceDate?.seconds ? inv.invoiceDate.seconds * 1000 : Date.now();
      const monthIdx = new Date(ms).getMonth();
      totals[monthIdx] += inv.grandTotalPaise;
    }

    return months.map((month, i) => ({ month, revenue: totals[i] }));
  }, [state.invoices]);

  const contextValue: StoreContextType = {
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
    approveSalesOrder,
    rejectSalesOrder,
    createInvoice,
    dispatchOrder,
    recordPayment,
    recordExpense,
    checkStockAvailability,
    getStockBalance,
    getProductionCost,
    getCustomerOutstanding,
    getMonthlyRevenue,
  };

  return (
    <StoreContext.Provider value={contextValue}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within StoreProvider');
  return context;
}
