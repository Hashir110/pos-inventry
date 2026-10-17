import { collection, doc, getDocs, query, setDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import type { DayClosing } from "../../types";

export type DayClosingInput = Omit<DayClosing, "id" | "ownerId" | "closedAt">;

export const listDayClosings = async (ownerId: string): Promise<DayClosing[]> => {
  const snap = await getDocs(query(collection(db, "day_closings"), where("ownerId", "==", ownerId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as DayClosing)
    .sort((a, b) => b.date.localeCompare(a.date));
};

export const saveDayClosing = async (ownerId: string, input: DayClosingInput): Promise<DayClosing> => {
  const id = `${ownerId}_${input.date}`;
  const data = { ...input, ownerId, closedAt: new Date().toISOString() };
  await setDoc(doc(db, "day_closings", id), data);
  return { id, ...data };
};