"use client";

import { useState } from "react";
import { ChevronDown, Save, Loader2 } from "lucide-react";
import type { ProductInput } from "../lib/services/products";
import type { UnitType } from "../types";
import { useRouter } from "next/navigation";
import { useLanguage } from "../store/useLanguage";

interface FormValues {
  name: string;
  sellingPrice: string;
  gudamStock: string;
  shopStock: string;
  unitType: UnitType;
  category: string;
}

interface ProductFormProps {
  initial?: ProductInput;
  mode: "add" | "edit";
  onSubmit: (values: ProductInput) => Promise<void>;
}

export default function ProductForm({ initial, mode, onSubmit }: ProductFormProps) {
  const isEdit = mode === "edit";
  const router = useRouter();
  const { t } = useLanguage();
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<FormValues>({
    name: initial?.name ?? "",
    sellingPrice: initial ? String(initial.sellingPrice) : "",
    gudamStock: initial ? String(initial.gudamStock ?? 0) : "0",
    shopStock: initial ? String(initial.shopStock ?? initial.stock ?? 0) : "0",
    unitType: initial?.unitType ?? "weight",
    category: initial?.category ?? "",
  });

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const gudam = parseFloat(form.gudamStock) || 0;
    const shop = parseFloat(form.shopStock) || 0;
    const total = gudam + shop;

    try {
      await onSubmit({
        name: form.name.trim(),
        buyingPrice: initial?.buyingPrice ?? 0,
        sellingPrice: parseFloat(form.sellingPrice) || 0,
        stock: total,
        gudamStock: gudam,
        shopStock: shop,
        unitType: form.unitType,
        category: form.category.trim(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-white">
          <h5 className="flex items-center gap-2 text-sm font-bold text-stone-800">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-orange-500 text-orange-500 text-xs font-bold">
              i
            </span>
            <span>{t("productForm_info")}</span>
          </h5>
          <ChevronDown size={18} className="text-stone-400" />
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                {t("productForm_name")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder={t("productForm_namePlaceholder")}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                {t("category")}
              </label>
              <input
                type="text"
                placeholder={t("productForm_categoryPlaceholder")}
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                {t("productForm_unitType")} <span className="text-red-500">*</span>
              </label>
              <select
                value={form.unitType}
                onChange={(e) => set("unitType", e.target.value as UnitType)}
                className="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              >
                <option value="weight">{t("productForm_byWeight")}</option>
                <option value="count">{t("productForm_byCount")}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-white">
          <h5 className="flex items-center gap-2 text-sm font-bold text-stone-800">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-orange-500 text-orange-500 text-xs font-bold">
              i
            </span>
            <span>{t("productForm_pricingStock")}</span>
          </h5>
          <ChevronDown size={18} className="text-stone-400" />
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                {form.unitType === "weight" ? t("productForm_sellPriceKg") : t("productForm_sellPricePc")} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                placeholder="0"
                value={form.sellingPrice}
                onChange={(e) => set("sellingPrice", e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-purple-900 mb-1">
                {t("productForm_warehouseStock", { unit: form.unitType === "weight" ? t("productForm_unitBags") : t("productForm_unitPieces") })} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                step="any"
                placeholder="0"
                value={form.gudamStock}
                onChange={(e) => set("gudamStock", e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-lg text-xs font-medium text-purple-950 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-blue-900 mb-1">
                {t("productForm_shopStock", { unit: form.unitType === "weight" ? t("productForm_unitBags") : t("productForm_unitPieces") })} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                step="any"
                placeholder="0"
                value={form.shopStock}
                onChange={(e) => set("shopStock", e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-lg text-xs font-medium text-blue-950 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <p className="text-[11px] text-stone-500 mt-4 bg-stone-50 p-2.5 rounded-lg border border-stone-200 flex items-center gap-1.5">
            <span className="font-bold text-brand-700">{t("productForm_note")}</span>
            <span>{t("productForm_noteText")}</span>
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg text-xs font-bold transition"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="min-w-[125px] px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 transition min-h-[38px]"
        >
          {submitting ? (
            <Loader2 className="animate-spin text-white" size={16} />
          ) : (
            <>
              <Save size={16} />
              <span>{isEdit ? t("productForm_update") : t("productForm_save")}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
