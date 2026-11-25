'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/lib/store/store-context';
import { PageHeader, Card, CardHeader, Button, Input } from '@/components/ui';
import { Save, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  const { settings, updateSettings } = useStore();

  const [companyName, setCompanyName] = useState(settings.companyName);
  const [companyGstin, setCompanyGstin] = useState(settings.companyGstin);
  const [companyPan, setCompanyPan] = useState(settings.companyPan);
  const [factoryState, setFactoryState] = useState(settings.factoryState);
  const [invoicePrefix, setInvoicePrefix] = useState(settings.invoicePrefix);
  const [addressLine1, setAddressLine1] = useState(settings.companyAddress.line1);
  const [city, setCity] = useState(settings.companyAddress.city);
  const [pincode, setPincode] = useState(settings.companyAddress.pincode);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setCompanyName(settings.companyName);
    setCompanyGstin(settings.companyGstin);
    setCompanyPan(settings.companyPan);
    setFactoryState(settings.factoryState);
    setInvoicePrefix(settings.invoicePrefix);
    setAddressLine1(settings.companyAddress.line1);
    setCity(settings.companyAddress.city);
    setPincode(settings.companyAddress.pincode);
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await updateSettings({
        companyName: companyName.trim(),
        companyGstin: companyGstin.trim().toUpperCase(),
        companyPan: companyPan.trim().toUpperCase(),
        factoryState: factoryState.trim(),
        invoicePrefix: invoicePrefix.trim().toUpperCase() || 'FF',
        companyAddress: {
          ...settings.companyAddress,
          line1: addressLine1.trim(),
          city: city.trim(),
          state: factoryState.trim(),
          pincode: pincode.trim(),
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <PageHeader
        title="Factory & Legal Entity Configuration"
        description="Company GSTIN, factory address, tax jurisdiction, and invoice numbering defaults"
      >
        <div className="flex items-center gap-3">
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
              <CheckCircle2 className="h-3.5 w-3.5" /> Settings Saved
            </span>
          )}
          <Button type="submit" icon={Save} loading={saving}>
            Save Configuration
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader
            title="Company Information"
            description="Primary legal entity displayed on all Tax Invoices"
          />
          <div className="space-y-4 text-sm">
            <Input
              label="Company Name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="GSTIN"
                value={companyGstin}
                onChange={(e) => setCompanyGstin(e.target.value)}
              />
              <Input
                label="PAN Number"
                value={companyPan}
                onChange={(e) => setCompanyPan(e.target.value)}
              />
            </div>
            <Input
              label="Factory State (Place of Supply)"
              value={factoryState}
              onChange={(e) => setFactoryState(e.target.value)}
              required
            />
            <Input
              label="Address Line 1"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} />
              <Input label="Pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="GST & Financial Configuration"
            description="Statutory tax parameters and numbering scheme"
          />
          <div className="space-y-4 text-sm">
            <div className="p-3.5 bg-surface-50 rounded-xl border border-surface-200 space-y-1.5 text-xs">
              <span className="font-semibold text-surface-800">GST Jurisdiction Rule:</span>
              <p className="text-surface-600">
                • Supply to <strong>{factoryState}</strong>: Intra-state (CGST + SGST)
              </p>
              <p className="text-surface-600">
                • Supply outside {factoryState}: Inter-state (IGST)
              </p>
            </div>

            <Input
              label="Invoice Prefix"
              value={invoicePrefix}
              onChange={(e) => setInvoicePrefix(e.target.value)}
              required
            />
            <Input label="Default Namkeen GST Rate" value={`${settings.defaultGstRate}%`} readOnly />
          </div>
        </Card>
      </div>
    </form>
  );
}
