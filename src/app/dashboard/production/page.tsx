'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '@/lib/store/store-context';
import { useAuth } from '@/lib/auth/auth-context';
import { PageHeader, Card, Button, StatusBadge, EmptyState, Modal, KPICard } from '@/components/ui';
import { formatCurrency, fromScaledQty, toScaledQty, formatPercentage, calculateVariance } from '@/lib/utils';
import { PRODUCTION_STATUS_CONFIG } from '@/lib/constants';
import type { ProductionRun, ProductionMaterial } from '@/lib/types';
import {
  Factory, Plus, Play, CheckCircle2, Package,
  ClipboardList, Trash2
} from 'lucide-react';

export default function ProductionPage() {
  const {
    productionRuns,
    products,
    materials,
    bomHeaders,
    bomItems,
    createBOM,
    createProductionRun,
    issueProductionMaterials,
    completeProductionRun,
  } = useStore();
  const { user } = useAuth();

  // New Run Modal state
  const [isNewRunModalOpen, setIsNewRunModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || '');
  const [batchSize, setBatchSize] = useState(100);

  // Create BOM Modal state
  const [isBOMModalOpen, setIsBOMModalOpen] = useState(false);
  const [bomProductId, setBomProductId] = useState(products[0]?.id || '');
  const [bomBatchSize, setBomBatchSize] = useState(100);
  const [bomRows, setBomRows] = useState<{ materialId: string; quantity: number }[]>([
    { materialId: '', quantity: 1 },
  ]);

  // Active BOM viewer selection
  const [viewingBomId, setViewingBomId] = useState('');

  // Material Issue Modal state
  const [issueModalRun, setIssueModalRun] = useState<ProductionRun | null>(null);
  const [issueInputs, setIssueInputs] = useState<Record<string, number>>({});

  // Completion Modal state
  const [completionModalRun, setCompletionModalRun] = useState<ProductionRun | null>(null);
  const [goodOutput, setGoodOutput] = useState(0);
  const [rejectedOutput, setRejectedOutput] = useState(0);
  const [damagedPackaging, setDamagedPackaging] = useState(0);

  // BOM for New Run Modal
  const effectiveProductId = selectedProductId || products[0]?.id || '';
  const currentBOMHeader = bomHeaders.find((b) => b.productId === effectiveProductId) || bomHeaders[0];
  const currentBOMItems = bomItems.filter((item) => item.bomHeaderId === currentBOMHeader?.id);

  // BOM for Reference Table
  const displayedBOMHeader =
    bomHeaders.find((b) => b.id === viewingBomId) || bomHeaders[0];
  const displayedBOMItems = bomItems.filter(
    (item) => item.bomHeaderId === displayedBOMHeader?.id
  );

  // Open Material Issue Modal
  const handleOpenIssueModal = (run: ProductionRun) => {
    setIssueModalRun(run);
    const initialInputs: Record<string, number> = {};
    run.plannedMaterials.forEach((m) => {
      initialInputs[m.materialId] = fromScaledQty(m.quantity);
    });
    setIssueInputs(initialInputs);
  };

  // Submit Material Issue
  const handleIssueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueModalRun) return;

    const materialsToIssue = Object.entries(issueInputs).map(([materialId, qty]) => ({
      materialId,
      quantity: toScaledQty(qty),
    }));

    issueProductionMaterials(issueModalRun.id, materialsToIssue);
    setIssueModalRun(null);
  };

  // Open Completion Modal
  const handleOpenCompletionModal = (run: ProductionRun) => {
    setCompletionModalRun(run);
    setGoodOutput(run.batchSize);
    setRejectedOutput(0);
    setDamagedPackaging(0);
  };

  // Submit Completion
  const handleCompletionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completionModalRun) return;

    completeProductionRun(
      completionModalRun.id,
      goodOutput,
      rejectedOutput,
      damagedPackaging
    );
    setCompletionModalRun(null);
  };

  // Handle New Run Submit
  const handleCreateRunSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find((p) => p.id === effectiveProductId);
    const bom = bomHeaders.find((b) => b.productId === effectiveProductId);
    if (!prod || !bom) return;

    const scaleFactor = bom.batchSize > 0 ? batchSize / bom.batchSize : 1;
    const itemsForBom = bomItems.filter((i) => i.bomHeaderId === bom.id);
    const plannedMaterials: ProductionMaterial[] = itemsForBom.map((bomi) => ({
      materialId: bomi.materialId,
      materialName: bomi.materialName,
      materialUnit: bomi.materialUnit,
      quantity: Math.round(bomi.standardQuantity * scaleFactor),
    }));

    createProductionRun({
      productId: prod.id,
      productName: prod.name,
      bomHeaderId: bom.id,
      batchSize,
      plannedMaterials,
      actualMaterials: [],
      createdBy: user?.displayName || 'Production Supervisor',
    });

    setIsNewRunModalOpen(false);
  };

  // Handle Create BOM Submit
  const handleOpenBOMModal = () => {
    setBomProductId(products[0]?.id || '');
    setBomBatchSize(100);
    setBomRows([{ materialId: materials[0]?.id || '', quantity: 1 }]);
    setIsBOMModalOpen(true);
  };

  const handleCreateBOMSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find((p) => p.id === (bomProductId || products[0]?.id));
    if (!prod) return;

    const validItems = bomRows
      .filter((row) => row.materialId && row.quantity > 0)
      .map((row) => {
        const mat = materials.find((m) => m.id === row.materialId);
        return {
          materialId: row.materialId,
          materialName: mat?.name || 'Material',
          materialUnit: mat?.unitName || 'kg',
          standardQuantity: row.quantity,
        };
      });

    if (validItems.length === 0) return;

    const newBomId = await createBOM(prod.id, prod.name, bomBatchSize, validItems);
    setViewingBomId(newBomId);
    setIsBOMModalOpen(false);
  };

  // Aggregate Stats
  const stats = useMemo(() => {
    const totalRuns = productionRuns.length;
    const completedRuns = productionRuns.filter((r) => r.status === 'completed').length;
    const totalGoodPackets = productionRuns
      .filter((r) => r.status === 'completed')
      .reduce((sum, r) => sum + fromScaledQty(r.goodOutput), 0);

    return { totalRuns, completedRuns, totalGoodPackets };
  }, [productionRuns]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Management"
        description="Batch production planning, standard BOM execution, variance tracking, and finished goods conversion"
      >
        <div className="flex items-center gap-2.5">
          <Button variant="secondary" onClick={handleOpenBOMModal} icon={ClipboardList}>
            Create BOM
          </Button>
          <Button
            onClick={() => {
              const prodId = products[0]?.id || '';
              setSelectedProductId(prodId);
              const bom = bomHeaders.find((b) => b.productId === prodId) || bomHeaders[0];
              setBatchSize(bom?.batchSize || 100);
              setIsNewRunModalOpen(true);
            }}
            icon={Plus}
          >
            New Production Run
          </Button>
        </div>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Production Runs"
          value={stats.totalRuns.toString()}
          icon={Factory}
        />
        <KPICard
          title="Completed Batches"
          value={stats.completedRuns.toString()}
          icon={CheckCircle2}
          trend="up"
        />
        <KPICard
          title="Good Packets Produced"
          value={`${stats.totalGoodPackets} pkts`}
          icon={Package}
          trend="up"
        />
        <KPICard
          title="Active Standard BOMs"
          value={bomHeaders.length.toString()}
          icon={ClipboardList}
        />
      </div>

      {/* Active Production Runs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-surface-900">Production Batches</h3>
          <span className="text-xs text-surface-500 font-medium">
            {productionRuns.length} Batches Recorded
          </span>
        </div>

        {productionRuns.length === 0 ? (
          <Card>
            <EmptyState
              icon={Factory}
              title="No production batches created"
              description={
                bomHeaders.length === 0
                  ? 'First create a Bill of Materials (BOM) recipe for your product, then start a production run.'
                  : 'Start a new batch using a Standard BOM to trigger material consumption and finished goods conversion.'
              }
              action={
                bomHeaders.length === 0 ? (
                  <Button onClick={handleOpenBOMModal} icon={ClipboardList} size="sm">
                    Create BOM Recipe
                  </Button>
                ) : (
                  <Button onClick={() => setIsNewRunModalOpen(true)} icon={Plus} size="sm">
                    Create Production Run
                  </Button>
                )
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {productionRuns.map((run) => (
              <Card key={run.id} padding="none" className="overflow-hidden">
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-surface-100">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <span className="font-extrabold text-surface-900 text-xl font-mono">{run.runNumber}</span>
                      <StatusBadge status={run.status} config={PRODUCTION_STATUS_CONFIG} size="md" />
                      <span className="text-xs font-bold px-3 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-200">
                        Batch Size: {run.batchSize} pkts
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-surface-700">
                      Product: <strong className="text-surface-900 text-base">{run.productName}</strong> • Planned by {run.createdBy}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    {run.status === 'planned' && (
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => handleOpenIssueModal(run)}
                        icon={Play}
                      >
                        Issue Materials & Start
                      </Button>
                    )}

                    {run.status === 'in_progress' && (
                      <Button
                        variant="success"
                        size="md"
                        onClick={() => handleOpenCompletionModal(run)}
                        icon={CheckCircle2}
                      >
                        Record Output & Complete
                      </Button>
                    )}

                    {run.status === 'completed' && (
                      <div className="text-right">
                        <div className="text-xs font-bold uppercase tracking-wider text-surface-400">Yield Variance</div>
                        <div className={`text-xl font-black tabular-nums ${run.yieldVariancePercent && run.yieldVariancePercent < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {run.yieldVariancePercent ? formatPercentage(run.yieldVariancePercent) : '0%'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Details / Variance Grid */}
                <div className="p-6 bg-surface-50/70">
                  {run.status === 'completed' ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-white rounded-xl border border-surface-200 shadow-sm">
                        <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Good Output</div>
                        <div className="text-2xl font-black text-emerald-700 tabular-nums mt-0.5">
                          {fromScaledQty(run.goodOutput)} pkts
                        </div>
                        <div className="text-xs text-surface-500 mt-1 font-medium">Target: {run.batchSize} pkts</div>
                      </div>

                      <div className="p-4 bg-white rounded-xl border border-surface-200 shadow-sm">
                        <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Damaged / Loss</div>
                        <div className="text-2xl font-black text-rose-600 tabular-nums mt-0.5">
                          {fromScaledQty(run.damagedPackaging)} pcs
                        </div>
                        <div className="text-xs text-surface-500 mt-1 font-medium">Recorded as loss</div>
                      </div>

                      <div className="p-4 bg-white rounded-xl border border-surface-200 shadow-sm">
                        <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Total Material Cost</div>
                        <div className="text-2xl font-black text-surface-900 tabular-nums mt-0.5">
                          {formatCurrency(run.totalMaterialCostPaise || 0)}
                        </div>
                        <div className="text-xs text-surface-500 mt-1 font-medium">Direct materials consumed</div>
                      </div>

                      <div className="p-4 bg-white rounded-xl border border-surface-200 shadow-sm">
                        <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Material Cost / Pkt</div>
                        <div className="text-2xl font-black text-primary-700 tabular-nums mt-0.5">
                          {run.goodOutput > 0
                            ? formatCurrency(Math.round((run.totalMaterialCostPaise || 0) / fromScaledQty(run.goodOutput)))
                            : '—'}
                        </div>
                        <div className="text-xs text-surface-500 mt-1 font-medium">Excluding labour & power</div>
                      </div>
                    </div>
                  ) : run.status === 'in_progress' ? (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-surface-700">Materials Issued to Shop Floor:</div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {run.actualMaterials.map((mat, idx) => (
                          <div key={idx} className="p-2.5 bg-white rounded-lg border border-surface-200 text-xs">
                            <span className="text-surface-500 block truncate">{mat.materialName}</span>
                            <span className="font-bold text-surface-900 tabular-nums">
                              {fromScaledQty(mat.quantity)} {mat.materialUnit}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-surface-500">
                      Standard BOM planned. Materials ready to be issued from inventory to start run.
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Standard Bill of Materials (BOM) Reference */}
      <Card padding="none" className="overflow-hidden">
        <div className="border-b border-surface-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-surface-900 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary-600" />
              {displayedBOMHeader
                ? `Standard Bill of Materials (BOM) — ${displayedBOMHeader.productName} (Batch: ${displayedBOMHeader.batchSize} Packets)`
                : 'Standard Bill of Materials (BOM)'}
            </h3>
            <p className="text-xs text-surface-500 mt-0.5">
              {displayedBOMHeader
                ? `Standard recipe formula calibrated for ${displayedBOMHeader.batchSize} packets finished output`
                : 'Define ingredient and packaging recipes for your finished products'}
            </p>
          </div>
          {bomHeaders.length > 1 && (
            <select
              value={displayedBOMHeader?.id || ''}
              onChange={(e) => setViewingBomId(e.target.value)}
              className="h-9 px-3 rounded-lg border border-surface-300 bg-white text-xs font-medium outline-none"
            >
              {bomHeaders.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.productName} (Batch: {b.batchSize})
                </option>
              ))}
            </select>
          )}
        </div>

        {!displayedBOMHeader ? (
          <div className="p-8">
            <EmptyState
              icon={ClipboardList}
              title="No BOM recipes configured"
              description="Create a Bill of Materials linking raw materials and packaging to a finished product."
              action={
                <Button onClick={handleOpenBOMModal} icon={Plus} size="sm">
                  Create BOM Recipe
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-surface-100 text-surface-600 text-xs uppercase font-medium">
                <tr>
                  <th className="px-5 py-3">Material Name</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3 text-right">Standard Quantity</th>
                  <th className="px-5 py-3 text-right">Standard Unit</th>
                  <th className="px-5 py-3 text-right">Standard Per Packet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {displayedBOMItems.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-50/70">
                    <td className="px-5 py-3 font-semibold text-surface-900">{item.materialName}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-0.5 rounded bg-surface-100 text-surface-700">
                        {item.materialUnit === 'pcs' ? 'Packaging' : 'Raw Material'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-surface-900 tabular-nums">
                      {fromScaledQty(item.standardQuantity)}
                    </td>
                    <td className="px-5 py-3 text-right text-surface-600 font-medium">
                      {item.materialUnit}
                    </td>
                    <td className="px-5 py-3 text-right text-surface-500 tabular-nums">
                      {(fromScaledQty(item.standardQuantity) / (displayedBOMHeader.batchSize || 1)).toFixed(3)} {item.materialUnit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ===== Create BOM Modal ===== */}
      <Modal
        open={isBOMModalOpen}
        onClose={() => setIsBOMModalOpen(false)}
        title="Create Bill of Materials (BOM)"
        description="Define standard raw material and packaging quantities for a finished product batch."
        size="lg"
      >
        <form onSubmit={handleCreateBOMSubmit} className="space-y-4">
          {products.length === 0 || materials.length === 0 ? (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              Please add at least one <strong>Product</strong> (Products page) and one <strong>Material</strong> (Inventory page) before creating a BOM.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-surface-700 block mb-1">Finished Product *</label>
                  <select
                    value={bomProductId}
                    onChange={(e) => setBomProductId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-surface-300 bg-white text-sm outline-none"
                    required
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-surface-700 block mb-1">Standard Batch Size (packets) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={bomBatchSize}
                    onChange={(e) => setBomBatchSize(parseInt(e.target.value) || 1)}
                    className="w-full h-10 px-3 rounded-lg border border-surface-300 bg-white text-sm outline-none tabular-nums"
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-surface-700">Recipe Materials</label>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={Plus}
                    onClick={() =>
                      setBomRows([...bomRows, { materialId: materials[0]?.id || '', quantity: 1 }])
                    }
                  >
                    Add Material
                  </Button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {bomRows.map((row, idx) => {
                    const mat = materials.find((m) => m.id === row.materialId);
                    return (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center p-2.5 bg-surface-50 rounded-lg border border-surface-200">
                        <div className="col-span-7">
                          <select
                            value={row.materialId}
                            onChange={(e) => {
                              const next = [...bomRows];
                              next[idx].materialId = e.target.value;
                              setBomRows(next);
                            }}
                            className="w-full h-9 px-2.5 rounded-lg border border-surface-300 bg-white text-sm outline-none"
                            required
                          >
                            <option value="">Select material...</option>
                            {materials.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.unitName})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-4 flex items-center gap-1.5">
                          <input
                            type="number"
                            step="any"
                            min="0.001"
                            required
                            value={row.quantity}
                            onChange={(e) => {
                              const next = [...bomRows];
                              next[idx].quantity = parseFloat(e.target.value) || 0;
                              setBomRows(next);
                            }}
                            className="w-full h-9 px-2.5 rounded-lg border border-surface-300 bg-white text-sm tabular-nums text-right outline-none"
                          />
                          <span className="text-xs text-surface-500 w-10 shrink-0">
                            {mat?.unitName || ''}
                          </span>
                        </div>
                        <div className="col-span-1 flex justify-end">
                          {bomRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setBomRows(bomRows.filter((_, i) => i !== idx))}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
                              aria-label="Remove material"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
            <Button type="button" variant="secondary" onClick={() => setIsBOMModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={products.length === 0 || materials.length === 0}>
              Save BOM Recipe
            </Button>
          </div>
        </form>
      </Modal>

      {/* ===== New Production Run Modal ===== */}
      <Modal
        open={isNewRunModalOpen}
        onClose={() => setIsNewRunModalOpen(false)}
        title="Create Production Run"
        description="Select product and target batch size. Standard BOM materials will be scheduled."
        size="md"
      >
        <form onSubmit={handleCreateRunSubmit} className="space-y-4">
          {products.length === 0 || !currentBOMHeader ? (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              No BOM recipe found for the selected product. Please create a BOM first.
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium text-surface-700 block mb-1">Target Product</label>
                <select
                  value={effectiveProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    const bom = bomHeaders.find((b) => b.productId === e.target.value);
                    if (bom) setBatchSize(bom.batchSize);
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-surface-300 bg-white text-sm outline-none"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-surface-700 block mb-1">Planned Batch Size (packets)</label>
                <input
                  type="number"
                  min="1"
                  value={batchSize}
                  onChange={(e) => setBatchSize(parseInt(e.target.value) || 1)}
                  className="w-full h-10 px-3 rounded-lg border border-surface-300 bg-white text-sm outline-none tabular-nums"
                />
                <p className="text-xs text-surface-500 mt-1">
                  BOM standard batch size is {currentBOMHeader.batchSize} packets. Material quantities scale automatically.
                </p>
              </div>

              {/* BOM Material preview */}
              <div className="p-3 bg-surface-50 rounded-lg border border-surface-200 space-y-1 text-xs">
                <span className="font-semibold text-surface-800">Planned Material Consumption:</span>
                {currentBOMItems.map((item) => {
                  const scale = currentBOMHeader.batchSize > 0 ? batchSize / currentBOMHeader.batchSize : 1;
                  const scaledQty = fromScaledQty(item.standardQuantity) * scale;
                  return (
                    <div key={item.id} className="flex justify-between text-surface-600">
                      <span>• {item.materialName}</span>
                      <span className="tabular-nums font-medium">{scaledQty.toFixed(2).replace(/\.00$/, '')} {item.materialUnit}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
            <Button type="button" variant="secondary" onClick={() => setIsNewRunModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!currentBOMHeader}>
              Create Production Batch
            </Button>
          </div>
        </form>
      </Modal>

      {/* ===== Material Issue Modal ===== */}
      <Modal
        open={!!issueModalRun}
        onClose={() => setIssueModalRun(null)}
        title="Issue Materials to Production"
        description="Verify actual quantities issued from warehouse. Stock will be deducted immediately."
        size="md"
      >
        <form onSubmit={handleIssueSubmit} className="space-y-4">
          <div className="space-y-3">
            {issueModalRun?.plannedMaterials.map((mat) => (
              <div key={mat.materialId} className="flex items-center justify-between gap-4 p-2 bg-surface-50 rounded-lg border border-surface-200">
                <div className="text-sm font-medium text-surface-900">
                  {mat.materialName}
                  <span className="text-xs text-surface-400 block">Unit: {mat.materialUnit}</span>
                </div>
                <div className="w-32">
                  <input
                    type="number"
                    step="any"
                    value={issueInputs[mat.materialId] ?? fromScaledQty(mat.quantity)}
                    onChange={(e) =>
                      setIssueInputs({
                        ...issueInputs,
                        [mat.materialId]: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full h-8 px-2.5 rounded border border-surface-300 text-sm font-semibold tabular-nums text-right outline-none"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
            <Button type="button" variant="secondary" onClick={() => setIssueModalRun(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Confirm Material Issue
            </Button>
          </div>
        </form>
      </Modal>

      {/* ===== Complete Production Modal ===== */}
      <Modal
        open={!!completionModalRun}
        onClose={() => setCompletionModalRun(null)}
        title="Record Output & Complete Batch"
        description="Enter actual good packets received and packaging damage. Finished goods inventory will be credited."
        size="md"
      >
        <form onSubmit={handleCompletionSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-surface-700 block mb-1">Good Output (packets to inventory)</label>
            <input
              type="number"
              min="0"
              value={goodOutput}
              onChange={(e) => setGoodOutput(parseInt(e.target.value) || 0)}
              className="w-full h-10 px-3 rounded-lg border border-surface-300 text-base font-bold tabular-nums outline-none text-success-700"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-surface-700 block mb-1">Damaged Pouches / Packaging Loss</label>
            <input
              type="number"
              min="0"
              value={damagedPackaging}
              onChange={(e) => setDamagedPackaging(parseInt(e.target.value) || 0)}
              className="w-full h-10 px-3 rounded-lg border border-surface-300 text-base font-bold tabular-nums outline-none text-error-600"
            />
          </div>

          {/* Variance Indicator */}
          <div className="p-3 bg-surface-100 rounded-lg flex items-center justify-between text-sm">
            <span className="text-surface-600 font-medium">Calculated Yield Variance:</span>
            <span className="font-bold tabular-nums text-surface-900">
              {calculateVariance(completionModalRun?.batchSize || 1, goodOutput).toFixed(1)}%
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
            <Button type="button" variant="secondary" onClick={() => setCompletionModalRun(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="success">
              Complete Production Batch
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
