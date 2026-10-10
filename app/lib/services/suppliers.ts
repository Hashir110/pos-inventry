import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Supplier, SupplierPurchase, SupplierPayment } from "../../types";

/** List all suppliers for a shop owner */
export const listSuppliers = async (ownerId: string): Promise<Supplier[]> => {
  const snap = await getDocs(
    query(collection(db, "suppliers"), where("ownerId", "==", ownerId))
  );
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Supplier);
  return items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
};

/** Subscribe live to suppliers list */
export const subscribeSuppliers = (
  ownerId: string,
  onData: (suppliers: Supplier[]) => void
): (() => void) => {
  return onSnapshot(
    query(collection(db, "suppliers"), where("ownerId", "==", ownerId)),
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Supplier);
      items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
      onData(items);
    },
    (err) => {
      console.warn("Suppliers listener warning/permission issue:", err.message);
    }
  );
};

/** Add new supplier */
export const addSupplier = async (
  ownerId: string,
  data: { name: string; phone?: string; address?: string }
): Promise<string> => {
  const ref = await addDoc(collection(db, "suppliers"), {
    ownerId,
    name: data.name.trim(),
    phone: data.phone?.trim() || "",
    address: data.address?.trim() || "",
    balance: 0,
    createdAt: new Date().toISOString(),
  });
  return ref.id;
};

/** Record a purchase from supplier (Maal uthaya) */
export const addSupplierPurchase = async (
  ownerId: string,
  purchase: {
    supplierId: string;
    supplierName: string;
    billNo?: string;
    items: Array<{
      productId?: string;
      productName: string;
      qty: number;
      buyingPrice: number;
      total: number;
      destinationLocation: "gudam" | "shop";
    }>;
    totalAmount: number;
    paidAmount: number;
    notes?: string;
  }
): Promise<string> => {
  const balanceAmount = purchase.totalAmount - purchase.paidAmount;

  // 1. Add purchase bill
  const purchaseRef = await addDoc(collection(db, "supplier_purchases"), {
    ownerId,
    ...purchase,
    balanceAmount,
    date: new Date().toISOString(),
  });

  // 2. Update Supplier balance (Add unpaid balance amount to supplier ledger)
  if (balanceAmount !== 0) {
    const supplierRef = doc(db, "suppliers", purchase.supplierId);
    // Fetch existing supplier balance
    const suppliersSnap = await getDocs(
      query(collection(db, "suppliers"), where("ownerId", "==", ownerId))
    );
    const targetSupplier = suppliersSnap.docs.find((d) => d.id === purchase.supplierId);
    if (targetSupplier) {
      const currentBalance = targetSupplier.data().balance || 0;
      await updateDoc(supplierRef, {
        balance: currentBalance + balanceAmount,
      });
    }
  }

  // 3. Increment stock in destination location if productId provided
  for (const item of purchase.items) {
    if (item.productId) {
      const productRef = doc(db, "products", item.productId);
      const prodSnap = await getDocs(query(collection(db, "products"), where("ownerId", "==", ownerId)));
      const targetProd = prodSnap.docs.find((d) => d.id === item.productId);
      if (targetProd) {
        const pData = targetProd.data();
        let gudamStock = pData.gudamStock ?? 0;
        let shopStock = pData.shopStock ?? pData.stock ?? 0;

        if (item.destinationLocation === "gudam") {
          gudamStock += item.qty;
        } else {
          shopStock += item.qty;
        }
        await updateDoc(productRef, {
          gudamStock,
          shopStock,
          stock: gudamStock + shopStock,
          buyingPrice: item.buyingPrice, // Update latest buying price
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  return purchaseRef.id;
};

/** Record payment made to a supplier (Payout) */
export const addSupplierPayment = async (
  ownerId: string,
  payment: {
    supplierId: string;
    supplierName: string;
    amount: number;
    method: "Cash" | "Bank Account";
    note?: string;
  }
): Promise<string> => {
  const ref = await addDoc(collection(db, "supplier_payments"), {
    ownerId,
    ...payment,
    date: new Date().toISOString(),
  });

  // Deduct from supplier balance
  const suppliersSnap = await getDocs(
    query(collection(db, "suppliers"), where("ownerId", "==", ownerId))
  );
  const targetSupplier = suppliersSnap.docs.find((d) => d.id === payment.supplierId);
  if (targetSupplier) {
    const currentBalance = targetSupplier.data().balance || 0;
    await updateDoc(doc(db, "suppliers", payment.supplierId), {
      balance: currentBalance - payment.amount,
    });
  }

  return ref.id;
};

/** List all supplier purchases */
export const listSupplierPurchases = async (ownerId: string): Promise<SupplierPurchase[]> => {
  const snap = await getDocs(
    query(collection(db, "supplier_purchases"), where("ownerId", "==", ownerId))
  );
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SupplierPurchase);
  return items.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
};

/** List all supplier payments */
export const listSupplierPayments = async (ownerId: string): Promise<SupplierPayment[]> => {
  const snap = await getDocs(
    query(collection(db, "supplier_payments"), where("ownerId", "==", ownerId))
  );
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SupplierPayment);
  return items.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
};
