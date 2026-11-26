'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { APP_NAME, NAV_GROUPS } from '@/lib/constants';
import type { UserRole } from '@/lib/types';
import { OfflineIndicator } from '@/components/layout/offline-indicator';
import { ErpChatbot } from '@/components/chatbot/erp-chatbot';
import { useAuth } from '@/lib/auth/auth-context';
import { useStore } from '@/lib/store/store-context';
import {
  LayoutDashboard,
  ShoppingCart,
  Warehouse,
  Factory,
  FileText,
  PackagePlus,
  IndianRupee,
  Calculator,
  BarChart3,
  Settings,
  Users,
  PlusCircle,
  Package,
  ClipboardList,
  Shield,
  Bell,
  Search,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Command,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  ChevronDown,
  Building2,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  ShoppingCart,
  Warehouse,
  Factory,
  FileText,
  PackagePlus,
  IndianRupee,
  Calculator,
  BarChart3,
  Settings,
  Users,
  PlusCircle,
  Package,
  ClipboardList,
  Shield,
};

const ROLE_DETAILS = [
  { role: 'owner' as UserRole, label: 'Owner / CEO', email: 'owner@foodflow.in', desc: 'Full financial & operational analytics' },
  { role: 'admin' as UserRole, label: 'Administrator', email: 'admin@foodflow.in', desc: 'Order approvals & dispatching' },
  { role: 'salesman' as UserRole, label: 'Salesman', email: 'salesman@foodflow.in', desc: 'Field order capture & catalogue' },
  { role: 'production_supervisor' as UserRole, label: 'Production Supervisor', email: 'production@foodflow.in', desc: 'Batch planning & yield variance' },
  { role: 'accountant' as UserRole, label: 'Accountant / Auditor', email: 'accountant@foodflow.in', desc: 'Statutory GST & stock ledgers' },
];

interface AppShellProps {
  children: React.ReactNode;
  userRole?: UserRole;
  userName?: string;
  userEmail?: string;
}

export function AppShell({
  children,
  userRole = 'owner',
  userName = 'Demo User',
  userEmail = 'demo@foodflow.in',
}: AppShellProps) {
  const { user, login, switchRole, logout, isLiveFirebase } = useAuth();
  const { notifications } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const notificationsRef = useRef<HTMLDivElement>(null);
  const roleSwitcherRef = useRef<HTMLDivElement>(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');

  const activeRole = user?.role || userRole;
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(activeRole)),
  })).filter((group) => group.items.length > 0);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Global Keyboard Shortcut: ⌘K or Ctrl+K to toggle Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
        setNotificationsOpen(false);
        setRoleSwitcherOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setNotificationsOpen(false);
    setRoleSwitcherOpen(false);
    setCommandPaletteOpen(false);
  }, [pathname]);

  // Close popovers when clicking anywhere outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (roleSwitcherRef.current && !roleSwitcherRef.current.contains(target)) {
        setRoleSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const handleSwitchRole = async (role: UserRole, email: string) => {
    if (isLiveFirebase) return;
    try {
      await login(email, 'demo');
      setRoleSwitcherOpen(false);
    } catch {}
  };

  // Command palette quick actions derived from role-permitted navigation groups
  const commandItems = visibleGroups.flatMap((group) =>
    group.items.map((item) => ({
      label: item.label,
      href: item.href,
      icon: iconMap[item.icon] || LayoutDashboard,
      category: group.label,
    }))
  );

  const filteredCommandItems = commandItems.filter((item) =>
    item.label.toLowerCase().includes(commandQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface-50 text-surface-900 font-sans">
      {/* ===== Desktop Sidebar ===== */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 76 : 270 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="hidden lg:flex flex-col border-r border-surface-200/90 bg-white relative z-30 shadow-sm"
      >
        {/* Brand Header */}
        <div className="flex h-18 items-center gap-3.5 border-b border-surface-200/90 px-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 text-white font-extrabold text-base shadow-md shadow-primary-600/25 ring-1 ring-white/20">
            FF
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="min-w-0"
              >
                <span className="text-lg font-extrabold tracking-tight text-surface-900 block leading-tight">
                  {APP_NAME}
                </span>
                <span className="text-[11px] font-semibold text-primary-600 uppercase tracking-wider block">
                  Enterprise ERP
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation Items (Grouped & Collapsible) */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4 scrollbar-none">
          {visibleGroups.map((group) => {
            const isGroupCollapsed = !!collapsedGroups[group.id];
            return (
              <div key={group.id} className="space-y-1">
                {!sidebarCollapsed && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-surface-400 hover:text-surface-700 transition-colors"
                  >
                    <span>{group.label}</span>
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 transition-transform duration-200',
                        isGroupCollapsed ? '-rotate-90' : ''
                      )}
                    />
                  </button>
                )}
                {(!isGroupCollapsed || sidebarCollapsed) && (
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = iconMap[item.icon] || LayoutDashboard;
                      const baseHref = item.href.split('?')[0];
                      const isActive =
                        baseHref === '/dashboard'
                          ? pathname === '/dashboard'
                          : pathname === baseHref && !item.href.includes('?');

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-150',
                            isActive
                              ? 'text-primary-700 bg-primary-50/90 shadow-xs'
                              : 'text-surface-600 hover:bg-surface-100/80 hover:text-surface-900'
                          )}
                          title={sidebarCollapsed ? item.label : undefined}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="sidebar-active-pill"
                              className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary-600"
                              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                            />
                          )}
                          <Icon
                            className={cn(
                              'h-4.5 w-4.5 shrink-0 transition-transform duration-150 group-hover:scale-105',
                              isActive ? 'text-primary-600' : 'text-surface-400 group-hover:text-surface-600'
                            )}
                          />
                          {!sidebarCollapsed && (
                            <span className="truncate">{item.label}</span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="border-t border-surface-200/90 p-3.5 space-y-3 bg-surface-50/60">
          {/* Collapse Toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="flex w-full items-center justify-center rounded-xl p-2 text-surface-400 hover:bg-surface-200/70 hover:text-surface-700 transition-colors"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <div className="flex items-center gap-2 text-xs font-semibold text-surface-500">
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse Sidebar</span>
              </div>
            )}
          </button>

          {/* User Profile Card */}
          <div className="flex items-center gap-3 rounded-xl p-2 bg-white border border-surface-200/80 shadow-sm">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white font-bold text-xs shadow-sm">
              {(user?.displayName || userName).split(' ').map((n) => n[0]).join('').slice(0, 2)}
            </div>
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="min-w-0 flex-1"
                >
                  <p className="text-xs font-bold text-surface-900 truncate">{user?.displayName || userName}</p>
                  <p className="text-[11px] text-surface-400 capitalize truncate font-medium">
                    {(user?.role || userRole).replace('_', ' ')}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.aside>

      {/* ===== Main Content Area ===== */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex h-18 items-center justify-between border-b border-surface-200/90 bg-white/90 backdrop-blur-md px-5 lg:px-8 z-20">
          <div className="flex items-center gap-4">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-xl p-2.5 text-surface-500 hover:bg-surface-100 lg:hidden transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Global Search / Command Bar */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="hidden sm:flex items-center gap-3 rounded-xl border border-surface-300/80 bg-surface-50/80 px-4 py-2 text-sm text-surface-500 cursor-pointer hover:border-primary-400 hover:bg-white hover:text-surface-700 transition-all shadow-sm w-72 lg:w-96"
            >
              <Search className="h-4 w-4 text-surface-400" />
              <span className="flex-1 text-left text-xs font-medium">Quick jump or search...</span>
              <kbd className="flex items-center gap-1 rounded-md border border-surface-200 bg-white px-2 py-0.5 text-[10px] font-bold text-surface-500 shadow-sm">
                <Command className="h-3 w-3" /> K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Role Badge (Live Firebase) / Quick Role Switcher (Demo Mode only) */}
            {isLiveFirebase ? (
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-surface-200 bg-surface-50 text-xs font-bold text-surface-700 shadow-xs"
                title="Role is assigned by your administrator"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="capitalize">Role: {activeRole.replace('_', ' ')}</span>
              </div>
            ) : (
              <div ref={roleSwitcherRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setRoleSwitcherOpen((prev) => !prev);
                    setNotificationsOpen(false);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-surface-200 bg-surface-50 hover:bg-surface-100 text-xs font-bold text-surface-700 transition-all shadow-sm cursor-pointer"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="capitalize">Role: {activeRole.replace('_', ' ')}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-surface-400" />
                </button>

                <AnimatePresence>
                  {roleSwitcherOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-72 rounded-2xl bg-white border border-surface-200 shadow-dropdown p-2 z-50"
                    >
                      <div className="px-3 py-2 border-b border-surface-100">
                        <p className="text-xs font-extrabold text-surface-900">Switch Demo Role View</p>
                        <p className="text-[11px] text-surface-400">Preview role-tailored ERP navigation & workflows</p>
                      </div>
                      <div className="space-y-1 pt-1.5">
                        {ROLE_DETAILS.map((r) => (
                          <button
                            key={r.role}
                            type="button"
                            onClick={() => handleSwitchRole(r.role, r.email)}
                            className={cn(
                              'w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-colors cursor-pointer',
                              activeRole === r.role
                                ? 'bg-primary-50 text-primary-700 font-bold'
                                : 'hover:bg-surface-50 text-surface-700 font-medium'
                            )}
                          >
                            <div>
                              <p className="font-semibold text-surface-900">{r.label}</p>
                              <p className="text-[10px] text-surface-400">{r.desc}</p>
                            </div>
                            {activeRole === r.role && (
                              <CheckCircle2 className="h-4 w-4 text-primary-600 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Notifications Popover */}
            <div ref={notificationsRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen((prev) => !prev);
                  setRoleSwitcherOpen(false);
                }}
                className="relative rounded-xl p-2.5 text-surface-500 hover:bg-surface-100 hover:text-surface-700 transition-colors cursor-pointer"
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                  <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
                )}
              </button>

              <AnimatePresence>
                {notificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-surface-200 shadow-dropdown p-4 z-50 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-surface-100 pb-2.5">
                      <h4 className="text-sm font-bold text-surface-900">Notifications & Alerts</h4>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary-50 text-primary-700">
                        {notifications.length} Active
                      </span>
                    </div>
                    {notifications.length === 0 ? (
                      <div className="py-6 text-center space-y-1">
                        <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto" />
                        <p className="text-xs font-semibold text-surface-700">You&apos;re all caught up</p>
                        <p className="text-[11px] text-surface-400">No active stock or order alerts right now.</p>
                      </div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {notifications.slice(0, 8).map((n) => (
                          <div key={n.id} className="p-2.5 rounded-xl bg-surface-50 border border-surface-100 text-xs">
                            <p className="font-semibold text-surface-900">{n.title}</p>
                            <p className="text-surface-500 mt-0.5">{n.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Logout */}
            <button
              onClick={logout}
              title="Sign Out"
              className="rounded-xl p-2.5 text-surface-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Page Main Content with Smooth Viewport */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
            {children}
          </div>
        </main>
      </div>

      {/* ===== Global Command Palette (⌘K) Modal ===== */}
      <AnimatePresence>
        {commandPaletteOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md"
              onClick={() => setCommandPaletteOpen(false)}
            />
            <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-xl rounded-2xl bg-white shadow-modal border border-surface-200 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Search Header */}
                <div className="flex items-center gap-3 border-b border-surface-200 px-4 py-3.5 bg-surface-50/50">
                  <Search className="h-5 w-5 text-surface-400" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search operations, modules, and workflows..."
                    value={commandQuery}
                    onChange={(e) => setCommandQuery(e.target.value)}
                    className="w-full text-base bg-transparent border-none outline-none text-surface-900 placeholder:text-surface-400"
                  />
                  <kbd className="text-[10px] font-bold text-surface-400 bg-surface-200 px-2 py-0.5 rounded">
                    ESC
                  </kbd>
                </div>

                {/* Command Items List */}
                <div className="p-2 max-h-80 overflow-y-auto space-y-1">
                  <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-surface-400">
                    Quick Navigation
                  </div>
                  {filteredCommandItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.href}
                        onClick={() => {
                          router.push(item.href);
                          setCommandPaletteOpen(false);
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left hover:bg-primary-50 text-surface-800 hover:text-primary-700 transition-colors group cursor-pointer text-sm font-semibold"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-surface-400 group-hover:text-primary-600" />
                          <span>{item.label}</span>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-surface-300 group-hover:text-primary-600 transition-transform group-hover:translate-x-1" />
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Offline Status PWA Banner */}
      <OfflineIndicator />

      {/* Gemini AI ERP Assistant */}
      <ErpChatbot />

      {/* ===== Mobile Navigation Drawer ===== */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-surface-200 shadow-2xl flex flex-col lg:hidden"
            >
              <div className="flex h-16 items-center justify-between border-b border-surface-200 px-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 text-white font-extrabold text-sm">
                    FF
                  </div>
                  <span className="text-base font-extrabold text-surface-900">{APP_NAME}</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg text-surface-400 hover:bg-surface-100 hover:text-surface-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
                {visibleGroups.map((group) => (
                  <div key={group.id} className="space-y-1">
                    <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-surface-400">
                      {group.label}
                    </div>
                    {group.items.map((item) => {
                      const Icon = iconMap[item.icon] || LayoutDashboard;
                      const baseHref = item.href.split('?')[0];
                      const isActive = baseHref === '/dashboard' ? pathname === '/dashboard' : pathname === baseHref;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                            isActive ? 'bg-primary-50 text-primary-700' : 'text-surface-600 hover:bg-surface-100'
                          )}
                        >
                          <Icon className="h-4.5 w-4.5 shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
