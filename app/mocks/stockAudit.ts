// app/mocks/stockAudit.ts
// TODO: connect logic with backend physical stock audit service in next phase

export interface AuditItem {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  systemStock: number;
  physicalCount: number;
  unit: string;
  status: "matched" | "discrepancy" | "uncounted";
  lastCounted: string;
}

export const mockStockAuditMetrics = {
  totalValue: "Rs. 1,842,950",
  trackedSkus: 428,
  lowStockCount: 4,
  outOfStockCount: 1,
  expiringBatches: 3,
};

export const mockAuditItems: AuditItem[] = [
  {
    id: "1",
    sku: "TAP-400-PK",
    barcode: "896400010214",
    name: "Tapal Danedar Tea 400g",
    category: "Grocery",
    systemStock: 42,
    physicalCount: 42,
    unit: "pcs",
    status: "matched",
    lastCounted: "Today, 10:15 AM",
  },
  {
    id: "2",
    sku: "DAL-100-PO",
    barcode: "896400030118",
    name: "Dalda Cooking Oil 1L Pouch",
    category: "Grocery",
    systemStock: 60,
    physicalCount: 58,
    unit: "pouches",
    status: "discrepancy",
    lastCounted: "Today, 09:40 AM",
  },
  {
    id: "3",
    sku: "OLP-1L-TPK",
    barcode: "896100010923",
    name: "Olper's Milk 1L Pack",
    category: "Dairy",
    systemStock: 85,
    physicalCount: 85,
    unit: "packs",
    status: "matched",
    lastCounted: "Yesterday",
  },
  {
    id: "4",
    sku: "SHN-BRY-050",
    barcode: "896400045091",
    name: "Shan Special Biryani Masala 50g",
    category: "Spices",
    systemStock: 5,
    physicalCount: 4,
    unit: "packs",
    status: "discrepancy",
    lastCounted: "Today, 11:20 AM",
  },
  {
    id: "5",
    sku: "NAT-KET-800",
    barcode: "896400077124",
    name: "National Tomato Ketchup 800g",
    category: "Condiments",
    systemStock: 0,
    physicalCount: 0,
    unit: "pouches",
    status: "matched",
    lastCounted: "2 days ago",
  },
];
