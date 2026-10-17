"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "react-toastify";
import FormField from "./FormField";
import { customerLabel, formatMoney } from "../lib/format";
import { updateSaleItems } from "../lib/services/sales";
import type { Sale } from "../types";

interface EditSaleModalProps {
  sale: Sale | null;
  onClose: () => void;
  onSaved: (updated: Sale) => void;
}

interface ItemDraft {
  qty: string;
  weight: string;
  manual: boolean;
  price: string;
}

export default function EditSaleModal({ sale, onClose, onSaved }: EditSaleModalProps) {
  const [draft, setDraft] = useState<ItemDraft[]>([]);
  const [extra, setExtra] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!sale) return;
    setDraft(
      sale.items.map((i) => ({
        qty: String(i.qty),
        weight: i.type === "weight" ? String(i.totalWeight ?? i.qty * (i.weightPerBag || 25)) : "",
        manual: !!i.isManualWeight,
        price: String(i.price),
      }))
    );
    setExtra(sale.extraCharges ? String(sale.extraCharges) : "");
  }, [sale]);

  if (!sale) return null;

  const hasReturns = (sale.refundedAmount ?? 0) > 0 || sale.items.some((i) => (i.returnedQty ?? 0) > 0);

  const change = (index: number, field: "qty" | "weight" | "price", value: string) => {
    setDraft((prev) =>
      prev.map((d, i) => {
        if (i !== index) return d;
        if (field === "weight") return { ...d, weight: value, manual: true };
        if (field === "price") return { ...d, price: value };
        const isWeight = sale.items[i].type === "weight";
        const perBag = sale.items[i].weightPerBag || 25;
        return {
          ...d,
          qty: value,
          weight: isWeight && !d.manual ? String((parseFloat(value) || 0) * perBag) : d.weight,
        };
      })
    );
  };

  const lineTotal = (index: number) => {
    const d = draft[index];
    if (!d) return 0;
    const units = sale.items[index].type === "weight" ? parseFloat(d.weight) || 0 : parseFloat(d.qty) || 0;
    return units * (parseFloat(d.price) || 0);
  };

  const extraNow = Math.max(0, parseFloat(extra) || 0);
  const grand = sale.items.reduce((sum, _item, i) => sum + lineTotal(i), 0) + extraNow;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { items, totalAmount, extraCharges } = await updateSaleItems(
        sale.id,
        draft.map((d, i) => ({
          qty: parseFloat(d.qty),
          price: parseFloat(d.price),
          ...(sale.items[i].type === "weight" ? { totalWeight: parseFloat(d.weight) } : {}),
        })),
        extraNow
      );
      toast.success("Bill update ho gaya");
      onSaved({ ...sale, items, totalAmount, extraCharges });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bill update nahi hua");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-pop">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <div>
            <h3 className="text-base font-extrabold text-stone-900">Bill Edit — #{sale.invoiceNo}</h3>
            <p className="text-xs text-stone-500">{customerLabel(sale.customerName)}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {hasReturns && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              Is bill par return ho chuka hai, is liye edit nahi ho sakta.
            </p>
          )}

          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-100">
                <tr>
                  <th className="px-3 py-2.5">Item</th>
                  <th className="px-3 py-2.5 text-center">Bags / Qty</th>
                  <th className="px-3 py-2.5 text-center">Weight (kg)</th>
                  <th className="px-3 py-2.5 text-center">Rate</th>
                  <th className="px-3 py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {sale.items.map((item, i) => {
                  const isWeight = item.type === "weight";
                  return (
                    <tr key={i}>
                      <td className="px-3 py-2.5 font-semibold text-stone-900">{item.name}</td>
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="number"
                          min="1"
                          step="any"
                          value={draft[i]?.qty ?? ""}
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
                            value={draft[i]?.weight ?? ""}
                            onChange={(e) => change(i, "weight", e.target.value)}
                            disabled={hasReturns}
                            className={`field !w-24 !py-1.5 text-center font-bold ${draft[i]?.manual ? "!border-amber-300 !bg-amber-50" : ""}`}
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
                          value={draft[i]?.price ?? ""}
                          onChange={(e) => change(i, "price", e.target.value)}
                          disabled={hasReturns}
                          className="field !w-24 !py-1.5 text-center font-bold"
                        />
                      </td>
                      <td className="tabular px-3 py-2.5 text-right font-bold text-stone-900">{formatMoney(lineTotal(i))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <FormField label="Extra Charges (transport waghera)" className="w-full sm:w-64">
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
              <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Total</p>
              <p className="tabular text-2xl font-extrabold text-stone-900">{formatMoney(grand)}</p>
            </div>
          </div>

          <p className="text-xs text-stone-400">
            Stock{sale.paymentMethod === "Udhar" ? " aur party ka udhar" : ""} farq ke hisaab se khud theek ho jayega.
          </p>
        </div>

        <div className="flex gap-3 border-t border-stone-200 bg-stone-50 px-5 py-4">
          <button onClick={onClose} disabled={saving} className="btn-ghost flex-1">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || hasReturns} className="btn-primary flex-1">
            {saving ? <Loader2 className="animate-spin" size={18} /> : "Save Karein"}
          </button>
        </div>
      </div>
    </div>
  );
}
