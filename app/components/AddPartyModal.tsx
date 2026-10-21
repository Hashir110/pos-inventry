"use client";

import { useEffect, useState } from "react";
import { Loader2, UserPlus, X } from "lucide-react";
import { toast } from "react-toastify";
import { useStore } from "../store/useStore";
import { useLanguage } from "../store/useLanguage";
import { addCustomer } from "../lib/services/customers";
import FormField from "./FormField";
import type { Customer } from "../types";

interface AddPartyModalProps {
  open: boolean;
  initialName?: string;
  onClose: () => void;
  onSaved: (customer: Customer) => void;
}

export default function AddPartyModal({
  open,
  initialName = "",
  onClose,
  onSaved,
}: AddPartyModalProps) {
  const { currentUser } = useStore();
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setPhone("");
    }
  }, [open, initialName]);

  if (!open) return null;

  const close = () => {
    setName("");
    setPhone("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const cleanName = name.trim();
    if (!cleanName) {
      toast.error("Party name is required");
      return;
    }

    setSaving(true);
    try {
      const created = await addCustomer(currentUser.uid, {
        name: cleanName,
        phone: phone.trim(),
      });
      toast.success(`Party "${created.name}" added successfully`);
      onSaved(created);
      close();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add party");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl border border-stone-100"
      >
        <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50/70 px-5 py-4">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-stone-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
              <UserPlus size={16} />
            </span>
            <span>{t("pos_select_new_party")}</span>
          </h3>
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-200 hover:text-stone-700 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <FormField label={t("customer")} required>
            <input
              autoFocus
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Al-Madina Traders, Khan & Sons"
              className="field text-sm font-bold"
            />
          </FormField>
          <FormField label={t("phone") || "Phone Number (Optional)"}>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="03xx-xxxxxxx"
              className="field text-sm"
            />
          </FormField>
        </div>

        <div className="flex gap-3 border-t border-stone-100 bg-stone-50 px-5 py-4">
          <button
            type="button"
            onClick={close}
            disabled={saving}
            className="btn-ghost flex-1"
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="btn-primary flex-1 shadow-sm"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : t("save")}
          </button>
        </div>
      </form>
    </div>
  );
}
