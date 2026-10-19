import { addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { tr } from "../i18n/translate";
import type { Transport } from "../../types";
import {
  cacheKeys,
  getCached,
  getCachedEvenStale,
  setCached,
} from "./offlineStorage";

export const listTransports = async (ownerId: string, forceRefresh = false): Promise<Transport[]> => {
  const cacheKey = cacheKeys.transports(ownerId);
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  if (!forceRefresh) {
    const cached = isOnline ? getCached<Transport[]>(cacheKey) : getCachedEvenStale<Transport[]>(cacheKey);
    if (cached && cached.length >= 0) return cached;
  }

  if (!isOnline) {
    return getCachedEvenStale<Transport[]>(cacheKey) || [];
  }

  try {
    const snap = await getDocs(query(collection(db, "transports"), where("ownerId", "==", ownerId)));
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Transport)
      .sort((a, b) => a.name.localeCompare(b.name));
    setCached(cacheKey, items);
    return items;
  } catch (err) {
    console.warn("[transports] Error fetching transports, using cache:", err);
    return getCachedEvenStale<Transport[]>(cacheKey) || [];
  }
};

export const addTransport = async (ownerId: string, name: string, phone = ""): Promise<Transport> => {
  const data = { ownerId, name: name.trim(), phone: phone.trim(), createdAt: new Date().toISOString() };
  if (!data.name) throw new Error(tr("pos_select_transport_name_required"));

  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  let id = `local_tr_${Date.now()}`;

  if (isOnline) {
    const ref = await addDoc(collection(db, "transports"), data);
    id = ref.id;
  }

  const created: Transport = { id, ...data };

  // Update local cache
  const cacheKey = cacheKeys.transports(ownerId);
  const current = getCachedEvenStale<Transport[]>(cacheKey) || [];
  setCached(
    cacheKey,
    [...current, created].sort((a, b) => a.name.localeCompare(b.name))
  );

  return created;
};
