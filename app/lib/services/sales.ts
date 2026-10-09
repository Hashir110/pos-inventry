import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Customer, PaymentMethod, PendingSale, Product, Sale, SaleItem } from "../../types";

/** POS se aane wala sale ka extra data */
export interface SaleMeta {
  customerName: string;
  description: string;
  paymentMethod: PaymentMethod;
  /** Udhar sale mein zaroori: kis customer ke khate mein jayega */
  customerId?: string;
}

const PENDING_KEY = "pendingSales";

// ---------- Offline queue (localStorage) ----------

export const getPendingSales = (): PendingSale[] => {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
  } catch {
    return [];
  }
};

const savePendingSales = (queue: PendingSale[]) => {
  localStorage.setItem(PENDING_KEY, JSON.stringify(queue));
};

// ---------- Create ----------

const buildMeta = (meta: SaleMeta) => ({
  customerName: meta.customerName || "Walk-in",
  description: meta.description || "",
  paymentMethod: meta.paymentMethod,
  // Firestore undefined field reject karta hai, isliye sirf Udhar mein add karo
  ...(meta.paymentMethod === "Udhar" && meta.customerId ? { customerId: meta.customerId } : {}),
});

const isUdharWithCustomer = (paymentMethod: PaymentMethod, customerId?: string): customerId is string =>
  paymentMethod === "Udhar" && !!customerId;

const roundMoney = (n: number) => Math.round(n * 100) / 100;

/**
 * Online sale: stock check + stock minus + sequential invoice + sale doc, sab ek transaction mein.
 * Return: invoiceNo. Stock kam ho to Error throw hota hai.
 */
export const createOnlineSale = async (
  ownerId: string,
  cart: SaleItem[],
  totalAmount: number,
  meta: SaleMeta
): Promise<string> => {
  let invoiceNo = "";

  await runTransaction(db, async (transaction) => {
    // Saari reads pehle (Firestore rule: reads before writes)
    const reads = [];
    for (const item of cart) {
      const snapshot = await transaction.get(doc(db, "products", item.id));
      reads.push({ snapshot, item });
    }

    // Udhar sale: customer ka balance bhi isi transaction mein badhega
    let customerRef = null;
    let customerSnap = null;
    if (isUdharWithCustomer(meta.paymentMethod, meta.customerId)) {
      customerRef = doc(db, "customers", meta.customerId);
      customerSnap = await transaction.get(customerRef);
      if (!customerSnap.exists()) throw new Error("Customer nahi mila");
    }

    const shopRef = doc(db, "users", ownerId);
    const shopSnap = await transaction.get(shopRef);
    const nextInvoice = ((shopSnap.data()?.invoiceCounter as number | undefined) || 0) + 1;
    invoiceNo = String(nextInvoice).padStart(6, "0");

    for (const { snapshot, item } of reads) {
      if (!snapshot.exists()) throw new Error(`${item.name} not found!`);
      const stock = (snapshot.data() as Product).stock;
      if (stock < item.qty) throw new Error(`Stock Low! ${item.name} only ${stock} left.`);
    }

    // Writes
    transaction.update(shopRef, { invoiceCounter: nextInvoice });
    if (customerRef && customerSnap) {
      const balance = (customerSnap.data() as Customer).balance || 0;
      transaction.update(customerRef, { balance: roundMoney(balance + totalAmount) });
    }
    for (const { snapshot, item } of reads) {
      transaction.update(snapshot.ref, { stock: (snapshot.data() as Product).stock - item.qty });
    }

    const saleRef = doc(collection(db, "sales"));
    transaction.set(saleRef, {
      saleId: saleRef.id,
      ownerId,
      items: cart,
      totalAmount,
      date: new Date().toISOString(),
      invoiceNo,
      ...buildMeta(meta),
    });
  });

  return invoiceNo;
};

/**
 * Offline sale: local stock se check karke queue mein daal do. Return: temporary invoiceNo.
 * Firestore par sync baad mein syncPendingSales() karta hai.
 */
export const queueOfflineSale = (
  ownerId: string,
  cart: SaleItem[],
  totalAmount: number,
  meta: SaleMeta,
  localProducts: Product[]
): string => {
  for (const item of cart) {
    const p = localProducts.find((pr) => pr.id === item.id);
    if (!p || p.stock < item.qty) {
      throw new Error(`Stock Low! ${item.name} only ${p ? p.stock : 0} left.`);
    }
  }

  const invoiceNo = "OFF-" + Date.now().toString(36).toUpperCase().slice(-6);
  const order: PendingSale = {
    ownerId,
    items: cart,
    totalAmount,
    date: new Date().toISOString(),
    isOffline: true,
    invoiceNo,
    ...buildMeta(meta),
  };
  savePendingSales([...getPendingSales(), order]);
  return invoiceNo;
};

// ---------- Sync ----------

/**
 * Queue ke orders ek ek karke upload karta hai. Har order ke baad queue se hat jata hai,
 * aur sale doc ID `ownerId_invoiceNo` hai, to dobara sync par duplicate nahi banta.
 * Return: kitne orders upload hue. Beech mein fail ho to error throw (bacha hua queue mein rehta hai).
 */
export const syncPendingSales = async (onProgress?: (remaining: number) => void): Promise<number> => {
  let queue = getPendingSales();
  let uploaded = 0;

  for (const order of [...queue]) {
    const saleRef = doc(db, "sales", `${order.ownerId}_${order.invoiceNo}`);

    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(saleRef);
      if (existing.exists()) return; // pehle hi upload ho chuka

      const reads = [];
      for (const item of order.items) {
        const snapshot = await transaction.get(doc(db, "products", item.id));
        reads.push({ snapshot, item });
      }

      let customerRef = null;
      let customerSnap = null;
      if (isUdharWithCustomer(order.paymentMethod, order.customerId)) {
        customerRef = doc(db, "customers", order.customerId);
        customerSnap = await transaction.get(customerRef);
      }

      // Sale pehle hi ho chuki hai, isliye stock minus karna hai chahe 0 se neeche jaye.
      // Product delete ho chuka ho to sirf us item ka stock update skip hoga.
      for (const { snapshot, item } of reads) {
        if (!snapshot.exists()) continue;
        transaction.update(snapshot.ref, { stock: (snapshot.data() as Product).stock - item.qty });
      }

      if (customerRef && customerSnap?.exists()) {
        const balance = (customerSnap.data() as Customer).balance || 0;
        transaction.update(customerRef, { balance: roundMoney(balance + order.totalAmount) });
      }

      const { isOffline: _isOffline, ...cleanOrder } = order;
      void _isOffline;
      transaction.set(saleRef, { ...cleanOrder, syncedAt: new Date().toISOString() });
    });

    queue = queue.filter((o) => o.invoiceNo !== order.invoiceNo);
    savePendingSales(queue);
    uploaded++;
    onProgress?.(queue.length);
  }

  return uploaded;
};

// ---------- Read ----------

const toSales = (docs: { id: string; data: () => unknown }[]): Sale[] =>
  docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Sale, "id">) }));

/** Naye pehle, max `max` sales */
export const listRecentSales = async (ownerId: string, max = 50): Promise<Sale[]> => {
  const snap = await getDocs(
    query(collection(db, "sales"), where("ownerId", "==", ownerId), orderBy("date", "desc"), limit(max))
  );
  return toSales(snap.docs);
};

/** `fromIso` se (aur agar diya ho to `toIso` tak) ki sales, naye pehle */
export const listSalesInRange = async (
  ownerId: string,
  fromIso: string,
  toIso?: string
): Promise<Sale[]> => {
  const snap = await getDocs(
    query(
      collection(db, "sales"),
      where("ownerId", "==", ownerId),
      where("date", ">=", fromIso),
      ...(toIso ? [where("date", "<=", toIso)] : []),
      orderBy("date", "desc")
    )
  );
  return toSales(snap.docs);
};

export const findSaleByInvoice = async (ownerId: string, invoiceNo: string): Promise<Sale | null> => {
  const snap = await getDocs(
    query(collection(db, "sales"), where("ownerId", "==", ownerId), where("invoiceNo", "==", invoiceNo.trim()))
  );
  return snap.empty ? null : toSales(snap.docs)[0];
};

export const getSaleById = async (id: string): Promise<Sale | null> => {
  const snap = await getDoc(doc(db, "sales", id));
  return snap.exists() ? { id: snap.id, ...(snap.data() as Omit<Sale, "id">) } : null;
};

// ---------- Delete ----------

/** Shop ki saari sales ya saare products delete (Settings > Danger Zone) */
export const clearCollection = async (ownerId: string, name: "products" | "sales"): Promise<void> => {
  const snap = await getDocs(query(collection(db, name), where("ownerId", "==", ownerId)));
  // Batch ki limit 500 hai, isliye tukron mein
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
};
