'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store/store-context';
import { PageHeader, Card, Button, Modal, Input, Select, EmptyState } from '@/components/ui';
import { formatCurrency, fromScaledQty, toPaise } from '@/lib/utils';
import { Package, Plus } from 'lucide-react';

export default function ProductsCataloguePage() {
  const { products, inventoryBalances, createProduct } = useStore();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('Snacks');
  const [unitName, setUnitName] = useState('packets');
  const [weightGrams, setWeightGrams] = useState(200);
  const [hsnCode, setHsnCode] = useState('19059040');
  const [gstRatePercent, setGstRatePercent] = useState(5);
  const [sellingPriceRupees, setSellingPriceRupees] = useState(50);
  const [mrpRupees, setMrpRupees] = useState(60);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    setSaving(true);
    try {
      await createProduct({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        category,
        unitId: `unit_${unitName}`,
        unitName,
        weightGrams,
        hsnCode: hsnCode.trim(),
        gstRatePercent,
        sellingPricePaise: toPaise(sellingPriceRupees),
        mrpPaise: toPaise(mrpRupees),
      });
      setIsAddOpen(false);
      setName('');
      setCode('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Catalogue & HSN Master"
        description="Packaged food SKUs, HSN classifications, GST tax slabs, and wholesale pricing rules"
      >
        <Button onClick={() => setIsAddOpen(true)} icon={Plus}>
          Add Product
        </Button>
      </PageHeader>

      {products.length === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            title="No products in catalogue"
            description="Create your finished food products (e.g. Murukku 200g, Mixture 250g) with HSN code and GST rate."
            action={
              <Button onClick={() => setIsAddOpen(true)} icon={Plus} size="sm">
                Add Product
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((prod) => {
            const bal = inventoryBalances.find((b) => b.itemId === prod.id);
            const currentStock = bal ? fromScaledQty(bal.currentStock) : 0;

            return (
              <Card key={prod.id} padding="none" className="overflow-hidden hover:shadow-card-hover transition-all">
                <div className="h-32 bg-gradient-to-br from-primary-900 to-primary-950 p-5 flex flex-col justify-between text-white relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-white/20 backdrop-blur-sm font-semibold">
                      {prod.code}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                      GST: {prod.gstRatePercent}%
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-snug">{prod.name}</h3>
                    <p className="text-xs text-primary-200">{prod.weightGrams}g Packaging Unit</p>
                  </div>
                </div>

                <div className="p-5 space-y-3 text-sm">
                  <div className="flex justify-between text-surface-600">
                    <span>HSN Code:</span>
                    <span className="font-mono font-semibold text-surface-900">{prod.hsnCode}</span>
                  </div>
                  <div className="flex justify-between text-surface-600">
                    <span>Selling Price (Pre-GST):</span>
                    <span className="font-bold text-surface-900 tabular-nums">
                      {formatCurrency(prod.sellingPricePaise)}
                    </span>
                  </div>
                  <div className="flex justify-between text-surface-600">
                    <span>MRP:</span>
                    <span className="font-semibold text-surface-700 tabular-nums">
                      {formatCurrency(prod.mrpPaise)}
                    </span>
                  </div>
                  <div className="pt-3 border-t border-surface-200 flex justify-between items-center">
                    <span className="text-surface-500 font-medium">Warehouse Stock:</span>
                    <span className={`font-extrabold text-base tabular-nums ${currentStock > 0 ? 'text-primary-700' : 'text-rose-600'}`}>
                      {currentStock} {prod.unitName}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add New Product"
        description="Define a finished packaged food product with HSN and GST tax settings."
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Product Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Murukku 200g"
            />
            <Input
              label="SKU Code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. MRK-200"
            />
            <Select
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={[
                { value: 'Snacks', label: 'Snacks' },
                { value: 'Chips', label: 'Chips' },
                { value: 'Sweets', label: 'Sweets' },
                { value: 'Mixtures', label: 'Mixtures' },
              ]}
            />
            <Select
              label="Unit"
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              options={[
                { value: 'packets', label: 'Packets' },
                { value: 'boxes', label: 'Boxes' },
                { value: 'kg', label: 'Kilograms (kg)' },
              ]}
            />
            <Input
              label="Pack Weight (grams)"
              type="number"
              min="1"
              value={weightGrams}
              onChange={(e) => setWeightGrams(parseInt(e.target.value) || 0)}
            />
            <Input
              label="HSN Code"
              required
              value={hsnCode}
              onChange={(e) => setHsnCode(e.target.value)}
              placeholder="19059040"
            />
            <Select
              label="GST Rate (%)"
              value={gstRatePercent.toString()}
              onChange={(e) => setGstRatePercent(parseInt(e.target.value))}
              options={[
                { value: '0', label: '0% (Exempt)' },
                { value: '5', label: '5% (Namkeen / Packaged Snacks)' },
                { value: '12', label: '12%' },
                { value: '18', label: '18%' },
              ]}
            />
            <Input
              label="Wholesale Selling Price (₹ Pre-GST)"
              type="number"
              step="any"
              min="0"
              required
              value={sellingPriceRupees}
              onChange={(e) => setSellingPriceRupees(parseFloat(e.target.value) || 0)}
            />
            <Input
              label="MRP (₹)"
              type="number"
              step="any"
              min="0"
              required
              value={mrpRupees}
              onChange={(e) => setMrpRupees(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-surface-200">
            <Button type="button" variant="secondary" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save Product
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
