import { forwardRef } from "react";
import { isCounterSale } from "../lib/format";
import { useLanguage } from "../store/useLanguage";
import type { PaymentMethod, SaleItem, Shop } from "../types";

interface InvoiceSheetProps {
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
}

const num = (n: number) => Math.round(n).toLocaleString();

const InvoiceSheet = forwardRef<HTMLDivElement, InvoiceSheetProps>(function InvoiceSheet(
  {
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
  },
  ref
) {
  const { t } = useLanguage();
  const paymentLabels: Record<PaymentMethod, string> = {
    Cash: t("pos_pay_cash"),
    "Bank Account": t("pos_pay_bank"),
    Udhar: t("pos_pay_credit"),
    Split: "Cash + Bank",
  };
  const gross = items.reduce((sum, item) => sum + item.total, 0);
  const extra = extraCharges && extraCharges > 0 ? extraCharges : 0;
  const advance = advanceAmount && advanceAmount > 0 ? advanceAmount : 0;
  const when = (() => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return date;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  })();

  const box =
    "rounded-md border-2 border-black px-3.5 py-1.5 text-[18px] font-black text-black min-h-[40px] flex items-center";
  const label = "w-[110px] shrink-0 text-right text-[18px] font-black text-black";

  return (
    <div ref={ref} style={{ width: 920 }} className="bg-white px-10 py-8 text-black">
      <div className="mb-5 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[38px] font-black uppercase leading-tight">
            {shop?.shopName || t("pos_receipt_default_shop")}
          </h1>
          {shop?.address && (
            <p className="mt-1 text-[18px] font-bold text-black">{shop.address}</p>
          )}
          {shop?.contact && (
            <p className="text-[18px] font-black text-black">
              {t("pos_receipt_phone_hash", { phone: shop.contact })}
            </p>
          )}
        </div>
        <h2 className="shrink-0 pt-2 font-serif text-[44px] font-black italic">
          {t("pos_receipt_sale_invoice")}
        </h2>
      </div>

      <div className="mb-5 grid grid-cols-[1fr_320px] gap-x-8 gap-y-3">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className={label}>{t("pos_receipt_inv_label")}</span>
            <div className={`${box} w-[240px]`}>{invoiceNo}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className={label}>{t("pos_receipt_date_label")}</span>
            <div className={`${box} w-[240px]`}>{when}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className={label}>{t("pos_receipt_name_label")}</span>
            <div className={`${box} flex-1 uppercase`}>
              {isCounterSale(customerName) ? t("pos_select_counter_sale") : customerName}
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-[16px] font-black text-black">{t("pos_receipt_vehicle")}</p>
            <div className={`${box} uppercase`}>{transport || "—"}</div>
          </div>
          <div>
            <p className="mb-1 text-[16px] font-black text-black">{t("pos_receipt_payment")}</p>
            <div className={`${box} uppercase`}>
              {paymentMethod === "Split" ? (
                <div className="text-[14px] leading-tight font-black">
                  <span>Cash: Rs. {num(cashAmount || 0)}</span>
                  <br />
                  <span>Bank: {bankName || "Online"} (Rs. {num(bankAmount || 0)})</span>
                </div>
              ) : paymentMethod === "Bank Account" && bankName ? (
                `Bank (${bankName})`
              ) : (
                paymentLabels[paymentMethod] ?? paymentMethod
              )}
            </div>
          </div>
        </div>
      </div>

      <table className="w-full border-collapse text-[19px]">
        <thead>
          <tr className="border-b-[3px] border-t-2 border-black bg-stone-100 text-[17px] font-black">
            <th className="border-x border-black px-2 py-2.5 text-center">{t("pos_receipt_col_sr")}</th>
            <th className="border-r border-black px-3 py-2.5 text-left">{t("pos_receipt_col_description")}</th>
            <th className="border-r border-black px-2 py-2.5 text-center">{t("pos_receipt_col_bags_qty")}</th>
            <th className="border-r border-black px-2 py-2.5 text-center">{t("pos_receipt_col_weight_kgs")}</th>
            <th className="border-r border-black px-2 py-2.5 text-right">{t("pos_receipt_col_rate")}</th>
            <th className="border-r border-black px-4 py-2.5 text-right">{t("pos_receipt_col_amount")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const isWeight = item.type === "weight";
            const weight = item.totalWeight ?? item.qty * (item.weightPerBag || 25);
            return (
              <tr key={idx} className="border-b border-black font-bold">
                <td className="border-x border-black px-2 py-3 text-center font-black">{idx + 1}</td>
                <td className="border-r border-black px-3 py-3 uppercase">{item.name}</td>
                <td className="border-r border-black px-2 py-3 text-center">{item.qty}</td>
                <td className="border-r border-black px-2 py-3 text-center">{isWeight ? weight : "—"}</td>
                <td className="border-r border-black px-2 py-3 text-right">{item.price.toFixed(2)}</td>
                <td className="border-r border-black px-4 py-3 text-right font-black">{item.total.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-5 flex justify-end">
        <div className="w-[360px] space-y-1.5 text-[20px]">
          {(extra > 0 || advance > 0) && (
            <>
              <div className="flex justify-between font-bold text-black">
                <span>{t("pos_receipt_items_total")}</span>
                <span>{num(gross)}</span>
              </div>
              {extra > 0 && (
                <div className="flex justify-between font-bold text-black">
                  <span>{t("pos_receipt_extra_charges")}</span>
                  <span>+{num(extra)}</span>
                </div>
              )}
              {advance > 0 && (
                <div className="flex justify-between font-black text-black">
                  <span>{t("pos_receipt_advance_paid")}</span>
                  <span>-{num(advance)}</span>
                </div>
              )}
            </>
          )}
          <div className="flex justify-between border-t-[3px] border-black pt-2 text-[26px] font-black">
            <span>{advance > 0 ? t("pos_receipt_net_payable") : t("pos_receipt_total")}</span>
            <span>{num(total)}</span>
          </div>

          {paymentMethod === "Split" && (
            <div className="space-y-1 border-t-2 border-black pt-2 text-[16px] font-bold text-black">
              <div className="flex justify-between">
                <span>Cash Paid:</span>
                <span className="font-black text-black">Rs. {num(cashAmount || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Bank ({bankName || "Online"}):</span>
                <span className="font-black text-black">Rs. {num(bankAmount || 0)}</span>
              </div>
              {total - (cashAmount || 0) - (bankAmount || 0) > 0 && (
                <div className="flex justify-between text-black font-black">
                  <span>Udhar (Remaining Due):</span>
                  <span>Rs. {num(total - (cashAmount || 0) - (bankAmount || 0))}</span>
                </div>
              )}
            </div>
          )}

          {paymentMethod === "Udhar" && customerName && (
            <p className="pt-1 text-right text-[15px] font-bold text-black">
              {t("pos_receipt_in_ledger", { name: customerName })}
            </p>
          )}
        </div>
      </div>
      <div className="mt-6 border-t-2 border-black pt-3 text-center text-[15px] font-bold text-black">
        <p className="mb-0.5 font-bold">Thank you for shopping with us</p>
        <p className="mb-2 tracking-wider font-extrabold">03124032200 / 03120032200</p>
        {shop?.receiptMessage && !shop.receiptMessage.includes("03124032200") && (
          <p className="mb-1 whitespace-pre-wrap font-medium text-stone-700">{shop.receiptMessage}</p>
        )}
        <p className="italic font-medium text-[11px] text-stone-500">{t("pos_receipt_powered_by")}</p>
        <p className="font-medium text-[11px] text-stone-500">{t("pos_receipt_contact")}</p>
      </div>
    </div>
  );
});

export default InvoiceSheet;
