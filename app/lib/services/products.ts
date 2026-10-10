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
  gudamStock?: number;
  shopStock?: number;
  unitType: UnitType;
  category?: string;
}

/** Shop ke saare products, naye pehle */
export const listProducts = async (ownerId: string): Promise<Product[]> => {
  const snap = await getDocs(query(collection(db, "products"), where("ownerId", "==", ownerId)));
  const items = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      gudamStock: data.gudamStock ?? 0,
      shopStock: data.shopStock ?? data.stock ?? 0,
    } as Product;
  });
  return items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
};

export const getProduct = async (id: string): Promise<Product | null> => {
  const snap = await getDoc(doc(db, "products", id));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    ...data,
    gudamStock: data.gudamStock ?? 0,
    shopStock: data.shopStock ?? data.stock ?? 0,
  } as Product;
};

export const addProduct = async (ownerId: string, input: ProductInput): Promise<string> => {
  const gudamStock = input.gudamStock ?? 0;
  const shopStock = input.shopStock ?? input.stock ?? 0;
  const totalStock = gudamStock + shopStock;

  const ref = await addDoc(collection(db, "products"), {
    ...input,
    gudamStock,
    shopStock,
    stock: totalStock,
    category: input.category?.trim() || "",
    ownerId,
    createdAt: new Date().toISOString(),
  });
  return ref.id;
};

export const updateProduct = async (id: string, input: ProductInput): Promise<void> => {
  const gudamStock = input.gudamStock ?? 0;
  const shopStock = input.shopStock ?? input.stock ?? 0;
  const totalStock = gudamStock + shopStock;

  await updateDoc(doc(db, "products", id), {
    ...input,
    gudamStock,
    shopStock,
    stock: totalStock,
    category: input.category?.trim() || "",
    updatedAt: new Date().toISOString(),
  });
};

export const deleteProduct = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, "products", id));
};

/** Stock Transfer between Gudam and Shop */
export const transferStock = async (
  productId: string,
  qty: number,
  fromLocation: "gudam" | "shop",
  toLocation: "gudam" | "shop"
): Promise<void> => {
  const product = await getProduct(productId);
  if (!product) throw new Error("Product not found");
  if (qty <= 0) throw new Error("Quantity must be greater than 0");

  let currentGudam = product.gudamStock ?? 0;
  let currentShop = product.shopStock ?? product.stock ?? 0;

  if (fromLocation === "gudam") {
    if (currentGudam < qty) throw new Error("Insufficient stock in Gudam");
    currentGudam -= qty;
    currentShop += qty;
  } else {
    if (currentShop < qty) throw new Error("Insufficient stock in Shop");
    currentShop -= qty;
    currentGudam += qty;
  }

  const totalStock = currentGudam + currentShop;

  await updateDoc(doc(db, "products", productId), {
    gudamStock: currentGudam,
    shopStock: currentShop,
    stock: totalStock,
    updatedAt: new Date().toISOString(),
  });

  // Log transfer
  await addDoc(collection(db, "stock_transfers"), {
    ownerId: product.ownerId,
    productId,
    productName: product.name,
    qty,
    fromLocation,
    toLocation,
    date: new Date().toISOString(),
  });
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
    (snap) => {
      const items = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          gudamStock: data.gudamStock ?? 0,
          shopStock: data.shopStock ?? data.stock ?? 0,
        } as Product;
      });
      onData(items);
    },
    onError
  );
