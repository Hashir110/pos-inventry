"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Landmark, Loader2 } from "lucide-react";
import type { BankAccount } from "../types";
import FormField from "./FormField";
import PartyAmountList, { type PartyRow } from "./PartyAmountList";
import SegmentedControl from "./SegmentedControl";
import { formatMoney } from "../lib/format";
import { allocateSplit, isSplitBalanced, remainingAfterSave, type SavedLine } from "../lib/settlement";
import { useLanguage } from "../store/useLanguage";

export type SettleMethod = "Cash" | "Bank Account";

type PanelMethod = SettleMethod | "Split";

export interface SettleLine {
  party: PartyRow;
  amount: number;
  method?: SettleMethod;
}

interface SettlementPanelProps {
  title: string;
  subtitle: string;
  icon: ReactNode;
  tone: "emerald" | "amber";
  parties: PartyRow[];
  capToBalance?: boolean;
  allowSplit?: boolean;
  noteLabel: string;
  notePlaceholder: string;
  submitLabel: string;
  emptyText: string;
  banks?: BankAccount[];
  onSubmit: (lines: SettleLine[], method: SettleMethod, note: string, bankId?: string) => Promise<SettleLine[]>;
}

export default function SettlementPanel({
  title,
  subtitle,
  icon,
  tone,
  parties,
  capToBalance = false,
  allowSplit = false,
  noteLabel,
  notePlaceholder,
  submitLabel,
  emptyText,
  banks,
  onSubmit,
}: SettlementPanelProps) {
  const { t } = useLanguage();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<PanelMethod>("Cash");
  const [bankId, setBankId] = useState("");
  const [cashInput, setCashInput] = useState("");
  const [bankInput, setBankInput] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const lines = parties
    .map((party) => ({ party, amount: parseFloat(amounts[party.id] ?? "") || 0 }))
    .filter((l) => l.amount > 0);
  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  const hasOver = capToBalance && lines.some((l) => l.amount > l.party.balance + 0.001);

  const cashPart = Math.max(0, parseFloat(cashInput) || 0);
  const bankPart = Math.max(0, parseFloat(bankInput) || 0);
  const splitMismatch = method === "Split" && !isSplitBalanced(cashPart, bankPart, total);
  const needsBank = !!banks && method !== "Cash";
  const activeBankId = banks?.some((b) => b.id === bankId) ? bankId : banks?.[0]?.id ?? "";
  const missingBank = needsBank && !activeBankId;

  const splitLines = (): SettleLine[] => allocateSplit(lines, cashPart);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0 || hasOver || splitMismatch || missingBank) return;
    setSaving(true);
    try {
      const bank = needsBank ? activeBankId : undefined;
      const isSplit = method === "Split";
      const submitted: SettleLine[] = isSplit ? splitLines() : lines;
      const failed = await onSubmit(submitted, isSplit ? "Cash" : method, note, bank);
      if (failed.length === 0) {
        setAmounts({});
        setCashInput("");
        setBankInput("");
        setNote("");
      } else {
        const saved = submitted
          .filter((l) => !failed.includes(l))
          .map((l) => ({
            partyId: l.party.id,
            amount: l.amount,
            method: l.method ?? (isSplit ? "Cash" : method),
          })) as SavedLine[];
        const next = remainingAfterSave({ amounts, cash: cashInput, bank: bankInput }, saved, isSplit);
        setAmounts(next.amounts);
        setCashInput(next.cash);
        setBankInput(next.bank);
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
              ...(allowSplit ? [{ value: "Split" as const, label: t("settle_split") }] : []),
            ]}
          />
        </FormField>

        {needsBank && (
          <div className="space-y-1.5 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1 text-xs font-bold text-indigo-950">
                <Landmark size={14} /> {t("pos_select_bank")}
              </label>
              {banks && banks.length === 0 && (
                <Link href="/dashboard/banks" className="text-[11px] font-bold text-indigo-700 underline">
                  {t("settle_addBank")}
                </Link>
              )}
            </div>
            {banks && banks.length > 0 ? (
              <select value={activeBankId} onChange={(e) => setBankId(e.target.value)} className="field bg-white font-semibold">
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} - {b.accountNumber} ({t("settle_bankBalance")}: Rs. {Math.round(b.currentBalance).toLocaleString()})
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs font-medium text-amber-800">{t("settle_noBank")}</p>
            )}
          </div>
        )}

        {method === "Split" && (
          <div className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t("pos_cash_part")}>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={cashInput}
                  onChange={(e) => setCashInput(e.target.value)}
                  placeholder="0"
                  className="field text-right font-bold"
                />
              </FormField>
              <FormField label={t("pos_bank_part")}>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={bankInput}
                  onChange={(e) => setBankInput(e.target.value)}
                  placeholder="0"
                  className="field text-right font-bold"
                />
              </FormField>
            </div>
            {splitMismatch && total > 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800">
                {t("settle_splitMismatch", { amount: Math.round(total).toLocaleString() })}
              </p>
            )}
          </div>
        )}

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
          disabled={saving || lines.length === 0 || hasOver || splitMismatch || missingBank}
          className={`btn-primary min-h-[44px] min-w-[150px] ${button}`}
        >
          {saving ? <Loader2 className="animate-spin text-white" size={18} /> : submitLabel}
        </button>
      </div>
    </form>
  );
}
