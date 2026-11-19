"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  Wallet,
  Phone,
  MessageCircle,
  Calendar,
  FileText,
  Printer,
  Receipt,
} from "lucide-react";
import { toast } from "react-toastify";
import { useStore } from "../../../store/useStore";
import { useLanguage } from "../../../store/useLanguage";
import ReceivePaymentModal from "../../../components/ReceivePaymentModal";
import { formatDate, formatMoney } from "../../../lib/format";
import { saleNetAmount } from "../../../lib/calc";
import { getCustomer, listCustomerCreditSales, listPayments } from "../../../lib/services/customers";
import type { Customer, CustomerPayment, Sale } from "../../../types";

interface LedgerEntry {
  id: string;
  date: string;
  kind: "sale" | "payment";
  title: string;
  details: string;
  amount: number;
  balance: number;
}

const describeItems = (sale: Sale) =>
  sale.items.map((i) => `${i.name} × ${i.qty}`).join(", ");

export default function CustomerLedgerPage() {
  const { id } = useParams<{ id: string }>();
  const { currentUser, currentShop } = useStore();
  const { t } = useLanguage();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<CustomerPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [payFor, setPayFor] = useState<Customer | null>(null);

  const loadLedger = useCallback(async () => {
    if (!currentUser || !id) return;
    try {
      const [c, s, p] = await Promise.all([
        getCustomer(id),
        listCustomerCreditSales(currentUser.uid, id),
        listPayments(currentUser.uid, id),
      ]);
      setCustomer(c && c.ownerId === currentUser.uid ? c : null);
      setSales(s);
      setPayments(p);
    } catch (error) {
      console.error(error);
      toast.error(t("credit_historyLoadFailed") || "Failed to load ledger");
    } finally {
      setLoading(false);
    }
  }, [currentUser, id, t]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  const entries = useMemo<LedgerEntry[]>(() => {
    const raw = [
      ...sales.map((s) => ({
        id: s.id,
        date: s.date,
        kind: "sale" as const,
        title: `Bill #${s.invoiceNo || s.id.slice(0, 6)}`,
        details: describeItems(s) + (s.refundedAmount ? ` (Refund: ${formatMoney(s.refundedAmount)})` : ""),
        amount: saleNetAmount(s),
      })),
      ...payments.map((p) => ({
        id: p.id,
        date: p.date,
        kind: "payment" as const,
        title: "Cash Collection",
        details: `${p.method || "Cash"}${p.note ? ` • ${p.note}` : ""}`,
        amount: p.amount,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    let running = 0;
    return raw
      .map((e) => {
        running += e.kind === "sale" ? e.amount : -e.amount;
        return { ...e, balance: Math.max(0, Math.round(running * 100) / 100) };
      })
      .reverse();
  }, [sales, payments]);

  const totalReceived = useMemo(() => payments.reduce((sum, p) => sum + p.amount, 0), [payments]);
  const totalBilled = useMemo(() => sales.reduce((sum, s) => sum + saleNetAmount(s), 0), [sales]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="animate-spin text-orange-600" size={28} />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8 space-y-4">
        <Link
          href="/dashboard/udhar"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={16} /> Back to Khata Directory
        </Link>
        <p className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
          Customer account not found.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Top Breadcrumb */}
      <div>
        <Link
          href="/dashboard/udhar"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={16} /> Back to Khata Directory
        </Link>
      </div>

      {/* Header Profile Card */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-600 text-white font-bold text-lg flex items-center justify-center">
              {customer.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-slate-900">{customer.name}</h1>
              <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <Phone size={13} className="text-orange-600" /> {customer.phone || "No phone registered"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {customer.phone && (
              <a
                href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                  `السلام علیکم ${customer.name} صاحب! ${currentShop?.shopName || "AsaanPOS"} پر آپ کا بقایا ادھار بیلنس ${formatMoney(
                    customer.balance || 0
                  )} ہے۔ برائے مہربانی تشریف لا کر حساب کلیئر فرمائیں۔ شکریہ!`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <MessageCircle size={15} />
                <span>WhatsApp Reminder</span>
              </a>
            )}

            <button
              onClick={() => setPayFor(customer)}
              className="px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 flex items-center gap-1.5 shadow-sm"
            >
              <Wallet size={15} />
              <span>Receive Payment</span>
            </button>
          </div>
        </div>

        {/* 3 Summary KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div className="p-3 bg-slate-50 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Lifetime Billed</span>
            <span className="text-base font-bold text-slate-900 tabular-nums">{formatMoney(totalBilled)}</span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-emerald-800 block">Total Recovered</span>
            <span className="text-base font-bold text-emerald-700 tabular-nums">{formatMoney(totalReceived)}</span>
          </div>
          <div className="p-3 bg-orange-50 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-orange-800 block">Current Balance Due</span>
            <span className="text-base font-extrabold text-orange-600 tabular-nums">{formatMoney(customer.balance || 0)}</span>
          </div>
        </div>
      </div>

      {/* Detailed Ledger Entries Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-orange-600" />
            <h2 className="font-bold text-slate-900 text-xs sm:text-sm">
              Complete Account Statement ({entries.length} Entries)
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Transaction Description</th>
                <th className="py-2.5 px-3 text-right">Debit</th>
                <th className="py-2.5 px-3 text-right">Credit</th>
                <th className="py-2.5 px-4 text-right">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No transactions recorded for this customer.
                  </td>
                </tr>
              ) : (
                entries.map((e) => (
                  <tr key={`${e.kind}-${e.id}`} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                      {formatDate(e.date)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-slate-800 block">{e.title}</span>
                      <span className="text-[11px] text-slate-400 truncate block max-w-sm">
                        {e.details}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">
                      {e.kind === "sale" ? (
                        <span className="text-orange-600 flex items-center justify-end gap-1">
                          <ArrowUpRight size={13} /> {formatMoney(e.amount)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-700 tabular-nums">
                      {e.kind === "payment" ? (
                        <span className="flex items-center justify-end gap-1">
                          <ArrowDownLeft size={13} /> {formatMoney(e.amount)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-extrabold text-slate-900 tabular-nums">
                      {formatMoney(e.balance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {payFor && (
        <ReceivePaymentModal
          customer={payFor}
          onClose={() => setPayFor(null)}
          onSuccess={() => {
            setPayFor(null);
            loadLedger();
          }}
        />
      )}
    </div>
  );
}
