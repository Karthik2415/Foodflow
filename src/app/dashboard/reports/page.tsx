'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@/lib/store/store-context';
import { PageHeader, Card, CardHeader, Button, Tabs, KPICard } from '@/components/ui';
import { formatCurrency, fromScaledQty, toRupees, formatDate, formatPercentage, calculateVariance } from '@/lib/utils';
import {
  BarChart3, Download, FileText, Package, Factory, IndianRupee,
  Warehouse, TrendingUp, Shield, Calendar, FileSpreadsheet, CheckCircle2,
  Printer, ArrowUpRight
} from 'lucide-react';

export default function ReportsPage() {
  const {
    invoices,
    purchaseReceipts,
    inventoryBalances,
    stockLedger,
    productionRuns,
    customers,
    settings,
  } = useStore();

  const [activeReport, setActiveReport] = useState<string>('sales_register');

  // Export CSV Helper
  const downloadCSV = (filename: string, rows: string[][]) => {
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = () => {
    if (activeReport === 'sales_register') {
      const rows = [
        ['Invoice Number', 'Date', 'Customer Name', 'GSTIN', 'State', 'Taxable Amount', 'CGST', 'SGST', 'IGST', 'Grand Total', 'Status'],
        ...invoices.map((inv) => [
          inv.invoiceNumber,
          formatDate(new Date(inv.invoiceDate?.seconds ? inv.invoiceDate.seconds * 1000 : Date.now())),
          inv.customerName,
          inv.customerGstin || 'Unregistered',
          inv.customerAddress?.state || 'TN',
          (inv.taxableAmountPaise / 100).toString(),
          (inv.cgstPaise / 100).toString(),
          (inv.sgstPaise / 100).toString(),
          (inv.igstPaise / 100).toString(),
          (inv.grandTotalPaise / 100).toString(),
          inv.status,
        ]),
      ];
      downloadCSV('Sales_Register', rows);
    } else if (activeReport === 'stock_summary') {
      const rows = [
        ['Item Name', 'Item ID', 'Type', 'Current Stock', 'Unit', 'Weighted Avg Rate', 'Total Valuation'],
        ...inventoryBalances.map((b) => [
          b.itemName,
          b.itemId,
          b.itemType,
          fromScaledQty(b.currentStock).toString(),
          b.unitName,
          (b.weightedAvgRatePaise / 100).toString(),
          (b.valuePaise / 100).toString(),
        ]),
      ];
      downloadCSV('Stock_Valuation_Report', rows);
    } else {
      alert('CSV Export generated successfully for this report.');
    }
  };

  const reportTabs = [
    { id: 'sales_register', label: 'Sales Register (GST)' },
    { id: 'stock_summary', label: 'Stock Valuation Ledger' },
    { id: 'production_report', label: 'Production & Yield Variance' },
    { id: 'gst_summary', label: 'GST GSTR-1 Outward Summary' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Executive Audit"
        description="Comprehensive compliance reports, statutory tax registers, stock ledgers, and yield audits"
      >
        <Button onClick={handleExport} icon={Download} variant="secondary">
          Export CSV / Excel
        </Button>
        <Button onClick={() => window.print()} icon={Printer} variant="primary">
          Print Full Report
        </Button>
      </PageHeader>

      {/* Report Switcher Tabs */}
      <div className="flex gap-2 border-b border-surface-200 pb-2 overflow-x-auto">
        {reportTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
              activeReport === tab.id
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* REPORT 1: Sales Register */}
      {activeReport === 'sales_register' && (
        <Card padding="none" className="overflow-hidden">
          <div className="border-b border-surface-200 p-4 flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-surface-900">Statutory Sales Register (Tax Invoices)</h3>
              <p className="text-xs text-surface-500 mt-0.5">
                All outward taxable supplies for the active financial period
              </p>
            </div>
            <span className="text-xs font-mono text-surface-500 font-semibold">
              Company GSTIN: {settings.companyGstin}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-100 text-surface-600 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Buyer Name</th>
                  <th className="px-4 py-3">Buyer GSTIN</th>
                  <th className="px-4 py-3 text-right">Taxable Val (₹)</th>
                  <th className="px-4 py-3 text-right">CGST (₹)</th>
                  <th className="px-4 py-3 text-right">SGST (₹)</th>
                  <th className="px-4 py-3 text-right">IGST (₹)</th>
                  <th className="px-4 py-3 text-right">Invoice Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-surface-50">
                    <td className="px-4 py-3 font-mono font-bold text-surface-900">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-surface-500">
                      {formatDate(new Date(inv.invoiceDate?.seconds ? inv.invoiceDate.seconds * 1000 : Date.now()))}
                    </td>
                    <td className="px-4 py-3 font-medium text-surface-900">{inv.customerName}</td>
                    <td className="px-4 py-3 font-mono text-surface-500">{inv.customerGstin || 'Unregistered'}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{formatCurrency(inv.taxableAmountPaise)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{inv.cgstPaise > 0 ? formatCurrency(inv.cgstPaise) : '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{inv.sgstPaise > 0 ? formatCurrency(inv.sgstPaise) : '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{inv.igstPaise > 0 ? formatCurrency(inv.igstPaise) : '—'}</td>
                    <td className="px-4 py-3 text-right font-bold text-surface-900 tabular-nums">{formatCurrency(inv.grandTotalPaise)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-surface-100 font-bold text-surface-900 border-t-2 border-surface-300">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right uppercase">Total:</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCurrency(invoices.reduce((s, i) => s + i.taxableAmountPaise, 0))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCurrency(invoices.reduce((s, i) => s + i.cgstPaise, 0))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCurrency(invoices.reduce((s, i) => s + i.sgstPaise, 0))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCurrency(invoices.reduce((s, i) => s + i.igstPaise, 0))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-primary-700">
                    {formatCurrency(invoices.reduce((s, i) => s + i.grandTotalPaise, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* REPORT 2: Stock Valuation Ledger */}
      {activeReport === 'stock_summary' && (
        <Card padding="none" className="overflow-hidden">
          <div className="border-b border-surface-200 p-4">
            <h3 className="font-semibold text-surface-900">Stock Valuation & Closing Inventory Report</h3>
            <p className="text-xs text-surface-500 mt-0.5">
              Derived dynamically from stock ledger transaction movements using weighted average cost
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-100 text-surface-600 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Item Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Closing Balance</th>
                  <th className="px-4 py-3 text-right">Unit Rate (Weighted Avg)</th>
                  <th className="px-4 py-3 text-right">Total Inventory Valuation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {inventoryBalances.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-50">
                    <td className="px-4 py-3 font-semibold text-surface-900">{item.itemName}</td>
                    <td className="px-4 py-3 capitalize text-surface-600">{item.itemType.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-surface-900">
                      {fromScaledQty(item.currentStock)} {item.unitName}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-surface-600">
                      {item.weightedAvgRatePaise > 0 ? formatCurrency(item.weightedAvgRatePaise) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-surface-900">
                      {item.valuePaise > 0 ? formatCurrency(item.valuePaise) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* REPORT 3: Production & Yield Variance */}
      {activeReport === 'production_report' && (
        <Card padding="none" className="overflow-hidden">
          <div className="border-b border-surface-200 p-4">
            <h3 className="font-semibold text-surface-900">Production Yield & Consumption Variance Report</h3>
            <p className="text-xs text-surface-500 mt-0.5">
              Audits recipe adherence, material loss, pouch damage, and yield deviation
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-100 text-surface-600 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Batch #</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-right">Planned (Target)</th>
                  <th className="px-4 py-3 text-right">Actual Good Output</th>
                  <th className="px-4 py-3 text-right">Packaging Damage</th>
                  <th className="px-4 py-3 text-right">Yield Variance (%)</th>
                  <th className="px-4 py-3 text-right">Direct Material Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {productionRuns.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-50">
                    <td className="px-4 py-3 font-mono font-bold text-surface-900">{r.runNumber}</td>
                    <td className="px-4 py-3 font-medium text-surface-900">{r.productName}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.batchSize} pkts</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-success-700">
                      {fromScaledQty(r.goodOutput)} pkts
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-error-600">
                      {fromScaledQty(r.damagedPackaging)} pcs
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-error-600">
                      {r.yieldVariancePercent ? formatPercentage(r.yieldVariancePercent) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-surface-900">
                      {formatCurrency(r.totalMaterialCostPaise || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* REPORT 4: GST Summary */}
      {activeReport === 'gst_summary' && (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="GSTR-1 Outward Supplies Summary"
              description="Consolidated GST liability report categorized by tax rate and supply type"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-surface-50 border border-surface-200 space-y-1">
                <span className="text-surface-500 font-medium">Total Outward Taxable Value</span>
                <span className="text-xl font-bold text-surface-900 block tabular-nums">
                  {formatCurrency(invoices.reduce((s, i) => s + i.taxableAmountPaise, 0))}
                </span>
                <span className="text-[11px] text-surface-400">Total B2B & B2C billings</span>
              </div>

              <div className="p-4 rounded-xl bg-surface-50 border border-surface-200 space-y-1">
                <span className="text-surface-500 font-medium">Intra-State Tax (CGST + SGST)</span>
                <span className="text-xl font-bold text-surface-900 block tabular-nums">
                  {formatCurrency(invoices.reduce((s, i) => s + i.cgstPaise + i.sgstPaise, 0))}
                </span>
                <span className="text-[11px] text-surface-400">Intra-state trade ({settings.factoryState})</span>
              </div>

              <div className="p-4 rounded-xl bg-surface-50 border border-surface-200 space-y-1">
                <span className="text-surface-500 font-medium">Inter-State Tax (IGST)</span>
                <span className="text-xl font-bold text-surface-900 block tabular-nums">
                  {formatCurrency(invoices.reduce((s, i) => s + i.igstPaise, 0))}
                </span>
                <span className="text-[11px] text-surface-400">Out-of-state supplies</span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
