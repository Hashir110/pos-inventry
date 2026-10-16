import { addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import type { Transport } from "../../types";

export const listTransports = async (ownerId: string): Promise<Transport[]> => {
  const snap = await getDocs(query(collection(db, "transports"), where("ownerId", "==", ownerId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Transport)
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const addTransport = async (ownerId: string, name: string, phone = ""): Promise<Transport> => {
  const data = { ownerId, name: name.trim(), phone: phone.trim(), createdAt: new Date().toISOString() };
  if (!data.name) throw new Error("Transport ka naam likhein");
  const ref = await addDoc(collection(db, "transports"), data);
  return { id: ref.id, ...data };
};
