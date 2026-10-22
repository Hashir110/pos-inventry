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
import type { GatePass, Product } from "../../types";
import {
  cacheKeys,
  getCached,
  getCachedEvenStale,
  getPendingGatePasses,
  savePendingGatePasses,
  setCached,
  type PendingGatePass,
} from "./offlineStorage";

export interface GatePassInput {
  customerName: string;
  customerId?: string;
  saleId?: string;
  vehicleNo?: string;
  driverName?: string;
  notes?: string;
  items: Array<{
    productId: string;
    productName: string;
    qty: number;
    weight?: number;
    unit?: string;
  }>;
}

export const listGatePasses = async (ownerId: string, forceRefresh = false): Promise<GatePass[]> => {
  const cacheKey = cacheKeys.gatePasses(ownerId);
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  if (!forceRefresh) {
    const cached = isOnline ? getCached<GatePass[]>(cacheKey) : getCachedEvenStale<GatePass[]>(cacheKey);
    if (cached && cached.length >= 0) {
      const pending = getPendingGatePasses().map((p) => ({ id: p.tempId, ...p } as GatePass));
      return [...pending, ...cached.filter((c) => !pending.some((p) => p.gatePassNo === c.gatePassNo))];
    }
  }

  if (!isOnline) {
    const cached = getCachedEvenStale<GatePass[]>(cacheKey) || [];
    const pending = getPendingGatePasses().map((p) => ({ id: p.tempId, ...p } as GatePass));
    return [...pending, ...cached.filter((c) => !pending.some((p) => p.gatePassNo === c.gatePassNo))];
  }

  try {
    const snap = await getDocs(
      query(collection(db, "gate_passes"), where("ownerId", "==", ownerId))
    );
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GatePass);
    items.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    setCached(cacheKey, items);

    const pending = getPendingGatePasses().map((p) => ({ id: p.tempId, ...p } as GatePass));
    return [...pending, ...items.filter((c) => !pending.some((p) => p.gatePassNo === c.gatePassNo))];
  } catch (error) {
    console.warn("[gatePasses] Failed to fetch gate passes, using offline cache:", error);
    const stale = getCachedEvenStale<GatePass[]>(cacheKey) || [];
    const pending = getPendingGatePasses().map((p) => ({ id: p.tempId, ...p } as GatePass));
    return [...pending, ...stale.filter((c) => !pending.some((p) => p.gatePassNo === c.gatePassNo))];
  }
};

export const subscribeGatePasses = (
  ownerId: string,
  onData: (passes: GatePass[]) => void
): (() => void) => {
  const cacheKey = cacheKeys.gatePasses(ownerId);
  const cached = getCachedEvenStale<GatePass[]>(cacheKey) || [];
  const pending = getPendingGatePasses().map((p) => ({ id: p.tempId, ...p } as GatePass));
  if (cached.length > 0 || pending.length > 0) {
    onData([...pending, ...cached.filter((c) => !pending.some((p) => p.gatePassNo === c.gatePassNo))]);
  }

  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (!isOnline) {
    return () => {};
  }

  return onSnapshot(
    query(collection(db, "gate_passes"), where("ownerId", "==", ownerId)),
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GatePass);
      items.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
      setCached(cacheKey, items);

      const latestPending = getPendingGatePasses().map((p) => ({ id: p.tempId, ...p } as GatePass));
      onData([...latestPending, ...items.filter((c) => !latestPending.some((p) => p.gatePassNo === c.gatePassNo))]);
    },
    (err) => {
      console.warn("GatePass listener warning:", err.message);
    }
  );
};

export const queueOfflineGatePass = (
  ownerId: string,
  gatePassData: GatePassInput
): GatePass => {
  const nextNo = `OFF-GP-${Date.now().toString(36).toUpperCase().slice(-5)}`;
  const tempId = `local_${Date.now()}`;
  const nowIso = new Date().toISOString();

  const newPass: PendingGatePass = {
    tempId,
    ownerId,
    gatePassNo: nextNo,
    customerName: gatePassData.customerName,
    items: gatePassData.items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      qty: Number(i.qty),
      weight: Number(i.weight || 0),
      unit: i.unit || "",
    })),
    date: nowIso,
    vehicleNo: gatePassData.vehicleNo || "",
    driverName: gatePassData.driverName || "",
    status: "Issued",
    notes: gatePassData.notes || "",
    isOffline: true,
    ...(gatePassData.customerId ? { customerId: gatePassData.customerId } : {}),
    ...(gatePassData.saleId ? { saleId: gatePassData.saleId } : {}),
  };

  savePendingGatePasses([...getPendingGatePasses(), newPass]);

  // Update local product cache gudam stock
  const prodsKey = cacheKeys.products(ownerId);
  const cachedProds = getCachedEvenStale<Product[]>(prodsKey);
  if (cachedProds) {
    const updated = cachedProds.map((p) => {
      const item = gatePassData.items.find((it) => it.productId === p.id);
      if (!item) return p;
      const currentGudam = p.gudamStock ?? 0;
      const newGudam = Math.max(0, currentGudam - item.qty);
      const newTotal = newGudam + (p.shopStock ?? p.stock ?? 0);
      return { ...p, gudamStock: newGudam, stock: newTotal };
    });
    setCached(prodsKey, updated);
  }

  // Prepend to cached gate passes
  const passesKey = cacheKeys.gatePasses(ownerId);
  const currentPasses = getCachedEvenStale<GatePass[]>(passesKey) || [];
  const localObj: GatePass = { id: tempId, ...newPass };
  setCached(passesKey, [localObj, ...currentPasses]);

  return localObj;
};

export const issueGatePass = async (
  ownerId: string,
  gatePassData: GatePassInput
): Promise<GatePass> => {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  if (!isOnline) {
    return queueOfflineGatePass(ownerId, gatePassData);
  }

  const existingPasses = await listGatePasses(ownerId);
  const nextNo = `GP-${1001 + existingPasses.length}`;

  const newPass: Record<string, any> = {
    ownerId,
    gatePassNo: nextNo,
    customerName: gatePassData.customerName,
    items: gatePassData.items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      qty: Number(i.qty),
      weight: Number(i.weight || 0),
      unit: i.unit || "",
    })),
    date: new Date().toISOString(),
    vehicleNo: gatePassData.vehicleNo || "",
    driverName: gatePassData.driverName || "",
    status: "Issued",
    notes: gatePassData.notes || "",
  };

  if (gatePassData.customerId) {
    newPass.customerId = gatePassData.customerId;
  }
  if (gatePassData.saleId) {
    newPass.saleId = gatePassData.saleId;
  }

  const docRef = await addDoc(collection(db, "gate_passes"), newPass);

  for (const item of gatePassData.items) {
    if (item.productId) {
      try {
        const prodSnap = await getDocs(query(collection(db, "products"), where("ownerId", "==", ownerId)));
        const targetProd = prodSnap.docs.find((d) => d.id === item.productId);
        if (targetProd) {
          const data = targetProd.data();
          const currentGudam = data.gudamStock ?? 0;
          const currentShop = data.shopStock ?? data.stock ?? 0;

          const deductQty = item.qty;
          const newGudam = Math.max(0, currentGudam - deductQty);
          const newTotal = newGudam + currentShop;

          await updateDoc(doc(db, "products", item.productId), {
            gudamStock: newGudam,
            stock: newTotal,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.warn("Could not deduct product gudam stock for gate pass:", err);
      }
    }
  }

  if (gatePassData.saleId) {
    try {
      await updateDoc(doc(db, "sales", gatePassData.saleId), {
        gatePassGenerated: true,
      });
    } catch (e) {
      console.warn("Could not update sale gatePassGenerated flag:", e);
    }
  }

  const created: GatePass = { id: docRef.id, ...newPass } as GatePass;

  // Update local gate pass cache
  const cacheKey = cacheKeys.gatePasses(ownerId);
  const current = getCachedEvenStale<GatePass[]>(cacheKey) || [];
  setCached(cacheKey, [created, ...current]);

  return created;
};

export const syncPendingGatePasses = async (onProgress?: (remaining: number) => void): Promise<number> => {
  let queue = getPendingGatePasses();
  let uploaded = 0;

  for (const pass of [...queue]) {
    try {
      const { tempId, isOffline, ...cleanData } = pass;
      void tempId;
      void isOffline;

      const docRef = await addDoc(collection(db, "gate_passes"), {
        ...cleanData,
        syncedAt: new Date().toISOString(),
      });

      for (const item of cleanData.items) {
        if (item.productId) {
          try {
            const prodSnap = await getDocs(query(collection(db, "products"), where("ownerId", "==", pass.ownerId)));
            const targetProd = prodSnap.docs.find((d) => d.id === item.productId);
            if (targetProd) {
              const data = targetProd.data();
              const currentGudam = data.gudamStock ?? 0;
              const currentShop = data.shopStock ?? data.stock ?? 0;
              const newGudam = Math.max(0, currentGudam - item.qty);
              const newTotal = newGudam + currentShop;

              await updateDoc(doc(db, "products", item.productId), {
                gudamStock: newGudam,
                stock: newTotal,
                updatedAt: new Date().toISOString(),
              });
            }
          } catch (e) {
            console.warn("Error updating gudam stock during gate pass sync:", e);
          }
        }
      }

      if (cleanData.saleId) {
        try {
          await updateDoc(doc(db, "sales", cleanData.saleId), { gatePassGenerated: true });
        } catch {}
      }

      queue = queue.filter((p) => p.tempId !== pass.tempId);
      savePendingGatePasses(queue);
      uploaded++;
      onProgress?.(queue.length);
    } catch (err) {
      console.error("Failed to sync pending gate pass:", pass.gatePassNo, err);
      break;
    }
  }

  return uploaded;
};

export const deleteGatePass = async (passId: string, ownerId: string): Promise<void> => {
  const passRef = doc(db, "gate_passes", passId);
  let passData: GatePass | null = null;

  try {
    const snap = await getDoc(passRef);
    if (snap.exists()) {
      passData = { id: snap.id, ...snap.data() } as GatePass;
    }
  } catch (err) {
    console.warn("Could not fetch gate pass from Firestore, checking offline queue/cache:", err);
  }

  if (!passData) {
    const cached = getCachedEvenStale<GatePass[]>(cacheKeys.gatePasses(ownerId)) || [];
    passData = cached.find((p) => p.id === passId) || null;
  }

  // Restore gudam stock for each item in the deleted gate pass
  if (passData && passData.items) {
    for (const item of passData.items) {
      if (item.productId) {
        try {
          const prodSnap = await getDocs(query(collection(db, "products"), where("ownerId", "==", ownerId)));
          const targetProd = prodSnap.docs.find((d) => d.id === item.productId);
          if (targetProd) {
            const data = targetProd.data();
            const currentGudam = data.gudamStock ?? 0;
            const currentShop = data.shopStock ?? data.stock ?? 0;
            const returnQty = item.qty || 0;
            const newGudam = currentGudam + returnQty;
            const newTotal = newGudam + currentShop;

            await updateDoc(doc(db, "products", item.productId), {
              gudamStock: newGudam,
              stock: newTotal,
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (err) {
          console.warn("Could not restore product gudam stock for deleted gate pass:", err);
        }
      }
    }

    // Update local product cache
    const prodsKey = cacheKeys.products(ownerId);
    const cachedProds = getCachedEvenStale<Product[]>(prodsKey);
    if (cachedProds) {
      const updatedProds = cachedProds.map((p) => {
        const item = passData!.items.find((it) => it.productId === p.id);
        if (!item) return p;
        const currentGudam = p.gudamStock ?? 0;
        const newGudam = currentGudam + (item.qty || 0);
        const newTotal = newGudam + (p.shopStock ?? p.stock ?? 0);
        return { ...p, gudamStock: newGudam, stock: newTotal };
      });
      setCached(prodsKey, updatedProds);
    }
  }

  // Reset sale flag if saleId was linked
  if (passData?.saleId) {
    try {
      await updateDoc(doc(db, "sales", passData.saleId), {
        gatePassGenerated: false,
      });
    } catch (e) {
      // ignore
    }
  }

  // Remove from offline pending queue if present
  const pending = getPendingGatePasses();
  const filteredPending = pending.filter((p) => p.tempId !== passId && p.gatePassNo !== passData?.gatePassNo);
  if (filteredPending.length !== pending.length) {
    savePendingGatePasses(filteredPending);
  }

  // Delete document in Firestore
  try {
    await deleteDoc(passRef);
  } catch (err) {
    console.warn("Could not delete from Firestore (offline or already removed):", err);
  }

  // Update local gate passes cache
  const passesKey = cacheKeys.gatePasses(ownerId);
  const currentPasses = getCachedEvenStale<GatePass[]>(passesKey) || [];
  setCached(passesKey, currentPasses.filter((p) => p.id !== passId));
};

export const updateGatePass = async (
  passId: string,
  updatedData: GatePassInput,
  ownerId: string
): Promise<GatePass> => {
  const passRef = doc(db, "gate_passes", passId);
  let oldPass: GatePass | null = null;
  try {
    const snap = await getDoc(passRef);
    if (snap.exists()) {
      oldPass = { id: snap.id, ...snap.data() } as GatePass;
    }
  } catch {}

  if (!oldPass) {
    const cached = getCachedEvenStale<GatePass[]>(cacheKeys.gatePasses(ownerId)) || [];
    oldPass = cached.find((p) => p.id === passId) || null;
  }

  const oldItems = oldPass?.items || [];
  const newItems = updatedData.items.map((i) => ({
    productId: i.productId,
    productName: i.productName,
    qty: Number(i.qty),
    weight: Number(i.weight || 0),
    unit: i.unit || "",
  }));

  // Adjust Gudam stock based on differences between old and new quantities
  const productIds = new Set([
    ...oldItems.map((i) => i.productId),
    ...newItems.map((i) => i.productId),
  ]);

  for (const prodId of productIds) {
    if (!prodId) continue;
    const oldItem = oldItems.find((i) => i.productId === prodId);
    const newItem = newItems.find((i) => i.productId === prodId);
    const oldQty = oldItem ? oldItem.qty : 0;
    const newQty = newItem ? newItem.qty : 0;
    const diff = oldQty - newQty; // Positive: returned to warehouse; Negative: deducted from warehouse

    if (diff !== 0) {
      try {
        const prodSnap = await getDocs(query(collection(db, "products"), where("ownerId", "==", ownerId)));
        const targetProd = prodSnap.docs.find((d) => d.id === prodId);
        if (targetProd) {
          const data = targetProd.data();
          const currentGudam = data.gudamStock ?? 0;
          const currentShop = data.shopStock ?? data.stock ?? 0;
          const newGudam = Math.max(0, currentGudam + diff);
          const newTotal = newGudam + currentShop;

          await updateDoc(doc(db, "products", prodId), {
            gudamStock: newGudam,
            stock: newTotal,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.warn("Could not adjust product gudam stock during gate pass edit:", err);
      }
    }
  }

  // Update local products cache
  const prodsKey = cacheKeys.products(ownerId);
  const cachedProds = getCachedEvenStale<Product[]>(prodsKey);
  if (cachedProds) {
    const updatedProds = cachedProds.map((p) => {
      const oldItem = oldItems.find((i) => i.productId === p.id);
      const newItem = newItems.find((i) => i.productId === p.id);
      if (!oldItem && !newItem) return p;
      const oldQty = oldItem ? oldItem.qty : 0;
      const newQty = newItem ? newItem.qty : 0;
      const diff = oldQty - newQty;
      const currentGudam = p.gudamStock ?? 0;
      const newGudam = Math.max(0, currentGudam + diff);
      const newTotal = newGudam + (p.shopStock ?? p.stock ?? 0);
      return { ...p, gudamStock: newGudam, stock: newTotal };
    });
    setCached(prodsKey, updatedProds);
  }

  // Update the gate pass document
  const updatedAt = new Date().toISOString();
  const updatePayload: Record<string, any> = {
    customerName: updatedData.customerName,
    items: newItems,
    vehicleNo: updatedData.vehicleNo || "",
    driverName: updatedData.driverName || "",
    notes: updatedData.notes || "",
    updatedAt,
  };
  if (updatedData.customerId) {
    updatePayload.customerId = updatedData.customerId;
  }

  try {
    await updateDoc(passRef, updatePayload);
  } catch (err) {
    console.warn("Could not update in Firestore (offline or error):", err);
  }

  // Update local gate passes cache
  const passesKey = cacheKeys.gatePasses(ownerId);
  const currentPasses = getCachedEvenStale<GatePass[]>(passesKey) || [];
  const updatedPassObj: GatePass = {
    id: passId,
    ownerId,
    gatePassNo: oldPass?.gatePassNo || "",
    customerName: updatedData.customerName,
    items: newItems,
    date: oldPass?.date || updatedAt,
    status: oldPass?.status || "Issued",
    vehicleNo: updatedData.vehicleNo || "",
    driverName: updatedData.driverName || "",
    notes: updatedData.notes || "",
    ...(updatedData.customerId ? { customerId: updatedData.customerId } : {}),
    ...(oldPass?.saleId ? { saleId: oldPass.saleId } : {}),
    updatedAt,
  };

  setCached(
    passesKey,
    currentPasses.map((p) => (p.id === passId ? updatedPassObj : p))
  );

  return updatedPassObj;
};

