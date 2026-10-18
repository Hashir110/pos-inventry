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

export interface SaleMeta {
  customerName: string;
  description: string;
  paymentMethod: PaymentMethod;
  customerId?: string;
  transport?: string;
  extraCharges?: number;
}

const PENDING_KEY = "pendingSales";

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

export const stripUndefined = <T>(obj: T): T => {
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => stripUndefined(item)) as unknown as T;
  }
  if (obj !== null && typeof obj === "object" && !(obj instanceof Date)) {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = stripUndefined(value);
      }
    }
    return cleaned as unknown as T;
  }
  return obj;
};

export const cleanSaleItem = (item: SaleItem): SaleItem => {
  const isWeight = item.type === "weight";
  const cleaned: Record<string, unknown> = {
    id: item.id || "",
    name: item.name || "",
    qty: Number(item.qty) || 0,
    price: Number(item.price ?? item.sellingPrice ?? 0),
    buyingPrice: Number(item.buyingPrice ?? 0),
    total: Number(item.total) || 0,
    type: item.type || "count",
  };

  if (item.weightPerBag !== undefined && item.weightPerBag !== null) {
    cleaned.weightPerBag = Number(item.weightPerBag);
  }
  if (isWeight && item.totalWeight !== undefined && item.totalWeight !== null) {
    cleaned.totalWeight = Number(item.totalWeight);
  }
  if (item.isManualWeight !== undefined) {
    cleaned.isManualWeight = Boolean(item.isManualWeight);
  }
  if (item.returnedQty !== undefined && item.returnedQty !== null) {
    cleaned.returnedQty = Number(item.returnedQty);
  }
  if (item.sellingPrice !== undefined && item.sellingPrice !== null) {
    cleaned.sellingPrice = Number(item.sellingPrice);
  }
  if (item.productId) {
    cleaned.productId = item.productId;
  }
  if (item.dispatchFrom) {
    cleaned.dispatchFrom = item.dispatchFrom;
  }

  return cleaned as unknown as SaleItem;
};

const buildMeta = (meta: SaleMeta) => {
  const result: Record<string, unknown> = {
    customerName: meta.customerName?.trim() || "Counter Sale",
    description: meta.description?.trim() || "",
    paymentMethod: meta.paymentMethod || "Cash",
  };
  if (meta.transport?.trim()) {
    result.transport = meta.transport.trim();
  }
  if (typeof meta.extraCharges === "number" && meta.extraCharges > 0) {
    result.extraCharges = meta.extraCharges;
  }
  if (meta.paymentMethod === "Udhar" && meta.customerId) {
    result.customerId = meta.customerId;
  }
  return result;
};

const isUdharWithCustomer = (paymentMethod: PaymentMethod, customerId?: string): customerId is string =>
  paymentMethod === "Udhar" && !!customerId;

const roundMoney = (n: number) => Math.round(n * 100) / 100;

export const createOnlineSale = async (
  ownerId: string,
  cart: SaleItem[],
  totalAmount: number,
  meta: SaleMeta
): Promise<string> => {
  let invoiceNo = "";

  await runTransaction(db, async (transaction) => {
    const reads = [];
    for (const item of cart) {
      const snapshot = await transaction.get(doc(db, "products", item.id));
      reads.push({ snapshot, item });
    }

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
      const deductQty = item.qty;
      if (stock < deductQty) throw new Error(`Stock Low! ${item.name} only ${stock} left.`);
    }

    transaction.update(shopRef, { invoiceCounter: nextInvoice });
    if (customerRef && customerSnap) {
      const balance = (customerSnap.data() as Customer).balance || 0;
      transaction.update(customerRef, { balance: roundMoney(balance + totalAmount) });
    }
    for (const { snapshot, item } of reads) {
      const prod = snapshot.data() as Product;
      const deductQty = item.qty;
      const currentShop = prod.shopStock ?? 0;
      const currentGudam = prod.gudamStock ?? 0;
      let newShop = currentShop;
      let newGudam = currentGudam;

      if (currentShop >= deductQty) {
        newShop = currentShop - deductQty;
      } else {
        const remaining = deductQty - currentShop;
        newShop = 0;
        newGudam = Math.max(0, currentGudam - remaining);
      }
      const newTotal = newShop + newGudam;

      transaction.update(snapshot.ref, {
        stock: newTotal,
        gudamStock: newGudam,
        shopStock: newShop,
      });
    }

    const saleRef = doc(collection(db, "sales"));
    const saleData = stripUndefined({
      saleId: saleRef.id,
      ownerId: ownerId || "",
      items: cart.map(cleanSaleItem),
      totalAmount: roundMoney(totalAmount || 0),
      date: new Date().toISOString(),
      invoiceNo,
      ...buildMeta(meta),
    });
    transaction.set(saleRef, saleData);
  });

  return invoiceNo;
};

export const queueOfflineSale = (
  ownerId: string,
  cart: SaleItem[],
  totalAmount: number,
  meta: SaleMeta,
  localProducts: Product[]
): string => {
  for (const item of cart) {
    const p = localProducts.find((pr) => pr.id === item.id);
    const deductQty = item.qty;
    if (!p || p.stock < deductQty) {
      throw new Error(`Stock Low! ${item.name} only ${p ? p.stock : 0} left.`);
    }
  }

  const invoiceNo = "OFF-" + Date.now().toString(36).toUpperCase().slice(-6);
  const order: PendingSale = stripUndefined({
    ownerId: ownerId || "",
    items: cart.map(cleanSaleItem),
    totalAmount: roundMoney(totalAmount || 0),
    date: new Date().toISOString(),
    isOffline: true,
    invoiceNo,
    ...buildMeta(meta),
  }) as PendingSale;
  savePendingSales([...getPendingSales(), order]);
  return invoiceNo;
};

export const syncPendingSales = async (onProgress?: (remaining: number) => void): Promise<number> => {
  let queue = getPendingSales();
  let uploaded = 0;

  for (const order of [...queue]) {
    const saleRef = doc(db, "sales", `${order.ownerId}_${order.invoiceNo}`);

    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(saleRef);
      if (existing.exists()) return;

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

      for (const { snapshot, item } of reads) {
        if (!snapshot.exists()) continue;
        const prod = snapshot.data() as Product;
        const deductQty = item.qty;
        const currentShop = prod.shopStock ?? 0;
        const currentGudam = prod.gudamStock ?? 0;
        let newShop = currentShop;
        let newGudam = currentGudam;

        if (currentShop >= deductQty) {
          newShop = currentShop - deductQty;
        } else {
          const remaining = deductQty - currentShop;
          newShop = 0;
          newGudam = Math.max(0, currentGudam - remaining);
        }
        const newTotal = newShop + newGudam;

        transaction.update(snapshot.ref, {
          stock: newTotal,
          gudamStock: newGudam,
          shopStock: newShop,
        });
      }

      if (customerRef && customerSnap?.exists()) {
        const balance = (customerSnap.data() as Customer).balance || 0;
        transaction.update(customerRef, { balance: roundMoney(balance + order.totalAmount) });
      }

      const { isOffline: _isOffline, ...cleanOrder } = order;
      void _isOffline;
      const saleData = stripUndefined({
        ...cleanOrder,
        items: (cleanOrder.items || []).map(cleanSaleItem),
        syncedAt: new Date().toISOString(),
      });
      transaction.set(saleRef, saleData);
    });

    queue = queue.filter((o) => o.invoiceNo !== order.invoiceNo);
    savePendingSales(queue);
    uploaded++;
    onProgress?.(queue.length);
  }

  return uploaded;
};

const toSales = (docs: { id: string; data: () => unknown }[]): Sale[] =>
  docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Sale, "id">) }));

export const listRecentSales = async (ownerId: string, max = 50): Promise<Sale[]> => {
  const snap = await getDocs(
    query(collection(db, "sales"), where("ownerId", "==", ownerId), orderBy("date", "desc"), limit(max))
  );
  return toSales(snap.docs);
};

export const listSales = async (ownerId: string): Promise<Sale[]> => {
  return listRecentSales(ownerId, 500);
};

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

export interface SaleItemEdit {
  qty: number;
  totalWeight?: number;
  price: number;
}

const deductedUnits = (item: Pick<SaleItem, "type" | "totalWeight" | "qty">): number =>
  item.type === "weight" && item.totalWeight ? item.totalWeight : item.qty;

/**
 * Bill ke items badalna (bags / wazan / rate): stock aur (Udhar ho to) party ka balance
 * farq ke hisaab se theek hota hai, sab ek transaction mein. Return ho chuka bill edit nahi hota.
 */
export const updateSaleItems = async (
  saleId: string,
  edits: SaleItemEdit[],
  extraCharges?: number
): Promise<{ items: SaleItem[]; totalAmount: number; extraCharges: number }> => {
  const saleRef = doc(db, "sales", saleId);
  let result: { items: SaleItem[]; totalAmount: number; extraCharges: number } = { items: [], totalAmount: 0, extraCharges: 0 };

  await runTransaction(db, async (transaction) => {
    const saleSnap = await transaction.get(saleRef);
    if (!saleSnap.exists()) throw new Error("Bill nahi mila");
    const sale = saleSnap.data() as Omit<Sale, "id">;

    if ((sale.refundedAmount || 0) > 0 || sale.items.some((i) => (i.returnedQty || 0) > 0)) {
      throw new Error("Return wala bill edit nahi ho sakta");
    }
    if (edits.length !== sale.items.length) throw new Error("Items badal gaye, bill dobara kholein");

    const newItems: SaleItem[] = sale.items.map((item, i) => {
      const e = edits[i];
      if (!(e.qty > 0)) throw new Error(`${item.name}: bags 0 se zyada hon`);
      if (!(e.price >= 0)) throw new Error(`${item.name}: rate galat hai`);

      const isWeight = item.type === "weight";
      const perBag = item.weightPerBag || 25;
      const weight = isWeight ? e.totalWeight ?? e.qty * perBag : undefined;
      if (isWeight && !((weight ?? 0) > 0)) throw new Error(`${item.name}: wazan 0 se zyada ho`);

      return {
        ...item,
        qty: e.qty,
        price: e.price,
        sellingPrice: e.price,
        ...(isWeight ? { totalWeight: weight, isManualWeight: weight !== e.qty * perBag } : {}),
        total: roundMoney((isWeight ? (weight ?? 0) : e.qty) * e.price),
      };
    });
    const extra = Math.max(0, roundMoney(extraCharges ?? sale.extraCharges ?? 0));
    const newTotal = roundMoney(newItems.reduce((sum, it) => sum + it.total, 0) + extra);
    const oldTotal = sale.totalAmount;

    const productReads = [];
    for (let i = 0; i < newItems.length; i++) {
      const diff = deductedUnits(newItems[i]) - deductedUnits(sale.items[i]);
      if (diff === 0) continue;
      const ref = doc(db, "products", newItems[i].id);
      productReads.push({ ref, snap: await transaction.get(ref), diff, name: newItems[i].name });
    }

    const customerRef =
      sale.paymentMethod === "Udhar" && sale.customerId ? doc(db, "customers", sale.customerId) : null;
    const customerSnap = customerRef ? await transaction.get(customerRef) : null;

    for (const { ref, snap, diff, name } of productReads) {
      if (!snap.exists()) continue;
      const prod = snap.data() as Product;
      const shop = prod.shopStock ?? 0;
      const gudam = prod.gudamStock ?? 0;
      let newShop = shop;
      let newGudam = gudam;

      if (diff > 0) {
        if (prod.stock < diff) throw new Error(`Stock Low! ${name} only ${prod.stock} left.`);
        if (shop >= diff) {
          newShop = shop - diff;
        } else {
          newGudam = Math.max(0, gudam - (diff - shop));
          newShop = 0;
        }
      } else {
        newShop = shop - diff;
      }
      transaction.update(ref, { stock: newShop + newGudam, shopStock: newShop, gudamStock: newGudam });
    }

    if (customerRef && customerSnap?.exists() && newTotal !== oldTotal) {
      const balance = (customerSnap.data() as Customer).balance || 0;
      transaction.update(customerRef, { balance: Math.max(0, roundMoney(balance + newTotal - oldTotal)) });
    }

    transaction.update(saleRef, stripUndefined({ items: newItems.map(cleanSaleItem), totalAmount: newTotal, extraCharges: extra, editedAt: new Date().toISOString() }));
    result = { items: newItems.map(cleanSaleItem), totalAmount: newTotal, extraCharges: extra };
  });

  return result;
};

export const updateSalePayment = async (
  saleId: string,
  method: PaymentMethod,
  customer?: { id: string; name: string }
): Promise<void> => {
  const saleRef = doc(db, "sales", saleId);

  await runTransaction(db, async (transaction) => {
    const saleSnap = await transaction.get(saleRef);
    if (!saleSnap.exists()) throw new Error("Bill nahi mila");
    const sale = saleSnap.data() as Omit<Sale, "id">;

    const current = sale.paymentMethod || "Cash";
    if (current === method) return;
    const net = roundMoney((sale.totalAmount || 0) - (sale.refundedAmount || 0));

    const oldRef = current === "Udhar" && sale.customerId ? doc(db, "customers", sale.customerId) : null;
    const oldSnap = oldRef ? await transaction.get(oldRef) : null;

    const newCustomerId = method === "Udhar" ? customer?.id ?? sale.customerId : undefined;
    if (method === "Udhar" && !newCustomerId) throw new Error("Udhar ke liye party select karein");
    const newRef = newCustomerId ? doc(db, "customers", newCustomerId) : null;
    const newSnap = newRef ? await transaction.get(newRef) : null;
    if (newRef && !newSnap?.exists()) throw new Error("Party nahi mili");

    if (oldRef && oldSnap?.exists()) {
      const balance = (oldSnap.data() as Customer).balance || 0;
      transaction.update(oldRef, { balance: Math.max(0, roundMoney(balance - net)) });
    }
    if (newRef && newSnap) {
      const data = newSnap.data() as Customer;
      transaction.update(newRef, { balance: roundMoney((data.balance || 0) + net) });
      transaction.update(saleRef, {
        paymentMethod: method,
        customerId: newCustomerId,
        customerName: customer?.name ?? data.name,
        editedAt: new Date().toISOString(),
      });
    } else {
      transaction.update(saleRef, { paymentMethod: method, editedAt: new Date().toISOString() });
    }
  });
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

export const clearCollection = async (ownerId: string, name: "products" | "sales"): Promise<void> => {
  const snap = await getDocs(query(collection(db, name), where("ownerId", "==", ownerId)));
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
};
