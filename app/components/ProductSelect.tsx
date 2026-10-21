"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Package, Search, X } from "lucide-react";
import type { Product } from "../types";

interface ProductSelectProps {
  products: Product[];
  value: string;
  displayName?: string;
  onChange: (product: Product) => void;
  disabled?: boolean;
}

export default function ProductSelect({
  products,
  value,
  displayName,
  onChange,
  disabled = false,
}: ProductSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => products.find((p) => p.id === value) ?? null,
    [products, value]
  );

  const label = selected?.name || displayName || "Select Product";

  const term = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!term) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.category && p.category.toLowerCase().includes(term))
    );
  }, [products, term]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      const timer = setTimeout(() => searchInputRef.current?.focus(), 40);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        clearTimeout(timer);
      };
    }
  }, [isOpen]);

  return (
    <div className="relative w-full min-w-[200px]" ref={rootRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 bg-white rounded-lg border text-left transition shadow-sm ${
          isOpen
            ? "border-brand-500 ring-2 ring-brand-500/15"
            : "border-stone-300 hover:border-brand-400"
        } ${disabled ? "opacity-60 cursor-not-allowed bg-stone-50" : "cursor-pointer"}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">
            <Package size={14} />
          </span>
          <span className="font-bold text-xs text-stone-900 truncate">
            {label}
          </span>
          {selected && (
            <span
              className={`hidden sm:inline-block text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                selected.unitType === "weight"
                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                  : "bg-blue-50 text-blue-700 border border-blue-200"
              }`}
            >
              {selected.unitType === "weight" ? "Weight" : "Count"}
            </span>
          )}
        </div>
        <ChevronDown
          size={14}
          className={`text-stone-400 shrink-0 transition-transform ${
            isOpen ? "rotate-180 text-brand-600" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 top-full mt-1.5 z-[150] w-72 sm:w-80 bg-white rounded-xl border border-stone-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Search box */}
          <div className="p-2.5 border-b border-stone-100 bg-stone-50/80">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products by name or category..."
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-semibold text-stone-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Product items list */}
          <div className="max-h-60 overflow-y-auto divide-y divide-stone-100">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-xs text-stone-400">
                No products found {search ? `matching "${search}"` : ""}
              </div>
            ) : (
              filtered.map((prod) => {
                const isSelected = prod.id === value;
                const isWeight = prod.unitType === "weight";
                return (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => {
                      onChange(prod);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full px-3.5 py-2 text-left flex items-center justify-between text-xs transition ${
                      isSelected
                        ? "bg-brand-50 text-brand-900 font-bold"
                        : "hover:bg-stone-50 text-stone-800"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold truncate">{prod.name}</span>
                        {prod.category && (
                          <span className="text-[10px] text-stone-400 font-normal truncate">
                            • {prod.category}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                            isWeight
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {isWeight ? "Weight (Kg/Bags)" : "Count (Pcs)"}
                        </span>
                        <span className="text-[10px] font-semibold text-stone-500 tabular">
                          Rs. {prod.sellingPrice}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <Check size={16} className="text-brand-600 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
