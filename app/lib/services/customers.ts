import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { tr } from "../i18n/translate";
import type { Customer, CustomerPayment, Sale } from "../../types";
import {
  cacheKeys,
  getCached,
  getCachedEvenStale,
  setCached,
} from "./offlineStorage";

export const listCustomers = async (ownerId: string, forceRefresh = false): Promise<Customer[]> => {
  const cacheKey = cacheKeys.customers(ownerId);
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  if (!forceRefresh) {
    const cached = isOnline ? getCached<Customer[]>(cacheKey) : getCachedEvenStale<Customer[]>(cacheKey);
    if (cached && cached.length >= 0) return cached;
  }

  if (!isOnline) {
    return getCachedEvenStale<Customer[]>(cacheKey) || [];
  }

  try {
    const snap = await getDocs(query(collection(db, "customers"), where("ownerId", "==", ownerId)));
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Customer)
      .sort((a, b) => a.name.localeCompare(b.name));
    setCached(cacheKey, items);
    return items;
  } catch (error) {
    console.warn("[customers] Failed to fetch customers, using offline cache:", error);
    const stale = getCachedEvenStale<Customer[]>(cacheKey);
    if (stale) return stale;
    throw error;
  }
};

export const subscribeCustomers = (
  ownerId: string,
  onData: (customers: Customer[]) => void
): (() => void) => {
  const cacheKey = cacheKeys.customers(ownerId);
  const cached = getCachedEvenStale<Customer[]>(cacheKey);
  if (cached && cached.length > 0) {
    onData(cached);
  }

  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (!isOnline) {
    return () => {};
  }

  return onSnapshot(
    query(collection(db, "customers"), where("ownerId", "==", ownerId)),
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Customer)
        .sort((a, b) => a.name.localeCompare(b.name));
      setCached(cacheKey, items);
      onData(items);
    },
    (err) => {
      console.warn("Customer listener warning:", err.message);
    }
  );
};

export const addCustomer = async (
  ownerId: string,
  input: { name: string; phone?: string }
): Promise<Customer> => {
  const data = {
    ownerId,
    name: input.name.trim(),
    phone: input.phone?.trim() || "",
    balance: 0,
    createdAt: new Date().toISOString(),
  };

  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  let id = `local_${Date.now()}`;

  if (isOnline) {
    const ref = await addDoc(collection(db, "customers"), data);
    id = ref.id;
  }

  const newCust: Customer = { id, ...data };

  // Optimistically update cache
  const cacheKey = cacheKeys.customers(ownerId);
  const current = getCachedEvenStale<Customer[]>(cacheKey) || [];
  setCached(
    cacheKey,
    [...current, newCust].sort((a, b) => a.name.localeCompare(b.name))
  );

  return newCust;
};

export const receivePayment = async (
  ownerId: string,
  customerId: string,
  amount: number,
  method: CustomerPayment["method"],
  note = ""
): Promise<void> => {
  if (!(amount > 0)) throw new Error(tr("closing_errAmountPositive"));

  const customerRef = doc(db, "customers", customerId);
  const paymentRef = doc(collection(db, "payments"));

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(customerRef);
    if (!snap.exists()) throw new Error(tr("closing_errCustomerNotFound"));
    const customer = snap.data() as Customer;
    if (amount > customer.balance + 0.001) {
      throw new Error(tr("closing_errCreditLimit", { amount: customer.balance }));
    }

    const newBalance = Math.round((customer.balance - amount) * 100) / 100;
    transaction.update(customerRef, { balance: newBalance });
    transaction.set(paymentRef, {
      ownerId,
      customerId,
      customerName: customer.name,
      amount,
      method,
      note: note.trim(),
      date: new Date().toISOString(),
    });
  });

  // Update customer balance in cache
  const cacheKey = cacheKeys.customers(ownerId);
  const current = getCachedEvenStale<Customer[]>(cacheKey);
  if (current) {
    setCached(
      cacheKey,
      current.map((c) =>
        c.id === customerId ? { ...c, balance: Math.max(0, Math.round((c.balance - amount) * 100) / 100) } : c
      )
    );
  }
};

export const getCustomer = async (customerId: string, ownerId?: string): Promise<Customer | null> => {
  if (ownerId) {
    const cached = getCachedEvenStale<Customer[]>(cacheKeys.customers(ownerId));
    const found = cached?.find((c) => c.id === customerId);
    if (found) return found;
  }

  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (!isOnline) return null;

  const snap = await getDoc(doc(db, "customers", customerId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Customer) : null;
};

export const listCustomerCreditSales = async (ownerId: string, customerId: string): Promise<Sale[]> => {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  const cachedSales = getCachedEvenStale<Sale[]>(cacheKeys.sales(ownerId));

  if (!isOnline && cachedSales) {
    return cachedSales
      .filter((s) => s.customerId === customerId && s.paymentMethod === "Udhar")
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  try {
    const snap = await getDocs(
      query(
        collection(db, "sales"),
        where("ownerId", "==", ownerId),
        where("customerId", "==", customerId)
      )
    );
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Sale)
      .filter((s) => s.paymentMethod === "Udhar")
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch (e) {
    if (cachedSales) {
      return cachedSales
        .filter((s) => s.customerId === customerId && s.paymentMethod === "Udhar")
        .sort((a, b) => b.date.localeCompare(a.date));
    }
    return [];
  }
};

export const listAllPayments = async (ownerId: string): Promise<CustomerPayment[]> => {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (!isOnline) return [];

  const snap = await getDocs(query(collection(db, "payments"), where("ownerId", "==", ownerId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as CustomerPayment)
    .sort((a, b) => b.date.localeCompare(a.date));
};

export const listPayments = async (ownerId: string, customerId: string): Promise<CustomerPayment[]> => {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (!isOnline) return [];

  const snap = await getDocs(
    query(
      collection(db, "payments"),
      where("ownerId", "==", ownerId),
      where("customerId", "==", customerId)
    )
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as CustomerPayment)
    .sort((a, b) => b.date.localeCompare(a.date));
};
