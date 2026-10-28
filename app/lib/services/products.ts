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
import { tr } from "../i18n/translate";
import {
  cacheKeys,
  getCached,
  getCachedEvenStale,
  setCached,
} from "./offlineStorage";

export interface ProductInput {
  name: string;
  buyingPrice: number;
  sellingPrice: number;
  stock: number;
  gudamStock?: number;
  shopStock?: number;
  unitType: UnitType;
  weightPerBag?: number;
  category?: string;
}

const mapProductDoc = (d: { id: string; data: () => Record<string, any>; ref?: any }): Product => {
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
};

export const listProducts = async (ownerId: string, forceRefresh = false): Promise<Product[]> => {
  const cacheKey = cacheKeys.products(ownerId);
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  if (!forceRefresh) {
    const cached = isOnline ? getCached<Product[]>(cacheKey) : getCachedEvenStale<Product[]>(cacheKey);
    if (cached && cached.length >= 0) return cached;
  }

  if (!isOnline) {
    return getCachedEvenStale<Product[]>(cacheKey) || [];
  }

  try {
    const snap = await getDocs(query(collection(db, "products"), where("ownerId", "==", ownerId)));
    const items = snap.docs.map(mapProductDoc);
    items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    setCached(cacheKey, items);
    return items;
  } catch (error) {
    console.warn("[products] Failed to fetch from Firebase, using offline cache:", error);
    const stale = getCachedEvenStale<Product[]>(cacheKey);
    if (stale) return stale;
    throw error;
  }
};

export const getProduct = async (id: string, ownerId?: string): Promise<Product | null> => {
  if (ownerId) {
    const cached = getCachedEvenStale<Product[]>(cacheKeys.products(ownerId));
    const found = cached?.find((p) => p.id === id);
    if (found) return found;
  }

  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (!isOnline) return null;

  const snap = await getDoc(doc(db, "products", id));
  if (!snap.exists()) return null;
  return mapProductDoc({ id: snap.id, data: () => snap.data() });
};

export const addProduct = async (ownerId: string, input: ProductInput): Promise<string> => {
  const gudamStock = input.gudamStock ?? 0;
  const shopStock = input.shopStock ?? input.stock ?? 0;
  const totalStock = gudamStock + shopStock;
  const createdAt = new Date().toISOString();

  const ref = await addDoc(collection(db, "products"), {
    ...input,
    gudamStock,
    shopStock,
    stock: totalStock,
    category: input.category?.trim() || "",
    ownerId,
    createdAt,
  });

  // Optimistically update cache
  const cacheKey = cacheKeys.products(ownerId);
  const current = getCachedEvenStale<Product[]>(cacheKey) || [];
  const newProduct: Product = {
    id: ref.id,
    ownerId,
    ...input,
    gudamStock,
    shopStock,
    stock: totalStock,
    category: input.category?.trim() || "",
    createdAt,
  };
  setCached(cacheKey, [newProduct, ...current]);

  return ref.id;
};

export const updateProduct = async (id: string, input: ProductInput, ownerId?: string): Promise<void> => {
  const gudamStock = input.gudamStock ?? 0;
  const shopStock = input.shopStock ?? input.stock ?? 0;
  const totalStock = gudamStock + shopStock;
  const updatedAt = new Date().toISOString();

  const productRef = doc(db, "products", id);
  let resolvedOwnerId = ownerId;

  if (!resolvedOwnerId) {
    try {
      const snap = await getDoc(productRef);
      if (snap.exists()) {
        resolvedOwnerId = snap.data().ownerId;
      }
    } catch (e) {
      // ignore
    }
  }

  await updateDoc(productRef, {
    ...input,
    gudamStock,
    shopStock,
    stock: totalStock,
    category: input.category?.trim() || "",
    updatedAt,
  });

  if (resolvedOwnerId) {
    const cacheKey = cacheKeys.products(resolvedOwnerId);
    const current = getCachedEvenStale<Product[]>(cacheKey) || [];
    const updatedProduct = {
      id,
      ownerId: resolvedOwnerId,
      ...input,
      gudamStock,
      shopStock,
      stock: totalStock,
      category: input.category?.trim() || "",
      updatedAt,
    } as Product;

    const exists = current.some((p) => p.id === id);
    if (exists) {
      setCached(
        cacheKey,
        current.map((p) => (p.id === id ? { ...p, ...updatedProduct } : p))
      );
    } else {
      setCached(cacheKey, [updatedProduct, ...current]);
    }
  }
};

export const deleteProduct = async (id: string, ownerId?: string): Promise<void> => {
  const productRef = doc(db, "products", id);
  let resolvedOwnerId = ownerId;

  if (!resolvedOwnerId) {
    try {
      const snap = await getDoc(productRef);
      if (snap.exists()) {
        resolvedOwnerId = snap.data().ownerId;
      }
    } catch (e) {
      // ignore
    }
  }

  await deleteDoc(productRef);
  if (resolvedOwnerId) {
    const cacheKey = cacheKeys.products(resolvedOwnerId);
    const current = getCachedEvenStale<Product[]>(cacheKey) || [];
    setCached(cacheKey, current.filter((p) => p.id !== id));
  }
};

export const transferStock = async (
  productId: string,
  qty: number,
  fromLocation: "gudam" | "shop",
  toLocation: "gudam" | "shop",
  ownerId?: string
): Promise<void> => {
  const product = await getProduct(productId, ownerId);
  if (!product) throw new Error(tr("inv_err_productNotFound"));
  if (qty <= 0) throw new Error(tr("inv_err_qtyPositive"));

  let currentGudam = product.gudamStock ?? 0;
  let currentShop = product.shopStock ?? product.stock ?? 0;

  if (fromLocation === "gudam") {
    if (currentGudam < qty) throw new Error(tr("inv_err_noWarehouseStock"));
    currentGudam -= qty;
    currentShop += qty;
  } else {
    if (currentShop < qty) throw new Error(tr("inv_err_noShopStock"));
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

  if (ownerId || product.ownerId) {
    const oid = ownerId || product.ownerId;
    const cacheKey = cacheKeys.products(oid);
    const current = getCachedEvenStale<Product[]>(cacheKey) || [];
    setCached(
      cacheKey,
      current.map((p) => (p.id === productId ? { ...p, gudamStock: currentGudam, shopStock: currentShop, stock: totalStock } : p))
    );
  }
};

export const countLowStock = async (ownerId: string, threshold = 5): Promise<number> => {
  const cached = getCachedEvenStale<Product[]>(cacheKeys.products(ownerId));
  if (cached && cached.length > 0) {
    return cached.filter((p) => p.stock < threshold).length;
  }
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (!isOnline) return 0;

  const snap = await getDocs(
    query(collection(db, "products"), where("ownerId", "==", ownerId), where("stock", "<", threshold))
  );
  return snap.size;
};

export const subscribeProducts = (
  ownerId: string,
  onData: (products: Product[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const cacheKey = cacheKeys.products(ownerId);
  // Emit cached products instantly to eliminate blank UI & loading lag
  const cached = getCachedEvenStale<Product[]>(cacheKey);
  if (cached && cached.length > 0) {
    onData(cached);
  }

  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (!isOnline) {
    return () => {};
  }

  return onSnapshot(
    query(collection(db, "products"), where("ownerId", "==", ownerId)),
    (snap) => {
      const items = snap.docs.map(mapProductDoc);
      items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
      setCached(cacheKey, items);
      onData(items);
    },
    (err) => {
      console.warn("Product listener error/warning:", err.message);
      if (onError) onError(err);
    }
  );
};

