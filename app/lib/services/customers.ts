import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { tr } from "../i18n/translate";
import type { BankAccount, Customer, CustomerPayment, Sale } from "../../types";
import {
  cacheKeys,
  getCached,
  getCachedEvenStale,
  invalidateCache,
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

export const updateCustomer = async (
  ownerId: string,
  customerId: string,
  input: { name: string; phone?: string }
): Promise<void> => {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  const updateData = {
    name: input.name.trim(),
    phone: input.phone?.trim() || "",
  };

  if (isOnline) {
    const customerRef = doc(db, "customers", customerId);
    await updateDoc(customerRef, updateData);
  }

  // Update local cache
  const cacheKey = cacheKeys.customers(ownerId);
  const current = getCachedEvenStale<Customer[]>(cacheKey) || [];
  setCached(
    cacheKey,
    current
      .map((c) => (c.id === customerId ? { ...c, ...updateData } : c))
      .sort((a, b) => a.name.localeCompare(b.name))
  );
};

export const deleteCustomer = async (
  ownerId: string,
  customerId: string
): Promise<void> => {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  if (isOnline) {
    const customerRef = doc(db, "customers", customerId);
    await deleteDoc(customerRef);
  }

  // Update local cache
  const cacheKey = cacheKeys.customers(ownerId);
  const current = getCachedEvenStale<Customer[]>(cacheKey) || [];
  setCached(
    cacheKey,
    current.filter((c) => c.id !== customerId)
  );
};

export const receivePayment = async (
  ownerId: string,
  customerId: string,
  amount: number,
  method: CustomerPayment["method"],
  note = "",
  bankId?: string
): Promise<void> => {
  if (!(amount > 0)) throw new Error(tr("closing_errAmountPositive"));

  const customerRef = doc(db, "customers", customerId);
  const paymentRef = doc(collection(db, "payments"));
  const bankRef = method === "Bank Account" && bankId ? doc(db, "banks", bankId) : null;
  const bankTxRef = bankRef ? doc(collection(db, "bank_transactions")) : null;
  let bankName = "";

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(customerRef);
    const bankSnap = bankRef ? await transaction.get(bankRef) : null;
    if (!snap.exists()) throw new Error(tr("closing_errCustomerNotFound"));
    const customer = snap.data() as Customer;

    const newBalance = Math.round((customer.balance - amount) * 100) / 100;
    const now = new Date().toISOString();
    transaction.update(customerRef, { balance: newBalance });

    if (bankRef && bankTxRef && bankSnap?.exists()) {
      const bank = bankSnap.data() as BankAccount;
      const newBankBalance = Math.round(((bank.currentBalance || 0) + amount) * 100) / 100;
      bankName = bank.bankName;
      transaction.update(bankRef, { currentBalance: newBankBalance, updatedAt: now });
      transaction.set(bankTxRef, {
        id: bankTxRef.id,
        ownerId,
        bankId: bankRef.id,
        bankName,
        type: "deposit",
        amount,
        date: now,
        customerName: customer.name,
        customerId,
        description: note.trim() || `Collection from ${customer.name}`,
        balanceAfter: newBankBalance,
        createdAt: now,
      });
    }

    transaction.set(paymentRef, {
      ownerId,
      customerId,
      customerName: customer.name,
      amount,
      method,
      ...(bankRef && bankName ? { bankId: bankRef.id, bankName } : {}),
      note: note.trim(),
      date: now,
    });
  });

  if (bankRef) {
    invalidateCache(cacheKeys.banks(ownerId));
    invalidateCache(cacheKeys.bankTransactions(ownerId, bankRef.id));
    invalidateCache(cacheKeys.bankTransactions(ownerId));
  }

  // Update customer balance in cache
  const cacheKey = cacheKeys.customers(ownerId);
  const current = getCachedEvenStale<Customer[]>(cacheKey);
  if (current) {
    setCached(
      cacheKey,
      current.map((c) =>
        c.id === customerId ? { ...c, balance: Math.round((c.balance - amount) * 100) / 100 } : c
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

export const recordCustomerWithdrawal = async (
  ownerId: string,
  customerId: string,
  amount: number,
  note = ""
): Promise<{ invoiceNo: string; newBalance: number; date: string }> => {
  if (!(amount > 0)) throw new Error(tr("closing_errAmountPositive") || "Amount must be greater than zero");

  const customerRef = doc(db, "customers", customerId);
  const shopRef = doc(db, "users", ownerId);
  const saleRef = doc(collection(db, "sales"));
  let invoiceNo = "";
  let newBalance = 0;
  const now = new Date().toISOString();

  await runTransaction(db, async (transaction) => {
    const customerSnap = await transaction.get(customerRef);
    if (!customerSnap.exists()) throw new Error(tr("closing_errCustomerNotFound") || "Customer not found");
    const customer = customerSnap.data() as Customer;

    const shopSnap = await transaction.get(shopRef);
    const nextInvoice = ((shopSnap.data()?.invoiceCounter as number | undefined) || 0) + 1;
    invoiceNo = String(nextInvoice).padStart(6, "0");

    newBalance = Math.round(((customer.balance || 0) + amount) * 100) / 100;

    transaction.update(customerRef, { balance: newBalance });
    transaction.set(shopRef, { invoiceCounter: nextInvoice }, { merge: true });

    const cleanItem = {
      id: "withdrawal",
      name: note.trim() || "Cash Withdrawal",
      qty: 1,
      price: amount,
      buyingPrice: 0,
      total: amount,
    };

    const saleData = {
      ownerId,
      items: [cleanItem],
      totalAmount: amount,
      date: now,
      customerName: customer.name,
      customerId: customer.id,
      description: note.trim() || "Cash Withdrawal from Ledger",
      invoiceNo,
      paymentMethod: "Udhar" as const,
    };

    transaction.set(saleRef, saleData);
  });

  // Update customer balance in cache
  const cacheKey = cacheKeys.customers(ownerId);
  const current = getCachedEvenStale<Customer[]>(cacheKey);
  if (current) {
    setCached(
      cacheKey,
      current.map((c) =>
        c.id === customerId ? { ...c, balance: newBalance } : c
      )
    );
  }

  // Update sales cache optimistically
  const salesKey = cacheKeys.sales(ownerId);
  const currentSales = getCachedEvenStale<Sale[]>(salesKey);
  if (currentSales) {
    const customerSnap = current?.find((c) => c.id === customerId);
    const saleRecord: Sale = {
      id: saleRef.id,
      ownerId,
      items: [{
        id: "withdrawal",
        name: note.trim() || "Cash Withdrawal",
        qty: 1,
        price: amount,
        buyingPrice: 0,
        total: amount,
      }],
      totalAmount: amount,
      date: now,
      customerName: customerSnap?.name || "Customer",
      customerId,
      description: note.trim() || "Cash Withdrawal from Ledger",
      invoiceNo,
      paymentMethod: "Udhar",
    };
    setCached(salesKey, [saleRecord, ...currentSales]);
  } else {
    invalidateCache(salesKey);
  }

  return { invoiceNo, newBalance, date: now };
};
