export type UnitType = "weight" | "count";
export type PaymentMethod = "Cash" | "Bank Account" | "Udhar" | "Split";

export interface BankAccount {
  id: string;
  ownerId: string;
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  branchName?: string;
  currentBalance: number;
  initialBalance?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface BankTransaction {
  id: string;
  ownerId: string;
  bankId: string;
  bankName: string;
  type: "deposit" | "withdrawal";
  amount: number;
  date: string;
  customerName?: string;
  customerId?: string;
  saleId?: string;
  invoiceNo?: string;
  description?: string;
  balanceAfter?: number;
  createdAt: string;
}

export interface Shop {
  uid: string;
  email: string | null;
  shopName: string;
  businessType: string;
  currency: string;
  createdAt: string;
  licenseExpiry?: string;
  contact?: string;
  address?: string;
  receiptMessage?: string;
  invoiceCounter?: number;
}

export interface NewShopDetails {
  shopName: string;
  businessType: string;
  createdAt?: string;
  licenseExpiry?: string;
  contact?: string;
  address?: string;
}

export interface Product {
  id: string;
  ownerId: string;
  name: string;
  buyingPrice: number;
  sellingPrice: number;
  stock: number;
  gudamStock?: number;
  shopStock?: number;
  unitType: UnitType;
  weightPerBag?: number;
  category?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SaleItem {
  id: string;
  name: string;
  qty: number;
  price: number;
  buyingPrice: number;
  total: number;
  type?: UnitType;
  returnedQty?: number;
  sellingPrice?: number;
  totalWeight?: number;
  weightPerBag?: number;
  isManualWeight?: boolean;
  productId?: string;
  dispatchFrom?: "gudam" | "shop";
}

export interface Sale {
  id: string;
  saleId?: string;
  ownerId: string;
  items: SaleItem[];
  totalAmount: number;
  refundedAmount?: number;
  date: string;
  customerName: string;
  customerId?: string;
  description: string;
  invoiceNo: string;
  paymentMethod: PaymentMethod;
  cashAmount?: number;
  bankAmount?: number;
  bankId?: string;
  bankName?: string;
  isOffline?: boolean;
  syncedAt?: string;
  gatePassGenerated?: boolean;
  editedAt?: string;
  transport?: string;
  extraCharges?: number;
  advanceAmount?: number;
}

export type PendingSale = Omit<Sale, "id">;

export interface ReturnRecord {
  id: string;
  ownerId: string;
  originalSaleId: string;
  itemName: string;
  productId?: string;
  qty: number;
  unitPrice: number;
  refundAmount: number;
  date: string;
}

export interface Expense {
  id: string;
  ownerId: string;
  title: string;
  amount: number;
  category: string;
  date: string;
}

export interface Customer {
  id: string;
  ownerId: string;
  name: string;
  phone?: string;
  balance: number;
  createdAt: string;
}

export interface CustomerPayment {
  id: string;
  ownerId: string;
  customerId: string;
  customerName: string;
  amount: number;
  method: "Cash" | "Bank Account";
  bankId?: string;
  bankName?: string;
  note?: string;
  date: string;
}

export interface GatePass {
  id: string;
  ownerId: string;
  gatePassNo: string;
  saleId?: string;
  customerName: string;
  customerId?: string;
  items: Array<{
    productId: string;
    productName: string;
    qty: number;
    weight?: number;
    unit?: string;
    isSelf?: boolean;
  }>;
  date: string;
  vehicleNo?: string;
  driverName?: string;
  status: "Issued" | "Dispatched" | "Cancelled";
  notes?: string;
  updatedAt?: string;
}

export interface Supplier {
  id: string;
  ownerId: string;
  name: string;
  phone?: string;
  address?: string;
  balance: number;
  createdAt: string;
}

export interface SupplierPurchase {
  id: string;
  ownerId: string;
  supplierId: string;
  supplierName: string;
  billNo?: string;
  items: Array<{
    productId?: string;
    productName: string;
    qty: number;
    weight?: number;
    totalWeight?: number;
    buyingPrice: number;
    total: number;
    destinationLocation: "gudam" | "shop";
  }>;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  date: string;
  notes?: string;
}

export interface SupplierPayment {
  id: string;
  ownerId: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  method: "Cash" | "Bank Account";
  note?: string;
  date: string;
}

export interface DayClosing {
  id: string;
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
  openingBalance?: number;
  cashInHand: number;
  closedAt: string;
}

export interface Transport {
  id: string;
  ownerId: string;
  name: string;
  phone?: string;
  createdAt: string;
}

export interface StockTransfer {
  id: string;
  ownerId: string;
  productId: string;
  productName: string;
  qty: number;
  fromLocation: "gudam" | "shop";
  toLocation: "gudam" | "shop";
  date: string;
  note?: string;
}