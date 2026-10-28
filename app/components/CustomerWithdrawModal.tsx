"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Loader2, Printer, X, AlertCircle } from "lucide-react";
import { toast } from "react-toastify";
import { useStore } from "../store/useStore";
import { useLanguage } from "../store/useLanguage";
import { formatMoney } from "../lib/format";
import { recordCustomerWithdrawal } from "../lib/services/customers";
import type { Customer } from "../types";

interface CustomerWithdrawModalProps {
  customer: Customer | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface WithdrawVoucherData {
  invoiceNo: string;
  customerName: string;
  amount: number;
  newBalance: number;
  note?: string;
  date: string;
}

export default function CustomerWithdrawModal({
  customer,
  onClose,
  onSuccess,
}: CustomerWithdrawModalProps) {
  const { currentUser } = useStore();
  const { t } = useLanguage();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [voucher, setVoucher] = useState<WithdrawVoucherData | null>(null);

  useEffect(() => {
    if (customer) {
      setAmount("");
      setNote("");
      setVoucher(null);
    }
  }, [customer]);

  if (!customer) return null;

  const currentBal = customer.balance || 0;
  const numAmt = parseFloat(amount) || 0;
  const simulatedNewBal = Math.round((currentBal + numAmt) * 100) / 100;

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !customer) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setWithdrawing(true);
    try {
      const res = await recordCustomerWithdrawal(
        currentUser.uid,
        customer.id,
        amt,
        note
      );
      toast.success(t("credit_withdrawSuccess", { amount: amt.toLocaleString() }));
      setVoucher({
        invoiceNo: res.invoiceNo,
        customerName: customer.name,
        amount: amt,
        newBalance: res.newBalance,
        note: note.trim(),
        date: res.date,
      });
      onSuccess();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : t("credit_withdrawFailed"));
    } finally {
      setWithdrawing(false);
    }
  };

  const handleVoucherClose = () => {
    setVoucher(null);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
        <form
          onSubmit={handleWithdraw}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col"
        >
          <div className="p-4 border-b border-stone-100 flex justify-between items-start bg-amber-50/60">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                <ArrowUpRight size={20} />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-stone-900">
                  {t("credit_withdrawTitle")}
                </h3>
                <p className="text-xs text-stone-500 font-semibold">{customer.name}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Current Balance / Advance Pill */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200">
              <span className="text-xs font-semibold text-stone-600">Current Status</span>
              {currentBal < 0 ? (
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                  Advance: {formatMoney(Math.abs(currentBal))}
                </span>
              ) : currentBal > 0 ? (
                <span className="text-xs font-bold text-red-700 bg-red-100 px-2.5 py-0.5 rounded-full">
                  Udhar Due: {formatMoney(currentBal)}
                </span>
              ) : (
                <span className="text-xs font-semibold text-stone-500 bg-stone-200 px-2.5 py-0.5 rounded-full">
                  Rs. 0 (Nil)
                </span>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 mb-1.5 block">
                Withdraw Amount (Rs.) *
              </label>
              <input
                type="number"
                required
                min="1"
                step="any"
                autoFocus
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full p-3 border border-stone-300 rounded-xl text-2xl font-black text-center text-amber-900 focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            {numAmt > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 text-xs flex justify-between items-center">
                <span className="text-stone-600 font-medium">New Balance will be:</span>
                <span className={`font-bold ${simulatedNewBal < 0 ? "text-emerald-700" : simulatedNewBal > 0 ? "text-amber-800" : "text-stone-700"}`}>
                  {simulatedNewBal < 0
                    ? `Advance: ${formatMoney(Math.abs(simulatedNewBal))}`
                    : simulatedNewBal > 0
                    ? `Udhar: ${formatMoney(simulatedNewBal)}`
                    : "Rs. 0"}
                </span>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-stone-700 mb-1 block">
                Reason / Note (Optional)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Cash withdrawal / Raqam nikali"
                className="w-full p-2.5 border border-stone-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="p-2 rounded-lg bg-stone-50 text-[11px] text-stone-500 flex items-start gap-1.5">
              <AlertCircle size={14} className="shrink-0 mt-0.5 text-stone-400" />
              <span>Ye raqam customer ke khate mein shamil hogi aur Total Sales mein plus ho jayegi.</span>
            </div>
          </div>

          <div className="p-4 border-t border-stone-100 bg-stone-50/50 flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={withdrawing}
              className="btn-ghost !py-2 text-xs"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={withdrawing || !amount || numAmt <= 0}
              className="btn-primary !bg-amber-600 hover:!bg-amber-700 !py-2 text-xs font-bold flex items-center justify-center gap-1.5 min-w-[120px] disabled:opacity-50"
            >
              {withdrawing ? (
                <Loader2 size={16} className="animate-spin text-white" />
              ) : (
                <>
                  <ArrowUpRight size={16} />
                  <span>{t("credit_withdraw")}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {voucher && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-pop w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-amber-50">
              <h3 className="font-extrabold text-amber-900 text-sm">
                {t("credit_withdrawVoucher")}
              </h3>
              <button
                onClick={handleVoucherClose}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 text-center space-y-4" id="withdrawal-voucher">
              <div className="border-b pb-3">
                <h2 className="font-black text-lg text-stone-900 uppercase tracking-wide">
                  {t("credit_withdrawReceiptTitle")}
                </h2>
                <p className="text-xs font-mono font-bold text-amber-800 mt-0.5">
                  #{voucher.invoiceNo}
                </p>
                <p className="text-xs text-stone-500 font-semibold mt-1">
                  {new Date(voucher.date).toLocaleString()}
                </p>
              </div>

              <div className="space-y-2.5 text-left text-xs bg-stone-50 p-4 rounded-xl border border-stone-200">
                <p className="flex justify-between">
                  <span className="font-semibold text-stone-500">Party Name:</span>
                  <b className="text-stone-900 text-sm">{voucher.customerName}</b>
                </p>
                <p className="flex justify-between">
                  <span className="font-semibold text-stone-500">Amount Withdrawn:</span>
                  <b className="text-amber-800 text-base">{formatMoney(voucher.amount)}</b>
                </p>
                <p className="flex justify-between">
                  <span className="font-semibold text-stone-500">Type:</span>
                  <b className="text-stone-800">Ledger Debit (Udhar)</b>
                </p>
                {voucher.note && (
                  <p className="flex justify-between">
                    <span className="font-semibold text-stone-500">Reason / Note:</span>
                    <span className="text-stone-800">{voucher.note}</span>
                  </p>
                )}
                <div className="border-t border-stone-200 pt-2 flex justify-between font-bold">
                  <span className="text-stone-600">New Balance:</span>
                  <span className={voucher.newBalance < 0 ? "text-emerald-700" : "text-stone-900"}>
                    {voucher.newBalance < 0
                      ? `Advance: ${formatMoney(Math.abs(voucher.newBalance))}`
                      : formatMoney(voucher.newBalance)}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleVoucherClose}
                  className="btn-ghost flex-1 text-xs"
                >
                  {t("receivePay_close")}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-primary !bg-amber-600 hover:!bg-amber-700 flex-1 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Printer size={15} />
                  <span>Print</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
