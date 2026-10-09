"use client";

import { useState } from "react";
import { Scale, Hash, Save, Loader2 } from "lucide-react";
import type { ProductInput } from "../lib/services/products";
import type { UnitType } from "../types";

interface FormValues {
  name: string;
  buyingPrice: string;
  sellingPrice: string;
  stock: string;
  unitType: UnitType;
  category: string;
}

interface ProductFormProps {
  /** Edit mode mein maujooda product, add mode mein khali chhodo */
  initial?: ProductInput;
  mode: "add" | "edit";
  onSubmit: (values: ProductInput) => Promise<void>;
}

export default function ProductForm({ initial, mode, onSubmit }: ProductFormProps) {
  const isEdit = mode === "edit";
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormValues>({
    name: initial?.name ?? "",
    buyingPrice: initial ? String(initial.buyingPrice) : "",
    sellingPrice: initial ? String(initial.sellingPrice) : "",
    stock: initial ? String(initial.stock) : "",
    unitType: initial?.unitType ?? "weight",
    category: initial?.category ?? "",
  });

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        name: form.name.trim(),
        buyingPrice: parseFloat(form.buyingPrice),
        sellingPrice: parseFloat(form.sellingPrice),
        stock: parseFloat(form.stock),
        unitType: form.unitType,
        category: form.category.trim(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const unitLabel = form.unitType === "weight" ? "kg" : "pcs";
  const buying = parseFloat(form.buyingPrice);
  const selling = parseFloat(form.sellingPrice);
  const margin = !isNaN(buying) && !isNaN(selling) ? selling - buying : null;

  const unitButton = (type: UnitType, title: string, hint: string, Icon: typeof Scale) => {
    const active = form.unitType === type;
    return (
      <button
        type="button"
        onClick={() => set("unitType", type)}
        className={`flex flex-1 items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
          active ? "border-brand-500 bg-brand-50" : "border-stone-200 bg-white hover:border-stone-300"
        }`}
      >
        <span className={`rounded-lg p-2.5 ${active ? "bg-brand-600 text-white" : "bg-stone-100 text-stone-500"}`}>
          <Icon size={20} />
        </span>
        <span>
          <span className={`block text-sm font-bold ${active ? "text-brand-800" : "text-stone-800"}`}>{title}</span>
          <span className="block text-xs text-stone-500">{hint}</span>
        </span>
      </button>
    );
  };

  const moneyField = (label: string, key: "buyingPrice" | "sellingPrice") => (
    <div>
      <label className="mb-1.5 block text-sm font-bold text-stone-700">
        {label} <span className="font-medium text-stone-400">(per {unitLabel})</span>
      </label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-stone-400">Rs.</span>
        <input
          type="number"
          required
          min="0"
          step="0.01"
          className="field pl-11 font-bold"
          value={form[key]}
          onChange={(e) => set(key, e.target.value)}
        />
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        {/* Basic */}
        <div className="card p-6">
          <h3 className="mb-4 text-base font-bold text-stone-900">Product ki tafseel</h3>
          <label className="mb-1.5 block text-sm font-bold text-stone-700">Naam</label>
          <input
            type="text"
            required
            className="field mb-5"
            placeholder="e.g. Basmati Rice / Panadol"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />

          <label className="mb-1.5 block text-sm font-bold text-stone-700">
            Category <span className="font-medium text-stone-400">(optional — POS par tabs banenge)</span>
          </label>
          <input
            type="text"
            className="field mb-5"
            placeholder="e.g. Atta, Dal, Drinks"
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
          />

          <label className="mb-2 block text-sm font-bold text-stone-700">Kaise bechna hai?</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            {unitButton("weight", "Wazan se", "kg mein (0.5 kg bhi)", Scale)}
            {unitButton("count", "Ginti se", "pieces mein", Hash)}
          </div>
        </div>

        {/* Pricing */}
        <div className="card p-6">
          <h3 className="mb-4 text-base font-bold text-stone-900">Qeemat aur stock</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {moneyField("Khareed qeemat", "buyingPrice")}
            {moneyField("Bikri qeemat", "sellingPrice")}
          </div>

          <label className="mb-1.5 mt-5 block text-sm font-bold text-stone-700">
            {isEdit ? "Maujooda stock" : "Shuru ka stock"} <span className="font-medium text-stone-400">({unitLabel})</span>
          </label>
          <input
            type="number"
            required
            min="0"
            step="0.01"
            className="field"
            value={form.stock}
            onChange={(e) => set("stock", e.target.value)}
          />
        </div>
      </div>

      {/* Side summary */}
      <div className="lg:col-span-1">
        <div className="card sticky top-0 p-6">
          <h3 className="mb-4 text-base font-bold text-stone-900">Khulasa</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-500">Naam</dt>
              <dd className="max-w-[60%] truncate font-bold text-stone-900">{form.name || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">Type</dt>
              <dd className="font-bold text-stone-900">{form.unitType === "weight" ? "Wazan (kg)" : "Ginti (pcs)"}</dd>
            </div>
            <div className="flex justify-between border-t border-stone-100 pt-3">
              <dt className="text-stone-500">Munafa / {unitLabel}</dt>
              <dd
                className={`tabular font-extrabold ${
                  margin === null ? "text-stone-400" : margin >= 0 ? "text-emerald-700" : "text-red-600"
                }`}
              >
                {margin === null ? "—" : `Rs. ${Math.round(margin * 100) / 100}`}
              </dd>
            </div>
          </dl>

          <button type="submit" disabled={submitting} className="btn-primary mt-6 w-full !py-3">
            {submitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            {isEdit ? "Update Product" : "Save Product"}
          </button>
        </div>
      </div>
    </form>
  );
}
