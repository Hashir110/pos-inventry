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

export interface ExpenseInput {
  title: string;
  amount: number;
  category: string;
}

/** Naye pehle */
export const listExpenses = async (ownerId: string): Promise<Expense[]> => {
  const snap = await getDocs(
    query(collection(db, "expenses"), where("ownerId", "==", ownerId), orderBy("date", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense);
};

export const subscribeExpenses = (
  ownerId: string,
  onData: (expenses: Expense[]) => void
): (() => void) =>
  onSnapshot(
    query(collection(db, "expenses"), where("ownerId", "==", ownerId)),
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense);
      onData(items);
    }
  );

/** `fromIso` se (aur agar diya ho to `toIso` tak) ke kharche */
export const listExpensesInRange = async (
  ownerId: string,
  fromIso: string,
  toIso?: string
): Promise<Expense[]> => {
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
};

export const addExpense = async (ownerId: string, input: ExpenseInput): Promise<void> => {
  await addDoc(collection(db, "expenses"), { ...input, ownerId, date: new Date().toISOString() });
};

export const deleteExpense = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, "expenses", id));
};
