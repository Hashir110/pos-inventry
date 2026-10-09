import type { Sale, SaleItem } from "../types";

/**
 * Ek item ka profit, return ke baad bachi hui qty par.
 * Line discount flat hota hai, isliye bachi qty ke hisaab se proportional minus hota hai.
 * (Purani sales mein price `sellingPrice` naam se bhi mil sakti hai.)
 */
export const itemProfit = (item: SaleItem): number => {
  const sold = Number(item.qty) || 0;
  const remaining = sold - (Number(item.returnedQty) || 0);
  if (remaining <= 0) return 0;

  const buying = Number(item.buyingPrice) || 0;
  const selling = Number(item.sellingPrice || item.price) || 0;
  const discountShare = sold > 0 ? (Number(item.discount) || 0) * (remaining / sold) : 0;
  return (selling - buying) * remaining - discountShare;
};

export const saleProfit = (sale: Pick<Sale, "items">): number =>
  (sale.items ?? []).reduce((sum, item) => sum + itemProfit(item), 0);

/** Refund minus karne ke baad asal bikri */
export const saleNetAmount = (sale: Pick<Sale, "totalAmount" | "refundedAmount">): number =>
  (Number(sale.totalAmount) || 0) - (Number(sale.refundedAmount) || 0);
