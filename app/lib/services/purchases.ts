// app/lib/services/purchases.ts
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  writeBatch,
  increment,
} from "firebase/firestore";
import { db } from "../firebase";
import { listSuppliers } from "./suppliers";
import type { Supplier } from "../../types";

export interface PurchaseOrderItem {
  productId?: string;
  name: string;
  qty: number;
  unitRate: number;
  total: number;
}

export type POStatus = "Draft" | "Pending Delivery" | "Received";

export interface PurchaseOrder {
  id: string;
  ownerId: string;
  poNumber: string;
  supplierId: string;
  vendorName: string;
  orderDate: string;
  deliveryDate: string;
  items: PurchaseOrderItem[];
  totalAmount: number;
  paidAmount: number;
  status: POStatus;
  destination: "shop" | "warehouse";
  notes?: string;
  receivedAt?: string;
}

export interface CreatePOInput {
  supplierId: string;
  vendorName: string;
  deliveryDate: string;
  destination: "shop" | "warehouse";
  items: PurchaseOrderItem[];
  notes?: string;
}

export interface PurchasesMetrics {
  totalPurchased: number;
  activePOs: number;
  pendingDeliveries: number;
  payablesDue: number;
}

export const listPurchaseOrders = async (ownerId: string): Promise<PurchaseOrder[]> => {
  try {
    const q = query(
      collection(db, "purchase_orders"),
      where("ownerId", "==", ownerId),
      orderBy("orderDate", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PurchaseOrder, "id">) }));
  } catch (error) {
    console.error("Failed to list purchase orders:", error);
    return [];
  }
};

export const createPurchaseOrder = async (
  ownerId: string,
  input: CreatePOInput
): Promise<string> => {
  const total = input.items.reduce((acc, curr) => acc + (curr.total || curr.qty * curr.unitRate), 0);
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const poNumber = `PO-${now.getFullYear()}-${String(Date.now()).slice(-4)}`;

  const orderData: Omit<PurchaseOrder, "id"> = {
    ownerId,
    poNumber,
    supplierId: input.supplierId,
    vendorName: input.vendorName,
    orderDate: dateStr,
    deliveryDate: input.deliveryDate || dateStr,
    items: input.items,
    totalAmount: total,
    paidAmount: 0,
    status: "Pending Delivery",
    destination: input.destination,
    notes: input.notes || "",
  };

  const docRef = await addDoc(collection(db, "purchase_orders"), orderData);
  return docRef.id;
};

/**
 * Marks PO as Received (Goods Receipt Note - GRN)
 * - Updates PO status to "Received"
 * - Increments product stock in Firestore
 * - Registers the bill in supplier_purchases and adds to supplier.balance
 */
export const markPOReceived = async (
  ownerId: string,
  po: PurchaseOrder
): Promise<void> => {
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  // 1. Update PO Status
  const poRef = doc(db, "purchase_orders", po.id);
  batch.update(poRef, {
    status: "Received",
    receivedAt: now,
  });

  // 2. Increment Stock for matching products
  for (const item of po.items) {
    if (item.productId) {
      const prodRef = doc(db, "products", item.productId);
      const stockField = po.destination === "warehouse" ? "gudamStock" : "stock";
      batch.update(prodRef, {
        [stockField]: increment(item.qty),
        stock: increment(item.qty),
        updatedAt: now,
      });
    }
  }

  // 3. Update Supplier Balance if supplierId exists
  if (po.supplierId) {
    const suppRef = doc(db, "suppliers", po.supplierId);
    batch.update(suppRef, {
      balance: increment(po.totalAmount),
    });

    // Record in supplier_purchases collection
    const purchaseDocRef = doc(collection(db, "supplier_purchases"));
    batch.set(purchaseDocRef, {
      ownerId,
      supplierId: po.supplierId,
      supplierName: po.vendorName,
      date: now,
      itemName: po.items.map((i) => `${i.name} (${i.qty})`).join(", "),
      total: po.totalAmount,
      destination: po.destination === "warehouse" ? "Warehouse" : "Shop",
      poNumber: po.poNumber,
    });
  }

  await batch.commit();
};

export const calculatePurchasesMetrics = (
  orders: PurchaseOrder[],
  suppliers: Supplier[]
): PurchasesMetrics => {
  let totalPurchased = 0;
  let activePOs = 0;
  let pendingDeliveries = 0;

  orders.forEach((o) => {
    totalPurchased += o.totalAmount;
    if (o.status === "Pending Delivery") {
      pendingDeliveries++;
      activePOs++;
    } else if (o.status === "Draft") {
      activePOs++;
    }
  });

  const payablesDue = suppliers.reduce((sum, s) => sum + (Number(s.balance) || 0), 0);

  return {
    totalPurchased,
    activePOs,
    pendingDeliveries,
    payablesDue,
  };
};
