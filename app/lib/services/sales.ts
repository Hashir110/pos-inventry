import {
  collection,
  deleteDoc,
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
import { auth, db } from "../firebase";
import { tr } from "../i18n/translate";
import { deductStock } from "../stock";
import type {
  BankAccount,
  BankTransaction,
  Customer,
  PaymentMethod,
  PendingSale,
  Product,
  Sale,
  SaleItem,
  UnitType,
} from "../../types";
import {
  cacheKeys,
  getCached,
  getCachedEvenStale,
  getPendingSales,
  savePendingSales,
  setCached,
  invalidateCache,
} from "./offlineStorage";

export { getPendingSales, savePendingSales };

export interface SaleMeta {
  customerName: string;
  description: string;
  paymentMethod: PaymentMethod;
  customerId?: string;
  transport?: string;
  extraCharges?: number;
  advanceAmount?: number;
  cashAmount?: number;
  bankAmount?: number;
  bankId?: string;
  bankName?: string;
}

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
  if (typeof meta.advanceAmount === "number" && meta.advanceAmount > 0) {
    result.advanceAmount = meta.advanceAmount;
  }
  if (meta.customerId) {
    result.customerId = meta.customerId;
  }
  if (typeof meta.cashAmount === "number") {
    result.cashAmount = meta.cashAmount;
  }
  if (typeof meta.bankAmount === "number") {
    result.bankAmount = meta.bankAmount;
  }
  if (meta.bankId) {
    result.bankId = meta.bankId;
  }
  if (meta.bankName) {
    result.bankName = meta.bankName;
  }
  return result;
};

const isUdharWithCustomer = (paymentMethod: PaymentMethod, customerId?: string): customerId is string =>
  (paymentMethod === "Udhar" || paymentMethod === "Split") && !!customerId;

const roundMoney = (n: number) => Math.round(n * 100) / 100;

export const createOnlineSale = async (
  ownerId: string,
  cart: SaleItem[],
  totalAmount: number,
  meta: SaleMeta
): Promise<string> => {
  const saleRef = doc(collection(db, "sales"));
  let invoiceNo = "";

  const advancePaid = meta.advanceAmount || 0;
  const netPayable = Math.max(0, roundMoney(totalAmount - advancePaid));

  const bankPaidAmount =
    meta.paymentMethod === "Bank Account"
      ? (meta.bankAmount ?? netPayable)
      : (meta.bankAmount || 0);
  const hasBankPayment =
    (meta.paymentMethod === "Bank Account" || meta.paymentMethod === "Split") &&
    !!meta.bankId &&
    bankPaidAmount > 0;

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
      if (!customerSnap.exists()) throw new Error(tr("sales_errCustomerNotFound"));
    }

    let bankRef = null;
    let bankSnap = null;
    if (hasBankPayment && meta.bankId) {
      bankRef = doc(db, "banks", meta.bankId);
      bankSnap = await transaction.get(bankRef);
    }

    const shopRef = doc(db, "users", ownerId);
    const shopSnap = await transaction.get(shopRef);
    const nextInvoice = ((shopSnap.data()?.invoiceCounter as number | undefined) || 0) + 1;
    invoiceNo = String(nextInvoice).padStart(6, "0");

    for (const { snapshot, item } of reads) {
      if (!snapshot.exists()) throw new Error(tr("sales_errProductNotFound", { name: item.name }));
    }

    const shopDefaults = shopSnap.exists() ? {} : {
      uid: ownerId,
      email: auth.currentUser?.email || "",
      shopName: "Eman Traders",
      businessType: "Wholesale",
      currency: "PKR",
      createdAt: new Date().toISOString(),
    };
    transaction.set(shopRef, { ...shopDefaults, invoiceCounter: nextInvoice }, { merge: true });

    if (customerRef && customerSnap) {
      const balance = (customerSnap.data() as Customer).balance || 0;
      let udharToAdd = 0;
      if (meta.paymentMethod === "Udhar") {
        udharToAdd = netPayable;
      } else if (meta.paymentMethod === "Split") {
        const cashPaid = meta.cashAmount || 0;
        const bankPaid = meta.bankAmount || 0;
        udharToAdd = Math.max(0, roundMoney(netPayable - cashPaid - bankPaid));
      }
      if (udharToAdd > 0) {
        transaction.update(customerRef, { balance: roundMoney(balance + udharToAdd) });
      }
    }

    if (bankRef && bankSnap && bankSnap.exists() && bankPaidAmount > 0) {
      const bankData = bankSnap.data() as BankAccount;
      const currentBankBal = bankData.currentBalance || 0;
      const newBankBal = roundMoney(currentBankBal + bankPaidAmount);

      transaction.update(bankRef, {
        currentBalance: newBankBal,
        updatedAt: new Date().toISOString(),
      });

      const bankTxRef = doc(collection(db, "bank_transactions"));
      const bankTxData: BankTransaction = {
        id: bankTxRef.id,
        ownerId,
        bankId: meta.bankId!,
        bankName: meta.bankName || bankData.bankName,
        type: "deposit",
        amount: bankPaidAmount,
        date: new Date().toISOString(),
        customerName: meta.customerName || "Counter Sale",
        customerId: meta.customerId,
        saleId: saleRef.id,
        invoiceNo,
        description: `Sale Payment #${invoiceNo}`,
        balanceAfter: newBankBal,
        createdAt: new Date().toISOString(),
      };
      transaction.set(bankTxRef, stripUndefined(bankTxData));
    }

    for (const { snapshot, item } of reads) {
      const prod = snapshot.data() as Product;
      const deductQty = item.qty;
      const levels = deductStock({ shopStock: prod.shopStock ?? 0, gudamStock: prod.gudamStock ?? 0 }, deductQty);
      const newShop = levels.shopStock;
      const newGudam = levels.gudamStock;
      const newTotal = newShop + newGudam;

      transaction.update(snapshot.ref, {
        stock: newTotal,
        gudamStock: newGudam,
        shopStock: newShop,
      });
    }

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

  if (hasBankPayment && meta.bankId) {
    invalidateCache(cacheKeys.banks(ownerId));
    invalidateCache(cacheKeys.bankTransactions(ownerId, meta.bankId));
    invalidateCache(cacheKeys.bankTransactions(ownerId));
  }

  // Optimistically update local sales cache
  const salesKey = cacheKeys.sales(ownerId);
  const currentSales = getCachedEvenStale<Sale[]>(salesKey) || [];
  const createdSale: Sale = {
    id: saleRef.id,
    saleId: saleRef.id,
    ownerId,
    items: cart.map(cleanSaleItem),
    totalAmount: roundMoney(totalAmount || 0),
    date: new Date().toISOString(),
    invoiceNo,
    customerName: meta.customerName || "Counter Sale",
    description: meta.description || "",
    paymentMethod: meta.paymentMethod || "Cash",
    ...(meta.cashAmount !== undefined ? { cashAmount: meta.cashAmount } : {}),
    ...(bankPaidAmount > 0 ? { bankAmount: bankPaidAmount } : {}),
    ...(meta.bankId ? { bankId: meta.bankId } : {}),
    ...(meta.bankName ? { bankName: meta.bankName } : {}),
    ...(meta.customerId ? { customerId: meta.customerId } : {}),
    ...(meta.transport ? { transport: meta.transport } : {}),
    ...(meta.extraCharges ? { extraCharges: meta.extraCharges } : {}),
    ...(meta.advanceAmount ? { advanceAmount: meta.advanceAmount } : {}),
  };
  setCached(salesKey, [createdSale, ...currentSales]);

  // Optimistically update local products stock cache
  const prodsKey = cacheKeys.products(ownerId);
  const currentProds = getCachedEvenStale<Product[]>(prodsKey);
  if (currentProds && currentProds.length > 0) {
    const updatedProds = currentProds.map((p) => {
      const cartItem = cart.find((c) => c.id === p.id);
      if (!cartItem) return p;
      const newStock = (p.stock || 0) - cartItem.qty;
      const newShop = (p.shopStock ?? p.stock ?? 0) - cartItem.qty;
      return { ...p, stock: newStock, shopStock: newShop };
    });
    setCached(prodsKey, updatedProds);
  }

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
    if (!p) {
      throw new Error(tr("sales_errProductNotFound", { name: item.name }));
    }
  }

  const invoiceNo = "OFF-" + Date.now().toString(36).toUpperCase().slice(-6);
  const nowIso = new Date().toISOString();
  const order: PendingSale = stripUndefined({
    ownerId: ownerId || "",
    items: cart.map(cleanSaleItem),
    totalAmount: roundMoney(totalAmount || 0),
    date: nowIso,
    isOffline: true,
    invoiceNo,
    ...buildMeta(meta),
  }) as PendingSale;

  savePendingSales([...getPendingSales(), order]);

  // Optimistically prepend to cached sales list with isOffline: true
  const salesKey = cacheKeys.sales(ownerId);
  const currentSales = getCachedEvenStale<Sale[]>(salesKey) || [];
  const localSaleRow: Sale = {
    id: `local_${invoiceNo}`,
    ...order,
  };
  setCached(salesKey, [localSaleRow, ...currentSales]);

  // Deduct stock in local product cache
  const prodsKey = cacheKeys.products(ownerId);
  const currentProds = getCachedEvenStale<Product[]>(prodsKey) || localProducts;
  if (currentProds && currentProds.length > 0) {
    const updatedProds = currentProds.map((p) => {
      const cartItem = cart.find((c) => c.id === p.id);
      if (!cartItem) return p;
      const newStock = (p.stock || 0) - cartItem.qty;
      const newShop = (p.shopStock ?? p.stock ?? 0) - cartItem.qty;
      return { ...p, stock: newStock, shopStock: newShop };
    });
    setCached(prodsKey, updatedProds);
  }

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
        const levels = deductStock({ shopStock: prod.shopStock ?? 0, gudamStock: prod.gudamStock ?? 0 }, deductQty);
        const newShop = levels.shopStock;
        const newGudam = levels.gudamStock;
        const newTotal = newShop + newGudam;

        transaction.update(snapshot.ref, {
          stock: newTotal,
          gudamStock: newGudam,
          shopStock: newShop,
        });
      }

      if (customerRef && customerSnap?.exists()) {
        const balance = (customerSnap.data() as Customer).balance || 0;
        const advancePaid = order.advanceAmount || 0;
        const netPayable = Math.max(0, roundMoney(order.totalAmount - advancePaid));
        let udharToAdd = 0;
        if (order.paymentMethod === "Udhar") {
          udharToAdd = netPayable;
        } else if (order.paymentMethod === "Split") {
          const cashPaid = order.cashAmount || 0;
          const bankPaid = order.bankAmount || 0;
          udharToAdd = Math.max(0, roundMoney(netPayable - cashPaid - bankPaid));
        }
        if (udharToAdd > 0) {
          transaction.update(customerRef, { balance: roundMoney(balance + udharToAdd) });
        }
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

export const listRecentSales = async (ownerId: string, max = 50, forceRefresh = false): Promise<Sale[]> => {
  const cacheKey = cacheKeys.sales(ownerId);
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  if (!forceRefresh) {
    const cached = isOnline ? getCached<Sale[]>(cacheKey) : getCachedEvenStale<Sale[]>(cacheKey);
    if (cached && cached.length >= 0) return cached;
  }

  if (!isOnline) {
    return getCachedEvenStale<Sale[]>(cacheKey) || [];
  }

  try {
    const snap = await getDocs(
      query(collection(db, "sales"), where("ownerId", "==", ownerId), orderBy("date", "desc"), limit(max))
    );
    const items = toSales(snap.docs);
    // Merge pending offline sales that haven't synced yet
    const pending = getPendingSales().map((p) => ({ id: `local_${p.invoiceNo}`, ...p } as Sale));
    const merged = [...pending, ...items.filter((item) => !pending.some((p) => p.invoiceNo === item.invoiceNo))];
    setCached(cacheKey, merged);
    return merged;
  } catch (error) {
    console.warn("[sales] Failed to fetch recent sales, using offline cache:", error);
    const stale = getCachedEvenStale<Sale[]>(cacheKey);
    if (stale) return stale;
    throw error;
  }
};

export const listSales = async (ownerId: string, forceRefresh = false): Promise<Sale[]> => {
  return listRecentSales(ownerId, 500, forceRefresh);
};

export const listSalesInRange = async (
  ownerId: string,
  fromIso: string,
  toIso?: string,
  forceRefresh = false
): Promise<Sale[]> => {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  const cached = getCachedEvenStale<Sale[]>(cacheKeys.sales(ownerId));

  if (!isOnline || (!forceRefresh && cached && cached.length > 0)) {
    if (cached && cached.length > 0) {
      return cached.filter((s) => {
        if (s.date < fromIso) return false;
        if (toIso && s.date > toIso) return false;
        return true;
      });
    }
  }

  if (!isOnline) return [];

  try {
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
  } catch (err) {
    console.warn("[sales] Error listing sales in range, using local cache:", err);
    if (cached) {
      return cached.filter((s) => s.date >= fromIso && (!toIso || s.date <= toIso));
    }
    return [];
  }
};

export interface SaleItemEdit {
  qty: number;
  totalWeight?: number;
  price: number;
}


const deductedUnits = (item: Pick<SaleItem, "type" | "totalWeight" | "qty">): number =>
  item.type === "weight" && item.totalWeight ? item.totalWeight : item.qty;

export const resolveSaleRef = async (saleId: string, ownerId?: string) => {
  // 1. Direct doc lookup
  try {
    const directRef = doc(db, "sales", saleId);
    const directSnap = await getDoc(directRef);
    if (directSnap.exists()) return directRef;
  } catch {}

  // 2. Query by ownerId & invoiceNo if available
  const cleanInvoice = saleId.replace(/^local_/, "").split("_").pop();
  if (cleanInvoice && ownerId) {
    try {
      const q1 = query(
        collection(db, "sales"),
        where("ownerId", "==", ownerId),
        where("invoiceNo", "==", cleanInvoice),
        limit(1)
      );
      const snap1 = await getDocs(q1);
      if (!snap1.empty) return snap1.docs[0].ref;
    } catch {}
  }

  // 3. Fallback query by invoiceNo alone
  if (cleanInvoice) {
    try {
      const q2 = query(
        collection(db, "sales"),
        where("invoiceNo", "==", cleanInvoice),
        limit(1)
      );
      const snap2 = await getDocs(q2);
      if (!snap2.empty) return snap2.docs[0].ref;
    } catch {}
  }

  // 4. Try saleId field match
  try {
    const q3 = query(
      collection(db, "sales"),
      where("saleId", "==", saleId),
      limit(1)
    );
    const snap3 = await getDocs(q3);
    if (!snap3.empty) return snap3.docs[0].ref;
  } catch {}

  return doc(db, "sales", saleId);
};

export const updateSaleItems = async (
  saleId: string,
  edits: SaleItemEdit[],
  extraCharges?: number,
  ownerId?: string
): Promise<{ items: SaleItem[]; totalAmount: number; extraCharges: number }> => {
  const saleRef = await resolveSaleRef(saleId, ownerId);
  let result: { items: SaleItem[]; totalAmount: number; extraCharges: number } = { items: [], totalAmount: 0, extraCharges: 0 };

  await runTransaction(db, async (transaction) => {
    const saleSnap = await transaction.get(saleRef);
    if (!saleSnap.exists()) throw new Error(tr("sales_errBillNotFound"));
    const sale = saleSnap.data() as Omit<Sale, "id">;

    if ((sale.refundedAmount || 0) > 0 || sale.items.some((i) => (i.returnedQty || 0) > 0)) {
      throw new Error(tr("sales_editBlocked"));
    }
    if (edits.length !== sale.items.length) throw new Error(tr("sales_errItemsChanged"));

    const newItems: SaleItem[] = sale.items.map((item, i) => {
      const e = edits[i];
      if (!(e.qty > 0)) throw new Error(tr("sales_errQtyInvalid", { name: item.name }));
      if (!(e.price >= 0)) throw new Error(tr("sales_errRateInvalid", { name: item.name }));

      const isWeight = item.type === "weight";
      const perBag = item.weightPerBag || 25;
      const weight = isWeight ? e.totalWeight ?? e.qty * perBag : undefined;
      if (isWeight && !((weight ?? 0) > 0)) throw new Error(tr("sales_errWeightInvalid", { name: item.name }));

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
        const levels = deductStock({ shopStock: shop, gudamStock: gudam }, diff);
        newShop = levels.shopStock;
        newGudam = levels.gudamStock;
      } else {
        newShop = shop - diff;
      }
      transaction.update(ref, { stock: newShop + newGudam, shopStock: newShop, gudamStock: newGudam });
    }

    if (customerRef && customerSnap?.exists() && newTotal !== oldTotal) {
      const balance = (customerSnap.data() as Customer).balance || 0;
      transaction.update(customerRef, { balance: roundMoney(balance + newTotal - oldTotal) });
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
    if (!saleSnap.exists()) throw new Error(tr("sales_errBillNotFound"));
    const sale = saleSnap.data() as Omit<Sale, "id">;

    const current = sale.paymentMethod || "Cash";
    if (current === method) return;
    const net = roundMoney((sale.totalAmount || 0) - (sale.refundedAmount || 0));

    const oldRef = current === "Udhar" && sale.customerId ? doc(db, "customers", sale.customerId) : null;
    const oldSnap = oldRef ? await transaction.get(oldRef) : null;

    const newCustomerId = method === "Udhar" ? customer?.id ?? sale.customerId : undefined;
    if (method === "Udhar" && !newCustomerId) throw new Error(tr("sales_errSelectParty"));
    const newRef = newCustomerId ? doc(db, "customers", newCustomerId) : null;
    const newSnap = newRef ? await transaction.get(newRef) : null;
    if (newRef && !newSnap?.exists()) throw new Error(tr("sales_errPartyNotFound"));

    if (oldRef && oldSnap?.exists()) {
      const balance = (oldSnap.data() as Customer).balance || 0;
      transaction.update(oldRef, { balance: roundMoney(balance - net) });
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

export interface FullSaleItemInput {
  id?: string;
  productId?: string;
  name?: string;
  qty: number;
  price: number;
  buyingPrice?: number;
  sellingPrice?: number;
  type?: UnitType;
  totalWeight?: number;
  weightPerBag?: number;
  isManualWeight?: boolean;
}

export interface FullSaleEditData {
  items: FullSaleItemInput[];
  customerName?: string;
  customerId?: string;
  paymentMethod?: PaymentMethod;
  transport?: string;
  extraCharges?: number;
  description?: string;
}

export const updateSaleFull = async (
  saleId: string,
  ownerId: string,
  updates: FullSaleEditData
): Promise<Sale> => {
  const saleRef = await resolveSaleRef(saleId, ownerId);
  let updatedSale: Sale | null = null;
  const stockChanges: { prodId: string; diff: number }[] = [];

  await runTransaction(db, async (transaction) => {
    const saleSnap = await transaction.get(saleRef);
    if (!saleSnap.exists()) throw new Error(tr("sales_errBillNotFound"));
    const sale = saleSnap.data() as Omit<Sale, "id">;

    if ((sale.refundedAmount || 0) > 0 || sale.items.some((i) => (i.returnedQty || 0) > 0)) {
      throw new Error(tr("sales_editBlocked"));
    }
    if (!updates.items || updates.items.length === 0) {
      throw new Error(tr("sales_errAtLeastOneItem"));
    }

    const newItems: SaleItem[] = updates.items.map((e, i) => {
      const fallbackName = sale.items[i]?.name || `Item ${i + 1}`;
      const name = e.name || fallbackName;
      if (!(e.qty > 0)) throw new Error(tr("sales_errQtyInvalid", { name }));
      if (!(e.price >= 0)) throw new Error(tr("sales_errRateInvalid", { name }));

      const isWeight = (e.type ?? sale.items[i]?.type) === "weight";
      const perBag = e.weightPerBag ?? sale.items[i]?.weightPerBag ?? 25;
      const weight = isWeight ? e.totalWeight ?? e.qty * perBag : undefined;
      if (isWeight && !((weight ?? 0) > 0)) throw new Error(tr("sales_errWeightInvalid", { name }));

      const prodId = e.productId || e.id || sale.items[i]?.productId || sale.items[i]?.id || "";
      const buyingPrice = e.buyingPrice ?? sale.items[i]?.buyingPrice ?? 0;

      return {
        id: prodId || `item_${i}`,
        productId: prodId,
        name,
        qty: e.qty,
        price: e.price,
        sellingPrice: e.price,
        buyingPrice,
        type: isWeight ? "weight" : "count",
        ...(isWeight ? { totalWeight: weight, weightPerBag: perBag, isManualWeight: Boolean(e.isManualWeight) } : {}),
        total: roundMoney((isWeight ? (weight ?? 0) : e.qty) * e.price),
      };
    });

    const extra = Math.max(0, roundMoney(updates.extraCharges ?? sale.extraCharges ?? 0));
    const newTotal = roundMoney(newItems.reduce((sum, it) => sum + it.total, 0) + extra);
    const oldTotal = sale.totalAmount || 0;

    // Adjust product stock for all affected products
    const oldDeductedMap: Record<string, number> = {};
    for (const it of sale.items) {
      const pid = it.productId || it.id;
      if (pid) {
        oldDeductedMap[pid] = (oldDeductedMap[pid] || 0) + deductedUnits(it);
      }
    }

    const newDeductedMap: Record<string, number> = {};
    for (const it of newItems) {
      const pid = it.productId || it.id;
      if (pid) {
        newDeductedMap[pid] = (newDeductedMap[pid] || 0) + deductedUnits(it);
      }
    }

    const allProductIds = Array.from(new Set([
      ...Object.keys(oldDeductedMap),
      ...Object.keys(newDeductedMap),
    ]));

    for (const prodId of allProductIds) {
      const oldUnits = oldDeductedMap[prodId] || 0;
      const newUnits = newDeductedMap[prodId] || 0;
      const diff = newUnits - oldUnits; // diff > 0: deduct more stock, diff < 0: return stock
      if (diff === 0) continue;

      const ref = doc(db, "products", prodId);
      const snap = await transaction.get(ref);
      if (snap.exists()) {
        const prod = snap.data() as Product;
        const shop = prod.shopStock ?? 0;
        const gudam = prod.gudamStock ?? 0;
        let newShop = shop;
        let newGudam = gudam;

        if (diff > 0) {
          const levels = deductStock({ shopStock: shop, gudamStock: gudam }, diff);
          newShop = levels.shopStock;
          newGudam = levels.gudamStock;
        } else {
          newShop = shop - diff;
        }
        transaction.update(ref, { stock: newShop + newGudam, shopStock: newShop, gudamStock: newGudam });
        stockChanges.push({ prodId, diff });
      }
    }

    // Customer balance adjustment
    const oldMethod = sale.paymentMethod || "Cash";
    const newMethod = updates.paymentMethod || oldMethod;
    const oldCustId = sale.customerId;
    const newCustId = updates.customerId ?? oldCustId;

    if (oldMethod === "Udhar" && newMethod !== "Udhar" && oldCustId) {
      const oldCustRef = doc(db, "customers", oldCustId);
      const oldCustSnap = await transaction.get(oldCustRef);
      if (oldCustSnap.exists()) {
        const bal = (oldCustSnap.data() as Customer).balance || 0;
        transaction.update(oldCustRef, { balance: roundMoney(bal - oldTotal) });
      }
    } else if (oldMethod !== "Udhar" && newMethod === "Udhar" && newCustId) {
      const newCustRef = doc(db, "customers", newCustId);
      const newCustSnap = await transaction.get(newCustRef);
      if (newCustSnap.exists()) {
        const bal = (newCustSnap.data() as Customer).balance || 0;
        transaction.update(newCustRef, { balance: roundMoney(bal + newTotal) });
      }
    } else if (oldMethod === "Udhar" && newMethod === "Udhar") {
      if (oldCustId === newCustId && oldCustId && newTotal !== oldTotal) {
        const custRef = doc(db, "customers", oldCustId);
        const custSnap = await transaction.get(custRef);
        if (custSnap.exists()) {
          const bal = (custSnap.data() as Customer).balance || 0;
          transaction.update(custRef, { balance: roundMoney(bal + newTotal - oldTotal) });
        }
      } else if (oldCustId !== newCustId) {
        if (oldCustId) {
          const oldRef = doc(db, "customers", oldCustId);
          const oldSnap = await transaction.get(oldRef);
          if (oldSnap.exists()) {
            const bal = (oldSnap.data() as Customer).balance || 0;
            transaction.update(oldRef, { balance: roundMoney(bal - oldTotal) });
          }
        }
        if (newCustId) {
          const newRef = doc(db, "customers", newCustId);
          const newSnap = await transaction.get(newRef);
          if (newSnap.exists()) {
            const bal = (newSnap.data() as Customer).balance || 0;
            transaction.update(newRef, { balance: roundMoney(bal + newTotal) });
          }
        }
      }
    }

    const payload = stripUndefined({
      items: newItems.map(cleanSaleItem),
      totalAmount: newTotal,
      extraCharges: extra,
      customerName: updates.customerName?.trim() || sale.customerName || "Counter Sale",
      customerId: newMethod === "Udhar" ? newCustId : undefined,
      paymentMethod: newMethod,
      transport: updates.transport !== undefined ? updates.transport.trim() : sale.transport,
      description: updates.description !== undefined ? updates.description.trim() : sale.description,
      editedAt: new Date().toISOString(),
    });

    transaction.update(saleRef, payload);
    updatedSale = { id: saleRef.id, ...sale, ...payload };
  });

  if (!updatedSale) throw new Error("Update failed");

  // Optimistically update local cache
  const salesKey = cacheKeys.sales(ownerId);
  const cachedSales = getCachedEvenStale<Sale[]>(salesKey);
  if (cachedSales) {
    setCached(
      salesKey,
      cachedSales.map((s) =>
        s.id === saleId || s.id === saleRef.id || s.invoiceNo === updatedSale!.invoiceNo
          ? updatedSale!
          : s
      )
    );
  }

  // Update products cache
  if (stockChanges.length > 0) {
    const prodsKey = cacheKeys.products(ownerId);
    const cachedProds = getCachedEvenStale<Product[]>(prodsKey);
    if (cachedProds) {
      setCached(
        prodsKey,
        cachedProds.map((p) => {
          const ch = stockChanges.find((c) => c.prodId === p.id);
          if (!ch) return p;
          const newStock = (p.stock || 0) - ch.diff;
          const newShop = (p.shopStock ?? p.stock ?? 0) - ch.diff;
          return { ...p, stock: newStock, shopStock: newShop };
        })
      );
    }
  }

  return updatedSale;
};

export const deleteSale = async (saleId: string, ownerId: string): Promise<void> => {
  const saleRef = await resolveSaleRef(saleId, ownerId);
  const stockRestores: { prodId: string; qty: number }[] = [];
  let deletedInvoiceNo: string | undefined;

  await runTransaction(db, async (transaction) => {
    const saleSnap = await transaction.get(saleRef);
    if (!saleSnap.exists()) return;
    const sale = saleSnap.data() as Omit<Sale, "id">;
    deletedInvoiceNo = sale.invoiceNo;

    // 1. Restore product stock
    for (const item of sale.items || []) {
      const prodId = item.productId || item.id;
      if (!prodId) continue;
      const ref = doc(db, "products", prodId);
      const snap = await transaction.get(ref);
      if (snap.exists()) {
        const prod = snap.data() as Product;
        const addQty = item.qty || 0;
        const shop = prod.shopStock ?? 0;
        const gudam = prod.gudamStock ?? 0;
        const newShop = shop + addQty;
        const newStock = newShop + gudam;
        transaction.update(ref, {
          stock: newStock,
          shopStock: newShop,
          gudamStock: gudam,
        });
        stockRestores.push({ prodId, qty: addQty });
      }
    }

    // 2. Reverse customer balance if Udhar or Split
    if ((sale.paymentMethod === "Udhar" || sale.paymentMethod === "Split") && sale.customerId) {
      const custRef = doc(db, "customers", sale.customerId);
      const custSnap = await transaction.get(custRef);
      if (custSnap.exists()) {
        const bal = (custSnap.data() as Customer).balance || 0;
        const udharOnSale =
          sale.paymentMethod === "Udhar"
            ? (sale.totalAmount || 0)
            : Math.max(0, (sale.totalAmount || 0) - (sale.cashAmount || 0) - (sale.bankAmount || 0));
        const net = roundMoney(Math.max(0, udharOnSale - (sale.refundedAmount || 0)));
        transaction.update(custRef, { balance: roundMoney(bal - net) });
      }
    }

    // 2b. Reverse bank balance if sale had bank payment
    const bankPaidOnSale =
      sale.bankAmount ?? (sale.paymentMethod === "Bank Account" ? (sale.totalAmount || 0) : 0);
    if (sale.bankId && bankPaidOnSale > 0) {
      const bankRef = doc(db, "banks", sale.bankId);
      const bankSnap = await transaction.get(bankRef);
      if (bankSnap.exists()) {
        const curBal = (bankSnap.data() as BankAccount).currentBalance || 0;
        transaction.update(bankRef, {
          currentBalance: Math.max(0, roundMoney(curBal - bankPaidOnSale)),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // 3. Delete sale doc
    transaction.delete(saleRef);
  });

  // Delete matching bank transaction if any
  if (deletedInvoiceNo) {
    try {
      const qTx = query(
        collection(db, "bank_transactions"),
        where("ownerId", "==", ownerId),
        where("invoiceNo", "==", deletedInvoiceNo)
      );
      const txSnaps = await getDocs(qTx);
      for (const tDoc of txSnaps.docs) {
        await deleteDoc(tDoc.ref);
      }
      invalidateCache(cacheKeys.banks(ownerId));
      invalidateCache(cacheKeys.bankTransactions(ownerId));
    } catch (err) {
      console.warn("Failed to delete bank transaction on sale delete:", err);
    }
  }

  // 4. Update local caches
  const salesKey = cacheKeys.sales(ownerId);
  const cachedSales = getCachedEvenStale<Sale[]>(salesKey);
  if (cachedSales) {
    setCached(
      salesKey,
      cachedSales.filter(
        (s) =>
          s.id !== saleId &&
          s.id !== saleRef.id &&
          (!deletedInvoiceNo || s.invoiceNo !== deletedInvoiceNo)
      )
    );
  }

  // Restore product cache
  if (stockRestores.length > 0) {
    const prodsKey = cacheKeys.products(ownerId);
    const cachedProds = getCachedEvenStale<Product[]>(prodsKey);
    if (cachedProds) {
      setCached(
        prodsKey,
        cachedProds.map((p) => {
          const res = stockRestores.find((r) => r.prodId === p.id);
          if (!res) return p;
          return {
            ...p,
            stock: (p.stock || 0) + res.qty,
            shopStock: (p.shopStock ?? p.stock ?? 0) + res.qty,
          };
        })
      );
    }
  }

  // Remove from pending offline if needed
  const pending = getPendingSales().filter((p) => p.invoiceNo !== saleId && `local_${p.invoiceNo}` !== saleId);
  savePendingSales(pending);
};
