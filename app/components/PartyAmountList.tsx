"use client";

import { useMemo, useState } from "react";
import { Search, X, ChevronDown, ChevronUp } from "lucide-react";
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

const DEFAULT_LIMIT = 5;

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
  const [showAll, setShowAll] = useState(false);
  const { t } = useLanguage();
  const colors = TONES[tone];

  const term = search.toLowerCase().trim();

  const filtered = useMemo(() => {
    if (!term) return parties;
    return parties.filter((p) => p.name.toLowerCase().includes(term) || (p.phone ?? "").includes(term));
  }, [parties, term]);

  const { activeParties, inactiveParties } = useMemo(() => {
    const active: PartyRow[] = [];
    const inactive: PartyRow[] = [];
    for (const p of filtered) {
      const val = parseFloat(amounts[p.id] ?? "") || 0;
      if (val > 0) active.push(p);
      else inactive.push(p);
    }
    return { activeParties: active, inactiveParties: inactive };
  }, [filtered, amounts]);

  const displayed = useMemo(() => {
    if (showAll) {
      return [...activeParties, ...inactiveParties];
    }
    // Always show all active parties so entered values are never hidden
    const neededInactive = Math.max(0, DEFAULT_LIMIT - activeParties.length);
    return [...activeParties, ...inactiveParties.slice(0, neededInactive)];
  }, [showAll, activeParties, inactiveParties]);

  // Check if there are active parties outside current search term
  const hiddenActiveCount = useMemo(() => {
    if (!term) return 0;
    return parties.filter((p) => {
      const val = parseFloat(amounts[p.id] ?? "") || 0;
      return val > 0 && !filtered.some((f) => f.id === p.id);
    }).length;
  }, [parties, amounts, term, filtered]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("settle_partySearch")}
          className="field pl-10 pr-8"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition"
            title={t("settle_clearSearch")}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {hiddenActiveCount > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50/70 px-2.5 py-1.5 text-xs font-semibold text-indigo-900">
          <span>{t("settle_activeHiddenHint", { count: hiddenActiveCount })}</span>
          <button
            type="button"
            onClick={() => setSearch("")}
            className="rounded bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-800 hover:bg-indigo-200"
          >
            {t("settle_clearSearch")}
          </button>
        </div>
      )}

      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {displayed.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone-200 p-6 text-center text-sm text-stone-400">
            {term ? "No matching party found" : emptyText}
          </p>
        ) : (
          displayed.map((p) => {
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
                      step="any"
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

      {filtered.length > DEFAULT_LIMIT && (
        <div className="flex items-center justify-between border-t border-stone-100 pt-2 text-xs text-stone-500">
          <span>
            {t("settle_showingCount", { count: displayed.length, total: filtered.length })}
          </span>
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
          >
            {showAll ? (
              <>
                <ChevronUp size={14} />
                {t("settle_showLess")}
              </>
            ) : (
              <>
                <ChevronDown size={14} />
                {t("settle_showAll", { count: filtered.length })}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
