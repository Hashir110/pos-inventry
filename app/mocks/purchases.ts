// app/mocks/purchases.ts
// TODO: connect logic with backend purchase order management service in next phase

export interface MockPurchaseOrder {
  id: string;
  poNumber: string;
  vendorName: string;
  orderDate: string;
  deliveryDate: string;
  totalAmount: number;
  paidAmount: number;
  status: "Received" | "Pending Delivery" | "Partially Received" | "Draft";
  itemsCount: number;
}

export const mockPurchasesMetrics = {
  totalPurchased: "Rs. 2,890,200",
  activePOs: 12,
  pendingDeliveries: 3,
  payablesDue: "Rs. 445,000",
};

export const mockPurchaseOrders: MockPurchaseOrder[] = [
  {
    id: "po-1",
    poNumber: "PO-2024-089",
    vendorName: "Engro Foods Ltd",
    orderDate: "2024-10-22",
    deliveryDate: "2024-10-24",
    totalAmount: 185000,
    paidAmount: 100000,
    status: "Received",
    itemsCount: 4,
  },
  {
    id: "po-2",
    poNumber: "PO-2024-090",
    vendorName: "Tapal Tea Direct",
    orderDate: "2024-10-23",
    deliveryDate: "2024-10-25",
    totalAmount: 95000,
    paidAmount: 0,
    status: "Pending Delivery",
    itemsCount: 2,
  },
  {
    id: "po-3",
    poNumber: "PO-2024-091",
    vendorName: "Shan Foods Distribution",
    orderDate: "2024-10-24",
    deliveryDate: "2024-10-26",
    totalAmount: 48000,
    paidAmount: 48000,
    status: "Partially Received",
    itemsCount: 6,
  },
  {
    id: "po-4",
    poNumber: "PO-2024-092",
    vendorName: "National Foods Limited",
    orderDate: "2024-10-24",
    deliveryDate: "2024-10-27",
    totalAmount: 120000,
    paidAmount: 60000,
    status: "Draft",
    itemsCount: 3,
  },
];
