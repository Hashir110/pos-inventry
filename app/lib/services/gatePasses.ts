import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import type { GatePass } from "../../types";

/** List all gate passes for shop */
export const listGatePasses = async (ownerId: string): Promise<GatePass[]> => {
  const snap = await getDocs(
    query(collection(db, "gate_passes"), where("ownerId", "==", ownerId))
  );
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GatePass);
  return items.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
};

/** Subscribe to live gate passes */
export const subscribeGatePasses = (
  ownerId: string,
  onData: (passes: GatePass[]) => void
): (() => void) => {
  return onSnapshot(
    query(collection(db, "gate_passes"), where("ownerId", "==", ownerId)),
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GatePass);
      items.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
      onData(items);
    },
    (err) => {
      console.warn("GatePass listener warning/permission issue:", err.message);
    }
  );
};

/** Issue Gate Pass (Generates Gate Pass & deducts stock from Gudam) */
export const issueGatePass = async (
  ownerId: string,
  gatePassData: {
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
      unit?: string;
    }>;
  }
): Promise<GatePass> => {
  // 1. Generate Gate Pass No (GP-1001, GP-1002, etc.)
  const existingPasses = await listGatePasses(ownerId);
  const nextNo = `GP-${1001 + existingPasses.length}`;

  const newPass: Omit<GatePass, "id"> = {
    ownerId,
    gatePassNo: nextNo,
    customerName: gatePassData.customerName,
    customerId: gatePassData.customerId,
    saleId: gatePassData.saleId,
    items: gatePassData.items,
    date: new Date().toISOString(),
    vehicleNo: gatePassData.vehicleNo || "",
    driverName: gatePassData.driverName || "",
    status: "Issued",
    notes: gatePassData.notes || "",
  };

  const docRef = await addDoc(collection(db, "gate_passes"), newPass);

  // 2. Deduct Gudam stock for each item in the gate pass
  for (const item of gatePassData.items) {
    if (item.productId) {
      const prodSnap = await getDocs(query(collection(db, "products"), where("ownerId", "==", ownerId)));
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
    }
  }

  // 3. Mark sale as gatePassGenerated if saleId provided
  if (gatePassData.saleId) {
    try {
      await updateDoc(doc(db, "sales", gatePassData.saleId), {
        gatePassGenerated: true,
      });
    } catch (e) {
      console.warn("Could not update sale gatePassGenerated flag:", e);
    }
  }

  return { id: docRef.id, ...newPass };
};
