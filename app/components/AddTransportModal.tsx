"use client";

import { useState } from "react";
import { Loader2, Truck, X } from "lucide-react";
import { toast } from "react-toastify";
import { useStore } from "../store/useStore";
import { useLanguage } from "../store/useLanguage";
import { addTransport } from "../lib/services/transports";
import FormField from "./FormField";
import type { Transport } from "../types";

interface AddTransportModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: (transport: Transport) => void;
}

export default function AddTransportModal({ open, onClose, onSaved }: AddTransportModalProps) {
  const { currentUser } = useStore();
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const close = () => {
    setName("");
    setPhone("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSaving(true);
    try {
      const created = await addTransport(currentUser.uid, name, phone);
      toast.success(t("pos_select_transport_added", { name: created.name }));
      onSaved(created);
      close();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("pos_select_transport_add_failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-pop">
        <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 p-4">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-stone-900">
            <Truck size={18} className="text-brand-600" /> {t("pos_select_transport_modal_title")}
          </h3>
          <button type="button" onClick={close} className="rounded-lg p-1 text-stone-400 hover:bg-stone-200">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <FormField label={t("pos_select_company_name")} required>
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("pos_select_company_placeholder")}
              className="field"
            />
          </FormField>
          <FormField label={t("phone")}>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="03xx-xxxxxxx"
              className="field"
            />
          </FormField>
        </div>

        <div className="flex gap-3 border-t border-stone-100 bg-stone-50 px-5 py-4">
          <button type="button" onClick={close} disabled={saving} className="btn-ghost flex-1">
            {t("cancel")}
          </button>
          <button type="submit" disabled={saving || !name.trim()} className="btn-primary flex-1">
            {saving ? <Loader2 className="animate-spin" size={18} /> : t("pos_select_save_company")}
          </button>
        </div>
      </form>
    </div>
  );
}
