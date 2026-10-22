"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2, Printer, X } from "lucide-react";
import { toBlob } from "html-to-image";
import { toast } from "react-toastify";
import InvoiceSheet from "./InvoiceSheet";
import { useLanguage } from "../store/useLanguage";
import { isCounterSale } from "../lib/format";
import type { PaymentMethod, SaleItem, Shop } from "../types";

interface SaleReceiptProps {
  shop: Shop | null;
  invoiceNo: string;
  date: string;
  customerName?: string;
  transport?: string;
  extraCharges?: number;
  advanceAmount?: number;
  items: SaleItem[];
  total: number;
  paymentMethod: PaymentMethod;
  cashAmount?: number;
  bankAmount?: number;
  bankName?: string;
  printLabel: string;
  closeLabel: string;
  onClose: () => void;
}

export default function SaleReceipt({
  shop,
  invoiceNo,
  date,
  customerName,
  transport,
  extraCharges,
  advanceAmount,
  items,
  total,
  paymentMethod,
  cashAmount,
  bankAmount,
  bankName,
  printLabel,
  closeLabel,
  onClose,
}: SaleReceiptProps) {
  const { t } = useLanguage();
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);

  const paymentLabels: Record<PaymentMethod, string> = {
    Cash: t("pos_pay_cash"),
    "Bank Account": t("pos_pay_bank"),
    Udhar: t("pos_pay_credit"),
    Split: "Cash + Bank",
  };

  const makeSlipBlob = async (): Promise<Blob> => {
    if (!invoiceRef.current) throw new Error(t("pos_receipt_slip_not_found"));
    const blob = await toBlob(invoiceRef.current, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true });
    if (!blob) throw new Error(t("pos_receipt_slip_image_failed"));
    return blob;
  };

  const handleCopySlip = async (isManualClick = false) => {
    if (copying) return;
    setCopying(true);
    try {
      const blob = await makeSlipBlob();
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        toast.success(
          isManualClick
            ? t("pos_receipt_copied_manual")
            : t("pos_receipt_copied_auto")
        );
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `slip-${invoiceNo}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.info(t("pos_receipt_downloaded"));
      }
    } catch (error) {
      if (isManualClick) {
        console.error("Copy slip error:", error);
        const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        toast.error(t("pos_receipt_copy_failed", { reason }));
      } else {
        console.warn("Auto copy blocked by browser gesture policy:", error);
      }
    } finally {
      setCopying(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      handleCopySlip(false);
    }, 400);
    return () => clearTimeout(timer);
  }, []);
  const handlePrint = () => {
    try {
      window.print();
    } catch (error) {
      console.error("Printer Error:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] animate-in fade-in backdrop-blur-sm p-4">
      <div aria-hidden style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }}>
        <InvoiceSheet
          ref={invoiceRef}
          shop={shop}
          invoiceNo={invoiceNo}
          date={date}
          customerName={customerName}
          transport={transport}
          extraCharges={extraCharges}
          advanceAmount={advanceAmount}
          items={items}
          total={total}
          paymentMethod={paymentMethod}
          cashAmount={cashAmount}
          bankAmount={bankAmount}
          bankName={bankName}
        />
      </div>      <div id="printable-receipt" className="bg-white p-4 rounded-xl w-full max-w-[340px] max-h-[95vh] overflow-y-auto shadow-2xl relative text-black">
        <button onClick={onClose} className="absolute top-2 right-2 p-1 text-stone-400 no-print hover:text-stone-700">
          <X size={20} />
        </button>

        <div className="bg-white">
          <div className="text-center mb-3 border-b border-black pb-3">
            <h2 className="text-xl font-bold uppercase text-black leading-tight">{shop?.shopName || t("pos_receipt_default_shop")}</h2>
            {shop?.address && <p className="text-[10px] text-stone-800 mt-0.5">{shop.address}</p>}
            {shop?.contact && <p className="text-[10px] font-bold text-stone-900">{t("pos_receipt_phone", { phone: shop.contact })}</p>}

            <div className="mt-2 text-[10px] text-stone-700 flex flex-col items-center">
              <p>{new Date(date).toLocaleString()}</p>
              <p className="font-bold text-black text-[12px] mt-1 tracking-wider">{t("pos_receipt_invoice_no", { no: invoiceNo })}</p>
              {transport && (
                <p className="font-bold text-black mt-1 uppercase">{t("pos_receipt_transport", { name: transport })}</p>
              )}
              {customerName && (
                <p className="font-bold text-black mt-1 uppercase border-b border-dashed border-stone-400 pb-0.5">
                  {t("pos_receipt_customer", { name: isCounterSale(customerName) ? t("pos_select_counter_sale") : customerName })}
                </p>
              )}
            </div>
          </div>

          <div className="mb-3 overflow-x-auto text-black">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="border-b-2 border-black text-[10px] font-black uppercase">
                  <th className="py-1 pr-1">{t("pos_receipt_col_qty")}</th>
                  <th className="py-1 px-1">{t("pos_receipt_col_items")}</th>
                  <th className="py-1 px-1 text-center">{t("pos_receipt_col_weight")}</th>
                  <th className="py-1 px-1 text-right">{t("pos_receipt_col_rate")}</th>
                  <th className="py-1 pl-1 text-right">{t("pos_receipt_col_amount")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {items.map((item, idx) => {
                  const isWeight = item.type === "weight";
                  const qtyStr = `${item.qty} ${isWeight ? t("pos_unit_bags") : t("pos_unit_pcs")}`;
                  const weightVal = item.totalWeight ?? item.qty * (item.weightPerBag || 25);
                  const weightStr = isWeight ? `${weightVal}kg` : "—";

                  return (
                    <tr key={idx} className="align-top">
                      <td className="py-1.5 pr-1 font-bold whitespace-nowrap">{qtyStr}</td>
                      <td className="py-1.5 px-1 font-semibold leading-tight">{item.name}</td>
                      <td className="py-1.5 px-1 text-center font-medium whitespace-nowrap">{weightStr}</td>
                      <td className="py-1.5 px-1 text-right tabular">{item.price}</td>
                      <td className="py-1.5 pl-1 text-right font-bold tabular">{Math.round(item.total).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t-2 border-black pt-2 mb-4 space-y-1">
            {!!extraCharges && extraCharges > 0 && (
              <div className="flex justify-between text-[11px] font-semibold text-black">
                <span>{t("pos_receipt_extra_charges")}</span>
                <span className="tabular">+{Math.round(extraCharges).toLocaleString()}</span>
              </div>
            )}
            {!!advanceAmount && advanceAmount > 0 && (
              <div className="flex justify-between text-[11px] font-bold text-emerald-800">
                <span>{t("pos_receipt_advance_paid")}</span>
                <span className="tabular">-{Math.round(advanceAmount).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between items-end">
              <div className="text-right w-full">
                <p className="text-xs font-black uppercase tracking-wider text-black">
                  {advanceAmount && advanceAmount > 0 ? t("pos_receipt_net_payable") : t("pos_receipt_total_amount")}
                </p>
                <p className="text-2xl font-black text-black tabular">{Math.round(total).toLocaleString()}</p>
              </div>
            </div>

            <div className="border-t border-dotted border-stone-400 pt-1.5 mt-2 text-[10px] space-y-0.5">
              <div className="flex justify-between font-semibold text-stone-800">
                <span>{t("pos_receipt_payment_mode")}</span>
                <span className="font-bold uppercase text-black">
                  {paymentMethod === "Bank Account" && bankName
                    ? `Bank (${bankName})`
                    : paymentLabels[paymentMethod] ?? paymentMethod}
                </span>
              </div>
              {paymentMethod === "Split" && (
                <div className="bg-stone-50 border border-stone-200 p-1.5 rounded mt-1 space-y-0.5 text-[10px]">
                  <div className="flex justify-between font-bold text-stone-800">
                    <span>Cash Received:</span>
                    <span>Rs. {Math.round(cashAmount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-brand-700">
                    <span>Bank ({bankName || "Online"}):</span>
                    <span>Rs. {Math.round(bankAmount || 0).toLocaleString()}</span>
                  </div>
                  {total - (cashAmount || 0) - (bankAmount || 0) > 0 && (
                    <div className="flex justify-between font-bold text-red-600">
                      <span>Udhar (Remaining):</span>
                      <span>Rs. {Math.round(total - (cashAmount || 0) - (bankAmount || 0)).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}
              {paymentMethod === "Udhar" && customerName && (
                <div className="bg-stone-100 border border-stone-300 p-1 rounded mt-1">
                  <div className="flex justify-between font-bold text-black">
                    <span>{t("pos_receipt_party_ledger")}</span>
                    <span>{customerName}</span>
                  </div>
                  <p className="text-[9px] text-stone-600 mt-0.5">{t("pos_receipt_ledger_note")}</p>
                </div>
              )}
            </div>
          </div>

          <div className="text-center text-[10px] text-black mb-4">
            {shop?.receiptMessage && (
              <div className="whitespace-pre-wrap leading-tight font-medium mb-2">{shop.receiptMessage}</div>
            )}
            <div className="border-t border-dotted border-stone-400 pt-2 mt-2">
              <p className="font-bold italic">{t("pos_receipt_powered_by")}</p>
              <p>{t("pos_receipt_contact")}</p>
            </div>
          </div>

        </div>

        <div id="receipt-modal" className="flex flex-col gap-2 no-print">
          <button
            onClick={handlePrint}
            className="w-full py-3 bg-green-600 text-white rounded-lg font-bold flex justify-center items-center gap-2 hover:bg-green-700"
          >
            <Printer size={18} /> {printLabel}
          </button>
          <button
            onClick={() => handleCopySlip(true)}
            disabled={copying}
            className={`w-full py-3 text-white rounded-lg font-bold flex justify-center items-center gap-2 transition-colors shadow-sm disabled:opacity-60 ${
              copied
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {copying ? (
              <Loader2 size={18} className="animate-spin" />
            ) : copied ? (
              <Check size={18} className="text-white" />
            ) : (
              <Copy size={18} />
            )}
            {copied ? t("pos_receipt_image_copied") : t("pos_receipt_copy_image")}
          </button>
          <button onClick={onClose} className="w-full py-3 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700">
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
