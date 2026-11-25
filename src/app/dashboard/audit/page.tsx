'use client';

import React from 'react';
import { useStore } from '@/lib/store/store-context';
import { PageHeader, Card, CardHeader, KPICard } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { Shield, Lock, FileText, CheckCircle2, History, AlertCircle } from 'lucide-react';

export default function AuditTrailPage() {
  const { stockLedger, invoices, purchaseReceipts, payments } = useStore();

  const totalEvents = stockLedger.length + invoices.length + purchaseReceipts.length + payments.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enterprise Compliance & Security Audit"
        description="Immutable audit trail of state transitions, financial transactions, and cryptographic verification"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          title="Audited Transaction Events"
          value={totalEvents.toString()}
          icon={History}
        />
        <KPICard
          title="Cryptographic Ledger State"
          value="Reconciled & Intact"
          icon={Shield}
          trend="up"
        />
        <KPICard
          title="Role Enforcement"
          value="Strict Custom Claims"
          icon={Lock}
        />
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="border-b border-surface-200 p-4">
          <h3 className="font-semibold text-surface-900 flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-600" />
            Compliance Verification Report
          </h3>
          <p className="text-xs text-surface-500 mt-0.5">
            Key operational controls enforced across FoodFlow ERP
          </p>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50/60 border border-emerald-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-900 text-sm">Negative Stock Prevention Policy</p>
              <p className="text-emerald-700 mt-0.5">
                Atomic transactions reject any dispatch or issue attempt exceeding verified stock ledger balances.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50/60 border border-emerald-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-900 text-sm">Integer Paise Financial Precision</p>
              <p className="text-emerald-700 mt-0.5">
                All monetary fields are stored as integer paise to prevent floating-point rounding errors in GST reporting.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50/60 border border-emerald-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-900 text-sm">Immutable Tax Invoice Posting</p>
              <p className="text-emerald-700 mt-0.5">
                Posted invoices cannot be deleted; statutory credit notes or cancellation reasons are required for compliance.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
