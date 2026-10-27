export interface CachePayload<T> {
  timestamp: number;
  data: T;
}

export const DEFAULT_CACHE_TTL = 60 * 60 * 1000; // 1 hour (dramatically saves Firebase read counts)

const isClient = typeof window !== "undefined";

export const getCached = <T>(key: string, maxAgeMs = DEFAULT_CACHE_TTL): T | null => {
  if (!isClient) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: CachePayload<T> = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !("timestamp" in parsed) || !("data" in parsed)) {
      return null;
    }

    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    const age = Date.now() - parsed.timestamp;

    // If offline, ALWAYS return cached data even if older than TTL to prevent errors
    if (!isOnline) {
      return parsed.data;
    }

    // If online and within TTL, return cached data to save Firebase reads
    if (age <= maxAgeMs) {
      return parsed.data;
    }

    return null;
  } catch {
    return null;
  }
};

export const getCachedEvenStale = <T>(key: string): T | null => {
  if (!isClient) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: CachePayload<T> = JSON.parse(raw);
    return parsed?.data ?? null;
  } catch {
    return null;
  }
};

export const setCached = <T>(key: string, data: T): void => {
  if (!isClient) return;
  try {
    const payload: CachePayload<T> = {
      timestamp: Date.now(),
      data,
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (e) {
    console.warn(`[LocalCache] Failed to save key "${key}":`, e);
  }
};

export const invalidateCache = (key: string): void => {
  if (!isClient) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore
  }
};

// Cache keys generator
export const cacheKeys = {
  shop: (ownerId: string) => `cache_shop_${ownerId}`,
  products: (ownerId: string) => `cache_products_${ownerId}`,
  customers: (ownerId: string) => `cache_customers_${ownerId}`,
  suppliers: (ownerId: string) => `cache_suppliers_${ownerId}`,
  supplierPurchases: (ownerId: string) => `cache_supplier_purchases_${ownerId}`,
  supplierPayments: (ownerId: string) => `cache_supplier_payments_${ownerId}`,
  sales: (ownerId: string) => `cache_sales_${ownerId}`,
  gatePasses: (ownerId: string) => `cache_gate_passes_${ownerId}`,
  dayClosings: (ownerId: string) => `cache_day_closings_${ownerId}`,
  expenses: (ownerId: string) => `cache_expenses_${ownerId}`,
  transports: (ownerId: string) => `cache_transports_${ownerId}`,
  banks: (ownerId: string) => `cache_banks_${ownerId}`,
  bankTransactions: (ownerId: string, bankId?: string) =>
    `cache_bank_txs_${ownerId}_${bankId || "all"}`,
};

// ========================
// OFFLINE QUEUES
// ========================

import type { PendingSale, GatePass, DayClosing } from "../../types";

const PENDING_SALES_KEY = "pendingSales";
const PENDING_GATE_PASSES_KEY = "pendingGatePasses";
const PENDING_DAY_CLOSINGS_KEY = "pendingDayClosings";

// 1. Sales Queue
export const getPendingSales = (): PendingSale[] => {
  if (!isClient) return [];
  try {
    return JSON.parse(localStorage.getItem(PENDING_SALES_KEY) || "[]");
  } catch {
    return [];
  }
};

export const savePendingSales = (queue: PendingSale[]) => {
  if (!isClient) return;
  localStorage.setItem(PENDING_SALES_KEY, JSON.stringify(queue));
};

// 2. Gate Passes Queue
export interface PendingGatePassItem {
  productId: string;
  productName: string;
  qty: number;
  weight?: number;
  unit?: string;
  isSelf?: boolean;
}

export interface PendingGatePass {
  tempId: string;
  ownerId: string;
  gatePassNo: string;
  customerName: string;
  customerId?: string;
  saleId?: string;
  vehicleNo?: string;
  driverName?: string;
  notes?: string;
  date: string;
  items: PendingGatePassItem[];
  status: "Issued";
  isOffline: true;
}

export const getPendingGatePasses = (): PendingGatePass[] => {
  if (!isClient) return [];
  try {
    return JSON.parse(localStorage.getItem(PENDING_GATE_PASSES_KEY) || "[]");
  } catch {
    return [];
  }
};

export const savePendingGatePasses = (queue: PendingGatePass[]) => {
  if (!isClient) return;
  localStorage.setItem(PENDING_GATE_PASSES_KEY, JSON.stringify(queue));
};

// 3. Day Closings Queue
export interface PendingDayClosing {
  tempId: string;
  ownerId: string;
  date: string;
  invoiceCount: number;
  salesTotal: number;
  cash: number;
  bank: number;
  udhar: number;
  amad: number;
  jamad: number;
  expenses: number;
  cashInHand: number;
  closedAt: string;
  isOffline: true;
}

export const getPendingDayClosings = (): PendingDayClosing[] => {
  if (!isClient) return [];
  try {
    return JSON.parse(localStorage.getItem(PENDING_DAY_CLOSINGS_KEY) || "[]");
  } catch {
    return [];
  }
};

export const savePendingDayClosings = (queue: PendingDayClosing[]) => {
  if (!isClient) return;
  localStorage.setItem(PENDING_DAY_CLOSINGS_KEY, JSON.stringify(queue));
};

// Overall Pending Count
export const getTotalPendingCount = (): number => {
  return getPendingSales().length + getPendingGatePasses().length + getPendingDayClosings().length;
};
