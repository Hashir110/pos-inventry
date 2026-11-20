// app/lib/services/staff.ts
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

export type StaffRole = "Cashier" | "Branch Manager" | "Inventory Stocker" | "Rider";
export type StaffShift = "Morning" | "Evening" | "Full Day";
export type StaffStatus = "On-Duty" | "Off-Duty" | "On-Break";

export interface StaffMember {
  id: string;
  ownerId: string;
  name: string;
  role: StaffRole;
  shift: StaffShift;
  phone: string;
  assignedRegister: string;
  status: StaffStatus;
  startingFloat: number;
  quickPin?: string;
  createdAt: string;
}

export interface StaffInput {
  name: string;
  role: StaffRole;
  shift: StaffShift;
  phone: string;
  assignedRegister: string;
  startingFloat: number;
  quickPin?: string;
  status?: StaffStatus;
}

export interface StaffMetrics {
  totalStaff: number;
  activeOnDuty: number;
  activeRegisters: number;
  activeShift: string;
}

export const listStaffMembers = async (ownerId: string): Promise<StaffMember[]> => {
  try {
    const q = query(
      collection(db, "staff_members"),
      where("ownerId", "==", ownerId),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StaffMember, "id">) }));
  } catch (error) {
    console.error("Failed to list staff members:", error);
    return [];
  }
};

export const addStaffMember = async (
  ownerId: string,
  input: StaffInput
): Promise<string> => {
  const staffData: Omit<StaffMember, "id"> = {
    ownerId,
    name: input.name,
    role: input.role,
    shift: input.shift,
    phone: input.phone || "",
    assignedRegister: input.assignedRegister || "Counter #1",
    status: input.status || "Off-Duty",
    startingFloat: Number(input.startingFloat) || 0,
    quickPin: input.quickPin || "0123",
    createdAt: new Date().toISOString(),
  };

  const docRef = await addDoc(collection(db, "staff_members"), staffData);
  return docRef.id;
};

export const updateStaffMember = async (
  id: string,
  updates: Partial<StaffMember>
): Promise<void> => {
  const staffRef = doc(db, "staff_members", id);
  await updateDoc(staffRef, updates);
};

export const deleteStaffMember = async (id: string): Promise<void> => {
  const staffRef = doc(db, "staff_members", id);
  await deleteDoc(staffRef);
};

export const calculateStaffMetrics = (staff: StaffMember[]): StaffMetrics => {
  let activeOnDuty = 0;
  const registers = new Set<string>();

  staff.forEach((s) => {
    if (s.status === "On-Duty") {
      activeOnDuty++;
      if (s.assignedRegister) {
        registers.add(s.assignedRegister);
      }
    }
  });

  const hour = new Date().getHours();
  const activeShift = hour >= 8 && hour < 16 ? "Morning Shift" : hour >= 16 && hour < 24 ? "Evening Shift" : "Night Shift";

  return {
    totalStaff: staff.length,
    activeOnDuty,
    activeRegisters: registers.size,
    activeShift,
  };
};
