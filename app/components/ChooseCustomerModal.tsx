"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import CustomerSelect from "./CustomerSelect";
import { useLanguage } from "../store/useLanguage";
import { onEnter } from "../lib/keys";
import type { Customer } from "../types";

interface ChooseCustomerModalProps {
  open: boolean;
  customers: Customer[];
  title: string;
  message?: string;
  confirmLabel?: string;
  onClose: () => void;
  onPick: (customer: Customer) => Promise<void> | void;
}

export default function ChooseCustomerModal({
  open,
  customers,
  title,
  message,
  confirmLabel,
  onClose,
  onPick,
}: ChooseCustomerModalProps) {
  const { t } = useLanguage();
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const selected = customers.find((c) => c.id === selectedId) ?? null;

  const close = () => {
    setSelectedId("");
    onClose();
  };

  const submit = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await onPick(selected);
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-stone-900/50 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-pop"
        onKeyDown={onEnter(() => { if (selected && !busy) submit(); })}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-stone-900">{title}</h3>
            {message && <p className="mt-1 text-sm text-stone-500">{message}</p>}
          </div>
          <button onClick={close} className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700">
            <X size={20} />
          </button>
        </div>

        <CustomerSelect
          customers={customers}
          selectedCustomerId={selectedId}
          onSelectCustomer={(c) => setSelectedId(c?.id ?? "")}
          isUdhar
        />

        <div className="mt-5 flex gap-3">
          <button onClick={close} disabled={busy} className="btn-ghost flex-1">
            {t("cancel")}
          </button>
          <button onClick={submit} disabled={!selected || busy} className="btn-primary flex-1">
            {busy ? <Loader2 className="animate-spin" size={18} /> : (confirmLabel ?? t("chooseParty_confirm"))}
          </button>
        </div>
      </div>
    </div>
  );
}
