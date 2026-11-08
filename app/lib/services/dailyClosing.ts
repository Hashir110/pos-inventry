import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import type { DayClosing, DayOpening } from "../../types";
import { dayKey } from "../calc";
import {
  cacheKeys,
  getCached,
  getCachedEvenStale,
  getPendingDayClosings,
  getPendingDayOpenings,
  savePendingDayClosings,
  savePendingDayOpenings,
  setCached,
  type PendingDayClosing,
  type PendingDayOpening,
} from "./offlineStorage";

export type DayClosingInput = Omit<DayClosing, "id" | "ownerId" | "closedAt">;

export const listDayClosings = async (ownerId: string, forceRefresh = false): Promise<DayClosing[]> => {
  const cacheKey = cacheKeys.dayClosings(ownerId);
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  if (!forceRefresh) {
    const cached = isOnline ? getCached<DayClosing[]>(cacheKey) : getCachedEvenStale<DayClosing[]>(cacheKey);
    if (cached && cached.length >= 0) {
      const pending = getPendingDayClosings().map((c) => ({ id: c.tempId, ...c } as DayClosing));
      const map = new Map<string, DayClosing>();
      [...pending, ...cached].forEach((c) => {
        const existing = map.get(c.date);
        if (!existing || (c.closedAt || "") >= (existing.closedAt || "")) {
          map.set(c.date, c);
        }
      });
      return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
    }
  }

  if (!isOnline) {
    const cached = getCachedEvenStale<DayClosing[]>(cacheKey) || [];
    const pending = getPendingDayClosings().map((c) => ({ id: c.tempId, ...c } as DayClosing));
    const map = new Map<string, DayClosing>();
    [...pending, ...cached].forEach((c) => {
      const existing = map.get(c.date);
      if (!existing || (c.closedAt || "") >= (existing.closedAt || "")) {
        map.set(c.date, c);
      }
    });
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }

  try {
    const snap = await getDocs(query(collection(db, "day_closings"), where("ownerId", "==", ownerId)));
    const map = new Map<string, DayClosing>();
    snap.docs.forEach((d) => {
      const item = { id: d.id, ...d.data() } as DayClosing;
      const existing = map.get(item.date);
      if (!existing || (item.closedAt || "") > (existing.closedAt || "")) {
        map.set(item.date, item);
      }
    });
    const items = Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
    setCached(cacheKey, items);

    const pending = getPendingDayClosings().map((c) => ({ id: c.tempId, ...c } as DayClosing));
    const finalMap = new Map<string, DayClosing>();
    [...pending, ...items].forEach((c) => {
      const existing = finalMap.get(c.date);
      if (!existing || (c.closedAt || "") >= (existing.closedAt || "")) {
        finalMap.set(c.date, c);
      }
    });
    return Array.from(finalMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  } catch (err) {
    console.warn("[dailyClosing] Failed to fetch closings, using offline cache:", err);
    const stale = getCachedEvenStale<DayClosing[]>(cacheKey) || [];
    const pending = getPendingDayClosings().map((c) => ({ id: c.tempId, ...c } as DayClosing));
    const map = new Map<string, DayClosing>();
    [...pending, ...stale].forEach((c) => {
      const existing = map.get(c.date);
      if (!existing || (c.closedAt || "") >= (existing.closedAt || "")) {
        map.set(c.date, c);
      }
    });
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }
};

export const queueOfflineDayClosing = (ownerId: string, input: DayClosingInput): DayClosing => {
  const tempId = `local_close_${ownerId}_${input.date}`;
  const nowIso = new Date().toISOString();

  const pendingRecord: PendingDayClosing = {
    ...input,
    tempId,
    ownerId,
    closedAt: nowIso,
    isOffline: true,
  };

  const currentQueue = getPendingDayClosings().filter((c) => c.date !== input.date);
  savePendingDayClosings([pendingRecord, ...currentQueue]);

  // Update local cache
  const cacheKey = cacheKeys.dayClosings(ownerId);
  const current = getCachedEvenStale<DayClosing[]>(cacheKey) || [];
  const localObj: DayClosing = { id: tempId, ...input, ownerId, closedAt: nowIso };
  setCached(
    cacheKey,
    [localObj, ...current.filter((c) => c.date !== input.date)].sort((a, b) => b.date.localeCompare(a.date))
  );

  return localObj;
};

export const saveDayClosing = async (ownerId: string, input: DayClosingInput): Promise<DayClosing> => {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  if (!isOnline) {
    return queueOfflineDayClosing(ownerId, input);
  }

  const id = `${ownerId}_${input.date}`;
  const data = { ...input, ownerId, closedAt: new Date().toISOString() };
  await setDoc(doc(db, "day_closings", id), data);

  // Clear any pending offline closing for this date
  const remainingPending = getPendingDayClosings().filter((c) => c.date !== input.date);
  savePendingDayClosings(remainingPending);

  const savedRecord = { id, ...data };

  // Update local cache
  const cacheKey = cacheKeys.dayClosings(ownerId);
  const current = getCachedEvenStale<DayClosing[]>(cacheKey) || [];
  setCached(
    cacheKey,
    [savedRecord, ...current.filter((c) => c.date !== input.date)].sort((a, b) => b.date.localeCompare(a.date))
  );

  return savedRecord;
};

export const syncPendingDayClosings = async (onProgress?: (remaining: number) => void): Promise<number> => {
  let queue = getPendingDayClosings();
  let uploaded = 0;

  for (const item of [...queue]) {
    try {
      const id = `${item.ownerId}_${item.date}`;
      const { tempId, isOffline, ...cleanData } = item;
      void tempId;
      void isOffline;

      await setDoc(doc(db, "day_closings", id), {
        ...cleanData,
        syncedAt: new Date().toISOString(),
      });

      queue = queue.filter((c) => c.tempId !== item.tempId);
      savePendingDayClosings(queue);
      uploaded++;
      onProgress?.(queue.length);
    } catch (err) {
      console.error("Failed to sync day closing:", item.date, err);
      break;
    }
  }

  return uploaded;
};

export const mergeSaleIntoDayClosing = async (
  ownerId: string,
  saleDate: string,
  breakdown: {
    net: number;
    cash: number;
    bank: number;
    udhar: number;
  }
): Promise<void> => {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  const dKey = dayKey(saleDate);
  if (!dKey || !ownerId) return;

  const id = `${ownerId}_${dKey}`;
  const cacheKey = cacheKeys.dayClosings(ownerId);

  if (isOnline) {
    try {
      const closingRef = doc(db, "day_closings", id);
      const snap = await getDoc(closingRef);
      if (snap.exists()) {
        const existing = snap.data() as DayClosing;
        const updatedClosing: DayClosing = {
          ...existing,
          invoiceCount: (existing.invoiceCount || 0) + 1,
          salesTotal: Math.round(((existing.salesTotal || 0) + breakdown.net) * 100) / 100,
          cash: Math.round(((existing.cash || 0) + breakdown.cash) * 100) / 100,
          bank: Math.round(((existing.bank || 0) + breakdown.bank) * 100) / 100,
          udhar: Math.round(((existing.udhar || 0) + breakdown.udhar) * 100) / 100,
          cashInHand: Math.round(((existing.cashInHand || 0) + breakdown.cash) * 100) / 100,
          closedAt: new Date().toISOString(),
        };
        await setDoc(closingRef, updatedClosing);

        // Update local cache
        const current = getCachedEvenStale<DayClosing[]>(cacheKey) || [];
        setCached(
          cacheKey,
          [updatedClosing, ...current.filter((c) => c.date !== dKey)].sort((a, b) => b.date.localeCompare(a.date))
        );
      }
    } catch (err) {
      console.warn("[dailyClosing] Failed to auto-merge sale into closing:", err);
    }
  } else {
    // Offline optimistic cache update
    const current = getCachedEvenStale<DayClosing[]>(cacheKey) || [];
    const existing = current.find((c) => c.date === dKey);
    if (existing) {
      const updatedClosing: DayClosing = {
        ...existing,
        invoiceCount: (existing.invoiceCount || 0) + 1,
        salesTotal: Math.round(((existing.salesTotal || 0) + breakdown.net) * 100) / 100,
        cash: Math.round(((existing.cash || 0) + breakdown.cash) * 100) / 100,
        bank: Math.round(((existing.bank || 0) + breakdown.bank) * 100) / 100,
        udhar: Math.round(((existing.udhar || 0) + breakdown.udhar) * 100) / 100,
        cashInHand: Math.round(((existing.cashInHand || 0) + breakdown.cash) * 100) / 100,
        closedAt: new Date().toISOString(),
      };
      setCached(
        cacheKey,
        [updatedClosing, ...current.filter((c) => c.date !== dKey)].sort((a, b) => b.date.localeCompare(a.date))
      );
    }
  }
};

export const listDayOpenings = async (ownerId: string, forceRefresh = false): Promise<DayOpening[]> => {
  const cacheKey = cacheKeys.dayOpenings(ownerId);
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  if (!forceRefresh) {
    const cached = isOnline ? getCached<DayOpening[]>(cacheKey) : getCachedEvenStale<DayOpening[]>(cacheKey);
    if (cached && cached.length >= 0) {
      const pending = getPendingDayOpenings().map((o) => ({ id: o.tempId, ...o } as DayOpening));
      const map = new Map<string, DayOpening>();
      [...pending, ...cached].forEach((o) => {
        const existing = map.get(o.date);
        if (!existing || (o.updatedAt || "") >= (existing.updatedAt || "")) {
          map.set(o.date, o);
        }
      });
      return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
    }
  }

  if (!isOnline) {
    const cached = getCachedEvenStale<DayOpening[]>(cacheKey) || [];
    const pending = getPendingDayOpenings().map((o) => ({ id: o.tempId, ...o } as DayOpening));
    const map = new Map<string, DayOpening>();
    [...pending, ...cached].forEach((o) => {
      const existing = map.get(o.date);
      if (!existing || (o.updatedAt || "") >= (existing.updatedAt || "")) {
        map.set(o.date, o);
      }
    });
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }

  try {
    const snap = await getDocs(query(collection(db, "day_openings"), where("ownerId", "==", ownerId)));
    const map = new Map<string, DayOpening>();
    snap.docs.forEach((d) => {
      const item = { id: d.id, ...d.data() } as DayOpening;
      const existing = map.get(item.date);
      if (!existing || (item.updatedAt || "") > (existing.updatedAt || "")) {
        map.set(item.date, item);
      }
    });
    const items = Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
    setCached(cacheKey, items);

    const pending = getPendingDayOpenings().map((o) => ({ id: o.tempId, ...o } as DayOpening));
    const finalMap = new Map<string, DayOpening>();
    [...pending, ...items].forEach((o) => {
      const existing = finalMap.get(o.date);
      if (!existing || (o.updatedAt || "") >= (existing.updatedAt || "")) {
        finalMap.set(o.date, o);
      }
    });
    return Array.from(finalMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  } catch (err) {
    console.warn("[dailyClosing] Failed to fetch openings, using offline cache:", err);
    const stale = getCachedEvenStale<DayOpening[]>(cacheKey) || [];
    const pending = getPendingDayOpenings().map((o) => ({ id: o.tempId, ...o } as DayOpening));
    const map = new Map<string, DayOpening>();
    [...pending, ...stale].forEach((o) => {
      const existing = map.get(o.date);
      if (!existing || (o.updatedAt || "") >= (existing.updatedAt || "")) {
        map.set(o.date, o);
      }
    });
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }
};

export const queueOfflineDayOpening = (ownerId: string, date: string, amount: number): DayOpening => {
  const tempId = `local_opening_${ownerId}_${date}`;
  const nowIso = new Date().toISOString();

  const pendingRecord: PendingDayOpening = {
    tempId,
    ownerId,
    date,
    amount,
    updatedAt: nowIso,
    isOffline: true,
  };

  const currentQueue = getPendingDayOpenings().filter((o) => o.date !== date);
  savePendingDayOpenings([pendingRecord, ...currentQueue]);

  // Update local cache
  const cacheKey = cacheKeys.dayOpenings(ownerId);
  const current = getCachedEvenStale<DayOpening[]>(cacheKey) || [];
  const localObj: DayOpening = { id: tempId, ownerId, date, amount, updatedAt: nowIso };
  setCached(
    cacheKey,
    [localObj, ...current.filter((o) => o.date !== date)].sort((a, b) => b.date.localeCompare(a.date))
  );

  return localObj;
};

export const saveDayOpening = async (ownerId: string, date: string, amount: number): Promise<DayOpening> => {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  if (!isOnline) {
    return queueOfflineDayOpening(ownerId, date, amount);
  }

  // Clear any pending offline opening for this date
  const remainingPending = getPendingDayOpenings().filter((o) => o.date !== date);
  savePendingDayOpenings(remainingPending);

  const id = `${ownerId}_${date}`;
  const data = { id, ownerId, date, amount, updatedAt: new Date().toISOString() };
  await setDoc(doc(db, "day_openings", id), data);

  // Update local cache
  const cacheKey = cacheKeys.dayOpenings(ownerId);
  const current = getCachedEvenStale<DayOpening[]>(cacheKey) || [];
  setCached(
    cacheKey,
    [data, ...current.filter((o) => o.date !== date)].sort((a, b) => b.date.localeCompare(a.date))
  );

  return data;
};

export const deleteDayOpening = async (ownerId: string, date: string): Promise<void> => {
  const id = `${ownerId}_${date}`;
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  // Remove from pending queue if present
  const pendingQueue = getPendingDayOpenings().filter((o) => o.date !== date);
  savePendingDayOpenings(pendingQueue);

  if (isOnline) {
    try {
      await deleteDoc(doc(db, "day_openings", id));
    } catch (err) {
      console.warn("[dailyClosing] Failed to delete opening from firestore:", err);
    }
  }

  // Update local cache
  const cacheKey = cacheKeys.dayOpenings(ownerId);
  const current = getCachedEvenStale<DayOpening[]>(cacheKey) || [];
  setCached(cacheKey, current.filter((o) => o.date !== date));
};

export const syncPendingDayOpenings = async (onProgress?: (remaining: number) => void): Promise<number> => {
  let queue = getPendingDayOpenings();
  let uploaded = 0;

  for (const item of [...queue]) {
    try {
      const id = `${item.ownerId}_${item.date}`;
      const { tempId, isOffline, ...cleanData } = item;
      void tempId;
      void isOffline;

      await setDoc(doc(db, "day_openings", id), {
        ...cleanData,
        syncedAt: new Date().toISOString(),
      });

      queue = queue.filter((c) => c.tempId !== item.tempId);
      savePendingDayOpenings(queue);
      uploaded++;
      onProgress?.(queue.length);
    } catch (err) {
      console.error("Failed to sync day opening:", item.date, err);
      break;
    }
  }

  return uploaded;
};