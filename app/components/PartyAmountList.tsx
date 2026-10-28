"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { formatMoney } from "../lib/format";
import { useLanguage } from "../store/useLanguage";

export interface PartyRow {
  id: string;
  name: string;
  phone?: string;
  balance: number;
}

interface PartyAmountListProps {
  parties: PartyRow[];
  amounts: Record<string, string>;
  onChange: (partyId: string, value: string) => void;
  capToBalance?: boolean;
  tone: "emerald" | "amber";
  emptyText: string;
}

const TONES = {
  emerald: { badge: "bg-emerald-100 text-emerald-800", ring: "border-emerald-300 bg-emerald-50/40", text: "text-emerald-700" },
  amber: { badge: "bg-amber-100 text-amber-800", ring: "border-amber-300 bg-amber-50/40", text: "text-amber-700" },
} as const;

export default function PartyAmountList({
  parties,
  amounts,
  onChange,
  capToBalance = false,
  tone,
  emptyText,
}: PartyAmountListProps) {
  const [search, setSearch] = useState("");
  const { t } = useLanguage();
  const colors = TONES[tone];

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return parties;
    return parties.filter((p) => p.name.toLowerCase().includes(term) || (p.phone ?? "").includes(term));
  }, [parties, search]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("settle_partySearch")}
          className="field pl-10"
        />
      </div>

      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone-200 p-6 text-center text-sm text-stone-400">
            {emptyText}
          </p>
        ) : (
          filtered.map((p) => {
            const raw = amounts[p.id] ?? "";
            const value = parseFloat(raw) || 0;
            const over = capToBalance && value > p.balance + 0.001;
            const active = value > 0;
            const remaining = p.balance - value;
            return (
              <div
                key={p.id}
                className={`rounded-xl border p-3 transition ${
                  over ? "border-red-300 bg-red-50/50" : active ? colors.ring : "border-stone-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-stone-900">{p.name}</p>
                    {p.balance < 0 ? (
                      <span className="tabular mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        Advance: {formatMoney(Math.abs(p.balance))}
                      </span>
                    ) : (
                      <span className={`tabular mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${colors.badge}`}>
                        {t("settle_balance", { amount: formatMoney(p.balance) })}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      disabled={p.balance <= 0}
                      onClick={() => onChange(p.id, p.balance > 0 ? String(p.balance) : "")}
                      className="rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-bold text-stone-500 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed"
                      title={t("settle_fullTitle")}
                    >
                      {t("settle_full")}
                    </button>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={raw}
                      placeholder="0"
                      onChange={(e) => onChange(p.id, e.target.value)}
                      className="field !w-28 !py-2 text-right font-bold"
                    />
                  </div>
                </div>
                {active && (
                  <p className={`tabular mt-2 text-xs font-semibold ${over ? "text-red-600" : colors.text}`}>
                    {over
                      ? t("settle_overBalance", { amount: formatMoney(p.balance) })
                      : remaining < 0
                        ? `Balance: ${formatMoney(p.balance)} − ${formatMoney(value)} = Advance: ${formatMoney(Math.abs(remaining))}`
                        : t("settle_remaining", {
                            balance: formatMoney(p.balance),
                            value: formatMoney(value),
                            remaining: formatMoney(remaining),
                          })}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
