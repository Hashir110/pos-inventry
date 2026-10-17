"use client";

import { useRef, useState } from "react";
import { Loader2, MessageCircle, Printer, X } from "lucide-react";
import { toBlob } from "html-to-image";
import { toast } from "react-toastify";
import InvoiceSheet from "./InvoiceSheet";
import type { PaymentMethod, SaleItem, Shop } from "../types";

interface SaleReceiptProps {
  shop: Shop | null;
  invoiceNo: string;
  date: string;
  customerName?: string;
  transport?: string;
  extraCharges?: number;
  items: SaleItem[];
  total: number;
  paymentMethod: PaymentMethod;
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
  items,
  total,
  paymentMethod,
  printLabel,
  closeLabel,
  onClose,
}: SaleReceiptProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  const makeSlipBlob = async (): Promise<Blob> => {
    if (!invoiceRef.current) throw new Error("Slip nahi mili");
    const blob = await toBlob(invoiceRef.current, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true });
    if (!blob) throw new Error("Slip ki image nahi bani");
    return blob;
  };

  const handleWhatsApp = async () => {
    setSharing(true);
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": makeSlipBlob() })]);
        window.open("https://web.whatsapp.com/", "whatsapp_web");
        toast.success("Slip copy ho gayi. WhatsApp mein chat khol kar Ctrl+V karein");
      } else {
        const url = URL.createObjectURL(await makeSlipBlob());
        const a = document.createElement("a");
        a.href = url;
        a.download = `slip-${invoiceNo}.png`;
        a.click();
        URL.revokeObjectURL(url);
        window.open("https://web.whatsapp.com/", "whatsapp_web");
        toast.info("Slip download ho gayi. WhatsApp chat mein attach karein");
      }
    } catch (error) {
      console.error("WhatsApp slip error:", error);
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      toast.error(`Slip nahi ban saki (${reason})`);
    } finally {
      setSharing(false);
    }
  };
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
          items={items}
          total={total}
          paymentMethod={paymentMethod}
        />
      </div>      <div id="printable-receipt" className="bg-white p-4 rounded-xl w-full max-w-[340px] max-h-[95vh] overflow-y-auto shadow-2xl relative text-black">
        <button onClick={onClose} className="absolute top-2 right-2 p-1 text-stone-400 no-print hover:text-stone-700">
          <X size={20} />
        </button>

        <div className="bg-white">
          <div className="text-center mb-3 border-b border-black pb-3">
            <h2 className="text-xl font-bold uppercase text-black leading-tight">{shop?.shopName || "My Shop"}</h2>
            {shop?.address && <p className="text-[10px] text-stone-800 mt-0.5">{shop.address}</p>}
            {shop?.contact && <p className="text-[10px] font-bold text-stone-900">Ph: {shop.contact}</p>}

            <div className="mt-2 text-[10px] text-stone-700 flex flex-col items-center">
              <p>{new Date(date).toLocaleString()}</p>
              <p className="font-bold text-black text-[12px] mt-1 tracking-wider">Inv #: {invoiceNo}</p>
              {transport && (
                <p className="font-bold text-black mt-1 uppercase">Transport: {transport}</p>
              )}
              {customerName && (
                <p className="font-bold text-black mt-1 uppercase border-b border-dashed border-stone-400 pb-0.5">
                  Cust: {customerName}
                </p>
              )}
            </div>
          </div>

          <div className="mb-3 overflow-x-auto text-black">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="border-b-2 border-black text-[10px] font-black uppercase">
                  <th className="py-1 pr-1">Qty</th>
                  <th className="py-1 px-1">Items</th>
                  <th className="py-1 px-1 text-center">Total Weight</th>
                  <th className="py-1 px-1 text-right">rate</th>
                  <th className="py-1 pl-1 text-right">amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {items.map((item, idx) => {
                  const isWeight = item.type === "weight";
                  const qtyStr = `${item.qty} ${isWeight ? "Bags" : "pcs"}`;
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
                <span>Extra Charges</span>
                <span className="tabular">{Math.round(extraCharges).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between items-end">
              <div className="text-right w-full">
                <p className="text-xs font-black uppercase tracking-wider text-black">Total Amount</p>
                <p className="text-2xl font-black text-black tabular">{Math.round(total).toLocaleString()}</p>
              </div>
            </div>

            <div className="border-t border-dotted border-stone-400 pt-1.5 mt-2 text-[10px] space-y-0.5">
              <div className="flex justify-between font-semibold text-stone-800">
                <span>Payment Mode:</span>
                <span className="font-bold uppercase text-black">{paymentMethod}</span>
              </div>
              {paymentMethod === "Udhar" && customerName && (
                <div className="bg-stone-100 border border-stone-300 p-1 rounded mt-1">
                  <div className="flex justify-between font-bold text-black">
                    <span>Khata (Party):</span>
                    <span>{customerName}</span>
                  </div>
                  <p className="text-[9px] text-stone-600 mt-0.5">Bill amount party ke khate mein add ho chuka hai.</p>
                </div>
              )}
            </div>
          </div>

          <div className="text-center text-[10px] text-black mb-4">
            {shop?.receiptMessage && (
              <div className="whitespace-pre-wrap leading-tight font-medium mb-2">{shop.receiptMessage}</div>
            )}
            <div className="border-t border-dotted border-stone-400 pt-2 mt-2">
              <p className="font-bold italic">Powered by HashTech Software Agency</p>
              <p>For Contact: 0314-2811181</p>
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
            onClick={handleWhatsApp}
            disabled={sharing}
            className="w-full py-3 bg-[#25D366] text-white rounded-lg font-bold flex justify-center items-center gap-2 hover:bg-[#1ebe5a] disabled:opacity-60"
          >
            {sharing ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} />} WhatsApp
          </button>          <button onClick={onClose} className="w-full py-3 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700">
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
