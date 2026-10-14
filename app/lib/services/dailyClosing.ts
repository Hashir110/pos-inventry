import { collection, doc, getDocs, query, runTransaction, where } from "firebase/firestore";
import { db } from "../firebase";
import type { Customer, DailyClosingEntry } from "../../types";

const roundMoney = (n: number) => Math.round(n * 100) / 100;

export interface ClosingInput {
  type: DailyClosingEntry["type"];
  itemName: string;
  qty: number;
  amount: number;
  customerId?: string;
  note?: string;
}


export const listClosings = async (ownerId: string): Promise<DailyClosingEntry[]> => {
  const snap = await getDocs(query(collection(db, "daily_closings"), where("ownerId", "==", ownerId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as DailyClosingEntry)
    .sort((a, b) => b.date.localeCompare(a.date));
};

export const listCustomerClosings = async (ownerId: string, customerId: string): Promise<DailyClosingEntry[]> => {
  const snap = await getDocs(
    query(collection(db, "daily_closings"), where("ownerId", "==", ownerId), where("customerId", "==", customerId))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as DailyClosingEntry)
    .sort((a, b) => b.date.localeCompare(a.date));
};

export const nextEntryNo = (entries: DailyClosingEntry[]): string => {
  const max = entries.reduce((m, e) => Math.max(m, parseInt(e.entryNo.replace(/\D/g, ""), 10) || 0), 0);
  return `DC-${String(max + 1).padStart(4, "0")}`;
};

export const addClosingEntry = async (
  ownerId: string,
  entryNo: string,
  input: ClosingInput
): Promise<void> => {
  if (!(input.qty > 0)) throw new Error("Qty 0 se zyada honi chahiye");
  if (!(input.amount > 0)) throw new Error("Amount 0 se zyada hona chahiye");
  if (input.type === "Udhar" && !input.customerId) throw new Error("Udhar ke liye party select karein");

  const entryRef = doc(collection(db, "daily_closings"));

  await runTransaction(db, async (transaction) => {
    let customerName = "";
    if (input.type === "Udhar" && input.customerId) {
      const customerRef = doc(db, "customers", input.customerId);
      const snap = await transaction.get(customerRef);
      if (!snap.exists()) throw new Error("Party nahi mili");
      const customer = snap.data() as Customer;
      customerName = customer.name;
      transaction.update(customerRef, { balance: roundMoney((customer.balance || 0) + input.amount) });
    }

    transaction.set(entryRef, {
      ownerId,
      entryNo,
      type: input.type,
      itemName: input.itemName.trim(),
      qty: input.qty,
      amount: input.amount,
      note: (input.note ?? "").trim(),
      date: new Date().toISOString(),
      ...(input.type === "Udhar" ? { customerId: input.customerId, customerName } : {}),
    });
  });
};
