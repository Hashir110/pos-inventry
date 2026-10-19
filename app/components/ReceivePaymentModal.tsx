"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "react-toastify";
import { useStore } from "../store/useStore";
import { useLanguage } from "../store/useLanguage";
import { formatMoney } from "../lib/format";
import { receivePayment } from "../lib/services/customers";
import type { Customer, CustomerPayment } from "../types";

interface ReceivePaymentModalProps {
  customer: Customer | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface PrintData {
  customerName: string;
  amount: number;
  method: string;
  note?: string;
  date: string;
}

export default function ReceivePaymentModal({ customer, onClose, onSuccess }: ReceivePaymentModalProps) {
  const { currentUser } = useStore();
  const { t } = useLanguage();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<CustomerPayment["method"]>("Cash");
  const [note, setNote] = useState("");
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState<PrintData | null>(null);

  useEffect(() => {
    if (customer) {
      setAmount(String(customer.balance));
      setMethod("Cash");
      setNote("");
    }
  }, [customer]);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !customer) return;
    setPaying(true);
    const amt = parseFloat(amount);
    try {
      await receivePayment(currentUser.uid, customer.id, amt, method, note);
      toast.success(t("receivePay_success", { amount }));
      setReceipt({
        customerName: customer.name,
        amount: amt,
        method,
        note,
        date: new Date().toISOString(),
      });
      onClose();
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("receivePay_failed"));
    } finally {
      setPaying(false);
    }
  };

  return (
    <>
      {customer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handlePay} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-stone-800">{customer.name}</h3>
                <p className="text-sm text-stone-500">{t("receivePay_creditBalance", { amount: formatMoney(customer.balance) })}</p>
              </div>
              <button type="button" onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700">
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-500 mb-1 block">{t("receivePay_amountLabel")}</label>
              <input
                type="number"
                required
                min="1"
                max={customer.balance}
                step="0.01"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full p-3 border rounded-lg text-2xl font-bold text-center focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>

            <div className="flex gap-2">
              {(["Cash", "Bank Account"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-bold ${
                    method === m ? "bg-brand-50 border-brand-500 text-brand-700" : "bg-white text-stone-500"
                  }`}
                >
                  {m === "Cash" ? t("cash") : t("bankOnline")}
                </button>
              ))}
            </div>

            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("receivePay_notePlaceholder")}
              className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500"
            />

            <button
              type="submit"
              disabled={paying}
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold disabled:opacity-50 min-h-[48px] flex items-center justify-center"
            >
              {paying ? <Loader2 className="animate-spin text-white" size={20} /> : t("receivePay_save")}
            </button>
          </form>
        </div>
      )}

      {receipt && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-pop w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-emerald-50">
              <h3 className="font-extrabold text-emerald-900 text-sm">{t("receivePay_voucher")}</h3>
              <button onClick={() => setReceipt(null)} className="rounded-lg p-1 text-stone-400 hover:bg-stone-200">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 text-center space-y-4" id="wasooli-receipt">
              <div className="border-b pb-3">
                <h2 className="font-black text-lg text-stone-900 uppercase tracking-wide">{t("receivePay_receiptTitle")}</h2>
                <p className="text-xs text-stone-500 font-bold">
                  {t("receivePay_date", { date: new Date(receipt.date).toLocaleDateString() })}
                </p>
              </div>

              <div className="space-y-2 text-left text-xs bg-stone-50 p-4 rounded-xl border border-stone-200">
                <p><span className="font-bold text-stone-500">{t("receivePay_partyName")}</span> <b className="text-stone-900 text-sm">{receipt.customerName}</b></p>
                <p><span className="font-bold text-stone-500">{t("receivePay_amountReceived")}</span> <b className="text-emerald-700 text-base">Rs. {receipt.amount.toLocaleString()}</b></p>
                <p><span className="font-bold text-stone-500">{t("receivePay_paymentMode")}</span> <b className="text-stone-800">{receipt.method === "Cash" ? t("cash") : t("bankOnline")}</b></p>
                {receipt.note && <p><span className="font-bold text-stone-500">{t("receivePay_note")}</span> {receipt.note}</p>}
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setReceipt(null)} className="btn-ghost flex-1 text-xs">
                  {t("receivePay_close")}
                </button>
                <button onClick={() => window.print()} className="btn-primary flex-1 text-xs font-bold">
                  {t("receivePay_print")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
