import { forwardRef } from "react";
import { customerLabel } from "../lib/format";
import type { PaymentMethod, SaleItem, Shop } from "../types";

interface InvoiceSheetProps {
  shop: Shop | null;
  invoiceNo: string;
  date: string;
  customerName?: string;
  transport?: string;
  extraCharges?: number;
  items: SaleItem[];
  total: number;
  paymentMethod: PaymentMethod;
}

const num = (n: number) => Math.round(n).toLocaleString();

/**
 * Bari, saaf "Sale Invoice" (WhatsApp ki tasveer ke liye). Screen par nahi dikhti,
 * sirf image banane ke liye off-screen render hoti hai.
 */
const InvoiceSheet = forwardRef<HTMLDivElement, InvoiceSheetProps>(function InvoiceSheet(
  { shop, invoiceNo, date, customerName, transport, extraCharges, items, total, paymentMethod },
  ref
) {
  const gross = items.reduce((sum, item) => sum + item.total, 0);
  const extra = extraCharges && extraCharges > 0 ? extraCharges : 0;
  const when = new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const box = "rounded-md border border-stone-500 px-3 py-1.5 text-[19px] font-bold text-black min-h-[40px]";
  const label = "w-[110px] shrink-0 text-right text-[18px] font-bold text-stone-700";

  return (
    <div ref={ref} style={{ width: 900 }} className="bg-white p-8 text-black">
      <div className="mb-5 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[38px] font-black uppercase leading-tight">{shop?.shopName || "My Shop"}</h1>
          {shop?.address && <p className="mt-1 text-[18px] font-semibold text-stone-800">{shop.address}</p>}
          {shop?.contact && <p className="text-[18px] font-semibold text-stone-800">Ph #: {shop.contact}</p>}
        </div>
        <h2 className="shrink-0 pt-2 font-serif text-[44px] font-bold italic">Sale Invoice</h2>
      </div>

      <div className="mb-5 grid grid-cols-[1fr_300px] gap-x-8 gap-y-3">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className={label}>Inv. # :</span>
            <div className={`${box} w-[240px]`}>{invoiceNo}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className={label}>Date :</span>
            <div className={`${box} w-[240px]`}>{when}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className={label}>Name :</span>
            <div className={`${box} flex-1 uppercase`}>{customerLabel(customerName)}</div>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-[16px] font-bold text-stone-700">Vehicle / Transport</p>
            <div className={`${box} uppercase`}>{transport || "—"}</div>
          </div>
          <div>
            <p className="mb-1 text-[16px] font-bold text-stone-700">Payment</p>
            <div className={`${box} uppercase`}>{paymentMethod === "Bank Account" ? "Bank / Online" : paymentMethod}</div>
          </div>
        </div>
      </div>

      <table className="w-full border-collapse text-[19px]">
        <thead>
          <tr className="border-b-[3px] border-t border-black bg-stone-100 text-[16px] font-bold">
            <th className="border-x border-stone-400 px-2 py-2.5 text-center">Sr</th>
            <th className="border-r border-stone-400 px-3 py-2.5 text-left">Item Description</th>
            <th className="border-r border-stone-400 px-2 py-2.5 text-center">Bags / Qty</th>
            <th className="border-r border-stone-400 px-2 py-2.5 text-center">Weight Kgs</th>
            <th className="border-r border-stone-400 px-2 py-2.5 text-right">Rate</th>
            <th className="border-r border-stone-400 px-3 py-2.5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const isWeight = item.type === "weight";
            const weight = item.totalWeight ?? item.qty * (item.weightPerBag || 25);
            return (
              <tr key={idx} className="border-b border-stone-400 font-semibold">
                <td className="border-x border-stone-400 px-2 py-3 text-center">{idx + 1}</td>
                <td className="border-r border-stone-400 px-3 py-3 uppercase">{item.name}</td>
                <td className="border-r border-stone-400 px-2 py-3 text-center">{item.qty}</td>
                <td className="border-r border-stone-400 px-2 py-3 text-center">{isWeight ? weight : "—"}</td>
                <td className="border-r border-stone-400 px-2 py-3 text-right">{item.price.toFixed(2)}</td>
                <td className="border-r border-stone-400 px-3 py-3 text-right font-bold">{item.total.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-5 flex justify-end">
        <div className="w-[340px] space-y-1.5 text-[20px]">
          {extra > 0 && (
            <>
              <div className="flex justify-between font-semibold text-stone-700">
                <span>Items Total</span>
                <span>{num(gross)}</span>
              </div>
              <div className="flex justify-between font-semibold text-stone-700">
                <span>Extra Charges</span>
                <span>{num(extra)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between border-t-2 border-black pt-2 text-[26px] font-black">
            <span>Total</span>
            <span>{num(total)}</span>
          </div>
          {paymentMethod === "Udhar" && customerName && (
            <p className="pt-1 text-right text-[15px] font-semibold text-stone-600">{customerName} ke khate mein add hai</p>
          )}
        </div>
      </div>
      <div className="mt-6 border-t border-stone-400 pt-3 text-center text-[15px] font-semibold text-stone-600">
        {shop?.receiptMessage && <p className="mb-1 whitespace-pre-wrap text-black">{shop.receiptMessage}</p>}
        <p className="italic">Powered by HashTech Software Agency</p>
        <p>For Contact: 0314-2811181</p>
      </div>
    </div>
  );
});

export default InvoiceSheet;
