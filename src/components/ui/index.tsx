'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  X,
  Search,
  Command,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';

// ===== KPI Card =====
interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
  loading?: boolean;
}

export function KPICard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  trend = 'neutral',
  className,
  loading = false,
}: KPICardProps) {
  if (loading) {
    return (
      <div className={cn('rounded-2xl border border-surface-200/80 bg-white p-6 shadow-card', className)}>
        <div className="flex items-center justify-between">
          <div className="skeleton-luxe h-5 w-28 rounded-lg" />
          <div className="skeleton-luxe h-11 w-11 rounded-xl" />
        </div>
        <div className="mt-4 skeleton-luxe h-9 w-36 rounded-lg" />
        <div className="mt-3 skeleton-luxe h-4 w-24 rounded-md" />
      </div>
    );
  }

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up'
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200/70'
      : trend === 'down'
        ? 'text-rose-700 bg-rose-50 border-rose-200/70'
        : 'text-surface-600 bg-surface-100 border-surface-200';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-surface-200/90 bg-white p-6',
        'shadow-card hover:shadow-card-hover transition-all duration-300',
        'glow-card',
        className
      )}
    >
      {/* Top subtle accent gradient bar */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary-500/0 via-primary-500/50 to-emerald-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold tracking-wide text-surface-500 uppercase">{title}</p>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-50 to-primary-100/60 text-primary-600 ring-1 ring-primary-500/20 shadow-sm transition-transform duration-300 group-hover:scale-105">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4">
        <motion.p
          key={value}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-extrabold tracking-tight text-surface-900 tabular-nums"
        >
          {value}
        </motion.p>
      </div>

      {change !== undefined && (
        <div className="mt-3 flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border tabular-nums shadow-sm',
              trendColor
            )}
          >
            <TrendIcon className="h-3.5 w-3.5" />
            {Math.abs(change).toFixed(1)}%
          </span>
          {changeLabel && (
            <span className="text-xs font-medium text-surface-400">{changeLabel}</span>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ===== Status Badge =====
interface StatusBadgeProps {
  status: string;
  config: Record<string, { label: string; color: string; dotColor?: string }>;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, config, size = 'md' }: StatusBadgeProps) {
  const cfg = config[status] || {
    label: status,
    color: 'bg-surface-100 text-surface-700 border-surface-200',
    dotColor: 'bg-surface-400',
  };

  const sizeClasses = {
    sm: 'px-2.5 py-0.5 text-xs gap-1.5',
    md: 'px-3 py-1 text-xs font-semibold gap-2',
    lg: 'px-3.5 py-1.5 text-sm font-semibold gap-2.5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border shadow-sm transition-all',
        cfg.color,
        sizeClasses[size]
      )}
    >
      {cfg.dotColor && (
        <span className="relative flex h-2 w-2">
          <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', cfg.dotColor)} />
          <span className={cn('relative inline-flex rounded-full h-2 w-2', cfg.dotColor)} />
        </span>
      )}
      <span>{cfg.label}</span>
    </span>
  );
}

// ===== Page Header =====
interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-surface-200/80 pb-5"
    >
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-surface-900 leading-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm sm:text-base text-surface-500 font-normal max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {children && <div className="flex items-center gap-3 shrink-0 flex-wrap">{children}</div>}
    </motion.div>
  );
}

// ===== Card Container =====
interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={cn(
        'rounded-2xl border border-surface-200/80 bg-white shadow-card hover:shadow-card-hover transition-all duration-300',
        paddingClasses[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

// ===== Card Header =====
interface CardHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function CardHeader({ title, description, action }: CardHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
      <div>
        <h3 className="text-base sm:text-lg font-bold text-surface-900 tracking-tight">{title}</h3>
        {description && (
          <p className="text-xs sm:text-sm text-surface-500 mt-0.5">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ===== Empty State =====
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-14 px-4 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-surface-100 to-surface-200/70 text-surface-500 ring-1 ring-surface-300 shadow-sm">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="mt-5 text-base sm:text-lg font-bold text-surface-900 tracking-tight">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-surface-500 leading-relaxed">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}

// ===== Skeleton Loader =====
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('skeleton-luxe rounded-xl', className)} />;
}

// ===== Button =====
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  iconPosition = 'left',
  children,
  className,
  disabled,
  onClick,
  type = 'button',
  ...props
}: ButtonProps) {
  const variants = {
    primary:
      'bg-gradient-to-r from-primary-600 via-primary-600 to-primary-700 text-white hover:from-primary-500 hover:to-primary-600 shadow-md hover:shadow-primary-500/25 border border-primary-500/30',
    secondary:
      'bg-white text-surface-700 border border-surface-300/90 hover:bg-surface-50 hover:border-surface-400 active:bg-surface-100 shadow-sm',
    ghost:
      'text-surface-600 hover:bg-surface-100/80 active:bg-surface-200/70',
    danger:
      'bg-gradient-to-r from-rose-600 to-rose-700 text-white hover:from-rose-500 hover:to-rose-600 shadow-md hover:shadow-rose-500/20 border border-rose-500/30',
    success:
      'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:from-emerald-500 hover:to-emerald-600 shadow-md hover:shadow-emerald-500/20 border border-emerald-500/30',
  };

  const sizes = {
    sm: 'h-9 px-3.5 text-xs font-semibold gap-1.5 rounded-lg',
    md: 'h-11 px-5 text-sm font-semibold gap-2 rounded-xl',
    lg: 'h-12 px-6 text-base font-semibold gap-2.5 rounded-xl',
  };

  return (
    <motion.button
      type={type}
      whileHover={{ scale: disabled || loading ? 1 : 1.015 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-all duration-200 select-none cursor-pointer',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500',
        'disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      onClick={onClick}
      {...(props as any)}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {!loading && Icon && iconPosition === 'left' && <Icon className="h-4 w-4 shrink-0" />}
      <span>{children}</span>
      {!loading && Icon && iconPosition === 'right' && <Icon className="h-4 w-4 shrink-0" />}
    </motion.button>
  );
}

// ===== Input =====
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: LucideIcon;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon: Icon, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-xs sm:text-sm font-semibold text-surface-700 tracking-wide block">{label}</label>
        )}
        <div className="relative">
          {Icon && (
            <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
          )}
          <input
            ref={ref}
            className={cn(
              'flex h-11 w-full rounded-xl border bg-white px-3.5 text-sm transition-all',
              'placeholder:text-surface-400 text-surface-900',
              'focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:border-primary-500 shadow-sm',
              error
                ? 'border-rose-400 focus:ring-rose-500/25 focus:border-rose-500'
                : 'border-surface-300/90 hover:border-surface-400',
              Icon && 'pl-10',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        {hint && !error && <p className="text-xs text-surface-400">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

// ===== Select =====
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: { value: string; label: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, children, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-xs sm:text-sm font-semibold text-surface-700 tracking-wide block">{label}</label>
        )}
        <select
          ref={ref}
          className={cn(
            'flex h-11 w-full rounded-xl border bg-white px-3.5 text-sm transition-all appearance-none cursor-pointer',
            'focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:border-primary-500 shadow-sm text-surface-900',
            error
              ? 'border-rose-400 focus:ring-rose-500/25 focus:border-rose-500'
              : 'border-surface-300/90 hover:border-surface-400',
            className
          )}
          {...props}
        >
          {options ? options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          )) : children}
        </select>
        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';

// ===== Modal =====
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ open, onClose, title, description, children, size = 'md' }: ModalProps) {
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                'w-full rounded-2xl bg-white shadow-modal border border-surface-200 overflow-hidden my-auto',
                sizeClasses[size]
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-surface-200 px-6 py-5 flex items-center justify-between bg-surface-50/60">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-surface-900 tracking-tight">{title}</h2>
                  {description && (
                    <p className="mt-1 text-xs sm:text-sm text-surface-500">{description}</p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="rounded-lg p-2 text-surface-400 hover:bg-surface-200 hover:text-surface-700 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 sm:p-8 max-h-[82vh] overflow-y-auto">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// ===== Toast =====
interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  visible: boolean;
}

export function Toast({ message, type = 'info', visible }: ToastProps) {
  const typeStyles = {
    success: 'bg-emerald-600 text-white shadow-emerald-500/20',
    error: 'bg-rose-600 text-white shadow-rose-500/20',
    warning: 'bg-amber-500 text-white shadow-amber-500/20',
    info: 'bg-surface-900 text-white shadow-black/20',
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className={cn(
            'fixed bottom-6 right-6 z-[100] rounded-xl px-5 py-3 text-sm font-semibold shadow-lg border border-white/20 backdrop-blur-md',
            typeStyles[type]
          )}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ===== Tabs =====
interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <div className="flex gap-2 border-b border-surface-200/90 overflow-x-auto pb-1 scrollbar-none">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'relative px-5 py-3 text-sm font-bold transition-all whitespace-nowrap cursor-pointer rounded-lg',
            activeTab === tab.id
              ? 'text-primary-600 bg-primary-50/60'
              : 'text-surface-500 hover:text-surface-900 hover:bg-surface-100/60'
          )}
        >
          <span className="flex items-center gap-2.5">
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums transition-colors',
                  activeTab === tab.id
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-surface-200 text-surface-600'
                )}
              >
                {tab.count}
              </span>
            )}
          </span>
          {activeTab === tab.id && (
            <motion.div
              layoutId="tab-indicator"
              className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary-600 rounded-full"
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}
        </button>
      ))}
    </div>
  );
}

// ===== Activity Item =====
interface ActivityItemProps {
  icon: LucideIcon;
  title: string;
  description: string;
  time: string;
  iconColor?: string;
}

export function ActivityItem({
  icon: Icon,
  title,
  description,
  time,
  iconColor = 'bg-primary-50 text-primary-600',
}: ActivityItemProps) {
  return (
    <motion.div
      whileHover={{ x: 3 }}
      className="flex gap-3.5 py-3.5 px-3 rounded-xl hover:bg-surface-50/80 transition-colors"
    >
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/5', iconColor)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-surface-900 truncate">{title}</p>
        <p className="text-xs text-surface-500 mt-0.5 truncate">{description}</p>
      </div>
      <span className="text-xs font-medium text-surface-400 whitespace-nowrap pt-0.5">{time}</span>
    </motion.div>
  );
}
