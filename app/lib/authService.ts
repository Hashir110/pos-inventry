import type { User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { NewShopDetails, Shop } from "../types";

/**
 * User ka shop profile. null = naya user (setup page par bhejo).
 * Network/permission error par throw karta hai (null nahi), warna offline refresh par
 * purana user bhi "naya user" samajh kar /setup par chala jata.
 */
export const getUserShopProfile = async (uid: string): Promise<Shop | null> => {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as Shop) : null;
};

/** Naya shop banao */
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
    return newShop;
  } catch (error) {
    console.error("Error creating shop:", error);
    throw error;
  }
};
