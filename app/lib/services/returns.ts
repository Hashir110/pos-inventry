import { collection, doc, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import type { Customer, Product, Sale } from "../../types";
import { tr } from "../i18n/translate";

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
    const saleSnap = await transaction.get(saleRef);
    if (!saleSnap.exists()) throw new Error(tr("returns_err_saleNotFound"));
    const sale = saleSnap.data() as Omit<Sale, "id">;

    const item = sale.items?.[itemIndex];
    if (!item || item.id !== itemId) throw new Error(tr("returns_err_itemsChanged"));
    const available = item.qty - (item.returnedQty || 0);
    if (returnQty > available) throw new Error(tr("returns_err_maxLimit", { available }));

    const productRef = doc(db, "products", item.id);
    const productSnap = await transaction.get(productRef);

    const customerRef =
      sale.paymentMethod === "Udhar" && sale.customerId ? doc(db, "customers", sale.customerId) : null;
    const customerSnap = customerRef ? await transaction.get(customerRef) : null;

    const isWeight = item.type === "weight";
    const bagWeight = item.weightPerBag || 25;
    const unitPrice = Number(item.price ?? item.sellingPrice ?? 0);
    const returnUnits = isWeight ? returnQty * bagWeight : returnQty;
    refundAmount = Math.round(returnUnits * unitPrice * 100) / 100;
    if (isNaN(refundAmount)) throw new Error(tr("returns_err_priceCalc"));

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
