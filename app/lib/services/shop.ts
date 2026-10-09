import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { Shop } from "../../types";

/** Settings se badal sakne wali fields (rules bhi sirf yehi allow karte hain) */
export type ShopProfileUpdate = Pick<Shop, "shopName" | "contact" | "address" | "receiptMessage">;

export const updateShopProfile = async (uid: string, fields: ShopProfileUpdate): Promise<void> => {
  await updateDoc(doc(db, "users", uid), fields);
};
