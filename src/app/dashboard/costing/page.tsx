'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '@/lib/store/store-context';
import { useAuth } from '@/lib/auth/auth-context';
import { PageHeader, Card, CardHeader, KPICard, Button, Modal, EmptyState } from '@/components/ui';
import { formatCurrency, fromScaledQty, toPaise } from '@/lib/utils';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { ExpenseCategory } from '@/lib/types';
import {
  Calculator, IndianRupee, TrendingUp, Factory,
  Users as UsersIcon, Flame, Plus
} from 'lucide-react';

const COST_COLORS = ['#3457ed', '#f59e0b', '#10b981', '#6366f1'];

export default function CostingPage() {
  const {
    productionRuns,
    recordExpense,
    getProductionCost,
  } = useStore();
  const { user } = useAuth();

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('labour');
  const [expenseAmount, setExpenseAmount] = useState(0);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [selectedRunId, setSelectedRunId] = useState('');

  const completedRuns = useMemo(
    () => productionRuns.filter((r) => r.status === 'completed'),
    [productionRuns]
  );

  const activeRun = useMemo(() => {
    if (selectedRunId) {
      return productionRuns.find((r) => r.id === selectedRunId) || completedRuns[0] || productionRuns[0];
    }
    return completedRuns[0] || productionRuns[0];
  }, [selectedRunId, productionRuns, completedRuns]);

  const activeCosting = activeRun ? getProductionCost(activeRun.id) : null;

  const pieData = useMemo(() => {
    if (!activeCosting) return [];
    return [
      { name: 'Direct Materials', value: activeCosting.materialCostPaise / 100 },
      { name: 'Direct Labour', value: activeCosting.labourCostPaise / 100 },
      { name: 'Gas & Power Overheads', value: activeCosting.overheadCostPaise / 100 },
    ].filter((d) => d.value > 0);
  }, [activeCosting]);

  const costShares = useMemo(() => {
    if (!activeCosting || activeCosting.totalCostPaise <= 0) {
      return { material: 0, labour: 0, overhead: 0 };
    }
    const total = activeCosting.totalCostPaise;
    return {
      material: (activeCosting.materialCostPaise / total) * 100,
      labour: (activeCosting.labourCostPaise / total) * 100,
      overhead: (activeCosting.overheadCostPaise / total) * 100,
    };
  }, [activeCosting]);

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseAmount <= 0) return;
    recordExpense({
      category: expenseCategory,
      description: expenseDesc.trim() || `${expenseCategory.replace('_', ' ')} expense`,
      amountPaise: toPaise(expenseAmount),
      productionRunId: selectedRunId || activeRun?.id || undefined,
      createdBy: user?.displayName || 'Accountant',
    });
    setExpenseAmount(0);
    setExpenseDesc('');
    setIsExpenseModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Costing & Profitability Analysis"
        description="Dynamic batch cost absorption, direct labour and energy allocation, unit economics, and gross contribution"
      >
        <Button onClick={() => setIsExpenseModalOpen(true)} icon={Plus}>
          Record Batch Expense
        </Button>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Unit Production Cost"
          value={activeCosting ? formatCurrency(activeCosting.costPerPacketPaise) : '₹0.00'}
          icon={Calculator}
          trend="neutral"
        />
        <KPICard
          title="Selling Price (Pre-tax)"
          value={activeCosting ? formatCurrency(activeCosting.sellingPricePaise) : '₹0.00'}
          icon={IndianRupee}
        />
        <KPICard
          title="Gross Contribution / Pkt"
          value={activeCosting ? formatCurrency(activeCosting.grossContributionPaise) : '₹0.00'}
          icon={TrendingUp}
          trend={activeCosting && activeCosting.grossContributionPaise > 0 ? 'up' : 'neutral'}
        />
        <KPICard
          title="Gross Margin %"
          value={activeCosting ? `${activeCosting.grossMarginPercent.toFixed(1)}%` : '0.0%'}
          icon={Factory}
          trend={activeCosting && activeCosting.grossMarginPercent > 0 ? 'up' : 'neutral'}
        />
      </div>

      {!activeRun || !activeCosting ? (
        <Card>
          <EmptyState
            icon={Calculator}
            title="No production batches to analyze yet"
            description="Create and complete a production run first, then record labour or utility expenses to inspect real-time unit economics."
            action={
              <Button onClick={() => setIsExpenseModalOpen(true)} icon={Plus} size="sm">
                Record Factory Expense
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Detailed Cost Absorption Sheet */}
          <div className="lg:col-span-7 space-y-6">
            <Card padding="none" className="overflow-hidden">
              <div className="border-b border-surface-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-surface-900 flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-primary-600" />
                    Batch Cost Absorption Sheet — {activeRun.productName}
                  </h3>
                  <p className="text-xs text-surface-500 mt-0.5">
                    Run {activeRun.runNumber} • Output: {activeCosting.goodPackets} Good Packets • Target: {activeRun.batchSize}
                  </p>
                </div>
                {productionRuns.length > 1 && (
                  <select
                    value={activeRun.id}
                    onChange={(e) => setSelectedRunId(e.target.value)}
                    className="h-8 px-2.5 rounded-lg border border-surface-300 bg-white text-xs font-medium outline-none"
                  >
                    {productionRuns.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.runNumber} — {r.productName} ({r.status})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="p-6 space-y-5">
                {/* Materials Breakdown */}
                <div>
                  <div className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-2.5">
                    1. Direct Materials Consumed (Weighted Average Rates)
                  </div>
                  <div className="rounded-xl border border-surface-200 divide-y divide-surface-200 text-sm">
                    {activeRun.actualMaterials.length === 0 ? (
                      <div className="p-4 text-xs text-surface-500 text-center">
                        Materials have not been issued to this batch yet.
                      </div>
                    ) : (
                      activeRun.actualMaterials.map((mat, idx) => {
                        const qty = fromScaledQty(mat.quantity);
                        const amount = mat.amountPaise || 0;
                        const ratePaise = qty > 0 ? Math.round(amount / qty) : 0;
                        return (
                          <div key={idx} className="p-3.5 flex justify-between bg-surface-50/50">
                            <span className="font-medium text-surface-700">
                              • {mat.materialName} ({qty} {mat.materialUnit} @ {formatCurrency(ratePaise)} / {mat.materialUnit})
                            </span>
                            <span className="font-bold tabular-nums text-surface-900">
                              {formatCurrency(amount)}
                            </span>
                          </div>
                        );
                      })
                    )}
                    <div className="p-3.5 flex justify-between bg-surface-100 font-extrabold text-surface-900 text-base">
                      <span>Total Direct Material Cost:</span>
                      <span className="tabular-nums">{formatCurrency(activeCosting.materialCostPaise)}</span>
                    </div>
                  </div>
                </div>

                {/* Conversion Costs */}
                <div>
                  <div className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-2">
                    2. Conversion Costs (Labour & Energy Absorption)
                  </div>
                  <div className="rounded-lg border border-surface-200 divide-y divide-surface-200 text-xs">
                    <div className="p-2.5 flex justify-between bg-surface-50/50">
                      <span className="flex items-center gap-1.5">
                        <UsersIcon className="h-3.5 w-3.5 text-amber-500" />
                        Direct Batch Labour
                      </span>
                      <span className="font-semibold tabular-nums text-surface-900">
                        {formatCurrency(activeCosting.labourCostPaise)}
                      </span>
                    </div>
                    <div className="p-2.5 flex justify-between bg-surface-50/50">
                      <span className="flex items-center gap-1.5">
                        <Flame className="h-3.5 w-3.5 text-error-500" />
                        Gas & Electricity Fuel Costs
                      </span>
                      <span className="font-semibold tabular-nums text-surface-900">
                        {formatCurrency(activeCosting.overheadCostPaise)}
                      </span>
                    </div>
                    <div className="p-2.5 flex justify-between bg-surface-100 font-bold text-surface-900">
                      <span>Total Conversion Cost:</span>
                      <span className="tabular-nums">
                        {formatCurrency(activeCosting.labourCostPaise + activeCosting.overheadCostPaise)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Final Unit Economics Total */}
                <div className="p-4 rounded-xl bg-primary-950 text-white space-y-2">
                  <div className="flex justify-between text-xs text-primary-200">
                    <span>Total Batch Production Cost:</span>
                    <span className="font-bold text-base text-white tabular-nums">
                      {formatCurrency(activeCosting.totalCostPaise)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-primary-200">
                    <span>Good Output Quantity:</span>
                    <span className="font-semibold text-white">{activeCosting.goodPackets} Packets</span>
                  </div>
                  <div className="border-t border-primary-800 pt-2 flex justify-between items-center">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-primary-300 font-bold">
                        Cost per Good Packet:
                      </div>
                      <div className="text-[11px] text-primary-400">
                        {activeCosting.goodPackets > 0
                          ? `${formatCurrency(activeCosting.totalCostPaise)} / ${activeCosting.goodPackets} packets`
                          : 'Complete batch to calculate unit cost'}
                      </div>
                    </div>
                    <div className="text-2xl font-black text-emerald-400 tabular-nums">
                      {formatCurrency(activeCosting.costPerPacketPaise)}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right: Charts & Contribution Margin */}
          <div className="lg:col-span-5 space-y-6">
            <Card>
              <CardHeader
                title="Cost Proportion by Category"
                description="Direct materials vs labour vs utility overheads"
              />
              {pieData.length === 0 ? (
                <div className="h-44 flex items-center justify-center text-xs text-surface-500">
                  Issue materials or record expenses to visualize cost breakdown.
                </div>
              ) : (
                <>
                  <div className="h-56 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {pieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COST_COLORS[index % COST_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Cost']}
                          contentStyle={{ borderRadius: 8, fontSize: 12 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-surface-200">
                    <div>
                      <span className="block font-bold text-primary-600">{costShares.material.toFixed(1)}%</span>
                      <span className="text-surface-500 text-[10px]">Material</span>
                    </div>
                    <div>
                      <span className="block font-bold text-amber-500">{costShares.labour.toFixed(1)}%</span>
                      <span className="text-surface-500 text-[10px]">Labour</span>
                    </div>
                    <div>
                      <span className="block font-bold text-emerald-600">{costShares.overhead.toFixed(1)}%</span>
                      <span className="text-surface-500 text-[10px]">Overhead</span>
                    </div>
                  </div>
                </>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Unit Margin & Contribution"
                description="Per packet unit economics analysis"
              />
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center p-2 rounded bg-surface-50">
                  <span className="text-surface-600">Selling Price (Excl. GST):</span>
                  <span className="font-bold text-surface-900 tabular-nums">
                    {formatCurrency(activeCosting.sellingPricePaise)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-surface-50">
                  <span className="text-surface-600">Less: Unit Production Cost:</span>
                  <span className="font-bold text-error-600 tabular-nums">
                    -{formatCurrency(activeCosting.costPerPacketPaise)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-success-50 border border-success-200">
                  <div>
                    <span className="font-bold text-success-900 block">Gross Contribution:</span>
                    <span className="text-[11px] text-success-700">
                      Gross Margin: {activeCosting.grossMarginPercent.toFixed(1)}%
                    </span>
                  </div>
                  <span className="font-black text-lg text-success-700 tabular-nums">
                    {activeCosting.grossContributionPaise >= 0 ? '+' : ''}
                    {formatCurrency(activeCosting.grossContributionPaise)} / pkt
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Record Expense Modal */}
      <Modal
        open={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        title="Record Production Batch Expense"
        description="Allocate factory floor labour, gas, electricity, or maintenance to a specific batch."
        size="md"
      >
        <form onSubmit={handleExpenseSubmit} className="space-y-4">
          {productionRuns.length > 0 && (
            <div>
              <label className="text-sm font-medium text-surface-700 block mb-1">Production Run (Optional)</label>
              <select
                value={selectedRunId || activeRun?.id || ''}
                onChange={(e) => setSelectedRunId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-surface-300 bg-white text-sm outline-none"
              >
                {productionRuns.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.runNumber} — {r.productName} ({r.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-surface-700 block mb-1">Expense Category</label>
            <select
              value={expenseCategory}
              onChange={(e) => setExpenseCategory(e.target.value as ExpenseCategory)}
              className="w-full h-10 px-3 rounded-lg border border-surface-300 bg-white text-sm outline-none"
            >
              <option value="labour">Direct Labour (Frying & Packing Wages)</option>
              <option value="gas_power">Gas & Electricity / Power Utility</option>
              <option value="transport">Freight & Transport</option>
              <option value="maintenance">Equipment Maintenance</option>
              <option value="other">Other Factory Overhead</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-surface-700 block mb-1">Amount (₹ Rupees)</label>
            <input
              type="number"
              min="1"
              step="any"
              required
              value={expenseAmount || ''}
              onChange={(e) => setExpenseAmount(parseFloat(e.target.value) || 0)}
              placeholder="e.g. 1200"
              className="w-full h-10 px-3 rounded-lg border border-surface-300 text-base font-bold tabular-nums outline-none text-surface-900"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-surface-700 block mb-1">Description</label>
            <input
              type="text"
              required
              value={expenseDesc}
              onChange={(e) => setExpenseDesc(e.target.value)}
              placeholder="e.g. Direct batch frying & packing labour"
              className="w-full h-10 px-3 rounded-lg border border-surface-300 bg-white text-sm outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
            <Button type="button" variant="secondary" onClick={() => setIsExpenseModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Record Expense & Recalculate
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
