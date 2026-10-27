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
  const totalText = Math.round(total).toLocaleString();
  const totalSize = totalText.length > 11 ? "text-lg" : totalText.length > 8 ? "text-xl" : "text-2xl";

  const paymentLabels: Record<PaymentMethod, string> = {
    Cash: t("pos_pay_cash"),
    "Bank Account": t("pos_pay_bank"),
    Udhar: t("pos_pay_credit"),
    Split: "Cash + Bank",
  };

  const formatReceiptDate = (dStr: string) => {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
    return `${day}/${month}/${year}, ${time}`;
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
      </div>      <div id="printable-receipt" className="bg-white p-4 print:p-0 rounded-xl w-full max-w-[340px] max-h-[95vh] overflow-y-auto shadow-2xl relative text-black">
        <button onClick={onClose} className="absolute top-2 right-2 p-1 text-stone-400 no-print hover:text-stone-700">
          <X size={20} />
        </button>

        <div className="receipt-outer-border border-2 border-black p-2.5 bg-white text-black rounded-sm">
          <div className="text-center mb-3 border-b-2 border-black pb-3">
            <h2 className="text-xl font-black uppercase text-black leading-tight tracking-wide">{shop?.shopName || t("pos_receipt_default_shop")}</h2>
            {shop?.address && <p className="text-[11px] font-bold text-black mt-0.5">{shop.address}</p>}
            {shop?.contact && <p className="text-[11px] font-black text-black">{t("pos_receipt_phone", { phone: shop.contact })}</p>}

            <div className="mt-2 text-[11px] font-bold text-black flex flex-col items-center">
              <p className="font-bold text-black">{formatReceiptDate(date)}</p>
              <p className="font-black text-black text-[13px] mt-1 tracking-wider">{t("pos_receipt_invoice_no", { no: invoiceNo })}</p>
              {transport && (
                <p className="font-black text-black mt-1 uppercase text-xs">{t("pos_receipt_transport", { name: transport })}</p>
              )}
              {customerName && (
                <p className="font-black text-black mt-1 uppercase border-b-2 border-black pb-0.5 text-xs">
                  {t("pos_receipt_customer", { name: isCounterSale(customerName) ? t("pos_select_counter_sale") : customerName })}
                </p>
              )}
            </div>
          </div>

          <div className="mb-3 text-black">
            <table className="w-full text-left border-collapse table-fixed text-[10px]">
              <thead>
                <tr className="border-y-2 border-black text-[10px] font-black uppercase text-black">
                  <th className="py-1.5 pl-0.5 pr-1 text-center w-[10%]">{t("pos_receipt_col_qty")}</th>
                  <th className="py-1.5 px-1 text-left w-[32%]">{t("pos_receipt_col_items")}</th>
                  <th className="py-1.5 px-0.5 text-center w-[14%]">{t("pos_receipt_col_weight")}</th>
                  <th className="py-1.5 px-0.5 text-right w-[16%]">{t("pos_receipt_col_rate")}</th>
                  <th className="py-1.5 pl-0.5 pr-1 text-right w-[28%]">{t("pos_receipt_col_amount")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/25 text-black">
                {items.map((item, idx) => {
                  const isWeight = item.type === "weight";
                  const weightVal = item.totalWeight ?? item.qty * (item.weightPerBag || 25);
                  const weightStr = isWeight ? `${weightVal}kg` : "—";
                  const amountText = Math.round(item.total).toLocaleString();
                  const rateText = Number(item.price).toLocaleString();

                  return (
                    <tr key={idx} className="receipt-item align-middle font-bold">
                      <td className="py-1.5 pl-0.5 pr-1 text-center font-black text-black text-[10px]">{item.qty}</td>
                      <td className="py-1.5 px-1 text-left font-bold leading-tight text-black text-[10px] break-words">{item.name}</td>
                      <td className="py-1.5 px-0.5 text-center font-bold text-black text-[9.5px] whitespace-nowrap">{weightStr}</td>
                      <td className={`py-1.5 px-0.5 text-right font-bold tabular text-black whitespace-nowrap ${rateText.length > 7 ? "text-[8.5px]" : "text-[10px]"}`}>
                        {rateText}
                      </td>
                      <td className={`py-1.5 pl-0.5 pr-1 text-right font-black tabular text-black whitespace-nowrap ${amountText.length > 9 ? "text-[8.5px]" : amountText.length > 7 ? "text-[9.5px]" : "text-[10px]"}`}>
                        {amountText}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t-[3px] border-black pt-2 mb-3 space-y-1">
            {!!extraCharges && extraCharges > 0 && (
              <div className="flex justify-between text-xs font-bold text-black px-1">
                <span>{t("pos_receipt_extra_charges")}</span>
                <span className="tabular font-black">+{Math.round(extraCharges).toLocaleString()}</span>
              </div>
            )}
            {!!advanceAmount && advanceAmount > 0 && (
              <div className="flex justify-between text-xs font-black text-black px-1">
                <span>{t("pos_receipt_advance_paid")}</span>
                <span className="tabular font-black">-{Math.round(advanceAmount).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between items-end">
              <div className="text-right w-full px-1">
                <p className="text-xs font-black uppercase tracking-wider text-black">
                  {advanceAmount && advanceAmount > 0 ? t("pos_receipt_net_payable") : t("pos_receipt_total_amount")}
                </p>
                <p className={`${totalSize} whitespace-nowrap font-black text-black tabular`}>{totalText}</p>
              </div>
            </div>

            <div className="border-t-2 border-black pt-2 mt-2 text-xs space-y-1 px-1">
              <div className="flex justify-between font-bold text-black">
                <span>{t("pos_receipt_payment_mode")}</span>
                <span className="font-black uppercase text-black">
                  {paymentMethod === "Bank Account" && bankName
                    ? `Bank (${bankName})`
                    : paymentLabels[paymentMethod] ?? paymentMethod}
                </span>
              </div>
              {paymentMethod === "Split" && (
                <div className="border-2 border-black p-2 rounded mt-1 space-y-1 text-xs bg-white text-black font-bold">
                  <div className="flex justify-between font-bold text-black">
                    <span>Cash Received:</span>
                    <span className="font-black">Rs. {Math.round(cashAmount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-black">
                    <span>Bank ({bankName || "Online"}):</span>
                    <span className="font-black">Rs. {Math.round(bankAmount || 0).toLocaleString()}</span>
                  </div>
                  {total - (cashAmount || 0) - (bankAmount || 0) > 0 && (
                    <div className="flex justify-between font-black text-black">
                      <span>Udhar (Remaining):</span>
                      <span className="font-black">Rs. {Math.round(total - (cashAmount || 0) - (bankAmount || 0)).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}
              {paymentMethod === "Udhar" && customerName && (
                <div className="border-2 border-black p-2 rounded mt-1 bg-white text-black font-bold">
                  <div className="flex justify-between font-black text-black">
                    <span>{t("pos_receipt_party_ledger")}</span>
                    <span className="font-black">{customerName}</span>
                  </div>
                  <p className="text-[10px] font-bold text-black mt-0.5">{t("pos_receipt_ledger_note")}</p>
                </div>
              )}
            </div>
          </div>

          <div className="text-center text-xs font-bold text-black mb-1">
            <div className="leading-tight font-bold text-[11px] text-black my-2">
              <p>Thank you for shopping with us ,</p>
              <p className="mt-0.5 tracking-wider font-extrabold">03124032200 / 03120032200</p>
            </div>
            {shop?.receiptMessage && !shop.receiptMessage.includes("03124032200") && (
              <div className="whitespace-pre-wrap leading-tight font-medium text-[10px] mb-2 text-stone-700">{shop.receiptMessage}</div>
            )}
            <div className="receipt-footer border-t border-black pt-2 mt-2 text-[10px] font-normal text-black leading-tight">
              <p className="italic">{t("pos_receipt_powered_by")}</p>
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
