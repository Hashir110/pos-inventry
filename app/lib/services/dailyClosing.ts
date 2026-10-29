import { collection, deleteDoc, doc, getDocs, query, setDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import type { DayClosing, DayOpening } from "../../types";
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
      return [...pending, ...cached.filter((c) => !pending.some((p) => p.date === c.date))].sort((a, b) =>
        b.date.localeCompare(a.date)
      );
    }
  }

  if (!isOnline) {
    const cached = getCachedEvenStale<DayClosing[]>(cacheKey) || [];
    const pending = getPendingDayClosings().map((c) => ({ id: c.tempId, ...c } as DayClosing));
    return [...pending, ...cached.filter((c) => !pending.some((p) => p.date === c.date))].sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  }

  try {
    const snap = await getDocs(query(collection(db, "day_closings"), where("ownerId", "==", ownerId)));
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as DayClosing)
      .sort((a, b) => b.date.localeCompare(a.date));
    setCached(cacheKey, items);

    const pending = getPendingDayClosings().map((c) => ({ id: c.tempId, ...c } as DayClosing));
    return [...pending, ...items.filter((c) => !pending.some((p) => p.date === c.date))].sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  } catch (err) {
    console.warn("[dailyClosing] Failed to fetch closings, using offline cache:", err);
    const stale = getCachedEvenStale<DayClosing[]>(cacheKey) || [];
    const pending = getPendingDayClosings().map((c) => ({ id: c.tempId, ...c } as DayClosing));
    return [...pending, ...stale.filter((c) => !pending.some((p) => p.date === c.date))].sort((a, b) =>
      b.date.localeCompare(a.date)
    );
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

export const listDayOpenings = async (ownerId: string, forceRefresh = false): Promise<DayOpening[]> => {
  const cacheKey = cacheKeys.dayOpenings(ownerId);
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  if (!forceRefresh) {
    const cached = isOnline ? getCached<DayOpening[]>(cacheKey) : getCachedEvenStale<DayOpening[]>(cacheKey);
    if (cached && cached.length >= 0) {
      const pending = getPendingDayOpenings().map((o) => ({ id: o.tempId, ...o } as DayOpening));
      return [...pending, ...cached.filter((c) => !pending.some((p) => p.date === c.date))].sort((a, b) =>
        b.date.localeCompare(a.date)
      );
    }
  }

  if (!isOnline) {
    const cached = getCachedEvenStale<DayOpening[]>(cacheKey) || [];
    const pending = getPendingDayOpenings().map((o) => ({ id: o.tempId, ...o } as DayOpening));
    return [...pending, ...cached.filter((c) => !pending.some((p) => p.date === c.date))].sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  }

  try {
    const snap = await getDocs(query(collection(db, "day_openings"), where("ownerId", "==", ownerId)));
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as DayOpening)
      .sort((a, b) => b.date.localeCompare(a.date));
    setCached(cacheKey, items);

    const pending = getPendingDayOpenings().map((o) => ({ id: o.tempId, ...o } as DayOpening));
    return [...pending, ...items.filter((c) => !pending.some((p) => p.date === c.date))].sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  } catch (err) {
    console.warn("[dailyClosing] Failed to fetch openings, using offline cache:", err);
    const stale = getCachedEvenStale<DayOpening[]>(cacheKey) || [];
    const pending = getPendingDayOpenings().map((o) => ({ id: o.tempId, ...o } as DayOpening));
    return [...pending, ...stale.filter((c) => !pending.some((p) => p.date === c.date))].sort((a, b) =>
      b.date.localeCompare(a.date)
    );
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