// app/lib/services/deliveries.ts
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";

export type DeliveryStatus = "Out for Delivery" | "Dispatched" | "Delivered" | "Returned";

export interface DeliveryRecord {
  id: string;
  ownerId: string;
  trackingNo: string;
  invoiceNo: string;
  customerName: string;
  phone: string;
  destination: string;
  riderName: string;
  codAmount: number;
  deliveryStatus: DeliveryStatus;
  dispatchedAt: string;
  deliveredAt?: string;
  notes?: string;
}

export interface CreateDeliveryInput {
  invoiceNo: string;
  customerName: string;
  phone: string;
  destination: string;
  riderName: string;
  codAmount: number;
  notes?: string;
}

export interface DeliveryMetrics {
  activeDispatches: number;
  codCollectedToday: number;
  completedDeliveries: number;
  activeRiders: number;
}

export const listDeliveries = async (ownerId: string): Promise<DeliveryRecord[]> => {
  try {
    const q = query(
      collection(db, "deliveries"),
      where("ownerId", "==", ownerId),
      orderBy("dispatchedAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DeliveryRecord, "id">) }));
  } catch (error) {
    console.error("Failed to list deliveries:", error);
    return [];
  }
};

export const createDeliveryOrder = async (
  ownerId: string,
  input: CreateDeliveryInput
): Promise<string> => {
  const trackingNo = `TRK-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  const record: Omit<DeliveryRecord, "id"> = {
    ownerId,
    trackingNo,
    invoiceNo: input.invoiceNo || "DIRECT",
    customerName: input.customerName,
    phone: input.phone || "",
    destination: input.destination,
    riderName: input.riderName || "Fleet Rider",
    codAmount: Number(input.codAmount) || 0,
    deliveryStatus: "Out for Delivery",
    dispatchedAt: now,
    notes: input.notes || "",
  };

  const docRef = await addDoc(collection(db, "deliveries"), record);
  return docRef.id;
};

export const updateDeliveryStatus = async (
  id: string,
  status: DeliveryStatus
): Promise<void> => {
  const delRef = doc(db, "deliveries", id);
  const updates: Record<string, any> = { deliveryStatus: status };
  if (status === "Delivered") {
    updates.deliveredAt = new Date().toISOString();
  }
  await updateDoc(delRef, updates);
};

export const deleteDelivery = async (id: string): Promise<void> => {
  const delRef = doc(db, "deliveries", id);
  await deleteDoc(delRef);
};

export const calculateDeliveryMetrics = (deliveries: DeliveryRecord[]): DeliveryMetrics => {
  let activeDispatches = 0;
  let codCollectedToday = 0;
  let completedDeliveries = 0;
  const riders = new Set<string>();

  deliveries.forEach((d) => {
    if (d.deliveryStatus === "Out for Delivery" || d.deliveryStatus === "Dispatched") {
      activeDispatches++;
    } else if (d.deliveryStatus === "Delivered") {
      completedDeliveries++;
      codCollectedToday += Number(d.codAmount) || 0;
    }

    if (d.riderName) {
      riders.add(d.riderName);
    }
  });

  return {
    activeDispatches,
    codCollectedToday,
    completedDeliveries,
    activeRiders: riders.size || (deliveries.length > 0 ? 1 : 0),
  };
};
