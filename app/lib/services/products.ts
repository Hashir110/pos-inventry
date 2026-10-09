import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Product, UnitType } from "../../types";

/** Form/DB ke beech ka data (id, ownerId aur timestamps ke baghair) */
export interface ProductInput {
  name: string;
  buyingPrice: number;
  sellingPrice: number;
  stock: number;
  unitType: UnitType;
  category?: string;
}

/** Shop ke saare products, naye pehle */
export const listProducts = async (ownerId: string): Promise<Product[]> => {
  const snap = await getDocs(query(collection(db, "products"), where("ownerId", "==", ownerId)));
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product);
  return items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
};

export const getProduct = async (id: string): Promise<Product | null> => {
  const snap = await getDoc(doc(db, "products", id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Product) : null;
};

export const addProduct = async (ownerId: string, input: ProductInput): Promise<string> => {
  const ref = await addDoc(collection(db, "products"), {
    ...input,
    category: input.category?.trim() || "",
    ownerId,
    createdAt: new Date().toISOString(),
  });
  return ref.id;
};

export const updateProduct = async (id: string, input: ProductInput): Promise<void> => {
  await updateDoc(doc(db, "products", id), {
    ...input,
    category: input.category?.trim() || "",
    updatedAt: new Date().toISOString(),
  });
};

export const deleteProduct = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, "products", id));
};

/** Kitne products ka stock threshold se kam hai (dashboard low-stock card) */
export const countLowStock = async (ownerId: string, threshold = 5): Promise<number> => {
  const snap = await getDocs(
    query(collection(db, "products"), where("ownerId", "==", ownerId), where("stock", "<", threshold))
  );
  return snap.size;
};

/** Live products (stock change turant dikhe). Return: unsubscribe function. */
export const subscribeProducts = (
  ownerId: string,
  onData: (products: Product[]) => void,
  onError?: (error: Error) => void
): (() => void) =>
  onSnapshot(
    query(collection(db, "products"), where("ownerId", "==", ownerId)),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product)),
    onError
  );
