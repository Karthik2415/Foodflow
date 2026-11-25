'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store/store-context';
import { PageHeader, Card, Button, Modal, Input, Select, KPICard, EmptyState } from '@/components/ui';
import { formatCurrency, toPaise } from '@/lib/utils';
import { Users, Plus, Phone, MapPin, Building2, Search } from 'lucide-react';

export default function CustomersPage() {
  const { customers, createCustomer } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('Tamil Nadu');
  const [pincode, setPincode] = useState('');
  const [customerType, setCustomerType] = useState<'retailer' | 'distributor' | 'wholesale'>('retailer');
  const [creditLimit, setCreditLimit] = useState(50000);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.gstin && c.gstin.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createCustomer({
        name: name.trim(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        gstin: gstin.trim() || undefined,
        billingAddress: {
          line1: line1.trim(),
          city: city.trim(),
          state: stateName.trim(),
          pincode: pincode.trim(),
        },
        state: stateName.trim(),
        customerType,
        creditLimitPaise: toPaise(creditLimit),
      });
      setIsAddOpen(false);
      setName('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setGstin('');
      setLine1('');
      setCity('');
      setPincode('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Directory & Credit Ledgers"
        description="Retailers, distributors, and wholesale channel partners with GSTIN registration and credit controls"
      >
        <Button onClick={() => setIsAddOpen(true)} icon={Plus}>
          Add Customer
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Active Accounts" value={customers.length.toString()} icon={Users} />
        <KPICard
          title="Intra-State (Tamil Nadu)"
          value={customers.filter((c) => c.state === 'Tamil Nadu').length.toString()}
          icon={Building2}
        />
        <KPICard
          title="Inter-State Partners"
          value={customers.filter((c) => c.state !== 'Tamil Nadu').length.toString()}
          icon={MapPin}
        />
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="border-b border-surface-200 p-4 flex flex-col sm:flex-row gap-3 justify-between items-center">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
            <input
              type="text"
              placeholder="Search by name, state, or GSTIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-surface-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>
          <div className="text-xs text-surface-500 font-medium">
            {filteredCustomers.length} registered customers
          </div>
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Users}
              title="No customers added yet"
              description="Add your first retailer, distributor, or wholesale buyer to begin taking sales orders and generating GST invoices."
              action={
                <Button onClick={() => setIsAddOpen(true)} icon={Plus} size="sm">
                  Add Customer
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-surface-100 text-surface-600 text-xs uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Customer Name</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">State & GSTIN</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4 text-right">Credit Limit</th>
                  <th className="px-6 py-4 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-50/70">
                    <td className="px-6 py-4">
                      <div className="font-bold text-surface-900 text-base">{c.name}</div>
                      <div className="text-xs text-surface-400">Contact: {c.contactPerson || '—'}</div>
                    </td>
                    <td className="px-6 py-4 capitalize text-xs text-surface-700">
                      <span className="px-2.5 py-1 rounded-full bg-surface-100 font-semibold">
                        {c.customerType}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-surface-900">{c.state}</div>
                      <div className="text-xs font-mono text-surface-500">{c.gstin || 'Unregistered'}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-surface-600">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-surface-400" /> {c.phone || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium tabular-nums text-surface-600">
                      {formatCurrency(c.creditLimitPaise)}
                    </td>
                    <td className="px-6 py-4 text-right font-extrabold tabular-nums text-base">
                      <span className={c.outstandingPaise > 0 ? 'text-primary-700' : 'text-emerald-700'}>
                        {formatCurrency(c.outstandingPaise)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add New Customer"
        description="Register a retailer, distributor, or wholesale account. State determines CGST/SGST vs IGST."
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Business / Store Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sri Murugan Stores"
            />
            <Input
              label="Contact Person"
              required
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="e.g. Murugavel K"
            />
            <Input
              label="Phone Number"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
            <Input
              label="Email (Optional)"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="store@example.com"
            />
            <Input
              label="GSTIN (Optional)"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              placeholder="33AADCS1234F1Z5"
            />
            <Select
              label="Customer Type"
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value as any)}
              options={[
                { value: 'retailer', label: 'Retailer' },
                { value: 'distributor', label: 'Distributor' },
                { value: 'wholesale', label: 'Wholesale' },
              ]}
            />
            <Input
              label="Address Line"
              value={line1}
              onChange={(e) => setLine1(e.target.value)}
              placeholder="12 Main Road"
            />
            <Input
              label="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Coimbatore"
            />
            <Input
              label="State (For GST Calculation)"
              required
              value={stateName}
              onChange={(e) => setStateName(e.target.value)}
              placeholder="Tamil Nadu"
            />
            <Input
              label="Pincode"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              placeholder="641001"
            />
            <Input
              label="Credit Limit (₹)"
              type="number"
              min="0"
              value={creditLimit}
              onChange={(e) => setCreditLimit(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-surface-200">
            <Button type="button" variant="secondary" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save Customer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
