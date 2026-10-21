import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { Shop } from "../../types";

export type ShopProfileUpdate = Pick<Shop, "shopName" | "contact" | "address" | "receiptMessage">;

export const updateShopProfile = async (uid: string, fields: ShopProfileUpdate): Promise<void> => {
  await setDoc(doc(db, "users", uid), fields, { merge: true });
};
