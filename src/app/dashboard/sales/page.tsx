'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store/store-context';
import { useAuth } from '@/lib/auth/auth-context';
import { PageHeader, Card, CardHeader, Button, StatusBadge, EmptyState, Input, Select, Modal, Tabs, KPICard } from '@/components/ui';
import { formatCurrency, fromScaledQty, toScaledQty, toPaise, formatDate } from '@/lib/utils';
import { ORDER_STATUS_CONFIG } from '@/lib/constants';
import type { SalesOrder, SalesOrderItem, StockShortage } from '@/lib/types';
import {
  ShoppingCart, Plus, Search, Filter, Eye, Check, X, AlertTriangle,
  ArrowRight, Package, User, ChevronDown, Truck, FileText, CheckCircle2,
  Clock, ShieldAlert, Sparkles, Building2, MapPin, IndianRupee
} from 'lucide-react';

export default function SalesOrdersPage() {
  const {
    salesOrders,
    customers,
    products,
    inventoryBalances,
    settings,
    createSalesOrder,
    submitSalesOrder,
    markOrderUnderReview,
    approveSalesOrder,
    rejectSalesOrder,
    cancelSalesOrder,
    createInvoice,
    dispatchOrder,
    checkStockAvailability,
  } = useStore();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [rejectModalOrder, setRejectModalOrder] = useState<SalesOrder | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // New Order Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [orderItems, setOrderItems] = useState<{ productId: string; quantity: number }[]>([
    { productId: products[0]?.id || '', quantity: 10 },
  ]);
  const [orderNotes, setOrderNotes] = useState('');

  // Tab counts
  const counts = useMemo(() => {
    return {
      all: salesOrders.length,
      submitted: salesOrders.filter((o) => o.status === 'submitted').length,
      approved: salesOrders.filter((o) => o.status === 'approved').length,
      invoiced: salesOrders.filter((o) => o.status === 'invoiced').length,
      dispatched: salesOrders.filter((o) => o.status === 'dispatched' || o.status === 'completed').length,
      rejected: salesOrders.filter((o) => o.status === 'rejected').length,
    };
  }, [salesOrders]);

  const tabs = [
    { id: 'all', label: 'All Orders', count: counts.all },
    { id: 'submitted', label: 'Under Review', count: counts.submitted },
    { id: 'approved', label: 'Approved', count: counts.approved },
    { id: 'invoiced', label: 'Ready to Dispatch', count: counts.invoiced },
    { id: 'dispatched', label: 'Dispatched', count: counts.dispatched },
    { id: 'rejected', label: 'Rejected', count: counts.rejected },
  ];

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return salesOrders.filter((order) => {
      const matchesTab =
        activeTab === 'all'
          ? true
          : activeTab === 'dispatched'
          ? order.status === 'dispatched' || order.status === 'completed'
          : order.status === activeTab;

      const matchesSearch =
        order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.salesmanName.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesTab && matchesSearch;
    });
  }, [salesOrders, activeTab, searchQuery]);

  // Selected customer for new order
  const currentCustomer = customers.find((c) => c.id === selectedCustomerId) || customers[0];

  // Calculated totals for new order modal
  const newOrderCalculations = useMemo(() => {
    let taxablePaise = 0;
    let gstAmountPaise = 0;
    let shortages: StockShortage[] = [];

    const computedItems: SalesOrderItem[] = orderItems.map((item) => {
      const prod = products.find((p) => p.id === item.productId);
      const unitPrice = prod?.sellingPricePaise || 0;
      const gstRate = prod?.gstRatePercent ?? 5;
      const amount = unitPrice * item.quantity;
      taxablePaise += amount;
      gstAmountPaise += Math.round((amount * gstRate) / 100);

      const stockCheck = checkStockAvailability(item.productId, toScaledQty(item.quantity));
      if (!stockCheck.available) {
        shortages.push({
          productId: item.productId,
          productName: prod?.name || 'Product',
          requested: toScaledQty(item.quantity),
          available: stockCheck.currentStock,
          shortage: stockCheck.shortage,
        });
      }

      return {
        productId: item.productId,
        productName: prod?.name || '',
        productCode: prod?.code || '',
        quantity: toScaledQty(item.quantity),
        unitPricePaise: unitPrice,
        gstRatePercent: gstRate,
        amountPaise: amount,
        availableStock: stockCheck.currentStock,
      };
    });

    const isInterstate = currentCustomer ? currentCustomer.state !== settings.factoryState : false;
    const grandTotalPaise = taxablePaise + gstAmountPaise;

    return {
      computedItems,
      taxablePaise,
      gstAmountPaise,
      grandTotalPaise,
      shortages,
      isInterstate,
    };
  }, [orderItems, products, currentCustomer, checkStockAvailability, settings.factoryState]);

  const handleCreateOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCustomer) return;

    createSalesOrder({
      customerId: currentCustomer.id,
      customerName: currentCustomer.name,
      customerState: currentCustomer.state,
      salesmanId: user?.id || 'user_salesman_a',
      salesmanName: user?.displayName || 'Salesman A',
      items: newOrderCalculations.computedItems,
      totalAmountPaise: newOrderCalculations.taxablePaise,
      taxableAmountPaise: newOrderCalculations.taxablePaise,
      gstAmountPaise: newOrderCalculations.gstAmountPaise,
      grandTotalPaise: newOrderCalculations.grandTotalPaise,
      notes: orderNotes,
      createdBy: user?.id || 'user_salesman_a',
    });

    setIsNewOrderModalOpen(false);
    setOrderNotes('');
  };

  const handleApprove = (order: SalesOrder) => {
    approveSalesOrder(order.id, user?.displayName || 'Admin');
    if (selectedOrder?.id === order.id) {
      setSelectedOrder({ ...order, status: 'approved' });
    }
  };

  const handleRejectConfirm = () => {
    if (!rejectModalOrder) return;
    rejectSalesOrder(rejectModalOrder.id, rejectionReason || 'Rejected by administrator');
    if (selectedOrder?.id === rejectModalOrder.id) {
      setSelectedOrder({ ...selectedOrder, status: 'rejected', rejectionReason });
    }
    setRejectModalOrder(null);
    setRejectionReason('');
  };

  const handleInvoiceCreate = (order: SalesOrder) => {
    createInvoice(order.id, user?.displayName || 'Admin');
    if (selectedOrder?.id === order.id) {
      setSelectedOrder({ ...order, status: 'invoiced' });
    }
  };

  const handleDispatch = async (order: SalesOrder) => {
    setActionError(null);
    const res = await dispatchOrder(order.id, user?.displayName || 'Dispatcher');
    if (!res.ok) {
      setActionError(res.error || 'Failed to dispatch order due to insufficient stock.');
      return;
    }
    if (selectedOrder?.id === order.id) {
      setSelectedOrder({ ...order, status: 'dispatched' });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales & Orders"
        description="Streamlined order-to-dispatch workflow with stock verification and GST calculations"
      >
        <Button
          onClick={() => {
            setSelectedCustomerId(customers[0]?.id || '');
            if (products[0]?.id && !orderItems[0]?.productId) {
              setOrderItems([{ productId: products[0].id, quantity: 10 }]);
            }
            setIsNewOrderModalOpen(true);
          }}
          icon={Plus}
        >
          New Sales Order
        </Button>
      </PageHeader>

      {actionError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-xs font-bold text-rose-700 hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Booked Value"
          value={formatCurrency(salesOrders.reduce((sum, o) => sum + o.grandTotalPaise, 0))}
          icon={IndianRupee}
          trend="up"
          change={12.4}
          changeLabel="vs last week"
        />
        <KPICard
          title="Pending Approvals"
          value={counts.submitted.toString()}
          icon={Clock}
          trend={counts.submitted > 0 ? 'down' : 'neutral'}
        />
        <KPICard
          title="Ready to Dispatch"
          value={counts.invoiced.toString()}
          icon={Truck}
          trend="up"
        />
        <KPICard
          title="Active Stock Shortages"
          value={salesOrders.filter((o) => o.hasStockShortage && o.status !== 'completed' && o.status !== 'rejected').length.toString()}
          icon={AlertTriangle}
          trend={salesOrders.some((o) => o.hasStockShortage) ? 'down' : 'neutral'}
        />
      </div>

      {/* Main Container */}
      <Card padding="none" className="overflow-hidden">
        {/* Controls Bar */}
        <div className="border-b border-surface-200 p-4 space-y-4">
          <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
              <input
                type="text"
                placeholder="Search orders, customers, salesmen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-surface-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-colors"
              />
            </div>
            <div className="text-xs text-surface-500 font-medium">
              Showing {filteredOrders.length} of {salesOrders.length} orders
            </div>
          </div>
        </div>

        {/* Order Cards / Table */}
        {filteredOrders.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={ShoppingCart}
              title="No sales orders found"
              description="There are no orders matching your current filters. Create a new order to test the workflow."
              action={
                <Button onClick={() => setIsNewOrderModalOpen(true)} icon={Plus} size="sm">
                  Create Order
                </Button>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-surface-200">
            {filteredOrders.map((order) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-5 hover:bg-surface-50/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                {/* Left: Info */}
                <div className="space-y-2.5 min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-extrabold text-surface-900 tracking-tight text-lg font-mono">
                      {order.orderNumber}
                    </span>
                    <StatusBadge status={order.status} config={ORDER_STATUS_CONFIG} size="md" />
                    {order.hasStockShortage && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 shadow-sm animate-pulse">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Stock Shortage
                      </span>
                    )}
                    {order.customerState !== settings.factoryState && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200">
                        IGST (Inter-state: {order.customerState})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-surface-600 flex-wrap">
                    <span className="flex items-center gap-2 font-bold text-surface-900 text-base">
                      <Building2 className="h-4 w-4 text-primary-600" />
                      {order.customerName}
                    </span>
                    <span className="text-surface-300">•</span>
                    <span className="flex items-center gap-1.5 text-xs font-medium text-surface-500">
                      <User className="h-3.5 w-3.5 text-surface-400" />
                      {order.salesmanName}
                    </span>
                    <span className="text-surface-300">•</span>
                    <span className="flex items-center gap-1.5 text-xs font-medium text-surface-500">
                      <Clock className="h-3.5 w-3.5 text-surface-400" />
                      {formatDate(new Date(order.createdAt?.seconds ? order.createdAt.seconds * 1000 : Date.now()))}
                    </span>
                  </div>

                  {/* Items Preview */}
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {order.items.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg bg-surface-100 text-surface-800 font-semibold border border-surface-200/80 shadow-xs"
                      >
                        <Package className="h-3.5 w-3.5 text-primary-600" />
                        {fromScaledQty(item.quantity)} × {item.productName}
                      </span>
                    ))}
                  </div>

                  {/* Shortage details inline if any */}
                  {order.hasStockShortage && order.shortageDetails && (
                    <div className="p-3.5 rounded-xl bg-rose-50/80 border border-rose-200 text-xs text-rose-900 space-y-1.5 shadow-xs">
                      <div className="font-bold flex items-center gap-2 text-sm text-rose-800">
                        <ShieldAlert className="h-4 w-4 text-rose-600" />
                        Insufficient finished goods inventory in warehouse:
                      </div>
                      {order.shortageDetails.map((sh, idx) => (
                        <div key={idx} className="ml-6 text-xs font-medium">
                          • {sh.productName}: Requested <strong>{fromScaledQty(sh.requested)} pkts</strong>, available <strong>{fromScaledQty(sh.available)} pkts</strong>. (Warehouse Shortage: <strong className="text-rose-700 underline text-sm">{fromScaledQty(sh.shortage)} pkts</strong>)
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Amounts & Actions */}
                <div className="flex items-center justify-between lg:justify-end gap-6 shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0">
                  <div className="text-right">
                    <div className="text-xs font-bold text-surface-400 uppercase tracking-wider">Grand Total</div>
                    <div className="text-xl sm:text-2xl font-black text-surface-900 tabular-nums">
                      {formatCurrency(order.grandTotalPaise)}
                    </div>
                    <div className="text-xs font-medium text-surface-400">
                      Taxable: {formatCurrency(order.taxableAmountPaise)}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedOrder(order)}
                      icon={Eye}
                    >
                      Details
                    </Button>

                    {order.status === 'draft' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => submitSalesOrder(order.id)}
                        icon={ArrowRight}
                      >
                        Submit Order
                      </Button>
                    )}

                    {order.status === 'submitted' && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => markOrderUnderReview(order.id)}
                          icon={Clock}
                        >
                          Review
                        </Button>
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => handleApprove(order)}
                          icon={Check}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setRejectModalOrder(order)}
                          icon={X}
                        >
                          Reject
                        </Button>
                      </>
                    )}

                    {order.status === 'under_review' && (
                      <>
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => handleApprove(order)}
                          icon={Check}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setRejectModalOrder(order)}
                          icon={X}
                        >
                          Reject
                        </Button>
                      </>
                    )}

                    {order.status === 'approved' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleInvoiceCreate(order)}
                        icon={FileText}
                      >
                        Generate Invoice
                      </Button>
                    )}

                    {order.status === 'invoiced' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleDispatch(order)}
                        icon={Truck}
                      >
                        Dispatch Stock
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      {/* ===== Order Details Modal ===== */}
      <Modal
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `Order Details — ${selectedOrder.orderNumber}` : ''}
        size="lg"
      >
        {selectedOrder && (
          <div className="space-y-6">
            {/* Status & Customer Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-surface-50 border border-surface-200">
              <div>
                <p className="text-xs text-surface-400 uppercase tracking-wider font-semibold">Customer</p>
                <p className="text-base font-semibold text-surface-900 mt-0.5">{selectedOrder.customerName}</p>
                <p className="text-xs text-surface-500 flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3" /> State: {selectedOrder.customerState}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs text-surface-400 uppercase tracking-wider font-semibold">Order Status</p>
                <div className="mt-1">
                  <StatusBadge status={selectedOrder.status} config={ORDER_STATUS_CONFIG} />
                </div>
                <p className="text-xs text-surface-500 mt-1">
                  Salesman: {selectedOrder.salesmanName}
                </p>
              </div>
            </div>

            {/* Shortage Alert */}
            {selectedOrder.hasStockShortage && selectedOrder.shortageDetails && (
              <div className="p-4 rounded-xl bg-error-50 border border-error-200 text-error-800 space-y-2">
                <div className="font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-error-600" />
                  Inventory Shortage Detected for this order
                </div>
                {selectedOrder.shortageDetails.map((sh, idx) => (
                  <div key={idx} className="text-xs">
                    • <strong>{sh.productName}</strong>: Available in warehouse is{' '}
                    <strong>{fromScaledQty(sh.available)} packets</strong>, but order requested{' '}
                    <strong>{fromScaledQty(sh.requested)} packets</strong>. Factory requires{' '}
                    <strong className="text-error-900 underline">{fromScaledQty(sh.shortage)} more packets</strong> to fulfill.
                  </div>
                ))}
              </div>
            )}

            {/* Order Items Table */}
            <div>
              <h4 className="text-sm font-semibold text-surface-900 mb-2">Order Line Items</h4>
              <div className="rounded-lg border border-surface-200 overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-surface-100 text-surface-600 text-xs uppercase font-medium">
                    <tr>
                      <th className="px-4 py-2.5">Product</th>
                      <th className="px-4 py-2.5 text-right">Quantity</th>
                      <th className="px-4 py-2.5 text-right">Unit Price</th>
                      <th className="px-4 py-2.5 text-right">GST Rate</th>
                      <th className="px-4 py-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-200">
                    {selectedOrder.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-surface-50">
                        <td className="px-4 py-3 font-medium text-surface-900">{item.productName}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fromScaledQty(item.quantity)} pkts</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(item.unitPricePaise)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{item.gstRatePercent}%</td>
                        <td className="px-4 py-3 text-right font-semibold text-surface-900 tabular-nums">
                          {formatCurrency(item.amountPaise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Price Calculations Breakdown */}
            <div className="flex justify-end">
              <div className="w-72 space-y-2 text-sm bg-surface-50 p-4 rounded-xl border border-surface-200">
                <div className="flex justify-between text-surface-600">
                  <span>Taxable Amount</span>
                  <span className="tabular-nums font-medium">{formatCurrency(selectedOrder.taxableAmountPaise)}</span>
                </div>
                <div className="flex justify-between text-surface-600">
                  <span>{selectedOrder.customerState === 'Tamil Nadu' ? 'CGST (2.5%) + SGST (2.5%)' : 'IGST (5%)'}</span>
                  <span className="tabular-nums font-medium">{formatCurrency(selectedOrder.gstAmountPaise)}</span>
                </div>
                <div className="border-t border-surface-300 pt-2 flex justify-between font-bold text-surface-900 text-base">
                  <span>Grand Total</span>
                  <span className="tabular-nums">{formatCurrency(selectedOrder.grandTotalPaise)}</span>
                </div>
              </div>
            </div>

            {/* Action Bar inside Modal */}
            <div className="border-t border-surface-200 pt-4 flex items-center justify-between">
              <Button variant="secondary" onClick={() => setSelectedOrder(null)}>
                Close
              </Button>
              <div className="flex gap-2">
                {selectedOrder.status === 'submitted' && (
                  <>
                    <Button variant="danger" onClick={() => setRejectModalOrder(selectedOrder)}>
                      Reject
                    </Button>
                    <Button variant="success" onClick={() => handleApprove(selectedOrder)}>
                      Approve Order
                    </Button>
                  </>
                )}
                {selectedOrder.status === 'approved' && (
                  <Button variant="primary" onClick={() => handleInvoiceCreate(selectedOrder)}>
                    Generate GST Invoice
                  </Button>
                )}
                {selectedOrder.status === 'invoiced' && (
                  <Button variant="primary" onClick={() => handleDispatch(selectedOrder)}>
                    Dispatch Order & Deduct Stock
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ===== Create New Order Modal ===== */}
      <Modal
        open={isNewOrderModalOpen}
        onClose={() => setIsNewOrderModalOpen(false)}
        title="Create Sales Order"
        description="Select customer, specify products and quantities. Live stock check will automatically run."
        size="lg"
      >
        <form onSubmit={handleCreateOrderSubmit} className="space-y-5">
          {/* Customer Selection */}
          <div>
            <label className="text-sm font-medium text-surface-700 block mb-1.5">Select Customer</label>
            <select
              value={selectedCustomerId || customers[0]?.id}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-surface-300 bg-white text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.state} ({c.customerType})
                </option>
              ))}
            </select>
            {currentCustomer && (
              <p className="text-xs text-surface-500 mt-1.5">
                GSTIN: {currentCustomer.gstin || 'Unregistered'} • State: {currentCustomer.state} ({currentCustomer.state === settings.factoryState ? 'Intra-State: CGST+SGST' : 'Inter-State: IGST'})
              </p>
            )}
          </div>

          {/* Product Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-surface-700">Order Items</label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setOrderItems([...orderItems, { productId: products[0]?.id || '', quantity: 50 }])}
                icon={Plus}
              >
                Add Item
              </Button>
            </div>

            {orderItems.map((item, index) => {
              const selectedProduct = products.find((p) => p.id === item.productId);
              const bal = inventoryBalances.find((b) => b.itemId === item.productId);
              const availableQty = bal ? fromScaledQty(bal.currentStock) : 0;
              const isShort = item.quantity > availableQty;

              return (
                <div key={index} className="p-3 rounded-lg border border-surface-200 bg-surface-50 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-6">
                      <label className="text-xs text-surface-500 block mb-1">Product</label>
                      <select
                        value={item.productId}
                        onChange={(e) => {
                          const updated = [...orderItems];
                          updated[index].productId = e.target.value;
                          setOrderItems(updated);
                        }}
                        className="w-full h-9 px-3 rounded-lg border border-surface-300 bg-white text-sm outline-none"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({formatCurrency(p.sellingPricePaise)}/pkt)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-4">
                      <label className="text-xs text-surface-500 block mb-1">Quantity (packets)</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...orderItems];
                          updated[index].quantity = parseInt(e.target.value) || 0;
                          setOrderItems(updated);
                        }}
                        className="w-full h-9 px-3 rounded-lg border border-surface-300 bg-white text-sm outline-none tabular-nums"
                      />
                    </div>

                    <div className="sm:col-span-2 flex justify-end">
                      {orderItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setOrderItems(orderItems.filter((_, i) => i !== index))}
                          className="h-9 px-2 text-error-600 hover:bg-error-50 rounded-lg text-xs font-medium"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stock Availability indicator */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-surface-500">
                      Warehouse Stock: <strong className={availableQty > 0 ? 'text-surface-800' : 'text-error-600'}>{availableQty} packets</strong>
                    </span>
                    {isShort && (
                      <span className="text-error-600 font-semibold flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Warning: Shortage of {item.quantity - availableQty} packets!
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Shortage notification banner if any */}
          {newOrderCalculations.shortages.length > 0 && (
            <div className="p-3 rounded-lg bg-warning-50 border border-warning-200 text-warning-800 text-xs space-y-1">
              <span className="font-semibold flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-warning-600" />
                Insufficient Finished Goods Stock Warning
              </span>
              <p>
                One or more items exceed warehouse stock. The order can still be captured and saved under review, alerting production supervisors to schedule a batch.
              </p>
            </div>
          )}

          {/* Live Order Calculation Summary */}
          <div className="p-4 rounded-xl bg-surface-100/70 border border-surface-200 space-y-1.5 text-sm">
            <div className="flex justify-between text-surface-600">
              <span>Taxable Value (Before GST)</span>
              <span className="tabular-nums font-medium">{formatCurrency(newOrderCalculations.taxablePaise)}</span>
            </div>
            <div className="flex justify-between text-surface-600">
              <span>
                GST (5% {newOrderCalculations.isInterstate ? 'IGST' : 'CGST 2.5% + SGST 2.5%'})
              </span>
              <span className="tabular-nums font-medium">{formatCurrency(newOrderCalculations.gstAmountPaise)}</span>
            </div>
            <div className="border-t border-surface-300 pt-1.5 flex justify-between font-bold text-surface-900 text-base">
              <span>Grand Total</span>
              <span className="tabular-nums text-primary-700">{formatCurrency(newOrderCalculations.grandTotalPaise)}</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-surface-500 block mb-1">Order Notes (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Standard dispatch via Coimbatore transport"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-surface-300 bg-white text-sm outline-none"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
            <Button type="button" variant="secondary" onClick={() => setIsNewOrderModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Submit Sales Order
            </Button>
          </div>
        </form>
      </Modal>

      {/* ===== Reject Reason Modal ===== */}
      <Modal
        open={!!rejectModalOrder}
        onClose={() => setRejectModalOrder(null)}
        title="Reject Sales Order"
        description="Provide a reason for rejecting this order so the salesman can review."
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Rejection Reason"
            placeholder="e.g. Credit limit exceeded or discontinued SKU"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setRejectModalOrder(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleRejectConfirm}>
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
