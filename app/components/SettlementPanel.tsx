"use client";

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import FormField from "./FormField";
import PartyAmountList, { type PartyRow } from "./PartyAmountList";
import SegmentedControl from "./SegmentedControl";
import { formatMoney } from "../lib/format";
import { useLanguage } from "../store/useLanguage";

export type SettleMethod = "Cash" | "Bank Account";

export interface SettleLine {
  party: PartyRow;
  amount: number;
}

interface SettlementPanelProps {
  title: string;
  subtitle: string;
  icon: ReactNode;
  tone: "emerald" | "amber";
  parties: PartyRow[];
  capToBalance?: boolean;
  noteLabel: string;
  notePlaceholder: string;
  submitLabel: string;
  emptyText: string;
  onSubmit: (lines: SettleLine[], method: SettleMethod, note: string) => Promise<boolean>;
}

export default function SettlementPanel({
  title,
  subtitle,
  icon,
  tone,
  parties,
  capToBalance = false,
  noteLabel,
  notePlaceholder,
  submitLabel,
  emptyText,
  onSubmit,
}: SettlementPanelProps) {
  const { t } = useLanguage();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<SettleMethod>("Cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const lines = parties
    .map((party) => ({ party, amount: parseFloat(amounts[party.id] ?? "") || 0 }))
    .filter((l) => l.amount > 0);
  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  const hasOver = capToBalance && lines.some((l) => l.amount > l.party.balance + 0.001);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0 || hasOver) return;
    setSaving(true);
    try {
      const ok = await onSubmit(lines, method, note);
      if (ok) {
        setAmounts({});
        setNote("");
      }
    } finally {
      setSaving(false);
    }
  };

  const head = tone === "emerald" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700";
  const button = tone === "emerald" ? "!bg-emerald-600 hover:!bg-emerald-700" : "!bg-amber-600 hover:!bg-amber-700";

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-stone-100 p-5">
        <span className={`rounded-xl p-2.5 ${head}`}>{icon}</span>
        <div>
          <h3 className="text-base font-bold text-stone-900">{title}</h3>
          <p className="text-xs text-stone-500">{subtitle}</p>
        </div>
      </div>

      <div className="flex-1 space-y-4 p-5">
        <PartyAmountList
          parties={parties}
          amounts={amounts}
          onChange={(id, value) => setAmounts((prev) => ({ ...prev, [id]: value }))}
          capToBalance={capToBalance}
          tone={tone}
          emptyText={emptyText}
        />

        <FormField label={t("settle_paymentMode")}>
          <SegmentedControl
            tone={tone}
            value={method}
            onChange={setMethod}
            options={[
              { value: "Cash", label: t("cash") },
              { value: "Bank Account", label: t("bankOnline") },
            ]}
          />
        </FormField>

        <FormField label={noteLabel}>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={notePlaceholder} className="field" />
        </FormField>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-stone-100 bg-stone-50 px-5 py-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
            {t(lines.length === 1 ? "settle_total_one" : "settle_total_other", { count: lines.length })}
          </p>
          <p className="tabular text-lg font-extrabold text-stone-900">{formatMoney(total)}</p>
        </div>
        <button
          type="submit"
          disabled={saving || lines.length === 0 || hasOver}
          className={`btn-primary min-h-[44px] min-w-[150px] ${button}`}
        >
          {saving ? <Loader2 className="animate-spin text-white" size={18} /> : submitLabel}
        </button>
      </div>
    </form>
  );
}
