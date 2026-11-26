'use client';

import React, { useState, useRef } from 'react';
import { useStore } from '@/lib/store/store-context';
import { PageHeader, Card, Button, Modal, Input, Select, EmptyState } from '@/components/ui';
import { compressProductImage } from '@/components/ui/product-thumbnail';
import { formatCurrency, fromScaledQty, toPaise } from '@/lib/utils';
import type { Product } from '@/lib/types';
import { Package, Plus, ImagePlus, Trash2, Pencil } from 'lucide-react';

export default function ProductsCataloguePage() {
  const { products, inventoryBalances, createProduct, updateProduct, deleteProduct } = useStore();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('Snacks');
  const [unitName, setUnitName] = useState('packets');
  const [weightGrams, setWeightGrams] = useState(200);
  const [hsnCode, setHsnCode] = useState('19059040');
  const [gstRatePercent, setGstRatePercent] = useState(5);
  const [sellingPriceRupees, setSellingPriceRupees] = useState(50);
  const [mrpRupees, setMrpRupees] = useState(60);
  const [imageUrl, setImageUrl] = useState('');
  const [imageError, setImageError] = useState('');

  const resetForm = () => {
    setName('');
    setCode('');
    setCategory('Snacks');
    setUnitName('packets');
    setWeightGrams(200);
    setHsnCode('19059040');
    setGstRatePercent(5);
    setSellingPriceRupees(50);
    setMrpRupees(60);
    setImageUrl('');
    setImageError('');
    setEditingProduct(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsAddOpen(true);
  };

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setName(prod.name);
    setCode(prod.code);
    setCategory(prod.category || 'Snacks');
    setUnitName(prod.unitName || 'packets');
    setWeightGrams(prod.weightGrams || 200);
    setHsnCode(prod.hsnCode || '');
    setGstRatePercent(prod.gstRatePercent ?? 5);
    setSellingPriceRupees(prod.sellingPricePaise / 100);
    setMrpRupees(prod.mrpPaise / 100);
    setImageUrl(prod.imageUrl || '');
    setImageError('');
    setIsAddOpen(true);
  };

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError('');
    try {
      const compressed = await compressProductImage(file);
      setImageUrl(compressed);
    } catch {
      setImageError('Could not process image. Please try a JPG or PNG file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    setSaving(true);
    try {
      const payload = {
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
        imageUrl: imageUrl.trim() || undefined,
      };
      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          ...payload,
          imageUrl: imageUrl.trim() || '',
        });
      } else {
        await createProduct(payload);
      }
      setIsAddOpen(false);
      resetForm();
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
        <Button onClick={openAddModal} icon={Plus}>
          Add Product
        </Button>
      </PageHeader>

      {deleteError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between">
          <span>{deleteError}</span>
          <button type="button" onClick={() => setDeleteError(null)} className="underline ml-3 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {products.length === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            title="No products in catalogue"
            description="Create your finished food products (e.g. Murukku 200g, Mixture 250g) with HSN code and GST rate."
            action={
              <Button onClick={openAddModal} icon={Plus} size="sm">
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
                <div className="h-40 bg-gradient-to-br from-primary-900 to-primary-950 p-5 flex flex-col justify-between text-white relative overflow-hidden">
                  {prod.imageUrl && (
                    <>
                      <img
                        src={prod.imageUrl}
                        alt={prod.name}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/45" />
                    </>
                  )}
                  <div className="relative z-10 flex justify-between items-start gap-2">
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-black/35 backdrop-blur-sm font-semibold">
                      {prod.code}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs px-2.5 py-0.5 rounded bg-emerald-500/25 text-emerald-200 backdrop-blur-sm font-bold">
                        GST: {prod.gstRatePercent}%
                      </span>
                      <button
                        type="button"
                        onClick={() => openEditModal(prod)}
                        title="Edit product & picture"
                        className="p-1.5 rounded-lg bg-black/35 hover:bg-black/55 text-white transition-colors cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm(`Delete product "${prod.name}"?`)) return;
                          setDeleteError(null);
                          const res = await deleteProduct(prod.id);
                          if (!res.ok) setDeleteError(res.error || 'Could not delete product.');
                        }}
                        title="Delete product"
                        className="p-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="relative z-10">
                    <h3 className="font-bold text-lg leading-snug drop-shadow-xs">{prod.name}</h3>
                    <p className="text-xs text-primary-100">{prod.weightGrams}g Packaging Unit</p>
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
        onClose={() => {
          setIsAddOpen(false);
          resetForm();
        }}
        title={editingProduct ? 'Edit Product' : 'Add New Product'}
        description="Define a finished packaged food product with picture, HSN, and GST tax settings."
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Product Picture Upload */}
          <div className="space-y-2">
            <label className="text-xs sm:text-sm font-semibold text-surface-700 tracking-wide block">
              Product Picture
            </label>
            <div className="flex items-center gap-4 p-3 rounded-xl border border-dashed border-surface-300 bg-surface-50/70">
              <div className="h-16 w-16 shrink-0 rounded-xl border border-surface-200 bg-white overflow-hidden flex items-center justify-center">
                {imageUrl ? (
                  <img src={imageUrl} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-7 w-7 text-surface-300" />
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageFile}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={ImagePlus}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imageUrl ? 'Change Picture' : 'Upload Picture'}
                  </Button>
                  {imageUrl && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={Trash2}
                      onClick={() => setImageUrl('')}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <input
                  type="url"
                  value={imageUrl.startsWith('data:') ? '' : imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Or paste an image URL (https://...)"
                  className="w-full h-8 px-2.5 rounded-lg border border-surface-200 bg-white text-xs text-surface-700 placeholder:text-surface-400 focus:outline-none focus:border-primary-500"
                />
                {imageError && <p className="text-xs text-rose-600 font-medium">{imageError}</p>}
              </div>
            </div>
          </div>

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
