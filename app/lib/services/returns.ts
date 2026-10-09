import { collection, doc, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import type { Customer, Product, Sale } from "../../types";

/**
 * Sale ke ek item ka return: stock wapas + sale update + returns record, sab ek transaction mein.
 * Line discount flat hota hai, isliye refund mein return ki qty ke hisaab se uska hissa minus hota hai.
 * Return: refund amount.
 */
export const processReturn = async (
  saleId: string,
  itemIndex: number,
  itemId: string,
  returnQty: number
): Promise<number> => {
  const saleRef = doc(db, "sales", saleId);
  const returnRef = doc(collection(db, "returns"));
  let refundAmount = 0;

  await runTransaction(db, async (transaction) => {
    // --- READS ---
    const saleSnap = await transaction.get(saleRef);
    if (!saleSnap.exists()) throw new Error("Sale not found");
    const sale = saleSnap.data() as Omit<Sale, "id">;

    // Taza data se dobara check (doosri tab/device se return ho chuka ho sakta hai)
    const item = sale.items?.[itemIndex];
    if (!item || item.id !== itemId) throw new Error("Sale items changed, search again");
    const available = item.qty - (item.returnedQty || 0);
    if (returnQty > available) throw new Error(`Max limit is ${available}`);

    const productRef = doc(db, "products", item.id);
    const productSnap = await transaction.get(productRef);

    // Udhar sale ka return: customer ka udhar bhi utna kam hona chahiye
    const customerRef =
      sale.paymentMethod === "Udhar" && sale.customerId ? doc(db, "customers", sale.customerId) : null;
    const customerSnap = customerRef ? await transaction.get(customerRef) : null;

    // --- REFUND ---
    const unitPrice = Number(item.price ?? item.sellingPrice ?? 0);
    const discountShare = (item.discount || 0) * (returnQty / item.qty);
    refundAmount = Math.round((returnQty * unitPrice - discountShare) * 100) / 100;
    if (isNaN(refundAmount)) throw new Error("Price calculation error");

    // --- WRITES ---
    if (productSnap.exists()) {
      transaction.update(productRef, { stock: (productSnap.data() as Product).stock + returnQty });
    }

    if (customerRef && customerSnap?.exists()) {
      const balance = (customerSnap.data() as Customer).balance || 0;
      transaction.update(customerRef, { balance: Math.max(0, Math.round((balance - refundAmount) * 100) / 100) });
    }

    const updatedItems = sale.items.map((it, i) =>
      i === itemIndex ? { ...it, returnedQty: (it.returnedQty || 0) + returnQty } : it
    );
    transaction.update(saleRef, {
      items: updatedItems,
      refundedAmount: (sale.refundedAmount || 0) + refundAmount,
    });

    transaction.set(returnRef, {
      originalSaleId: saleRef.id,
      itemName: item.name,
      productId: item.id,
      qty: returnQty,
      unitPrice,
      refundAmount,
      date: new Date().toISOString(),
      ownerId: sale.ownerId,
    });
  });

  return refundAmount;
};
