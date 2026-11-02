import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { addStock } from "../stock";
import type { Supplier, SupplierPurchase, SupplierPayment, Product, BankAccount } from "../../types";
import {
  cacheKeys,
  getCached,
  getCachedEvenStale,
  invalidateCache,
  setCached,
} from "./offlineStorage";

export const listSuppliers = async (ownerId: string, forceRefresh = false): Promise<Supplier[]> => {
  const cacheKey = cacheKeys.suppliers(ownerId);
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  if (!forceRefresh) {
    const cached = isOnline ? getCached<Supplier[]>(cacheKey) : getCachedEvenStale<Supplier[]>(cacheKey);
    if (cached && cached.length >= 0) return cached;
  }

  if (!isOnline) {
    return getCachedEvenStale<Supplier[]>(cacheKey) || [];
  }

  try {
    const snap = await getDocs(
      query(collection(db, "suppliers"), where("ownerId", "==", ownerId))
    );
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Supplier);
    items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    setCached(cacheKey, items);
    return items;
  } catch (err) {
    console.warn("[suppliers] Failed to fetch suppliers, using offline cache:", err);
    return getCachedEvenStale<Supplier[]>(cacheKey) || [];
  }
};

export const subscribeSuppliers = (
  ownerId: string,
  onData: (suppliers: Supplier[]) => void
): (() => void) => {
  const cacheKey = cacheKeys.suppliers(ownerId);
  const cached = getCachedEvenStale<Supplier[]>(cacheKey);
  if (cached && cached.length > 0) {
    onData(cached);
  }

  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (!isOnline) {
    return () => {};
  }

  return onSnapshot(
    query(collection(db, "suppliers"), where("ownerId", "==", ownerId)),
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Supplier);
      items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
      setCached(cacheKey, items);
      onData(items);
    },
    (err) => {
      console.warn("Suppliers listener warning/permission issue:", err.message);
    }
  );
};

export const addSupplier = async (
  ownerId: string,
  data: { name: string; phone?: string; address?: string }
): Promise<string> => {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  const newObj = {
    ownerId,
    name: data.name.trim(),
    phone: data.phone?.trim() || "",
    address: data.address?.trim() || "",
    balance: 0,
    createdAt: new Date().toISOString(),
  };

  let id = `local_sup_${Date.now()}`;
  if (isOnline) {
    const ref = await addDoc(collection(db, "suppliers"), newObj);
    id = ref.id;
  }

  const cacheKey = cacheKeys.suppliers(ownerId);
  const current = getCachedEvenStale<Supplier[]>(cacheKey) || [];
  setCached(cacheKey, [{ id, ...newObj }, ...current]);

  return id;
};

export const updateSupplier = async (
  id: string,
  data: { name: string; phone?: string; address?: string },
  ownerId?: string
): Promise<void> => {
  await updateDoc(doc(db, "suppliers", id), {
    name: data.name.trim(),
    phone: data.phone?.trim() || "",
    address: data.address?.trim() || "",
    updatedAt: new Date().toISOString(),
  });

  if (ownerId) {
    const cacheKey = cacheKeys.suppliers(ownerId);
    const current = getCachedEvenStale<Supplier[]>(cacheKey);
    if (current) {
      setCached(cacheKey, current.map((s) => (s.id === id ? { ...s, ...data } : s)));
    }
  }
};

export const deleteSupplier = async (id: string, ownerId?: string): Promise<void> => {
  await deleteDoc(doc(db, "suppliers", id));
  if (ownerId) {
    const cacheKey = cacheKeys.suppliers(ownerId);
    const current = getCachedEvenStale<Supplier[]>(cacheKey);
    if (current) {
      setCached(cacheKey, current.filter((s) => s.id !== id));
    }
  }
};

export const addSupplierPurchase = async (
  ownerId: string,
  purchase: {
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
      destination?: "gudam" | "shop";
      destinationLocation?: "gudam" | "shop";
      total?: number;
    }>;
    totalAmount: number;
    paidAmount?: number;
    destination?: "gudam" | "shop";
  }


): Promise<string> => {
  const purchaseRef = await addDoc(collection(db, "supplier_purchases"), {
    ownerId,
    ...purchase,
    date: new Date().toISOString(),
  });

  const unpaid = purchase.totalAmount - (purchase.paidAmount || 0);

  if (unpaid !== 0) {
    const suppliersSnap = await getDocs(
      query(collection(db, "suppliers"), where("ownerId", "==", ownerId))
    );
    const targetSupplier = suppliersSnap.docs.find((d) => d.id === purchase.supplierId);
    if (targetSupplier) {
      const currentBalance = targetSupplier.data().balance || 0;
      const newBal = Math.round((currentBalance + unpaid) * 100) / 100;
      await updateDoc(doc(db, "suppliers", purchase.supplierId), {
        balance: newBal,
      });

      // Update local supplier cache
      const cacheKey = cacheKeys.suppliers(ownerId);
      const current = getCachedEvenStale<Supplier[]>(cacheKey);
      if (current) {
        setCached(
          cacheKey,
          current.map((s) => (s.id === purchase.supplierId ? { ...s, balance: newBal } : s))
        );
      }
    }
  }

  for (const item of purchase.items) {
    if (item.productId) {
      const prodSnap = await getDocs(
        query(collection(db, "products"), where("ownerId", "==", ownerId))
      );
      const targetProd = prodSnap.docs.find((d) => d.id === item.productId);
      if (targetProd) {
        const data = targetProd.data();
        const dest = (item as any).destinationLocation || (item as any).destination || (purchase as any).destination || "gudam";
        const currentShop = data.shopStock ?? 0;
        const currentGudam = data.gudamStock ?? 0;
        const { shopStock: newShop, gudamStock: newGudam } = addStock(
          { shopStock: currentShop, gudamStock: currentGudam },
          item.qty,
          dest === "shop" ? "shop" : "gudam"
        );
        const newTotal = newShop + newGudam;

        await updateDoc(doc(db, "products", item.productId), {
          stock: newTotal,
          shopStock: newShop,
          gudamStock: newGudam,
          buyingPrice: item.buyingPrice,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  // Update local product cache
  const prodsKey = cacheKeys.products(ownerId);
  const cachedProds = getCachedEvenStale<Product[]>(prodsKey);
  if (cachedProds) {
    const updated = cachedProds.map((p) => {
      const it = purchase.items.find((pi) => pi.productId === p.id);
      if (!it) return p;
      const dest = (it as any).destinationLocation || (it as any).destination || (purchase as any).destination || "gudam";
      const { shopStock: newShop, gudamStock: newGudam } = addStock(
        { shopStock: p.shopStock ?? 0, gudamStock: p.gudamStock ?? 0 },
        it.qty,
        dest === "shop" ? "shop" : "gudam"
      );
      return {
        ...p,
        stock: newShop + newGudam,
        shopStock: newShop,
        gudamStock: newGudam,
        buyingPrice: it.buyingPrice,
      };
    });
    setCached(prodsKey, updated);
  }

  return purchaseRef.id;
};

export const addSupplierPayment = async (
  ownerId: string,
  payment: {
    supplierId: string;
    supplierName: string;
    amount: number;
    method: "Cash" | "Bank Account";
    note?: string;
    bankId?: string;
    date?: string;
  }
): Promise<string> => {
  if (payment.amount <= 0) {
    throw new Error("Payment amount must be greater than zero");
  }

  const suppliersSnap = await getDocs(
    query(collection(db, "suppliers"), where("ownerId", "==", ownerId))
  );
  const targetSupplier = suppliersSnap.docs.find((d) => d.id === payment.supplierId);
  if (!targetSupplier) throw new Error("Supplier not found");

  const currentBalance = targetSupplier.data().balance || 0;
  const newBalance = Math.round((currentBalance - payment.amount) * 100) / 100;
  const paymentDate = payment.date || new Date().toISOString();

  const bankRef = payment.method === "Bank Account" && payment.bankId ? doc(db, "banks", payment.bankId) : null;
  const bankTxRef = bankRef ? doc(collection(db, "bank_transactions")) : null;
  let bankName = "";

  const ref = doc(collection(db, "supplier_payments"));

  if (bankRef && bankTxRef) {
    await runTransaction(db, async (transaction) => {
      const bankSnap = await transaction.get(bankRef);
      if (!bankSnap.exists()) throw new Error("Bank account not found");
      const bank = bankSnap.data() as BankAccount;
      bankName = bank.bankName;
      const newBankBalance = Math.round(((bank.currentBalance || 0) - payment.amount) * 100) / 100;

      transaction.update(bankRef, { currentBalance: newBankBalance, updatedAt: paymentDate });
      transaction.set(bankTxRef, {
        id: bankTxRef.id,
        ownerId,
        bankId: bankRef.id,
        bankName,
        type: "withdrawal",
        amount: payment.amount,
        date: paymentDate,
        supplierId: payment.supplierId,
        supplierName: payment.supplierName,
        description: payment.note?.trim() || `Supplier Payment: ${payment.supplierName}`,
        balanceAfter: newBankBalance,
        createdAt: paymentDate,
      });

      transaction.set(ref, {
        ownerId,
        supplierId: payment.supplierId,
        supplierName: payment.supplierName,
        amount: payment.amount,
        method: payment.method,
        note: payment.note || "",
        bankId: bankRef.id,
        bankName,
        date: paymentDate,
      });

      transaction.update(doc(db, "suppliers", payment.supplierId), {
        balance: newBalance,
      });
    });

    invalidateCache(cacheKeys.banks(ownerId));
    invalidateCache(cacheKeys.bankTransactions(ownerId, bankRef.id));
    invalidateCache(cacheKeys.bankTransactions(ownerId));
  } else {
    await setDoc(ref, {
      ownerId,
      supplierId: payment.supplierId,
      supplierName: payment.supplierName,
      amount: payment.amount,
      method: payment.method,
      note: payment.note || "",
      date: paymentDate,
    });

    await updateDoc(doc(db, "suppliers", payment.supplierId), {
      balance: newBalance,
    });
  }

  // Update local cache for suppliers
  const cacheKey = cacheKeys.suppliers(ownerId);
  const current = getCachedEvenStale<Supplier[]>(cacheKey);
  if (current) {
    setCached(
      cacheKey,
      current.map((s) => (s.id === payment.supplierId ? { ...s, balance: newBalance } : s))
    );
  }

  // Update local cache for supplier payments so daily closing and dashboard reflect immediately
  const payCacheKey = cacheKeys.supplierPayments(ownerId);
  const currentPayments = getCachedEvenStale<SupplierPayment[]>(payCacheKey);
  const newPaymentRecord: SupplierPayment = {
    id: ref.id,
    ownerId,
    supplierId: payment.supplierId,
    supplierName: payment.supplierName,
    amount: payment.amount,
    method: payment.method,
    note: payment.note || "",
    ...(bankName ? { bankId: payment.bankId, bankName } : {}),
    date: paymentDate,
  };
  if (currentPayments) {
    setCached(payCacheKey, [newPaymentRecord, ...currentPayments]);
  } else {
    invalidateCache(payCacheKey);
  }

  return ref.id;
};

export const listSupplierPurchases = async (ownerId: string, forceRefresh = false): Promise<SupplierPurchase[]> => {
  const cacheKey = cacheKeys.supplierPurchases(ownerId);
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  if (!forceRefresh) {
    const cached = isOnline ? getCached<SupplierPurchase[]>(cacheKey) : getCachedEvenStale<SupplierPurchase[]>(cacheKey);
    if (cached) return cached;
  }

  if (!isOnline) {
    return getCachedEvenStale<SupplierPurchase[]>(cacheKey) || [];
  }

  try {
    const snap = await getDocs(
      query(collection(db, "supplier_purchases"), where("ownerId", "==", ownerId))
    );
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SupplierPurchase);
    items.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    setCached(cacheKey, items);
    return items;
  } catch {
    return getCachedEvenStale<SupplierPurchase[]>(cacheKey) || [];
  }
};

export const listSupplierPayments = async (ownerId: string, forceRefresh = false): Promise<SupplierPayment[]> => {
  const cacheKey = cacheKeys.supplierPayments(ownerId);
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  if (!forceRefresh) {
    const cached = isOnline ? getCached<SupplierPayment[]>(cacheKey) : getCachedEvenStale<SupplierPayment[]>(cacheKey);
    if (cached) return cached;
  }

  if (!isOnline) {
    return getCachedEvenStale<SupplierPayment[]>(cacheKey) || [];
  }

  try {
    const snap = await getDocs(
      query(collection(db, "supplier_payments"), where("ownerId", "==", ownerId))
    );
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SupplierPayment);
    items.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    setCached(cacheKey, items);
    return items;
  } catch {
    return getCachedEvenStale<SupplierPayment[]>(cacheKey) || [];
  }
};
