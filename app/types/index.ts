/** DB mein pieces wale items "count" save hote hain */
export type UnitType = "weight" | "count";
export type PaymentMethod = "Cash" | "Bank Account" | "Udhar";

/** users/{uid} */
export interface Shop {
  uid: string;
  email: string | null;
  shopName: string;
  businessType: string;
  currency: string;
  createdAt: string; // ISO
  licenseExpiry: string; // ISO — sirf admin badalta hai
  contact?: string;
  address?: string;
  receiptMessage?: string;
  invoiceCounter?: number;
}

/** Setup form se aane wala data (createShopProfile ke liye) */
export interface NewShopDetails {
  shopName: string;
  businessType: string;
  createdAt?: string;
  licenseExpiry: string;
}

/** products/{id} */
export interface Product {
  id: string;
  ownerId: string;
  name: string;
  buyingPrice: number;
  sellingPrice: number;
  stock: number; // Purane records compatibility
  gudamStock?: number; // Warehouse stock
  shopStock?: number; // Dukan stock
  unitType: UnitType;
  /** Optional: POS par category tabs ke liye (e.g. "Atta", "Drinks") */
  category?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** sales/{id}.items[] — cart ka snapshot */
export interface SaleItem {
  id: string; // product id
  name: string;
  qty: number;
  price: number; // selling price at time of sale
  buyingPrice: number;
  discount: number; // flat Rs. poori line par
  total: number; // qty * price - discount
  type?: UnitType;
  returnedQty?: number;
  /** Purani sales mein price ya product id in naamon se bhi mil sakti hai */
  sellingPrice?: number;
  productId?: string;
  dispatchFrom?: "gudam" | "shop";
}

/** sales/{id} */
export interface Sale {
  id: string;
  saleId?: string;
  ownerId: string;
  items: SaleItem[];
  totalAmount: number;
  refundedAmount?: number;
  date: string; // ISO
  customerName: string;
  /** Udhar sale mein customer ka id (customers/{id}) */
  customerId?: string;
  description: string;
  invoiceNo: string;
  paymentMethod: PaymentMethod;
  isOffline?: boolean;
  syncedAt?: string;
  gatePassGenerated?: boolean;
}

/** Offline queue mein pada sale (abhi Firestore mein nahi gaya) */
export type PendingSale = Omit<Sale, "id">;

/** returns/{id} */
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

/** expenses/{id} */
export interface Expense {
  id: string;
  ownerId: string;
  title: string;
  amount: number;
  category: string;
  date: string;
}

/** customers/{id} — Udhar wale customers */
export interface Customer {
  id: string;
  ownerId: string;
  name: string;
  phone?: string;
  /** Customer ne abhi kitne paise dene hain (Udhar sales - wasool hui raqam - returns) */
  balance: number;
  createdAt: string;
}

/** payments/{id} — customer se wasool hui raqam */
export interface CustomerPayment {
  id: string;
  ownerId: string;
  customerId: string;
  customerName: string;
  amount: number;
  method: "Cash" | "Bank Account";
  note?: string;
  date: string;
}

/** gate_passes/{id} — Gudam dispatch parchi record */
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
    unit?: string;
  }>;
  date: string;
  vehicleNo?: string;
  driverName?: string;
  status: "Issued" | "Dispatched" | "Cancelled";
  notes?: string;
}

/** suppliers/{id} — Jin parties se maal lety hain */
export interface Supplier {
  id: string;
  ownerId: string;
  name: string;
  phone?: string;
  address?: string;
  /** Humne is supplier ke kitne paise dene hain */
  balance: number;
  createdAt: string;
}

/** supplier_purchases/{id} — Supplier se maal khareedne ki entry */
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
    buyingPrice: number;
    total: number;
    destinationLocation: "gudam" | "shop";
  }>;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number; // totalAmount - paidAmount
  date: string;
  notes?: string;
}

/** supplier_payments/{id} — Supplier ko paise dene ki entry (Payout) */
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

/** stock_transfers/{id} — Gudam <-> Dukan stock transfer log */
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