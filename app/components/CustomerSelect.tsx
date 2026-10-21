"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronDown, User, X, Plus, Check, Wallet } from "lucide-react";
import { useLanguage } from "../store/useLanguage";
import AddPartyModal from "./AddPartyModal";
import type { Customer } from "../types";

interface CustomerSelectProps {
  customers: Customer[];
  selectedCustomerId: string;
  onSelectCustomer: (customer: Customer | null) => void;
  isUdhar?: boolean;
}

export default function CustomerSelect({
  customers,
  selectedCustomerId,
  onSelectCustomer,
  isUdhar = false,
}: CustomerSelectProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [showAddPartyModal, setShowAddPartyModal] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const filteredCustomers = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.phone && c.phone.includes(term))
    );
  }, [customers, search]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch("");
    }
  }, [isOpen]);

  const handleGoToUdhar = () => {
    setIsOpen(false);
    router.push("/dashboard/udhar");
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-white rounded-lg border text-left transition shadow-sm ${
          isUdhar && !selectedCustomer
            ? "border-amber-400 ring-2 ring-amber-300/40 bg-amber-50/30"
            : "border-stone-200 hover:border-brand-400"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <User
            size={16}
            className={selectedCustomer ? "text-brand-600 shrink-0" : "text-stone-400 shrink-0"}
          />
          <div className="truncate">
            {selectedCustomer ? (
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-stone-900 truncate">
                  {selectedCustomer.name}
                </span>
                {selectedCustomer.balance > 0 ? (
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">
                    {t("pos_select_due", { amount: Math.round(selectedCustomer.balance).toLocaleString() })}
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">
                    Rs. 0
                  </span>
                )}
              </div>
            ) : (
              <span className="text-sm font-medium text-stone-600">
                {isUdhar ? t("pos_select_party_required") : t("pos_select_counter_sale")}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedCustomer && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onSelectCustomer(null);
              }}
              className="p-1 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-100"
              title={t("pos_select_back_counter")}
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-stone-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-xl border border-stone-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2.5 border-b border-stone-100 bg-stone-50/80">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("pos_select_search_party")}
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
            {!search && (
              <button
                type="button"
                onClick={() => {
                  onSelectCustomer(null);
                  setIsOpen(false);
                }}
                className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between text-xs transition ${
                  !selectedCustomerId
                    ? "bg-brand-50/70 text-brand-900 font-bold"
                    : "hover:bg-stone-50 text-stone-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 text-[10px] font-bold">
                    W
                  </div>
                  <span>{t("pos_select_counter_sale")}</span>
                </div>
                {!selectedCustomerId && <Check size={14} className="text-brand-600" />}
              </button>
            )}

            {filteredCustomers.length === 0 ? (
              <div className="p-6 text-center text-stone-400 text-xs">
                <p>{t("pos_select_no_party", { query: search ? `"${search}"` : "" })}</p>
              </div>
            ) : (
              filteredCustomers.map((c) => {
                const isSelected = c.id === selectedCustomerId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onSelectCustomer(c);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between text-xs transition ${
                      isSelected
                        ? "bg-brand-50 text-brand-900 font-bold"
                        : "hover:bg-stone-50 text-stone-800"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold truncate">{c.name}</span>
                        {c.phone && (
                          <span className="text-[11px] text-stone-400 tabular shrink-0">
                            ({c.phone})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {c.balance > 0 ? (
                        <span className="text-[11px] font-bold tabular text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Wallet size={11} />
                          Rs. {Math.round(c.balance).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          Rs. 0
                        </span>
                      )}
                      {isSelected && <Check size={14} className="text-brand-600" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="p-2 border-t border-stone-100 bg-stone-50">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setShowAddPartyModal(true);
              }}
              className="btn-primary w-full !py-2 text-xs flex items-center justify-center gap-1.5 font-bold shadow-sm"
            >
              <Plus size={14} /> {t("pos_select_new_party")}
            </button>
          </div>
        </div>
      )}

      <AddPartyModal
        open={showAddPartyModal}
        initialName={search}
        onClose={() => setShowAddPartyModal(false)}
        onSaved={(created) => {
          onSelectCustomer(created);
          setIsOpen(false);
          setSearch("");
        }}
      />
    </div>
  );
}
