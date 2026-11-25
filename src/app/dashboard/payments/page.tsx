'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store/store-context';
import { useAuth } from '@/lib/auth/auth-context';
import { PageHeader, Card, CardHeader, Button, EmptyState, Modal, Input, Select, Tabs, KPICard } from '@/components/ui';
import { formatCurrency, formatDate, toPaise } from '@/lib/utils';
import type { Payment, PaymentMode } from '@/lib/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  IndianRupee, Plus, CreditCard, Banknote, ArrowDownLeft,
  Search, Users, AlertCircle, Clock, CheckCircle2, Building2, MapPin
} from 'lucide-react';

export default function PaymentsPage() {
  const {
    customers,
    payments,
    invoices,
    recordPayment,
  } = useStore();
  const { user } = useAuth();

  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || '');
  const [amountRupees, setAmountRupees] = useState(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('bank_transfer');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Customer selected for modal
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || customers[0];

  // Aggregate stats
  const stats = useMemo(() => {
    const totalCollected = payments.reduce((sum, p) => sum + p.amountPaise, 0);
    const totalOutstanding = customers.reduce((sum, c) => sum + c.outstandingPaise, 0);
    const count = payments.length;

    return { totalCollected, totalOutstanding, count };
  }, [payments, customers]);

  // Customer Outstanding chart data
  const outstandingChartData = useMemo(() => {
    return customers.map((c) => ({
      name: c.name,
      outstanding: c.outstandingPaise / 100,
      state: c.state,
    }));
  }, [customers]);

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    recordPayment({
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      amountPaise: toPaise(amountRupees),
      paymentMode,
      referenceNumber,
      notes: paymentNotes,
      receivedBy: user?.displayName || 'Accounts Department',
    });

    setIsRecordModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments & Accounts Receivable"
        description="Collection tracking, part payments, customer balance ledgers, and debtor ageing"
      >
        <Button onClick={() => setIsRecordModalOpen(true)} icon={Plus}>
          Record Customer Payment
        </Button>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Cash & Bank Receipts"
          value={formatCurrency(stats.totalCollected)}
          icon={IndianRupee}
          trend="up"
        />
        <KPICard
          title="Total Outstanding Receivables"
          value={formatCurrency(stats.totalOutstanding)}
          icon={AlertCircle}
          trend={stats.totalOutstanding > 0 ? 'down' : 'neutral'}
        />
        <KPICard
          title="Recorded Transactions"
          value={stats.count.toString()}
          icon={CreditCard}
        />
        <KPICard
          title="Active Debtors"
          value={customers.filter((c) => c.outstandingPaise > 0).length.toString()}
          icon={Users}
        />
      </div>

      {/* Customer Balances & Ageing Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="border-b border-surface-200 p-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-surface-900 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary-600" />
              Customer Receivables & Balance Ledger
            </h3>
            <p className="text-xs text-surface-500 mt-0.5">
              Live balances showing invoiced totals, payments credited, and net outstanding
            </p>
          </div>
        </div>

        {customers.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Users}
              title="No customers added yet"
              description="Add customers in the Customers page to track their invoices and receivables."
            />
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-surface-100 text-surface-600 text-xs uppercase font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Customer Details</th>
                <th className="px-6 py-4">State</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4 text-right">Credit Limit</th>
                <th className="px-6 py-4 text-right">Net Outstanding</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-surface-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-surface-900 text-base">{c.name}</div>
                    <div className="text-xs text-surface-400 font-mono mt-0.5">GSTIN: {c.gstin || 'None'}</div>
                  </td>
                  <td className="px-6 py-4 text-xs font-semibold text-surface-700">{c.state}</td>
                  <td className="px-6 py-4 capitalize text-xs text-surface-600">
                    <span className="px-2.5 py-0.5 rounded-full bg-surface-100 font-semibold border border-surface-200">
                      {c.customerType}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums text-surface-600 font-medium text-sm">
                    {formatCurrency(c.creditLimitPaise)}
                  </td>
                  <td className="px-6 py-4 text-right font-black text-surface-900 text-lg tabular-nums">
                    <span className={c.outstandingPaise > 0 ? 'text-primary-700' : 'text-emerald-700'}>
                      {formatCurrency(c.outstandingPaise)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {c.outstandingPaise > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="h-3.5 w-3.5" /> Payment Due
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Fully Cleared
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedCustomerId(c.id);
                        setAmountRupees(c.outstandingPaise > 0 ? c.outstandingPaise / 100 : 0);
                        setIsRecordModalOpen(true);
                      }}
                    >
                      Receive Payment
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </Card>

      {/* Payment Transactions Register */}
      <Card padding="none" className="overflow-hidden">
        <div className="border-b border-surface-200 p-4">
          <h3 className="font-semibold text-surface-900 flex items-center gap-2">
            <Banknote className="h-4 w-4 text-primary-600" />
            Payment Receipts History
          </h3>
          <p className="text-xs text-surface-500 mt-0.5">
            Log of customer payments received via Bank Transfer, UPI, Cheque, or Cash
          </p>
        </div>

        {payments.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={IndianRupee}
              title="No customer payments recorded yet"
              description="Record incoming payments from customers against their posted invoices."
              action={
                <Button onClick={() => setIsRecordModalOpen(true)} icon={Plus} size="sm" disabled={customers.length === 0}>
                  Record Payment
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-surface-100 text-surface-600 text-xs uppercase font-medium">
                <tr>
                  <th className="px-5 py-3">Receipt #</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Mode</th>
                  <th className="px-5 py-3">Bank Ref #</th>
                  <th className="px-5 py-3 text-right">Amount Received</th>
                  <th className="px-5 py-3">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-50/70">
                    <td className="px-5 py-3.5 font-bold font-mono text-surface-900">{p.paymentNumber}</td>
                    <td className="px-5 py-3.5 text-xs text-surface-500">
                      {formatDate(new Date(p.paymentDate?.seconds ? p.paymentDate.seconds * 1000 : Date.now()))}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-surface-900">{p.customerName}</td>
                    <td className="px-5 py-3.5">
                      <span className="capitalize text-xs px-2 py-0.5 rounded bg-surface-100 text-surface-800 font-medium">
                        {p.paymentMode.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs font-mono text-surface-500">{p.referenceNumber || '—'}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-success-700 text-base tabular-nums">
                      +{formatCurrency(p.amountPaise)}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-surface-500">{p.receivedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ===== Record Payment Modal ===== */}
      <Modal
        open={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        title="Record Customer Payment"
        description="Allocate incoming funds against outstanding invoices to update debtor balances."
        size="md"
      >
        <form onSubmit={handlePaymentSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-surface-700 block mb-1">Customer</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => {
                setSelectedCustomerId(e.target.value);
                const cust = customers.find((c) => c.id === e.target.value);
                if (cust && cust.outstandingPaise > 0) {
                  setAmountRupees(cust.outstandingPaise / 100);
                }
              }}
              className="w-full h-10 px-3 rounded-lg border border-surface-300 bg-white text-sm outline-none"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — Outstanding: {formatCurrency(c.outstandingPaise)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-surface-700 block mb-1">Amount Received (₹ Rupees)</label>
            <input
              type="number"
              min="1"
              step="any"
              value={amountRupees}
              onChange={(e) => setAmountRupees(parseFloat(e.target.value) || 0)}
              className="w-full h-10 px-3 rounded-lg border border-surface-300 bg-white text-base font-bold tabular-nums outline-none text-success-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-surface-500 block mb-1">Payment Mode</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                className="w-full h-9 px-3 rounded-lg border border-surface-300 bg-white text-sm outline-none"
              >
                <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                <option value="upi">UPI / QR Code</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-surface-500 block mb-1">Reference / UTR Number</label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-surface-300 bg-white text-sm outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-surface-500 block mb-1">Notes</label>
            <input
              type="text"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-surface-300 bg-white text-sm outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
            <Button type="button" variant="secondary" onClick={() => setIsRecordModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Confirm & Post Payment Receipt
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
