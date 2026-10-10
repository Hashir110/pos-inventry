"use client";

import { useState } from "react";
import { Info, ChevronDown, Save, Loader2 } from "lucide-react";
import type { ProductInput } from "../lib/services/products";
import type { UnitType } from "../types";
import { useRouter } from "next/navigation";

interface FormValues {
  name: string;
  buyingPrice: string;
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
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<FormValues>({
    name: initial?.name ?? "",
    buyingPrice: initial ? String(initial.buyingPrice) : "",
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
        buyingPrice: parseFloat(form.buyingPrice) || 0,
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
    <form onSubmit={handleSubmit} className="space-y-6 max-w-6xl mx-auto">
      {/* Accordion Card 1: Product Information */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        {/* Card Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-white">
          <h5 className="flex items-center gap-2 text-sm font-bold text-stone-800">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-orange-500 text-orange-500 text-xs font-bold">
              i
            </span>
            <span>Product Information</span>
          </h5>
          <ChevronDown size={18} className="text-stone-400" />
        </div>

        {/* Card Body */}
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {/* Product Name */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Enter product name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Category
              </label>
              <input
                type="text"
                placeholder="e.g. Rice, Atta, Groceries"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Selling Type / Unit */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Unit / Selling Type <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={form.unitType}
                  onChange={(e) => set("unitType", e.target.value as UnitType)}
                  className="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-900 appearance-none focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 pr-8"
                >
                  <option value="weight">By Weight (KG)</option>
                  <option value="count">By Count (Pieces / Bags)</option>
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-3 top-3 text-stone-400 pointer-events-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accordion Card 2: Pricing & Stocks */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        {/* Card Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-white">
          <h5 className="flex items-center gap-2 text-sm font-bold text-stone-800">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-orange-500 text-orange-500 text-xs font-bold">
              i
            </span>
            <span>Pricing & Stocks</span>
          </h5>
          <ChevronDown size={18} className="text-stone-400" />
        </div>

        {/* Card Body */}
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {/* Buying Price */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Buying Price (Khareed Rate) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.buyingPrice}
                onChange={(e) => set("buyingPrice", e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Selling Price */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Selling Price (Sale Rate) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.sellingPrice}
                onChange={(e) => set("sellingPrice", e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Gudam Stock */}
            <div>
              <label className="block text-xs font-bold text-purple-900 mb-1">
                Gudam (Warehouse) Stock <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                placeholder="0"
                value={form.gudamStock}
                onChange={(e) => set("gudamStock", e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-lg text-xs font-medium text-purple-950 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>

            {/* Shop Stock */}
            <div>
              <label className="block text-xs font-bold text-blue-900 mb-1">
                Dukan (Shop) Stock <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                placeholder="0"
                value={form.shopStock}
                onChange={(e) => set("shopStock", e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-lg text-xs font-medium text-blue-950 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Form Action Buttons */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg text-xs font-bold transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm disabled:opacity-50 transition"
        >
          {submitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          {isEdit ? "Update Product" : "Save Product"}
        </button>
      </div>
    </form>
  );
}
