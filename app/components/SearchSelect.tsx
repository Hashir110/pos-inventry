"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Loader2, Plus, Search, X } from "lucide-react";
import { useLanguage } from "../store/useLanguage";

export interface SearchSelectOption {
  id: string;
  label: string;
}

interface SearchSelectProps {
  options: SearchSelectOption[];
  value: string;
  onChange: (option: SearchSelectOption | null) => void;
  placeholder: string;
  searchPlaceholder?: string;
  icon: ReactNode;
  emptyText?: string;
  onCreate?: (name: string) => Promise<void>;
}

export default function SearchSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  icon,
  emptyText,
  onCreate,
}: SearchSelectProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => options.find((o) => o.id === value) ?? null, [options, value]);

  const term = search.trim().toLowerCase();
  const filtered = useMemo(
    () => (term ? options.filter((o) => o.label.toLowerCase().includes(term)) : options),
    [options, term]
  );
  const canCreate = !!onCreate && term.length > 0 && !options.some((o) => o.label.toLowerCase() === term);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const id = setTimeout(() => searchRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
    setSearch("");
  }, [isOpen]);

  const handleCreate = async () => {
    if (!onCreate) return;
    setCreating(true);
    try {
      await onCreate(search.trim());
      setIsOpen(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative w-full" ref={rootRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-white rounded-lg border border-stone-200 text-left transition shadow-sm hover:border-brand-400"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={selected ? "text-brand-600 shrink-0" : "text-stone-400 shrink-0"}>{icon}</span>
          <span className={`truncate text-sm ${selected ? "font-bold text-stone-900" : "font-medium text-stone-500"}`}>
            {selected ? selected.label : placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selected && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              className="p-1 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-100"
              title={t("pos_select_remove")}
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown size={16} className={`text-stone-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-xl border border-stone-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2.5 border-b border-stone-100 bg-stone-50/80">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (filtered.length === 1) {
                      onChange(filtered[0]);
                      setIsOpen(false);
                    } else if (canCreate && filtered.length === 0) {
                      handleCreate();
                    }
                  }
                }}
                placeholder={searchPlaceholder ?? t("search")}
                className="w-full pl-9 pr-8 py-2 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
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

          <div className="max-h-60 overflow-y-auto divide-y divide-stone-50">
            {filtered.length === 0 ? (
              <div className="p-5 text-center text-stone-400 text-xs">{emptyText ?? t("pos_select_nothing_found")}</div>
            ) : (
              filtered.map((o) => {
                const isSelected = o.id === value;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      onChange(o);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between text-xs transition ${
                      isSelected ? "bg-brand-50 text-brand-900 font-bold" : "hover:bg-stone-50 text-stone-800"
                    }`}
                  >
                    <span className="font-bold truncate">{o.label}</span>
                    {isSelected && <Check size={14} className="text-brand-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {canCreate && (
            <div className="p-2 border-t border-stone-100 bg-stone-50">
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="btn-primary w-full !py-2 text-xs flex items-center justify-center gap-1.5 font-bold shadow-sm"
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {t("pos_select_create", { name: search.trim() })}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
