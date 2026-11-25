'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store/store-context';
import { useAuth } from '@/lib/auth/auth-context';
import { PageHeader, Card, CardHeader, Button, EmptyState, Modal, Input, Select, KPICard } from '@/components/ui';
import { formatCurrency, fromScaledQty, toScaledQty, toPaise, formatDate } from '@/lib/utils';
import type { PurchaseReceipt } from '@/lib/types';
import {
  PackagePlus, Plus, Truck, Package, Search, Building2,
  ArrowRight, CheckCircle2, IndianRupee, Layers, Calendar, Phone, MapPin
} from 'lucide-react';

export default function PurchasesPage() {
  const {
    suppliers,
    materials,
    purchaseReceipts,
    inventoryBalances,
    createPurchaseReceipt,
    createSupplier,
  } = useStore();
  const { user } = useAuth();

  const [isNewReceiptModalOpen, setIsNewReceiptModalOpen] = useState(false);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [receiptItems, setReceiptItems] = useState<{ materialId: string; quantity: number; rate: number }[]>([
    { materialId: '', quantity: 0, rate: 0 },
  ]);
  const [invoiceRefNumber, setInvoiceRefNumber] = useState('');

  // Add Supplier state
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supGstin, setSupGstin] = useState('');
  const [supCity, setSupCity] = useState('');
  const [supState, setSupState] = useState('Tamil Nadu');

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) return;
    await createSupplier({
      name: supName.trim(),
      contactPerson: supContact.trim(),
      phone: supPhone.trim(),
      gstin: supGstin.trim() || undefined,
      address: { line1: '', city: supCity.trim(), state: supState.trim(), pincode: '' },
      materials: [],
    });
    setIsAddSupplierOpen(false);
    setSupName('');
    setSupContact('');
    setSupPhone('');
    setSupGstin('');
    setSupCity('');
  };

  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId) || suppliers[0];

  // Calculated receipt total
  const receiptTotalPaise = useMemo(() => {
    return receiptItems.reduce((sum, item) => sum + toPaise(item.quantity * item.rate), 0);
  }, [receiptItems]);

  const handleReceiptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;

    const items = receiptItems.map((item) => {
      const mat = materials.find((m) => m.id === item.materialId);
      return {
        materialId: item.materialId,
        materialName: mat?.name || 'Material',
        materialUnit: mat?.unitName || 'kg',
        quantity: toScaledQty(item.quantity),
        ratePaise: toPaise(item.rate),
        amountPaise: toPaise(item.quantity * item.rate),
      };
    });

    createPurchaseReceipt({
      receiptNumber: `PR-${(purchaseReceipts.length + 1).toString().padStart(4, '0')}`,
      supplierId: selectedSupplier.id,
      supplierName: selectedSupplier.name,
      items,
      totalAmountPaise: receiptTotalPaise,
      invoiceNumber: invoiceRefNumber,
      idempotencyKey: `idem_pr_${Date.now()}`,
      createdBy: user?.displayName || 'Store Manager',
    });

    setIsNewReceiptModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Management"
        description="Raw material procurement, GRN goods receipts, vendor management, and weighted-average rate recalculation"
      >
        <Button variant="secondary" onClick={() => setIsAddSupplierOpen(true)} icon={Building2}>
          Add Supplier
        </Button>
        <Button
          onClick={() => {
            setSelectedSupplierId(suppliers[0]?.id || '');
            setReceiptItems([{ materialId: materials[0]?.id || '', quantity: 0, rate: 0 }]);
            setIsNewReceiptModalOpen(true);
          }}
          icon={Plus}
        >
          New Purchase Receipt (GRN)
        </Button>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Purchases Value"
          value={formatCurrency(purchaseReceipts.reduce((sum, r) => sum + r.totalAmountPaise, 0))}
          icon={IndianRupee}
          trend="neutral"
        />
        <KPICard
          title="Goods Receipts (GRN)"
          value={purchaseReceipts.length.toString()}
          icon={Truck}
        />
        <KPICard
          title="Approved Suppliers"
          value={suppliers.length.toString()}
          icon={Building2}
        />
        <KPICard
          title="Raw Materials Tracked"
          value={materials.length.toString()}
          icon={Layers}
        />
      </div>

      {/* Purchase Receipts Register */}
      <Card padding="none" className="overflow-hidden">
        <div className="border-b border-surface-200 p-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-surface-900 flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary-600" />
              Goods Receipt Notes (GRN)
            </h3>
            <p className="text-xs text-surface-500 mt-0.5">
              Material receipts that update warehouse inventory and recalculate moving weighted average costs
            </p>
          </div>
          <div className="text-xs text-surface-500 font-medium">
            {purchaseReceipts.length} Receipts Posted
          </div>
        </div>

        {purchaseReceipts.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={PackagePlus}
              title="No purchase receipts recorded yet"
              description="Record a Goods Receipt Note (GRN) when raw or packaging materials arrive at the factory to update stock and weighted average rates."
              action={
                <Button onClick={() => setIsNewReceiptModalOpen(true)} icon={Plus} size="sm">
                  Record Purchase
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-surface-100 text-surface-600 text-xs uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">GRN #</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Supplier Name</th>
                  <th className="px-6 py-4">Vendor Invoice #</th>
                  <th className="px-6 py-4">Items Received</th>
                  <th className="px-6 py-4 text-right">Total GRN Value</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {purchaseReceipts.map((pr) => (
                  <tr key={pr.id} className="hover:bg-surface-50/80 transition-colors">
                    <td className="px-6 py-4 font-black font-mono text-surface-900 text-base">{pr.receiptNumber}</td>
                    <td className="px-6 py-4 text-xs font-medium text-surface-500">
                      {formatDate(new Date(pr.createdAt?.seconds ? pr.createdAt.seconds * 1000 : Date.now()))}
                    </td>
                    <td className="px-6 py-4 font-bold text-surface-900 text-base">{pr.supplierName}</td>
                    <td className="px-6 py-4 text-xs font-mono text-surface-600 font-semibold">{pr.invoiceNumber || '—'}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {pr.items.map((item, idx) => (
                          <span key={idx} className="text-xs px-2.5 py-1 rounded-lg bg-surface-100 text-surface-800 font-bold border border-surface-200 shadow-xs">
                            {fromScaledQty(item.quantity)} {item.materialUnit} {item.materialName} @ {formatCurrency(item.ratePaise)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-extrabold text-surface-900 text-lg tabular-nums">
                      {formatCurrency(pr.totalAmountPaise)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Received
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Supplier Directory */}
      <Card padding="none" className="overflow-hidden">
        <div className="border-b border-surface-200 p-4">
          <h3 className="font-semibold text-surface-900 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary-600" />
            Approved Raw Material & Packaging Suppliers
          </h3>
          <p className="text-xs text-surface-500 mt-0.5">
            Registered suppliers in Tamil Nadu with active GSTIN credentials
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-surface-200">
          {suppliers.map((sup) => (
            <div key={sup.id} className="p-5 space-y-3">
              <div>
                <h4 className="font-bold text-surface-900 text-base">{sup.name}</h4>
                <p className="text-xs text-surface-500 flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3" /> {sup.address.city}, {sup.address.state}
                </p>
              </div>

              <div className="text-xs space-y-1 text-surface-600">
                <p>Contact: <strong>{sup.contactPerson}</strong></p>
                <p className="flex items-center gap-1">
                  <Phone className="h-3 w-3 text-surface-400" /> {sup.phone}
                </p>
                <p className="font-mono text-[11px] text-surface-500">GSTIN: {sup.gstin}</p>
              </div>

              <div className="pt-2">
                <span className="text-[11px] text-surface-400 font-semibold block uppercase">Supplies:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {sup.materials.map((mId) => {
                    const m = materials.find((mat) => mat.id === mId);
                    return (
                      <span key={mId} className="text-[11px] px-2 py-0.5 rounded bg-primary-50 text-primary-700 font-medium">
                        {m?.name || mId}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ===== New Purchase Receipt (GRN) Modal ===== */}
      <Modal
        open={isNewReceiptModalOpen}
        onClose={() => setIsNewReceiptModalOpen(false)}
        title="Record Goods Receipt (GRN)"
        description="Enter supplier details and quantities received. Inventory stock balances and weighted average costs will be updated."
        size="lg"
      >
        <form onSubmit={handleReceiptSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-surface-700 block mb-1">Select Supplier</label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-surface-300 bg-white text-sm outline-none"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.address.city})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-surface-700 block mb-1">Vendor Invoice #</label>
              <input
                type="text"
                value={invoiceRefNumber}
                onChange={(e) => setInvoiceRefNumber(e.target.value)}
                placeholder="e.g. INV-9821"
                className="w-full h-10 px-3 rounded-lg border border-surface-300 bg-white text-sm outline-none"
              />
            </div>
          </div>

          {/* Receipt Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-surface-700">Materials Received</label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setReceiptItems([...receiptItems, { materialId: materials[0]?.id || '', quantity: 10, rate: 50 }])
                }
                icon={Plus}
              >
                Add Item
              </Button>
            </div>

            {receiptItems.map((item, idx) => (
              <div key={idx} className="p-3 bg-surface-50 rounded-lg border border-surface-200 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-5">
                  <label className="text-xs text-surface-500 block mb-1">Material</label>
                  <select
                    value={item.materialId}
                    onChange={(e) => {
                      const updated = [...receiptItems];
                      updated[idx].materialId = e.target.value;
                      setReceiptItems(updated);
                    }}
                    className="w-full h-9 px-3 rounded-lg border border-surface-300 bg-white text-sm outline-none"
                  >
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.unitName})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="text-xs text-surface-500 block mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={item.quantity}
                    onChange={(e) => {
                      const updated = [...receiptItems];
                      updated[idx].quantity = parseFloat(e.target.value) || 0;
                      setReceiptItems(updated);
                    }}
                    className="w-full h-9 px-3 rounded-lg border border-surface-300 bg-white text-sm outline-none tabular-nums"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="text-xs text-surface-500 block mb-1">Rate (₹ / unit)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={item.rate}
                    onChange={(e) => {
                      const updated = [...receiptItems];
                      updated[idx].rate = parseFloat(e.target.value) || 0;
                      setReceiptItems(updated);
                    }}
                    className="w-full h-9 px-3 rounded-lg border border-surface-300 bg-white text-sm outline-none tabular-nums"
                  />
                </div>

                <div className="sm:col-span-1 flex justify-end">
                  {receiptItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setReceiptItems(receiptItems.filter((_, i) => i !== idx))}
                      className="h-9 px-2 text-error-600 hover:bg-error-50 rounded-lg text-xs font-medium"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="p-4 bg-surface-100 rounded-xl flex justify-between items-center text-sm">
            <span className="font-semibold text-surface-700">Total Purchase Value:</span>
            <span className="font-bold text-lg text-surface-900 tabular-nums">
              {formatCurrency(receiptTotalPaise)}
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
            <Button type="button" variant="secondary" onClick={() => setIsNewReceiptModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Post Goods Receipt & Update Stock
            </Button>
          </div>
        </form>
      </Modal>

      {/* ===== Add Supplier Modal ===== */}
      <Modal
        open={isAddSupplierOpen}
        onClose={() => setIsAddSupplierOpen(false)}
        title="Add New Supplier"
        description="Register a raw material or packaging supplier."
        size="md"
      >
        <form onSubmit={handleAddSupplier} className="space-y-4">
          <Input
            label="Supplier Company Name"
            required
            value={supName}
            onChange={(e) => setSupName(e.target.value)}
            placeholder="e.g. Chennai Rice Mills"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Contact Person"
              required
              value={supContact}
              onChange={(e) => setSupContact(e.target.value)}
              placeholder="e.g. Ravi S"
            />
            <Input
              label="Phone"
              required
              value={supPhone}
              onChange={(e) => setSupPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
            <Input
              label="GSTIN (Optional)"
              value={supGstin}
              onChange={(e) => setSupGstin(e.target.value.toUpperCase())}
              placeholder="33AADCS1111A1Z1"
            />
            <Input
              label="City"
              value={supCity}
              onChange={(e) => setSupCity(e.target.value)}
              placeholder="Chennai"
            />
          </div>
          <Input
            label="State"
            required
            value={supState}
            onChange={(e) => setSupState(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
            <Button type="button" variant="secondary" onClick={() => setIsAddSupplierOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Supplier</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
