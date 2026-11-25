'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store/store-context';
import { PageHeader, Card, CardHeader, Button, StatusBadge, EmptyState, Modal, Tabs, KPICard } from '@/components/ui';
import { formatCurrency, fromScaledQty, formatDate } from '@/lib/utils';
import { INVOICE_STATUS_CONFIG } from '@/lib/constants';
import type { Invoice } from '@/lib/types';
import {
  FileText, Download, Eye, Printer, Search, Filter,
  IndianRupee, CheckCircle2, XCircle, Calendar, Building2, MapPin
} from 'lucide-react';

export default function InvoicesPage() {
  const { invoices, settings } = useStore();

  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesTab = activeTab === 'all' ? true : inv.status === activeTab;
      const matchesSearch =
        inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.customerName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [invoices, activeTab, searchQuery]);

  // Aggregate GST stats
  const gstStats = useMemo(() => {
    const posted = invoices.filter((i) => i.status === 'posted');
    const totalTaxable = posted.reduce((sum, i) => sum + i.taxableAmountPaise, 0);
    const totalCGST = posted.reduce((sum, i) => sum + i.cgstPaise, 0);
    const totalSGST = posted.reduce((sum, i) => sum + i.sgstPaise, 0);
    const totalIGST = posted.reduce((sum, i) => sum + i.igstPaise, 0);
    const totalGrand = posted.reduce((sum, i) => sum + i.grandTotalPaise, 0);

    return { totalTaxable, totalCGST, totalSGST, totalIGST, totalGrand };
  }, [invoices]);

  const tabs = [
    { id: 'all', label: 'All Invoices', count: invoices.length },
    { id: 'posted', label: 'Posted Tax Invoices', count: invoices.filter((i) => i.status === 'posted').length },
    { id: 'cancelled', label: 'Cancelled', count: invoices.filter((i) => i.status === 'cancelled').length },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="GST Tax Invoices"
        description="Compliant GST invoice register with auto CGST/SGST/IGST splitting, PDF generation, and immutable posting"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Billed Revenue"
          value={formatCurrency(gstStats.totalGrand)}
          icon={IndianRupee}
          trend="up"
        />
        <KPICard
          title="Total Taxable Value"
          value={formatCurrency(gstStats.totalTaxable)}
          icon={FileText}
        />
        <KPICard
          title="CGST + SGST (Intra-state)"
          value={formatCurrency(gstStats.totalCGST + gstStats.totalSGST)}
          icon={Building2}
        />
        <KPICard
          title="IGST (Inter-state)"
          value={formatCurrency(gstStats.totalIGST)}
          icon={MapPin}
        />
      </div>

      {/* Invoice Register Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="border-b border-surface-200 p-4 space-y-4">
          <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
              <input
                type="text"
                placeholder="Search by invoice # or customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-surface-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
            <div className="text-xs text-surface-500 font-medium">
              Seller GSTIN: <strong className="font-mono text-surface-800">{settings.companyGstin}</strong> (Tamil Nadu)
            </div>
          </div>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={FileText}
              title="No invoices posted"
              description="Approve and generate an invoice from the Sales Orders tab to view it in the official GST register."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-surface-100 text-surface-600 text-xs uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Invoice #</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Customer & GSTIN</th>
                  <th className="px-6 py-4 text-right">Taxable (₹)</th>
                  <th className="px-6 py-4 text-right">CGST (₹)</th>
                  <th className="px-6 py-4 text-right">SGST (₹)</th>
                  <th className="px-6 py-4 text-right">IGST (₹)</th>
                  <th className="px-6 py-4 text-right">Total Invoice Value</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-surface-50/80 transition-colors">
                    <td className="px-6 py-4 font-black text-surface-900 font-mono text-base">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-surface-500">
                      {formatDate(new Date(inv.invoiceDate?.seconds ? inv.invoiceDate.seconds * 1000 : Date.now()))}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-surface-900 text-base">{inv.customerName}</div>
                      <div className="text-xs text-surface-500 font-mono mt-0.5">
                        GSTIN: {inv.customerGstin || 'Unregistered'} ({inv.customerAddress?.state || 'TN'})
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-surface-900 tabular-nums text-sm">
                      {formatCurrency(inv.taxableAmountPaise)}
                    </td>
                    <td className="px-6 py-4 text-right text-surface-600 font-medium tabular-nums text-sm">
                      {inv.cgstPaise > 0 ? formatCurrency(inv.cgstPaise) : '—'}
                    </td>
                    <td className="px-6 py-4 text-right text-surface-600 font-medium tabular-nums text-sm">
                      {inv.sgstPaise > 0 ? formatCurrency(inv.sgstPaise) : '—'}
                    </td>
                    <td className="px-6 py-4 text-right text-surface-600 font-medium tabular-nums text-sm">
                      {inv.igstPaise > 0 ? formatCurrency(inv.igstPaise) : '—'}
                    </td>
                    <td className="px-6 py-4 text-right font-extrabold text-surface-900 text-lg tabular-nums">
                      {formatCurrency(inv.grandTotalPaise)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge status={inv.status} config={INVOICE_STATUS_CONFIG} size="md" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedInvoice(inv)}
                        icon={Eye}
                      >
                        Preview
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ===== Commercial Tax Invoice Modal Preview ===== */}
      <Modal
        open={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title={selectedInvoice ? `TAX INVOICE — ${selectedInvoice.invoiceNumber}` : ''}
        size="xl"
      >
        {selectedInvoice && (
          <div className="space-y-6 print:m-0 print:p-0" id="printable-invoice">
            {/* Invoice Header */}
            <div className="border-b border-surface-300 pb-5 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-black text-surface-900 tracking-tight">{settings.companyName}</h2>
                <p className="text-xs text-surface-600 mt-1 max-w-sm">
                  {settings.companyAddress.line1}, {settings.companyAddress.line2}, {settings.companyAddress.city}, {settings.companyAddress.state} - {settings.companyAddress.pincode}
                </p>
                <div className="mt-2 text-xs font-mono text-surface-700">
                  <span className="font-bold text-surface-900">GSTIN:</span> {settings.companyGstin} • <span className="font-bold text-surface-900">PAN:</span> {settings.companyPan}
                </div>
              </div>

              <div className="text-right">
                <span className="inline-block px-3 py-1 rounded bg-primary-100 text-primary-800 font-bold text-xs uppercase tracking-wider mb-2">
                  Tax Invoice
                </span>
                <div className="text-lg font-black font-mono text-surface-900">{selectedInvoice.invoiceNumber}</div>
                <div className="text-xs text-surface-500 mt-0.5">
                  Date:{' '}
                  {formatDate(new Date(selectedInvoice.invoiceDate?.seconds ? selectedInvoice.invoiceDate.seconds * 1000 : Date.now()))}
                </div>
                <div className="text-xs text-surface-500 font-mono mt-0.5">
                  FY: {selectedInvoice.financialYear}
                </div>
              </div>
            </div>

            {/* Bill To & Ship To */}
            <div className="grid grid-cols-2 gap-6 p-4 rounded-xl bg-surface-50 border border-surface-200 text-xs">
              <div>
                <p className="font-bold uppercase tracking-wider text-surface-400 mb-1">Billed To (Customer):</p>
                <p className="font-bold text-surface-900 text-sm">{selectedInvoice.customerName}</p>
                <p className="text-surface-600 mt-0.5">
                  {selectedInvoice.customerAddress?.line1}, {selectedInvoice.customerAddress?.city}, {selectedInvoice.customerAddress?.state} - {selectedInvoice.customerAddress?.pincode}
                </p>
                <p className="font-mono text-surface-700 font-semibold mt-1">
                  GSTIN: {selectedInvoice.customerGstin || 'Unregistered Consumer'}
                </p>
              </div>

              <div className="text-right">
                <p className="font-bold uppercase tracking-wider text-surface-400 mb-1">Place of Supply:</p>
                <p className="font-bold text-surface-900 text-sm">{selectedInvoice.customerAddress?.state || 'Tamil Nadu'}</p>
                <p className="text-surface-600 mt-1">
                  Transaction Type:{' '}
                  <strong>
                    {selectedInvoice.isInterstate ? 'Inter-state (IGST Applicable)' : 'Intra-state (CGST + SGST Applicable)'}
                  </strong>
                </p>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="rounded-lg border border-surface-200 overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-100 text-surface-600 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-2.5">#</th>
                    <th className="px-4 py-2.5">Description of Goods</th>
                    <th className="px-4 py-2.5">HSN Code</th>
                    <th className="px-4 py-2.5 text-right">Qty</th>
                    <th className="px-4 py-2.5 text-right">Unit Rate</th>
                    <th className="px-4 py-2.5 text-right">Taxable Val</th>
                    <th className="px-4 py-2.5 text-right">CGST</th>
                    <th className="px-4 py-2.5 text-right">SGST</th>
                    <th className="px-4 py-2.5 text-right">IGST</th>
                    <th className="px-4 py-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-200">
                  {selectedInvoice.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-surface-50/50">
                      <td className="px-4 py-3 text-surface-400 font-mono">{idx + 1}</td>
                      <td className="px-4 py-3 font-semibold text-surface-900">{item.productName}</td>
                      <td className="px-4 py-3 text-surface-500 font-mono">{item.hsnCode}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">{fromScaledQty(item.quantity)} pkts</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(item.unitPricePaise)}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{formatCurrency(item.taxableAmountPaise)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{item.cgstPaise > 0 ? formatCurrency(item.cgstPaise) : '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{item.sgstPaise > 0 ? formatCurrency(item.sgstPaise) : '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{item.igstPaise > 0 ? formatCurrency(item.igstPaise) : '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-surface-900 tabular-nums">{formatCurrency(item.totalPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total Summary */}
            <div className="flex justify-between items-start pt-2">
              <div className="max-w-md text-xs text-surface-500 space-y-1">
                <p><strong>Declaration:</strong> We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</p>
                <p className="font-mono text-[11px] pt-1 text-surface-400">Electronic Reference ID: {selectedInvoice.idempotencyKey}</p>
              </div>

              <div className="w-80 space-y-2 text-xs bg-surface-50 p-4 rounded-xl border border-surface-200">
                <div className="flex justify-between text-surface-600">
                  <span>Total Taxable Amount:</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(selectedInvoice.taxableAmountPaise)}</span>
                </div>
                {selectedInvoice.cgstPaise > 0 && (
                  <div className="flex justify-between text-surface-600">
                    <span>CGST (2.5%):</span>
                    <span className="tabular-nums">{formatCurrency(selectedInvoice.cgstPaise)}</span>
                  </div>
                )}
                {selectedInvoice.sgstPaise > 0 && (
                  <div className="flex justify-between text-surface-600">
                    <span>SGST (2.5%):</span>
                    <span className="tabular-nums">{formatCurrency(selectedInvoice.sgstPaise)}</span>
                  </div>
                )}
                {selectedInvoice.igstPaise > 0 && (
                  <div className="flex justify-between text-surface-600">
                    <span>IGST (5%):</span>
                    <span className="tabular-nums">{formatCurrency(selectedInvoice.igstPaise)}</span>
                  </div>
                )}
                <div className="border-t border-surface-300 pt-2 flex justify-between font-bold text-surface-900 text-base">
                  <span>Grand Total:</span>
                  <span className="text-primary-700 tabular-nums">{formatCurrency(selectedInvoice.grandTotalPaise)}</span>
                </div>
              </div>
            </div>

            {/* Print & Close */}
            <div className="border-t border-surface-200 pt-4 flex items-center justify-between">
              <Button variant="secondary" onClick={() => setSelectedInvoice(null)}>
                Close
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => window.print()} icon={Printer}>
                  Print Invoice
                </Button>
                <Button variant="primary" onClick={() => window.print()} icon={Download}>
                  Download PDF
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
