import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ===== Styling Utilities =====
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ===== Financial Utilities (Paise-based) =====
/** Convert rupees to paise (integer) */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Convert paise to rupees */
export function toRupees(paise: number): number {
  return paise / 100;
}

/** Format paise as rupee string */
export function formatCurrency(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/** Format a number in Indian number system (lakhs, crores) */
export function formatIndianNumber(num: number): string {
  return new Intl.NumberFormat('en-IN').format(num);
}

// ===== Quantity Utilities (Scaled Integer, 3 decimals) =====
const QUANTITY_SCALE = 1000;

/** Convert real quantity to scaled integer */
export function toScaledQty(qty: number): number {
  return Math.round(qty * QUANTITY_SCALE);
}

/** Convert scaled integer back to real quantity */
export function fromScaledQty(scaled: number): number {
  return scaled / QUANTITY_SCALE;
}

/** Format quantity with unit */
export function formatQuantity(scaled: number, unit: string, decimals = 2): string {
  const qty = scaled / QUANTITY_SCALE;
  return `${qty.toFixed(decimals)} ${unit}`;
}

// ===== GST Calculations =====
export interface GSTBreakdown {
  taxableAmountPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  gstRate: number;
  isInterstate: boolean;
}

export function calculateGST(
  taxableAmountPaise: number,
  gstRatePercent: number,
  isInterstate: boolean
): GSTBreakdown {
  const gstAmountPaise = Math.round(taxableAmountPaise * gstRatePercent / 100);

  if (isInterstate) {
    return {
      taxableAmountPaise,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: gstAmountPaise,
      totalPaise: taxableAmountPaise + gstAmountPaise,
      gstRate: gstRatePercent,
      isInterstate: true,
    };
  }

  const halfGst = Math.round(gstAmountPaise / 2);
  return {
    taxableAmountPaise,
    cgstPaise: halfGst,
    sgstPaise: gstAmountPaise - halfGst, // handles odd paise
    igstPaise: 0,
    totalPaise: taxableAmountPaise + gstAmountPaise,
    gstRate: gstRatePercent,
    isInterstate: false,
  };
}

// ===== Date Utilities =====
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** Get Indian financial year string e.g. "2026-27" */
export function getFinancialYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  if (month >= 3) {
    // April onwards
    return `${year}-${(year + 1).toString().slice(2)}`;
  }
  return `${year - 1}-${year.toString().slice(2)}`;
}

/** Generate invoice number: FF/FY/SERIAL */
export function generateInvoiceNumber(serial: number, date: Date = new Date()): string {
  const fy = getFinancialYear(date);
  return `FF/${fy}/${serial.toString().padStart(4, '0')}`;
}

// ===== ID Generation =====
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}${random}`;
}

// ===== Percentage & Variance =====
export function calculateVariance(planned: number, actual: number): number {
  if (planned === 0) return 0;
  return ((actual - planned) / planned) * 100;
}

export function formatPercentage(value: number, decimals = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

// ===== Weighted Average =====
export function weightedAverage(entries: { qty: number; rate: number }[]): number {
  const totalValue = entries.reduce((sum, e) => sum + e.qty * e.rate, 0);
  const totalQty = entries.reduce((sum, e) => sum + e.qty, 0);
  if (totalQty === 0) return 0;
  return totalValue / totalQty;
}

