import type { User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { NewShopDetails, Shop } from "../types";
import { cacheKeys, getCached, getCachedEvenStale, setCached } from "./services/offlineStorage";

export const getUserShopProfile = async (uid: string, forceRefresh = false): Promise<Shop | null> => {
  const cacheKey = cacheKeys.shop(uid);
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  if (!forceRefresh) {
    const cached = isOnline ? getCached<Shop>(cacheKey) : getCachedEvenStale<Shop>(cacheKey);
    if (cached) return cached;
  }

  if (!isOnline) {
    return getCachedEvenStale<Shop>(cacheKey);
  }

  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      const data = snap.data() as Shop;
      setCached(cacheKey, data);
      return data;
    }
    return null;
  } catch (error) {
    console.warn("[authService] Failed to fetch shop profile from Firebase, trying stale cache:", error);
    const stale = getCachedEvenStale<Shop>(cacheKey);
    if (stale) return stale;
    throw error;
  }
};

export const createShopProfile = async (user: User, details: NewShopDetails): Promise<Shop> => {
  const newShop: Shop = {
    uid: user.uid,
    email: user.email,
    shopName: details.shopName,
    businessType: details.businessType,
    currency: "PKR",
    createdAt: details.createdAt || new Date().toISOString(),
    licenseExpiry: details.licenseExpiry,
  };

  try {
    await setDoc(doc(db, "users", user.uid), newShop);
    setCached(cacheKeys.shop(user.uid), newShop);
    return newShop;
  } catch (error) {
    console.error("Error creating shop:", error);
    throw error;
  }
};

