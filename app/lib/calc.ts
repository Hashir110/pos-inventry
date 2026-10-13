import type { Sale, SaleItem } from "../types";

export const itemProfit = (item: SaleItem): number => {
  const sold = Number(item.qty) || 0;
  const remaining = sold - (Number(item.returnedQty) || 0);
  if (remaining <= 0) return 0;

  const buying = Number(item.buyingPrice) || 0;
  const selling = Number(item.sellingPrice || item.price) || 0;
  return (selling - buying) * remaining;
};

export const saleProfit = (sale: Pick<Sale, "items">): number =>
  (sale.items ?? []).reduce((sum, item) => sum + itemProfit(item), 0);

export const saleNetAmount = (sale: Pick<Sale, "totalAmount" | "refundedAmount">): number =>
  (Number(sale.totalAmount) || 0) - (Number(sale.refundedAmount) || 0);
