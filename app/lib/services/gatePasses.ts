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

export const listGatePasses = async (ownerId: string): Promise<GatePass[]> => {
  const snap = await getDocs(
    query(collection(db, "gate_passes"), where("ownerId", "==", ownerId))
  );
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GatePass);
  return items.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
};

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
      console.warn("GatePass listener warning:", err.message);
    }
  );
};

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
      weight?: number;
      unit?: string;
    }>;
  }
): Promise<GatePass> => {
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
      const prodSnap = await getDocs(query(collection(db, "products"), where("ownerId", "==", ownerId)));
      const targetProd = prodSnap.docs.find((d) => d.id === item.productId);
      if (targetProd) {
        const data = targetProd.data();
        const currentGudam = data.gudamStock ?? 0;
        const currentShop = data.shopStock ?? data.stock ?? 0;

        const deductQty = (data.unitType === "weight" && item.weight) ? item.weight : item.qty;
        const newGudam = Math.max(0, currentGudam - deductQty);
        const newTotal = newGudam + currentShop;

        await updateDoc(doc(db, "products", item.productId), {
          gudamStock: newGudam,
          stock: newTotal,
          updatedAt: new Date().toISOString(),
        });
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

  return { id: docRef.id, ...newPass } as GatePass;
};
