'use client';
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@/lib/store/store-context';
import { useAuth } from '@/lib/auth/auth-context';
import { KPICard, Card, CardHeader, ActivityItem, StatusBadge, PageHeader } from '@/components/ui';
import { formatCurrency, formatQuantity, fromScaledQty, toRupees } from '@/lib/utils';
import { ORDER_STATUS_CONFIG } from '@/lib/constants';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
  IndianRupee, Package, ShoppingCart, Factory, TrendingUp, AlertTriangle,
  Warehouse, FileText, Users, ArrowUpRight, Clock, CheckCircle2
} from 'lucide-react';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const CHART_COLORS = {
  primary: '#3457ed',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
};

const STATUS_CHART_COLORS: Record<string, string> = {
  draft: '#a8a29e',
  submitted: '#6366f1',
  under_review: '#f59e0b',
  approved: '#10b981',
  rejected: '#ef4444',
  invoiced: '#3457ed',
  dispatched: '#059669',
  completed: '#047857',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-surface-200 bg-white/95 backdrop-blur-md px-4 py-3 shadow-dropdown">
      <p className="text-xs font-bold text-surface-400 uppercase tracking-wider">{label}</p>
      <p className="text-base font-extrabold text-surface-900 mt-0.5 tabular-nums">{formatCurrency(payload[0].value)}</p>
    </div>
  );
};

const InventoryTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-xl border border-surface-200 bg-white/95 backdrop-blur-md px-4 py-3 shadow-dropdown space-y-1">
      <p className="text-sm font-bold text-surface-900">{data.name}</p>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-surface-500">Stock Balance:</span>
        <span className="font-bold text-primary-700 tabular-nums">{data.stock.toLocaleString('en-IN')} {data.unit}</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-surface-500">Reorder Threshold:</span>
        <span className="font-semibold text-surface-700 tabular-nums">{data.reorderLevel.toLocaleString('en-IN')} {data.unit}</span>
      </div>
    </div>
  );
};

export default function DashboardPage() {
  const { user } = useAuth();
  const {
    invoices,
    salesOrders,
    inventoryBalances,
    customers,
    products,
    productionRuns,
    materials,
    stockLedger,
    getMonthlyRevenue,
  } = useStore();

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // 1. User greeting and date
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const formattedDate = useMemo(() => {
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
  }, []);

  const userName = user?.displayName || 'Owner';

  // 2. KPI Cards metrics
  const totalRevenuePaise = useMemo(() => {
    return invoices
      .filter((inv) => inv.status === 'posted')
      .reduce((sum, inv) => sum + (inv.grandTotalPaise || 0), 0);
  }, [invoices]);

  const totalOrdersCount = useMemo(() => {
    return salesOrders.length;
  }, [salesOrders]);

  const finishedGoodsStock = useMemo(() => {
    return inventoryBalances
      .filter((b) => b.itemType === 'finished_good')
      .reduce((sum, b) => sum + fromScaledQty(b.currentStock), 0);
  }, [inventoryBalances]);

  const totalOutstandingPaise = useMemo(() => {
    return customers.reduce((sum, c) => sum + (c.outstandingPaise || 0), 0);
  }, [customers]);

  // 3. Monthly revenue chart data
  const monthlyRevenueData = useMemo(() => {
    return getMonthlyRevenue();
  }, [getMonthlyRevenue, invoices]);

  // 4. Order status distribution
  const orderDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const order of salesOrders) {
      counts[order.status] = (counts[order.status] || 0) + 1;
    }

    return Object.entries(ORDER_STATUS_CONFIG).map(([key, config]) => ({
      status: key,
      name: config.label,
      value: counts[key] || 0,
      color: STATUS_CHART_COLORS[key] || '#a8a29e',
    }));
  }, [salesOrders]);

  const activeOrderDistribution = useMemo(() => {
    return orderDistribution.filter((d) => d.value > 0);
  }, [orderDistribution]);

  // 5. Inventory Overview bar chart data
  const inventoryData = useMemo(() => {
    return inventoryBalances.map((item) => ({
      name: item.itemName,
      shortName: item.itemName.length > 10 ? `${item.itemName.slice(0, 9)}…` : item.itemName,
      stock: fromScaledQty(item.currentStock),
      reorderLevel: fromScaledQty(item.reorderLevel),
      unit: item.unitName,
      category: item.itemType === 'finished_good' ? 'Finished Good' : item.itemType === 'raw_material' ? 'Raw Material' : 'Packaging',
      color: item.itemType === 'finished_good' ? CHART_COLORS.success : item.itemType === 'raw_material' ? CHART_COLORS.primary : CHART_COLORS.warning,
    }));
  }, [inventoryBalances]);

  // 6. Low stock alerts
  const lowStockItems = useMemo(() => {
    return inventoryBalances.filter((b) => b.isLowStock || b.currentStock <= b.reorderLevel);
  }, [inventoryBalances]);

  // 7. Recent activity from stock ledger (last 5)
  const recentActivities = useMemo(() => {
    const entries = [...stockLedger].slice(-5).reverse();
    return entries.map((entry) => {
      let icon = Warehouse;
      let iconColor = 'bg-primary-50 text-primary-600';
      let title = entry.itemName;
      let description = entry.remarks || 'Stock movement logged';

      switch (entry.movementType) {
        case 'purchase_receipt':
          icon = Package;
          iconColor = 'bg-success-50 text-success-600';
          title = `Received: ${entry.itemName}`;
          description = `+${formatQuantity(entry.quantityIn, '')} added to stock`;
          break;
        case 'production_receipt':
          icon = CheckCircle2;
          iconColor = 'bg-primary-50 text-primary-600';
          title = `Produced: ${entry.itemName}`;
          description = `+${formatQuantity(entry.quantityIn, '')} finished goods batched`;
          break;
        case 'production_issue':
          icon = Factory;
          iconColor = 'bg-warning-50 text-warning-600';
          title = `Issued: ${entry.itemName}`;
          description = `-${formatQuantity(entry.quantityOut, '')} issued to production`;
          break;
        case 'sales_dispatch':
          icon = ShoppingCart;
          iconColor = 'bg-info-50 text-info-600';
          title = `Dispatched: ${entry.itemName}`;
          description = `-${formatQuantity(entry.quantityOut, '')} dispatched to customer`;
          break;
        case 'opening_balance':
          icon = Warehouse;
          iconColor = 'bg-surface-100 text-surface-600';
          title = `Opening Stock: ${entry.itemName}`;
          description = `Initial balance: ${formatQuantity(entry.quantityIn, '')}`;
          break;
        default:
          icon = FileText;
          iconColor = 'bg-surface-100 text-surface-600';
          title = `${entry.movementType.replace(/_/g, ' ')}: ${entry.itemName}`;
          description = entry.remarks || 'Stock movement logged';
      }

      let timeStr = 'Recently';
      if (entry.timestamp?.seconds) {
        const d = new Date(entry.timestamp.seconds * 1000);
        timeStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      return {
        id: entry.id,
        icon,
        iconColor,
        title,
        description,
        time: timeStr,
      };
    });
  }, [stockLedger]);

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 pb-12"
    >
      {/* 1. Page Header */}
      <motion.div variants={item}>
        <PageHeader
          title={`${greeting}, ${userName}`}
          description={`${formattedDate} • Operational overview & manufacturing performance`}
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-surface-200 bg-white px-3 py-1 text-xs font-medium text-surface-600 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-success-500 animate-pulse" />
              <span>Operations Active</span>
            </span>
            <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-surface-200 bg-white px-3 py-1 text-xs font-medium text-surface-600 shadow-sm">
              <Clock className="h-3 w-3 text-surface-400" />
              <span>Auto-refreshing</span>
            </div>
          </div>
        </PageHeader>
      </motion.div>

      {/* 2. KPI Cards Row (4 cards in responsive grid: 2 cols on mobile, 4 on desktop) */}
      <motion.div variants={item} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard
          title="Total Revenue"
          value={formatCurrency(totalRevenuePaise)}
          change={12.5}
          changeLabel="vs last month"
          icon={IndianRupee}
          trend="up"
        />
        <KPICard
          title="Total Orders"
          value={totalOrdersCount.toString()}
          change={8.2}
          changeLabel="vs last month"
          icon={ShoppingCart}
          trend="up"
        />
        <KPICard
          title="Finished Goods Stock"
          value={`${finishedGoodsStock.toLocaleString('en-IN')} units`}
          change={4.1}
          changeLabel="vs last month"
          icon={Package}
          trend="up"
        />
        <KPICard
          title="Outstanding Amount"
          value={formatCurrency(totalOutstandingPaise)}
          change={2.4}
          changeLabel="vs last month"
          icon={Clock}
          trend="down"
        />
      </motion.div>

      {/* Main Grid: Charts and Insights */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Revenue Chart & Inventory Overview (8 cols on lg) */}
        <div className="space-y-6 lg:col-span-8">
          {/* 3. Revenue Chart (AreaChart) */}
          <motion.div variants={item}>
            <Card>
              <CardHeader
                title="Revenue Performance"
                description="Monthly invoiced revenue trajectory across the financial year"
                action={
                  <div className="flex items-center gap-1 rounded-lg border border-surface-200 bg-surface-50 px-2.5 py-1 text-xs font-medium text-surface-600">
                    <TrendingUp className="h-3.5 w-3.5 text-primary-600" />
                    <span>Invoiced (Paise)</span>
                  </div>
                }
              />
              <div className="h-[280px] w-full pt-2">
                {mounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={monthlyRevenueData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                      <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: '#78716c' }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: '#78716c' }}
                        tickFormatter={(v) => {
                          const rupees = toRupees(v);
                          if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
                          if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(0)}k`;
                          return `₹${rupees}`;
                        }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke={CHART_COLORS.primary}
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#revenueGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full w-full animate-pulse rounded bg-surface-100" />
                )}
              </div>
            </Card>
          </motion.div>

          {/* 5. Inventory Overview (Bar chart) */}
          <motion.div variants={item}>
            <Card>
              <CardHeader
                title="Inventory Stock Levels"
                description="Live stock volumes for raw materials, packaging, and finished goods"
                action={
                  <div className="flex items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-surface-600">
                      <span className="h-2.5 w-2.5 rounded-sm bg-[#3457ed]" />
                      Raw Material
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-surface-600">
                      <span className="h-2.5 w-2.5 rounded-sm bg-[#f59e0b]" />
                      Packaging
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-surface-600">
                      <span className="h-2.5 w-2.5 rounded-sm bg-[#10b981]" />
                      Finished Good
                    </span>
                  </div>
                }
              />
              <div className="h-[280px] w-full pt-2">
                {mounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={inventoryData}
                      margin={{ top: 10, right: 10, left: -15, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                      <XAxis
                        dataKey="shortName"
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                        tick={{ fontSize: 11, fill: '#78716c' }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: '#78716c' }}
                      />
                      <Tooltip content={<InventoryTooltip />} />
                      <Bar dataKey="stock" radius={[4, 4, 0, 0]}>
                        {inventoryData.map((entry, idx) => (
                          <Cell key={`bar-cell-${idx}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full w-full animate-pulse rounded bg-surface-100" />
                )}
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Right Column: Order Distribution, Quick Stats, Alerts, Activity (4 cols on lg) */}
        <div className="space-y-6 lg:col-span-4">
          {/* 8. Quick Stats Card */}
          <motion.div variants={item}>
            <Card>
              <CardHeader
                title="Operations Snapshot"
                description="Core metrics across facility operations"
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
                <div className="flex items-center gap-2.5 rounded-lg border border-surface-200 bg-surface-50 p-2.5 transition-colors hover:bg-surface-100">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                    <Package className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-surface-900 tabular-nums">{products.length}</p>
                    <p className="text-xs text-surface-500 truncate">Products</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 rounded-lg border border-surface-200 bg-surface-50 p-2.5 transition-colors hover:bg-surface-100">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info-100 text-info-700">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-surface-900 tabular-nums">{customers.length}</p>
                    <p className="text-xs text-surface-500 truncate">Customers</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 rounded-lg border border-surface-200 bg-surface-50 p-2.5 transition-colors hover:bg-surface-100">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning-100 text-warning-700">
                    <Factory className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-surface-900 tabular-nums">{productionRuns.length}</p>
                    <p className="text-xs text-surface-500 truncate">Production Runs</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 rounded-lg border border-surface-200 bg-surface-50 p-2.5 transition-colors hover:bg-surface-100">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success-100 text-success-700">
                    <Warehouse className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-surface-900 tabular-nums">{materials.length}</p>
                    <p className="text-xs text-surface-500 truncate">Materials</p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* 4. Order Status Distribution */}
          <motion.div variants={item}>
            <Card>
              <CardHeader
                title="Order Distribution"
                description={`${totalOrdersCount} total orders in system`}
              />
              <div className="flex flex-col items-center">
                {mounted && activeOrderDistribution.length > 0 ? (
                  <div className="relative h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={activeOrderDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {activeOrderDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0];
                            return (
                              <div className="rounded-lg border border-surface-200 bg-white px-2.5 py-1.5 shadow-dropdown text-xs">
                                <span className="font-semibold text-surface-900">{d.name}:</span>{' '}
                                <span className="font-medium text-surface-600">{d.value} orders</span>
                              </div>
                            );
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xl font-bold text-surface-900 tabular-nums">{totalOrdersCount}</span>
                      <span className="text-[10px] text-surface-400 font-medium uppercase tracking-wider">Orders</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-100 text-surface-400 mb-2">
                      <ShoppingCart className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium text-surface-700">No Orders Logged</p>
                    <p className="text-xs text-surface-400 mt-0.5">Status breakdown will display as orders are placed.</p>
                  </div>
                )}

                {/* Status Badges breakdown */}
                <div className="w-full mt-3 divide-y divide-surface-100">
                  {Object.entries(ORDER_STATUS_CONFIG).slice(0, 5).map(([status, cfg]) => {
                    const count = salesOrders.filter((o) => o.status === status).length;
                    return (
                      <div key={status} className="flex items-center justify-between py-1.5 text-xs">
                        <StatusBadge status={status} config={ORDER_STATUS_CONFIG} size="sm" />
                        <span className="font-medium text-surface-600 tabular-nums">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </motion.div>

          {/* 6. Low Stock Alerts */}
          <motion.div variants={item}>
            <Card>
              <CardHeader
                title="Low Stock Alerts"
                description="Materials & goods nearing critical thresholds"
                action={
                  lowStockItems.length > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-error-50 px-2 py-0.5 text-xs font-semibold text-error-700">
                      <AlertTriangle className="h-3 w-3" />
                      {lowStockItems.length} Low
                    </span>
                  ) : null
                }
              />
              {lowStockItems.length > 0 ? (
                <div className="space-y-2.5">
                  {lowStockItems.map((item) => (
                    <div
                      key={item.itemId}
                      className="flex items-center justify-between rounded-lg border border-warning-200 bg-warning-50/60 p-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning-100 text-warning-700">
                          <AlertTriangle className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-surface-900 truncate">{item.itemName}</p>
                          <p className="text-xs text-surface-500">
                            Reorder: {formatQuantity(item.reorderLevel, item.unitName)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold text-error-600 tabular-nums">
                          {formatQuantity(item.currentStock, item.unitName)}
                        </span>
                        <p className="text-[10px] text-surface-400 uppercase font-medium">In Stock</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-success-200 bg-success-50/50 p-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success-100 text-success-600">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-success-900">All Stock Levels Healthy</p>
                    <p className="text-xs text-success-700 mt-0.5">
                      All raw materials and finished goods are safely above reorder points.
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>

          {/* 7. Recent Activity Feed (last 5 items) */}
          <motion.div variants={item}>
            <Card>
              <CardHeader
                title="Recent Activity"
                description="Latest movements recorded in the stock ledger"
                action={
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary-600">
                    <span>Audit trail</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </span>
                }
              />
              <div className="divide-y divide-surface-100">
                {recentActivities.length > 0 ? (
                  recentActivities.map((act) => (
                    <ActivityItem
                      key={act.id}
                      icon={act.icon}
                      title={act.title}
                      description={act.description}
                      time={act.time}
                      iconColor={act.iconColor}
                    />
                  ))
                ) : (
                  <p className="py-6 text-center text-xs text-surface-400">
                    No recent activity records found.
                  </p>
                )}
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
