import type { Sale, SaleItem } from "../types";

export const itemSoldUnits = (item: SaleItem): number => {
  const isWeight = item.type === "weight";
  const returnedQty = Number(item.returnedQty) || 0;

  if (isWeight) {
    const totalWeight = Number(item.totalWeight) > 0 ? Number(item.totalWeight) : 0;
    const bags = Number(item.qty) || 0;
    const bagWeight =
      bags > 0 && totalWeight > 0
        ? totalWeight / bags
        : Number(item.weightPerBag) || 25;
    const resolvedTotalWeight = totalWeight > 0 ? totalWeight : bags * bagWeight;
    const returnedWeight = returnedQty * bagWeight;
    return Math.max(0, resolvedTotalWeight - returnedWeight);
  }

  const sold = Number(item.qty) || 0;
  return Math.max(0, sold - returnedQty);
};

export const itemProfit = (item: SaleItem, fallbackBuyingPrice?: number): number => {
  const remaining = itemSoldUnits(item);
  if (remaining <= 0) return 0;

  const itemBuying = Number(item.buyingPrice) || 0;
  const buying = itemBuying > 0 ? itemBuying : (Number(fallbackBuyingPrice) || 0);
  const selling = Number(item.price ?? item.sellingPrice ?? 0);
  return (selling - buying) * remaining;
};

export type ProductPriceLookup =
  | Map<string, number>
  | Record<string, number>
  | ((idOrName: string) => number | undefined);

export const saleProfit = (
  sale?: (Pick<Sale, "items"> & { isWithdrawal?: boolean; description?: string }) | null,
  productPrices?: ProductPriceLookup
): number => {
  if (!sale || isWithdrawalSale(sale)) return 0;

  const resolveFallback = (prodId?: string, name?: string): number | undefined => {
    if (!productPrices) return undefined;
    if (typeof productPrices === "function") {
      return (prodId ? productPrices(prodId) : undefined) ?? (name ? productPrices(name) : undefined);
    }
    if (productPrices instanceof Map) {
      return (prodId ? productPrices.get(prodId) : undefined) ?? (name ? productPrices.get(name) : undefined);
    }
    return (prodId ? productPrices[prodId] : undefined) ?? (name ? productPrices[name] : undefined);
  };

  return (sale.items ?? []).reduce((sum, item) => {
    const prodId = item.productId || item.id;
    const fallback = resolveFallback(prodId, item.name?.trim().toLowerCase());
    return sum + itemProfit(item, fallback);
  }, 0);
};

export const saleNetAmount = (sale: Pick<Sale, "totalAmount" | "refundedAmount">): number =>
  Math.max(0, (Number(sale.totalAmount) || 0) - (Number(sale.refundedAmount) || 0));

export const isWithdrawalSale = (
  sale?: (Pick<Sale, "items"> & { isWithdrawal?: boolean; description?: string }) | null
): boolean => {
  if (!sale) return false;
  if (sale.isWithdrawal) return true;
  if (sale.description === "Cash Withdrawal from Ledger") return true;
  return (sale.items ?? []).some((item) => item.id === "withdrawal");
};

export const todayKey = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const dayKey = (isoString?: string): string => {
  if (!isoString) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoString)) return isoString;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const toLocalIsoString = (dateStr?: string, preserveTime = true): string => {
  const now = new Date();
  if (!dateStr) return now.toISOString();

  // If already a full ISO string ending in Z
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/i.test(dateStr)) {
    return dateStr;
  }

  // If YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const target = preserveTime
      ? new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds())
      : new Date(y, m - 1, d, 12, 0, 0, 0);
    return target.toISOString();
  }

  // If YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss without Z (local datetime string)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(dateStr)) {
    const target = new Date(dateStr);
    if (!isNaN(target.getTime())) return target.toISOString();
  }

  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? now.toISOString() : parsed.toISOString();
};

export const dateWithTimeToIso = (dateStr: string, originalIsoOrDate?: string): string => {
  if (!dateStr) return new Date().toISOString();
  const [y, m, d] = dateStr.split("-").map(Number);
  let hours = new Date().getHours();
  let minutes = new Date().getMinutes();
  let seconds = new Date().getSeconds();
  let ms = new Date().getMilliseconds();

  if (originalIsoOrDate) {
    const orig = new Date(originalIsoOrDate);
    if (!isNaN(orig.getTime())) {
      hours = orig.getHours();
      minutes = orig.getMinutes();
      seconds = orig.getSeconds();
      ms = orig.getMilliseconds();
    }
  }

  const dt = new Date(y, m - 1, d, hours, minutes, seconds, ms);
  return dt.toISOString();
};

export const dayRange = (day: string) => {
  const start = new Date(`${day}T00:00:00`);
  const end = new Date(`${day}T23:59:59.999`);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
};
