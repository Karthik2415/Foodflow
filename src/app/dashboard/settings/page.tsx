'use client';

import React from 'react';
import { useStore } from '@/lib/store/store-context';
import { PageHeader, Card, CardHeader, Button, Input } from '@/components/ui';
import { Settings, Building2, MapPin, Phone, Mail, Shield, Save } from 'lucide-react';

export default function SettingsPage() {
  const { settings } = useStore();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Factory & Legal Entity Configuration"
        description="Company GSTIN, factory address, tax rates, financial year sequence, and system defaults"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader
            title="Company Information"
            description="Primary legal entity displayed on all Tax Invoices"
          />
          <div className="space-y-4 text-sm">
            <Input label="Company Name" defaultValue={settings.companyName} readOnly />
            <div className="grid grid-cols-2 gap-3">
              <Input label="GSTIN" defaultValue={settings.companyGstin} readOnly />
              <Input label="PAN Number" defaultValue={settings.companyPan} readOnly />
            </div>
            <Input label="Factory State" defaultValue={settings.factoryState} readOnly />
            <Input label="Registered Address" defaultValue={`${settings.companyAddress.line1}, ${settings.companyAddress.city}, ${settings.companyAddress.state} - ${settings.companyAddress.pincode}`} readOnly />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="GST & Financial Configuration"
            description="Statutory tax parameters and numbering scheme"
          />
          <div className="space-y-4 text-sm">
            <div className="p-3 bg-surface-50 rounded-lg border border-surface-200 space-y-2 text-xs">
              <span className="font-semibold text-surface-800">GST Jurisdiction Rule:</span>
              <p className="text-surface-600">
                • Supply to <strong>Tamil Nadu</strong>: CGST (2.5%) + SGST (2.5%)
              </p>
              <p className="text-surface-600">
                • Supply Outside Tamil Nadu: IGST (5.0%)
              </p>
            </div>

            <Input label="Invoice Prefix" defaultValue={settings.invoicePrefix} readOnly />
            <Input label="Active Financial Year" defaultValue="2026-27" readOnly />
            <Input label="Default Namkeen GST Rate" defaultValue="5%" readOnly />
          </div>
        </Card>
      </div>
    </div>
  );
}
