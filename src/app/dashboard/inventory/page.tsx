'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@/lib/store/store-context';
import { PageHeader, Card, CardHeader, Button, StatusBadge, EmptyState, Tabs, Input, Select, Modal, KPICard } from '@/components/ui';
import { formatCurrency, formatQuantity, fromScaledQty, toScaledQty, toPaise, toRupees, formatDate } from '@/lib/utils';
import type { MaterialType } from '@/lib/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Warehouse, Package, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Search, Filter, TrendingUp, TrendingDown, Layers, Archive, History, CheckCircle2, Plus
} from 'lucide-react';

export default function InventoryPage() {
  const { inventoryBalances, stockLedger, materials, products, createMaterial } = useStore();

  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddMatOpen, setIsAddMatOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [matName, setMatName] = useState('');
  const [matCode, setMatCode] = useState('');
  const [matType, setMatType] = useState<MaterialType>('raw_material');
  const [matUnit, setMatUnit] = useState('kg');
  const [reorderQty, setReorderQty] = useState(10);
  const [openingQty, setOpeningQty] = useState(0);
  const [openingRate, setOpeningRate] = useState(0);

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matName.trim() || !matCode.trim()) return;
    setSaving(true);
    try {
      await createMaterial(
        {
          name: matName.trim(),
          code: matCode.trim().toUpperCase(),
          type: matType,
          unitId: `unit_${matUnit}`,
          unitName: matUnit,
          currentRatePaise: toPaise(openingRate),
          reorderLevel: toScaledQty(reorderQty),
        },
        openingQty,
        toPaise(openingRate)
      );
      setIsAddMatOpen(false);
      setMatName('');
      setMatCode('');
      setOpeningQty(0);
      setOpeningRate(0);
    } finally {
      setSaving(false);
    }
  };

  // Filtered inventory items
  const filteredBalances = useMemo(() => {
    return inventoryBalances.filter((b) => {
      const matchesTab =
        activeTab === 'all'
          ? true
          : activeTab === 'raw'
          ? b.itemType === 'raw_material'
          : activeTab === 'packaging'
          ? b.itemType === 'packaging_material'
          : b.itemType === 'finished_good';

      const matchesSearch = b.itemName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [inventoryBalances, activeTab, searchQuery]);

  // Aggregate valuations
  const stats = useMemo(() => {
    const rawVal = inventoryBalances
      .filter((b) => b.itemType === 'raw_material')
      .reduce((sum, b) => sum + (b.valuePaise || 0), 0);
    const packVal = inventoryBalances
      .filter((b) => b.itemType === 'packaging_material')
      .reduce((sum, b) => sum + (b.valuePaise || 0), 0);
    const fgCount = inventoryBalances
      .filter((b) => b.itemType === 'finished_good')
      .reduce((sum, b) => sum + fromScaledQty(b.currentStock), 0);
    const lowStockCount = inventoryBalances.filter((b) => b.isLowStock).length;

    return { rawVal, packVal, fgCount, lowStockCount };
  }, [inventoryBalances]);

  // Chart data
  const chartData = useMemo(() => {
    return inventoryBalances.map((b) => ({
      name: b.itemName.length > 16 ? `${b.itemName.slice(0, 14)}…` : b.itemName,
      stock: fromScaledQty(b.currentStock),
      reorder: fromScaledQty(b.reorderLevel),
      unit: b.unitName,
    }));
  }, [inventoryBalances]);

  const tabs = [
    { id: 'all', label: 'All Items', count: inventoryBalances.length },
    { id: 'raw', label: 'Raw Materials', count: inventoryBalances.filter((b) => b.itemType === 'raw_material').length },
    { id: 'packaging', label: 'Packaging', count: inventoryBalances.filter((b) => b.itemType === 'packaging_material').length },
    { id: 'finished', label: 'Finished Goods', count: inventoryBalances.filter((b) => b.itemType === 'finished_good').length },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory & Stock Ledger"
        description="Real-time stock valuation, weighted average costing, and immutable stock ledger movements"
      >
        <Button onClick={() => setIsAddMatOpen(true)} icon={Plus}>
          Add Material
        </Button>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Raw Material Valuation"
          value={formatCurrency(stats.rawVal)}
          icon={Layers}
          trend="neutral"
        />
        <KPICard
          title="Packaging Valuation"
          value={formatCurrency(stats.packVal)}
          icon={Archive}
          trend="neutral"
        />
        <KPICard
          title="Finished Goods on Hand"
          value={`${stats.fgCount} pkts`}
          icon={Package}
          trend={stats.fgCount > 50 ? 'up' : 'down'}
        />
        <KPICard
          title="Low Stock Items"
          value={stats.lowStockCount.toString()}
          icon={AlertTriangle}
          trend={stats.lowStockCount > 0 ? 'down' : 'neutral'}
        />
      </div>

      {/* Stock Levels Chart */}
      <Card>
        <CardHeader
          title="Inventory Levels & Reorder Thresholds"
          description="Comparison of current warehouse quantities against safety thresholds"
        />
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload;
                  return (
                    <div className="rounded-lg border border-surface-200 bg-white px-3 py-2 shadow-dropdown text-xs">
                      <p className="font-semibold text-surface-900">{label}</p>
                      <p className="text-primary-600 mt-1">Current: {item.stock} {item.unit}</p>
                      <p className="text-surface-500">Reorder Level: {item.reorder} {item.unit}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="stock" fill="#3457ed" radius={[4, 4, 0, 0]} name="Current Stock" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Current Balances Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="border-b border-surface-200 p-4 space-y-4">
          <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
              <input
                type="text"
                placeholder="Search items by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-surface-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
            <div className="text-xs text-surface-500 font-medium">
              Source of Truth: Reconciled with Stock Ledger
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-surface-100 text-surface-600 text-xs uppercase font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Item Details</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4 text-right">Current Stock</th>
                <th className="px-6 py-4 text-right">Reorder Level</th>
                <th className="px-6 py-4 text-right">Weighted Avg Rate</th>
                <th className="px-6 py-4 text-right">Total Valuation</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200">
              {filteredBalances.map((item) => (
                <tr key={item.id} className="hover:bg-surface-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-surface-900 text-base">{item.itemName}</div>
                    <div className="text-xs font-mono text-surface-400 mt-0.5">ID: {item.itemId}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="capitalize text-xs px-3 py-1 rounded-full bg-surface-100 text-surface-700 font-semibold border border-surface-200">
                      {item.itemType.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-extrabold text-surface-900 text-base tabular-nums">
                    {fromScaledQty(item.currentStock)} {item.unitName}
                  </td>
                  <td className="px-6 py-4 text-right text-surface-600 font-medium tabular-nums text-sm">
                    {fromScaledQty(item.reorderLevel)} {item.unitName}
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums text-surface-700 font-semibold text-sm">
                    {item.weightedAvgRatePaise > 0 ? (
                      `${formatCurrency(item.weightedAvgRatePaise)} / ${item.unitName}`
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-extrabold text-surface-900 text-base tabular-nums">
                    {item.valuePaise > 0 ? formatCurrency(item.valuePaise) : '—'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {item.isLowStock ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                        <AlertTriangle className="h-3.5 w-3.5" /> Low Stock
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Healthy
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Stock Ledger Section */}
      <Card padding="none" className="overflow-hidden">
        <div className="border-b border-surface-200 p-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-surface-900 flex items-center gap-2">
              <History className="h-4 w-4 text-primary-600" />
              Stock Movement Ledger (Audit Log)
            </h3>
            <p className="text-xs text-surface-500 mt-0.5">
              Append-only immutable record of every transaction, receipt, issue, and dispatch
            </p>
          </div>
          <div className="text-xs text-surface-400 font-mono">
            Total Movements: {stockLedger.length}
          </div>
        </div>

        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-surface-100 text-surface-600 uppercase font-medium sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2.5">Date & Time</th>
                <th className="px-4 py-2.5">Item</th>
                <th className="px-4 py-2.5">Movement Type</th>
                <th className="px-4 py-2.5 text-right">In</th>
                <th className="px-4 py-2.5 text-right">Out</th>
                <th className="px-4 py-2.5 text-right">Running Balance</th>
                <th className="px-4 py-2.5">Source Doc</th>
                <th className="px-4 py-2.5">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200">
              {[...stockLedger].reverse().map((entry) => (
                <tr key={entry.id} className="hover:bg-surface-50/70 transition-colors">
                  <td className="px-4 py-2 text-surface-500 whitespace-nowrap">
                    {formatDate(new Date(entry.timestamp?.seconds ? entry.timestamp.seconds * 1000 : Date.now()))}
                  </td>
                  <td className="px-4 py-2 font-medium text-surface-900">{entry.itemName}</td>
                  <td className="px-4 py-2">
                    <span className="capitalize px-2 py-0.5 rounded text-[11px] font-medium bg-surface-100 text-surface-700">
                      {entry.movementType.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-success-600 tabular-nums">
                    {entry.quantityIn > 0 ? `+${fromScaledQty(entry.quantityIn)}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-error-600 tabular-nums">
                    {entry.quantityOut > 0 ? `-${fromScaledQty(entry.quantityOut)}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-surface-900 tabular-nums">
                    {fromScaledQty(entry.newBalance)}
                  </td>
                  <td className="px-4 py-2 text-surface-500 font-mono text-[11px]">{entry.sourceDocumentId}</td>
                  <td className="px-4 py-2 text-surface-500">{entry.remarks || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={isAddMatOpen}
        onClose={() => setIsAddMatOpen(false)}
        title="Add Raw or Packaging Material"
        description="Register a new material with reorder threshold and optional opening inventory."
        size="md"
      >
        <form onSubmit={handleAddMaterial} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Material Name"
              required
              value={matName}
              onChange={(e) => setMatName(e.target.value)}
              placeholder="e.g. Rice Flour"
            />
            <Input
              label="Material Code"
              required
              value={matCode}
              onChange={(e) => setMatCode(e.target.value.toUpperCase())}
              placeholder="e.g. RM-FLR"
            />
            <Select
              label="Material Type"
              value={matType}
              onChange={(e) => setMatType(e.target.value as MaterialType)}
              options={[
                { value: 'raw_material', label: 'Raw Material' },
                { value: 'packaging_material', label: 'Packaging Material' },
              ]}
            />
            <Select
              label="Unit of Measure"
              value={matUnit}
              onChange={(e) => setMatUnit(e.target.value)}
              options={[
                { value: 'kg', label: 'Kilograms (kg)' },
                { value: 'L', label: 'Liters (L)' },
                { value: 'pcs', label: 'Pieces (pcs)' },
              ]}
            />
            <Input
              label="Reorder Alert Level"
              type="number"
              min="0"
              step="any"
              value={reorderQty}
              onChange={(e) => setReorderQty(parseFloat(e.target.value) || 0)}
            />
            <Input
              label="Opening Quantity (Optional)"
              type="number"
              min="0"
              step="any"
              value={openingQty}
              onChange={(e) => setOpeningQty(parseFloat(e.target.value) || 0)}
            />
            <Input
              label="Opening Rate per Unit (₹)"
              type="number"
              min="0"
              step="any"
              value={openingRate}
              onChange={(e) => setOpeningRate(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-surface-200">
            <Button type="button" variant="secondary" onClick={() => setIsAddMatOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save Material
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
