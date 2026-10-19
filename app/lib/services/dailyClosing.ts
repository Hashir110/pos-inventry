import { collection, doc, getDocs, query, setDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import type { DayClosing } from "../../types";
import {
  cacheKeys,
  getCached,
  getCachedEvenStale,
  getPendingDayClosings,
  savePendingDayClosings,
  setCached,
  type PendingDayClosing,
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