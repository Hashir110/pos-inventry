import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Expense } from "../../types";
import {
  cacheKeys,
  getCached,
  getCachedEvenStale,
  setCached,
} from "./offlineStorage";

export interface ExpenseInput {
  title: string;
  amount: number;
  category: string;
}

export const listExpenses = async (ownerId: string, forceRefresh = false): Promise<Expense[]> => {
  const cacheKey = cacheKeys.expenses(ownerId);
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  if (!forceRefresh) {
    const cached = isOnline ? getCached<Expense[]>(cacheKey) : getCachedEvenStale<Expense[]>(cacheKey);
    if (cached && cached.length >= 0) return cached;
  }

  if (!isOnline) {
    return getCachedEvenStale<Expense[]>(cacheKey) || [];
  }

  try {
    const snap = await getDocs(
      query(collection(db, "expenses"), where("ownerId", "==", ownerId), orderBy("date", "desc"))
    );
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense);
    setCached(cacheKey, items);
    return items;
  } catch (err) {
    console.warn("[expenses] Error fetching expenses, using cache:", err);
    return getCachedEvenStale<Expense[]>(cacheKey) || [];
  }
};

export const subscribeExpenses = (
  ownerId: string,
  onData: (expenses: Expense[]) => void
): (() => void) => {
  const cacheKey = cacheKeys.expenses(ownerId);
  const cached = getCachedEvenStale<Expense[]>(cacheKey);
  if (cached && cached.length > 0) {
    onData(cached);
  }

  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (!isOnline) {
    return () => {};
  }

  return onSnapshot(
    query(collection(db, "expenses"), where("ownerId", "==", ownerId)),
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense);
      setCached(cacheKey, items);
      onData(items);
    }
  );
};

export const listExpensesInRange = async (
  ownerId: string,
  fromIso: string,
  toIso?: string,
  forceRefresh = false
): Promise<Expense[]> => {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  const cached = getCachedEvenStale<Expense[]>(cacheKeys.expenses(ownerId));

  if (!isOnline || (!forceRefresh && cached && cached.length > 0)) {
    if (cached && cached.length > 0) {
      return cached.filter((e) => {
        if (e.date < fromIso) return false;
        if (toIso && e.date > toIso) return false;
        return true;
      });
    }
  }

  if (!isOnline) return [];

  try {
    const snap = await getDocs(
      query(
        collection(db, "expenses"),
        where("ownerId", "==", ownerId),
        where("date", ">=", fromIso),
        ...(toIso ? [where("date", "<=", toIso)] : []),
        orderBy("date", "desc")
      )
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense);
  } catch {
    if (cached) {
      return cached.filter((e) => e.date >= fromIso && (!toIso || e.date <= toIso));
    }
    return [];
  }
};

export const addExpense = async (ownerId: string, input: ExpenseInput): Promise<Expense> => {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  const nowIso = new Date().toISOString();
  let id = `local_exp_${Date.now()}`;

  if (isOnline) {
    const ref = await addDoc(collection(db, "expenses"), { ...input, ownerId, date: nowIso });
    id = ref.id;
  }

  const newExp: Expense = { id, ownerId, ...input, date: nowIso };

  // Update local cache
  const cacheKey = cacheKeys.expenses(ownerId);
  const current = getCachedEvenStale<Expense[]>(cacheKey) || [];
  setCached(cacheKey, [newExp, ...current]);

  return newExp;
};

export const deleteExpense = async (id: string, ownerId?: string): Promise<void> => {
  await deleteDoc(doc(db, "expenses", id));
  if (ownerId) {
    const cacheKey = cacheKeys.expenses(ownerId);
    const current = getCachedEvenStale<Expense[]>(cacheKey);
    if (current) {
      setCached(cacheKey, current.filter((e) => e.id !== id));
    }
  }
};
