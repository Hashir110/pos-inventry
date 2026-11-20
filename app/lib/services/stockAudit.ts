// app/lib/services/stockAudit.ts
import {
  collection,
  doc,
  addDoc,
  writeBatch,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../firebase";
import { listProducts } from "./products";
import type { Product } from "../../types";

export interface RealAuditItem {
  id: string; // product id
  sku: string;
  name: string;
  category: string;
  systemStock: number;
  physicalCount: number;
  unit: string;
  buyingPrice: number;
  sellingPrice: number;
  status: "matched" | "discrepancy";
  lastCounted: string;
}

export interface StockAuditAdjustment {
  productId: string;
  name: string;
  oldStock: number;
  newStock: number;
  variance: number;
  unitBuyingPrice: number;
  financialImpact: number;
  reason: string;
}

export interface StockAuditLog {
  id?: string;
  ownerId: string;
  date: string;
  totalAdjusted: number;
  netUnitsVariance: number;
  financialImpact: number;
  items: StockAuditAdjustment[];
}

export interface StockAuditMetrics {
  totalAssetValue: number;
  trackedSkus: number;
  lowStockCount: number;
  outOfStockCount: number;
  discrepancyCount: number;
}

/**
 * Loads real products from Firestore and converts them into Audit Items
 */
export const loadAuditProducts = async (ownerId: string): Promise<RealAuditItem[]> => {
  const products = await listProducts(ownerId, true);

  return products.map((p) => {
    const stockVal = Number(p.stock) || 0;
    return {
      id: p.id,
      sku: p.id.slice(0, 8).toUpperCase(),
      name: p.name,
      category: p.category || "General",
      systemStock: stockVal,
      physicalCount: stockVal, // Defaults to matching until user changes count
      unit: p.unitType === "weight" ? "kg" : "pcs",
      buyingPrice: Number(p.buyingPrice) || 0,
      sellingPrice: Number(p.sellingPrice) || 0,
      status: "matched",
      lastCounted: p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : "Uncounted",
    };
  });
};

/**
 * Calculates asset value and stock health KPIs
 */
export const calculateStockAuditMetrics = (items: RealAuditItem[]): StockAuditMetrics => {
  let totalAssetValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let discrepancyCount = 0;

  items.forEach((item) => {
    totalAssetValue += item.physicalCount * (item.sellingPrice || item.buyingPrice || 0);

    if (item.systemStock === 0) {
      outOfStockCount++;
    } else if (item.systemStock <= 5) {
      lowStockCount++;
    }

    if (item.physicalCount !== item.systemStock) {
      discrepancyCount++;
    }
  });

  return {
    totalAssetValue,
    trackedSkus: items.length,
    lowStockCount,
    outOfStockCount,
    discrepancyCount,
  };
};

/**
 * Saves audit adjustments to Firestore in a single batch
 * - Updates product.stock in `products` collection
 * - Logs the audit session in `stock_audits` collection
 */
export const applyStockAuditReconciliation = async (
  ownerId: string,
  adjustments: StockAuditAdjustment[]
): Promise<string> => {
  if (adjustments.length === 0) {
    throw new Error("No discrepancies to adjust");
  }

  const batch = writeBatch(db);
  const now = new Date().toISOString();

  let netUnitsVariance = 0;
  let totalFinancialImpact = 0;

  // 1. Update each product's stock in Firestore
  for (const adj of adjustments) {
    const productRef = doc(db, "products", adj.productId);
    batch.update(productRef, {
      stock: adj.newStock,
      updatedAt: now,
    });

    netUnitsVariance += adj.variance;
    totalFinancialImpact += adj.financialImpact;
  }

  // 2. Commit product updates
  await batch.commit();

  // 3. Save Audit Log Record to `stock_audits`
  const auditLog: StockAuditLog = {
    ownerId,
    date: now,
    totalAdjusted: adjustments.length,
    netUnitsVariance,
    financialImpact: totalFinancialImpact,
    items: adjustments,
  };

  const logRef = await addDoc(collection(db, "stock_audits"), auditLog);
  return logRef.id;
};

/**
 * Fetches past audit session history
 */
export const listPastStockAudits = async (
  ownerId: string,
  max = 10
): Promise<StockAuditLog[]> => {
  try {
    const q = query(
      collection(db, "stock_audits"),
      where("ownerId", "==", ownerId),
      orderBy("date", "desc"),
      limit(max)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as StockAuditLog) }));
  } catch (error) {
    console.warn("Could not fetch past audits history:", error);
    return [];
  }
};
