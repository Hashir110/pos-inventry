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

export const listProducts = async (ownerId: string): Promise<Product[]> => {
  const snap = await getDocs(query(collection(db, "products"), where("ownerId", "==", ownerId)));
  const items = snap.docs.map((d) => {
    const data = d.data();
    const total = data.stock ?? 0;
    const shop = data.shopStock ?? 0;
    const rawGudam = data.gudamStock ?? 0;
    const gudam = (rawGudam + shop > total) ? Math.max(0, total - shop) : rawGudam;
    return {
      id: d.id,
      ...data,
      stock: total,
      gudamStock: gudam,
      shopStock: shop,
    } as Product;
  });
  return items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
};

export const getProduct = async (id: string): Promise<Product | null> => {
  const snap = await getDoc(doc(db, "products", id));
  if (!snap.exists()) return null;
  const data = snap.data();
  const total = data.stock ?? 0;
  const shop = data.shopStock ?? 0;
  const rawGudam = data.gudamStock ?? 0;
  const gudam = (rawGudam + shop > total) ? Math.max(0, total - shop) : rawGudam;
  return {
    id: snap.id,
    ...data,
    stock: total,
    gudamStock: gudam,
    shopStock: shop,
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

export const countLowStock = async (ownerId: string, threshold = 5): Promise<number> => {
  const snap = await getDocs(
    query(collection(db, "products"), where("ownerId", "==", ownerId), where("stock", "<", threshold))
  );
  return snap.size;
};

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
        const total = data.stock ?? 0;
        const shop = data.shopStock ?? 0;
        const rawGudam = data.gudamStock ?? 0;
        const gudam = (rawGudam + shop > total) ? Math.max(0, total - shop) : rawGudam;

        if (rawGudam + shop > total) {
          updateDoc(d.ref, { gudamStock: gudam, updatedAt: new Date().toISOString() }).catch(() => {});
        }

        return {
          id: d.id,
          ...data,
          stock: total,
          gudamStock: gudam,
          shopStock: shop,
        } as Product;
      });
      onData(items);
    },
    onError
  );
