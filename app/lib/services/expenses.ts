import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
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
  date?: string;
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
    let snap;
    try {
      snap = await getDocs(
        query(collection(db, "expenses"), where("ownerId", "==", ownerId), orderBy("date", "desc"))
      );
    } catch {
      snap = await getDocs(
        query(collection(db, "expenses"), where("ownerId", "==", ownerId))
      );
    }
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense);
    items.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
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
      items.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
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
  
  let dateIso = new Date().toISOString();
  if (input.date) {
    const parsed = new Date(input.date);
    if (!isNaN(parsed.getTime())) {
      if (input.date.length === 10) {
        const now = new Date();
        parsed.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      }
      dateIso = parsed.toISOString();
    }
  }

  let id = `local_exp_${Date.now()}`;
  const payload = {
    title: input.title,
    amount: input.amount,
    category: input.category,
    date: dateIso,
    ownerId,
  };

  if (isOnline) {
    const ref = await addDoc(collection(db, "expenses"), payload);
    id = ref.id;
  }

  const newExp: Expense = { id, ...payload };

  // Update local cache
  const cacheKey = cacheKeys.expenses(ownerId);
  const current = getCachedEvenStale<Expense[]>(cacheKey) || [];
  setCached(cacheKey, [newExp, ...current.filter((e) => e.id !== id)]);

  return newExp;
};

export const deleteExpense = async (id: string, ownerId?: string): Promise<void> => {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  let resolvedOwnerId = ownerId;

  const expenseRef = doc(db, "expenses", id);

  if (!resolvedOwnerId && isOnline && !id.startsWith("local_exp_")) {
    try {
      const snap = await getDoc(expenseRef);
      if (snap.exists()) {
        resolvedOwnerId = snap.data().ownerId;
      }
    } catch {
      // ignore
    }
  }

  if (isOnline && !id.startsWith("local_exp_")) {
    await deleteDoc(expenseRef);
  }

  if (resolvedOwnerId) {
    const cacheKey = cacheKeys.expenses(resolvedOwnerId);
    const current = getCachedEvenStale<Expense[]>(cacheKey);
    if (current) {
      setCached(cacheKey, current.filter((e) => e.id !== id));
    }
  }

  if (typeof window !== "undefined") {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("cache_expenses_")) {
          const current = getCachedEvenStale<Expense[]>(key);
          if (current && current.some((e) => e.id === id)) {
            setCached(key, current.filter((e) => e.id !== id));
          }
        }
      }
    } catch {
      // ignore
    }
  }
};
