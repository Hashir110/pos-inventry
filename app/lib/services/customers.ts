import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Customer, CustomerPayment } from "../../types";

/** Naam ke hisaab se (A-Z) */
export const listCustomers = async (ownerId: string): Promise<Customer[]> => {
  const snap = await getDocs(query(collection(db, "customers"), where("ownerId", "==", ownerId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Customer)
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const addCustomer = async (
  ownerId: string,
  input: { name: string; phone?: string }
): Promise<Customer> => {
  const data = {
    ownerId,
    name: input.name.trim(),
    phone: input.phone?.trim() || "",
    balance: 0,
    createdAt: new Date().toISOString(),
  };
  const ref = await addDoc(collection(db, "customers"), data);
  return { id: ref.id, ...data };
};

/**
 * Customer se paise wasool: balance kam + payment record, ek transaction mein.
 * Balance se zyada raqam allow nahi (customer ka advance abhi support nahi).
 */
export const receivePayment = async (
  ownerId: string,
  customerId: string,
  amount: number,
  method: CustomerPayment["method"],
  note = ""
): Promise<void> => {
  if (!(amount > 0)) throw new Error("Raqam 0 se zyada honi chahiye");

  const customerRef = doc(db, "customers", customerId);
  const paymentRef = doc(collection(db, "payments"));

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(customerRef);
    if (!snap.exists()) throw new Error("Customer nahi mila");
    const customer = snap.data() as Customer;
    if (amount > customer.balance + 0.001) {
      throw new Error(`Is customer ka udhar sirf Rs. ${customer.balance} hai`);
    }

    transaction.update(customerRef, { balance: Math.round((customer.balance - amount) * 100) / 100 });
    transaction.set(paymentRef, {
      ownerId,
      customerId,
      customerName: customer.name,
      amount,
      method,
      note: note.trim(),
      date: new Date().toISOString(),
    });
  });
};

/** Ek customer ki payments, naye pehle */
export const listPayments = async (ownerId: string, customerId: string): Promise<CustomerPayment[]> => {
  const snap = await getDocs(
    query(
      collection(db, "payments"),
      where("ownerId", "==", ownerId),
      where("customerId", "==", customerId)
    )
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as CustomerPayment)
    .sort((a, b) => b.date.localeCompare(a.date));
};
