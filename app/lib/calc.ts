import type { Sale, SaleItem } from "../types";

export const itemSoldUnits = (item: SaleItem): number => {
  const sold =
    item.type === "weight" && Number(item.totalWeight) > 0 ? Number(item.totalWeight) : Number(item.qty) || 0;
  return Math.max(0, sold - (Number(item.returnedQty) || 0));
};

export const itemProfit = (item: SaleItem): number => {
  const remaining = itemSoldUnits(item);
  if (remaining <= 0) return 0;

  const buying = Number(item.buyingPrice) || 0;
  const selling = Number(item.sellingPrice || item.price) || 0;
  return (selling - buying) * remaining;
};

export const saleProfit = (sale: Pick<Sale, "items">): number =>
  (sale.items ?? []).reduce((sum, item) => sum + itemProfit(item), 0);

export const saleNetAmount = (sale: Pick<Sale, "totalAmount" | "refundedAmount">): number =>
  (Number(sale.totalAmount) || 0) - (Number(sale.refundedAmount) || 0);
