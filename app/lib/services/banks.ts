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
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import type { BankAccount, BankTransaction } from "../../types";
import {
  cacheKeys,
  getCached,
  getCachedEvenStale,
  setCached,
  invalidateCache,
} from "./offlineStorage";

export interface CreateBankInput {
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  branchName?: string;
  initialBalance?: number;
}

export const listBankAccounts = async (
  ownerId: string,
  forceRefresh = false
): Promise<BankAccount[]> => {
  const cacheKey = cacheKeys.banks(ownerId);
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  if (!forceRefresh) {
    const cached = isOnline
      ? getCached<BankAccount[]>(cacheKey)
      : getCachedEvenStale<BankAccount[]>(cacheKey);
    if (cached && cached.length >= 0) return cached;
  }

  if (!isOnline) {
    return getCachedEvenStale<BankAccount[]>(cacheKey) || [];
  }

  try {
    const snap = await getDocs(
      query(collection(db, "banks"), where("ownerId", "==", ownerId))
    );
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as BankAccount)
      .sort((a, b) => a.bankName.localeCompare(b.bankName));

    setCached(cacheKey, items);
    return items;
  } catch (error) {
    console.warn("[banks] Failed to fetch bank accounts, using offline cache:", error);
    const stale = getCachedEvenStale<BankAccount[]>(cacheKey);
    if (stale) return stale;
    throw error;
  }
};

export const getBankAccount = async (bankId: string): Promise<BankAccount | null> => {
  try {
    const snap = await getDoc(doc(db, "banks", bankId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as BankAccount;
  } catch (err) {
    console.error("[banks] Error getting bank account:", err);
    return null;
  }
};

export const createBankAccount = async (
  ownerId: string,
  input: CreateBankInput
): Promise<BankAccount> => {
  const bankRef = doc(collection(db, "banks"));
  const initialBal = Number(input.initialBalance) || 0;
  const now = new Date().toISOString();

  const newBank: BankAccount = {
    id: bankRef.id,
    ownerId,
    bankName: input.bankName.trim(),
    accountTitle: input.accountTitle.trim(),
    accountNumber: input.accountNumber.trim(),
    branchName: input.branchName?.trim() || "",
    currentBalance: initialBal,
    initialBalance: initialBal,
    createdAt: now,
  };

  await runTransaction(db, async (tx) => {
    tx.set(bankRef, newBank);

    if (initialBal > 0) {
      const txRef = doc(collection(db, "bank_transactions"));
      const openingTx: BankTransaction = {
        id: txRef.id,
        ownerId,
        bankId: bankRef.id,
        bankName: newBank.bankName,
        type: "deposit",
        amount: initialBal,
        date: now,
        description: "Opening / Initial Balance",
        balanceAfter: initialBal,
        createdAt: now,
      };
      tx.set(txRef, openingTx);
    }
  });

  // Update local cache
  const cacheKey = cacheKeys.banks(ownerId);
  const cached = getCachedEvenStale<BankAccount[]>(cacheKey) || [];
  setCached(cacheKey, [...cached, newBank]);
  invalidateCache(cacheKeys.bankTransactions(ownerId, bankRef.id));
  invalidateCache(cacheKeys.bankTransactions(ownerId));

  return newBank;
};

export const updateBankAccount = async (
  bankId: string,
  ownerId: string,
  updates: Partial<Pick<BankAccount, "bankName" | "accountTitle" | "accountNumber" | "branchName">>
): Promise<void> => {
  const bankRef = doc(db, "banks", bankId);
  await updateDoc(bankRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });

  const cacheKey = cacheKeys.banks(ownerId);
  const cached = getCachedEvenStale<BankAccount[]>(cacheKey);
  if (cached) {
    setCached(
      cacheKey,
      cached.map((b) => (b.id === bankId ? { ...b, ...updates } : b))
    );
  }
};

export const deleteBankAccount = async (bankId: string, ownerId: string): Promise<void> => {
  const bankRef = doc(db, "banks", bankId);
  await deleteDoc(bankRef);

  const cacheKey = cacheKeys.banks(ownerId);
  const cached = getCachedEvenStale<BankAccount[]>(cacheKey);
  if (cached) {
    setCached(cacheKey, cached.filter((b) => b.id !== bankId));
  }
};

export const listBankTransactions = async (
  ownerId: string,
  bankId?: string,
  limitCount = 200,
  forceRefresh = false
): Promise<BankTransaction[]> => {
  const cacheKey = cacheKeys.bankTransactions(ownerId, bankId);
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  if (!forceRefresh) {
    const cached = isOnline
      ? getCached<BankTransaction[]>(cacheKey)
      : getCachedEvenStale<BankTransaction[]>(cacheKey);
    if (cached) return cached;
  }

  if (!isOnline) {
    return getCachedEvenStale<BankTransaction[]>(cacheKey) || [];
  }

  try {
    let q = query(
      collection(db, "bank_transactions"),
      where("ownerId", "==", ownerId),
      orderBy("date", "desc"),
      limit(limitCount)
    );

    if (bankId) {
      q = query(
        collection(db, "bank_transactions"),
        where("ownerId", "==", ownerId),
        where("bankId", "==", bankId),
        orderBy("date", "desc"),
        limit(limitCount)
      );
    }

    const snap = await getDocs(q);
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BankTransaction);
    setCached(cacheKey, items);
    return items;
  } catch (error) {
    console.warn("[banks] Failed to list transactions:", error);
    const stale = getCachedEvenStale<BankTransaction[]>(cacheKey);
    if (stale) return stale;
    return [];
  }
};

export const recordManualBankTransaction = async (
  ownerId: string,
  bankId: string,
  type: "deposit" | "withdrawal",
  amount: number,
  description?: string
): Promise<BankTransaction> => {
  if (amount <= 0) throw new Error("Amount must be greater than zero");

  const bankRef = doc(db, "banks", bankId);
  const txRef = doc(collection(db, "bank_transactions"));
  const now = new Date().toISOString();
  let createdTx: BankTransaction | null = null;

  await runTransaction(db, async (tx) => {
    const bankSnap = await tx.get(bankRef);
    if (!bankSnap.exists()) throw new Error("Bank account not found");
    const bank = bankSnap.data() as BankAccount;

    const currentBal = bank.currentBalance || 0;
    const newBal =
      type === "deposit"
        ? Math.round((currentBal + amount) * 100) / 100
        : Math.round((currentBal - amount) * 100) / 100;

    tx.update(bankRef, {
      currentBalance: newBal,
      updatedAt: now,
    });

    createdTx = {
      id: txRef.id,
      ownerId,
      bankId,
      bankName: bank.bankName,
      type,
      amount: Math.round(amount * 100) / 100,
      date: now,
      description: description?.trim() || (type === "deposit" ? "Manual Deposit" : "Manual Withdrawal"),
      balanceAfter: newBal,
      createdAt: now,
    };

    tx.set(txRef, createdTx);
  });

  if (!createdTx) throw new Error("Transaction failed");

  // Invalidate caches
  invalidateCache(cacheKeys.banks(ownerId));
  invalidateCache(cacheKeys.bankTransactions(ownerId, bankId));
  invalidateCache(cacheKeys.bankTransactions(ownerId));

  return createdTx;
};
