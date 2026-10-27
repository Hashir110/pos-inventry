"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "react-toastify";
import FormField from "./FormField";
import { useLanguage } from "../store/useLanguage";
import { onEnter } from "../lib/keys";
import { useStore } from "../store/useStore";
import { customerLabel, formatMoney } from "../lib/format";
import { updateSaleFull } from "../lib/services/sales";
import { listProducts } from "../lib/services/products";
import ProductSelect from "./ProductSelect";
import type { Product, Sale, UnitType } from "../types";

interface EditSaleModalProps {
  sale: Sale | null;
  onClose: () => void;
  onSaved: (updated: Sale) => void;
}

interface ItemDraft {
  id: string;
  productId: string;
  name: string;
  type: UnitType;
  weightPerBag?: number;
  buyingPrice: number;
  qty: string;
  weight: string;
  manual: boolean;
  price: string;
}

export default function EditSaleModal({ sale, onClose, onSaved }: EditSaleModalProps) {
  const { t } = useLanguage();
  const { currentUser } = useStore();
  const [draft, setDraft] = useState<ItemDraft[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [extra, setExtra] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!sale) return;
    setDraft(
      sale.items.map((i, idx) => ({
        id: i.id || `item_${idx}`,
        productId: i.productId || i.id || "",
        name: i.name,
        type: i.type || "count",
        weightPerBag: i.weightPerBag || 25,
        buyingPrice: i.buyingPrice || 0,
        qty: String(i.qty),
        weight: i.type === "weight" ? String(i.totalWeight ?? i.qty * (i.weightPerBag || 25)) : "",
        manual: !!i.isManualWeight,
        price: String(i.price),
      }))
    );
    setExtra(sale.extraCharges ? String(sale.extraCharges) : "");

    const uid = currentUser?.uid || sale.ownerId;
    if (uid) {
      listProducts(uid)
        .then(setProducts)
        .catch(() => {});
    }
  }, [sale, currentUser]);

  if (!sale) return null;

  const hasReturns = (sale.refundedAmount ?? 0) > 0 || sale.items.some((i) => (i.returnedQty ?? 0) > 0);

  const changeProduct = (index: number, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    setDraft((prev) =>
      prev.map((d, i) => {
        if (i !== index) return d;
        const isWeight = prod.unitType === "weight";
        const qtyNum = parseFloat(d.qty) || 1;
        const bagWeight = 25;
        return {
          ...d,
          productId: prod.id,
          name: prod.name,
          type: prod.unitType || "count",
          weightPerBag: bagWeight,
          buyingPrice: prod.buyingPrice ?? 0,
          price: String(prod.sellingPrice ?? d.price),
          weight: isWeight ? String(qtyNum * bagWeight) : "",
          manual: false,
        };
      })
    );
  };

  const change = (index: number, field: "qty" | "weight" | "price", value: string) => {
    setDraft((prev) =>
      prev.map((d, i) => {
        if (i !== index) return d;
        if (field === "weight") return { ...d, weight: value, manual: true };
        if (field === "price") return { ...d, price: value };
        const perBag = d.weightPerBag || 25;
        const auto = d.manual ? d.weight : String((parseFloat(value) || 0) * perBag);
        return {
          ...d,
          qty: value,
          weight: d.type === "weight" ? auto : d.weight,
        };
      })
    );
  };

  const addItem = () => {
    if (products.length === 0) {
      toast.error("No products available to add");
      return;
    }
    const existingIds = new Set(draft.map((d) => d.productId));
    const prod = products.find((p) => !existingIds.has(p.id)) || products[0];
    const isWeight = prod.unitType === "weight";
    const bagWeight = 25;
    const newItem: ItemDraft = {
      id: `new_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      productId: prod.id,
      name: prod.name,
      type: prod.unitType || "count",
      weightPerBag: bagWeight,
      buyingPrice: prod.buyingPrice ?? 0,
      qty: "1",
      weight: isWeight ? String(bagWeight) : "",
      manual: false,
      price: String(prod.sellingPrice || 0),
    };
    setDraft((prev) => [...prev, newItem]);
  };

  const removeItem = (index: number) => {
    if (draft.length <= 1) {
      toast.error(t("sales_errAtLeastOneItem") || "Invoice must contain at least one item");
      return;
    }
    setDraft((prev) => prev.filter((_, i) => i !== index));
  };

  const lineTotal = (index: number) => {
    const d = draft[index];
    if (!d) return 0;
    const units = d.type === "weight" ? parseFloat(d.weight) || 0 : parseFloat(d.qty) || 0;
    return units * (parseFloat(d.price) || 0);
  };

  const extraNow = Math.max(0, parseFloat(extra) || 0);
  const grand = draft.reduce((sum, _item, i) => sum + lineTotal(i), 0) + extraNow;

  const handleSave = async () => {
    const uid = currentUser?.uid || sale.ownerId;
    if (!uid) {
      toast.error("User not authenticated");
      return;
    }
    if (draft.length === 0) {
      toast.error(t("sales_errAtLeastOneItem") || "Invoice must contain at least one item");
      return;
    }
    for (const d of draft) {
      if (!(parseFloat(d.qty) > 0)) {
        toast.error(t("sales_errQtyInvalid", { name: d.name }));
        return;
      }
      if (d.type === "weight" && !(parseFloat(d.weight) > 0)) {
        toast.error(t("sales_errWeightInvalid", { name: d.name }));
        return;
      }
    }
    setSaving(true);
    try {
      const updated = await updateSaleFull(sale.id, uid, {
        items: draft.map((d) => ({
          id: d.id,
          productId: d.productId,
          name: d.name,
          type: d.type,
          weightPerBag: d.weightPerBag,
          buyingPrice: d.buyingPrice,
          qty: Math.max(0.1, parseFloat(d.qty) || 0),
          price: Math.max(0, parseFloat(d.price) || 0),
          ...(d.type === "weight"
            ? { totalWeight: Math.max(0.1, parseFloat(d.weight) || 0), isManualWeight: d.manual }
            : {}),
        })),
        extraCharges: extraNow,
      });
      toast.success(t("editSale_saved"));
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("editSale_failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-pop">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <div>
            <h3 className="text-base font-extrabold text-stone-900">{t("editSale_title", { invoice: sale.invoiceNo })}</h3>
            <p className="text-xs text-stone-500">{customerLabel(sale.customerName)}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700">
            <X size={20} />
          </button>
        </div>

        <div
          className="flex-1 space-y-4 overflow-y-auto p-5"
          onKeyDown={onEnter(() => { if (!saving && !hasReturns) handleSave(); })}
        >
          {hasReturns && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              {t("editSale_returned")}
            </p>
          )}

          <div className="overflow-x-auto rounded-xl border border-stone-200 min-h-[260px] pb-32">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-100">
                <tr>
                  <th className="px-3 py-2.5">{t("editSale_colItem")}</th>
                  <th className="px-3 py-2.5 text-center">{t("editSale_colBagsQty")}</th>
                  <th className="px-3 py-2.5 text-center">{t("editSale_colWeight")}</th>
                  <th className="px-3 py-2.5 text-center">{t("editSale_colRate")}</th>
                  <th className="px-3 py-2.5 text-right">{t("total")}</th>
                  <th className="px-2 py-2.5 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {draft.map((d, i) => {
                  const isWeight = d.type === "weight";
                  return (
                    <tr key={d.id || i}>
                      <td className="px-3 py-2.5">
                        <ProductSelect
                          products={products}
                          value={d.productId}
                          displayName={d.name}
                          onChange={(prod) => changeProduct(i, prod.id)}
                          disabled={hasReturns}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="number"
                          min="0.1"
                          step="any"
                          value={d.qty}
                          onChange={(e) => change(i, "qty", e.target.value)}
                          disabled={hasReturns}
                          className="field !w-20 !py-1.5 text-center font-bold"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {isWeight ? (
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={d.weight}
                            onChange={(e) => change(i, "weight", e.target.value)}
                            disabled={hasReturns}
                            className={`field !w-24 !py-1.5 text-center font-bold ${d.manual ? "!border-amber-300 !bg-amber-50" : ""}`}
                          />
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={d.price}
                          onChange={(e) => change(i, "price", e.target.value)}
                          disabled={hasReturns}
                          className="field !w-24 !py-1.5 text-center font-bold"
                        />
                      </td>
                      <td className="tabular px-3 py-2.5 text-right font-bold text-stone-900">{formatMoney(lineTotal(i))}</td>
                      <td className="px-2 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(i)}
                          disabled={draft.length <= 1 || hasReturns}
                          title={draft.length <= 1 ? "At least one item required" : "Remove item"}
                          className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-20"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!hasReturns && (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1.5 rounded-xl border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-100 hover:border-brand-400 shadow-sm"
              >
                <Plus size={16} /> {t("sales_addItem") || "Add Item"}
              </button>
              <span className="text-xs text-stone-400 font-medium">
                {draft.length} {t("items")}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-end justify-between gap-4">
            <FormField label={t("editSale_extra")} className="w-full sm:w-64">
              <input
                type="number"
                min="0"
                step="any"
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                disabled={hasReturns}
                placeholder="0"
                className="field font-bold"
              />
            </FormField>
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">{t("total")}</p>
              <p className="tabular text-2xl font-extrabold text-stone-900">{formatMoney(grand)}</p>
            </div>
          </div>

          <p className="text-xs text-stone-400">
            {t(sale.paymentMethod === "Udhar" ? "editSale_stockNoteCredit" : "editSale_stockNote")}
          </p>
        </div>

        <div className="flex gap-3 border-t border-stone-200 bg-stone-50 px-5 py-4">
          <button onClick={onClose} disabled={saving} className="btn-ghost flex-1">
            {t("cancel")}
          </button>
          <button onClick={handleSave} disabled={saving || hasReturns} className="btn-primary flex-1">
            {saving ? <Loader2 className="animate-spin" size={18} /> : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
