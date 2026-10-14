"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Loader2, Wallet } from "lucide-react";
import { toast } from "react-toastify";
import { useStore } from "../../../store/useStore";
import { useLanguage } from "../../../store/useLanguage";
import PageHeader from "../../../components/PageHeader";
import DataTable from "../../../components/DataTable";
import SummaryBox from "../../../components/SummaryBox";
import ReceivePaymentModal from "../../../components/ReceivePaymentModal";
import { formatDate, formatMoney } from "../../../lib/format";
import { saleNetAmount } from "../../../lib/calc";
import { getCustomer, listCustomerCreditSales, listPayments } from "../../../lib/services/customers";
import { listCustomerClosings } from "../../../lib/services/dailyClosing";
import type { Customer, CustomerPayment, DailyClosingEntry, Sale } from "../../../types";

interface LedgerEntry {
  id: string;
  date: string;
  kind: "sale" | "payment";
  title: string;
  details: string;
  /** sale = +udhar, payment = -wasooli */
  amount: number;
  balance: number;
}

const describeItems = (sale: Sale) =>
  sale.items.map((i) => `${i.name} × ${i.qty}`).join(", ");

export default function CustomerLedgerPage() {
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useStore();
  const { t } = useLanguage();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<CustomerPayment[]>([]);
  const [closings, setClosings] = useState<DailyClosingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [payFor, setPayFor] = useState<Customer | null>(null);

  const loadLedger = useCallback(async () => {
    if (!currentUser || !id) return;
    try {
      const [c, s, p, cl] = await Promise.all([
        getCustomer(id),
        listCustomerCreditSales(currentUser.uid, id),
        listPayments(currentUser.uid, id),
        listCustomerClosings(currentUser.uid, id),
      ]);
      setCustomer(c && c.ownerId === currentUser.uid ? c : null);
      setSales(s);
      setPayments(p);
      setClosings(cl);
    } catch (error) {
      console.error(error);
      toast.error("History load nahi hui");
    } finally {
      setLoading(false);
    }
  }, [currentUser, id]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  // Purane se naye tak running balance nikaal kar, dikhane ke liye naye pehle
  const entries = useMemo<LedgerEntry[]>(() => {
    const raw = [
      ...sales.map((s) => ({
        id: s.id,
        date: s.date,
        kind: "sale" as const,
        title: `${t("maalGiven")} • #${s.invoiceNo}`,
        details: describeItems(s) + (s.refundedAmount ? ` (Return: ${formatMoney(s.refundedAmount)})` : ""),
        amount: saleNetAmount(s),
      })),
      ...closings
        .filter((c) => c.type === "Udhar")
        .map((c) => ({
          id: c.id,
          date: c.date,
          kind: "sale" as const,
          title: `${t("maalGiven")} • ${c.entryNo}`,
          details: `${c.itemName} × ${c.qty}${c.note ? ` • ${c.note}` : ""}`,
          amount: c.amount,
        })),
      ...payments.map((p) => ({
        id: p.id,
        date: p.date,
        kind: "payment" as const,
        title: t("paymentReceived"),
        details: `${p.method === "Cash" ? "Cash" : "Bank / Online"}${p.note ? ` • ${p.note}` : ""}`,
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
  }, [sales, payments, closings, t]);

  const totalReceived = useMemo(() => payments.reduce((sum, p) => sum + p.amount, 0), [payments]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-stone-400">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="space-y-4">
        <BackLink label={t("backToLedger")} />
        <p className="card p-8 text-center text-stone-400">{t("customerNotFound")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink label={t("backToLedger")} />

      <PageHeader
        title={customer.name}
        subtitle={customer.phone || "-"}
        actions={
          <>
            <SummaryBox label={t("totalReceived")} value={formatMoney(totalReceived)} />
            <SummaryBox label={t("remainingBalance")} value={formatMoney(customer.balance)} tone="amber" />
            <button
              onClick={() => setPayFor(customer)}
              disabled={customer.balance <= 0}
              className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Wallet size={18} /> {t("receivePayment")}
            </button>
          </>
        }
      />
      <ReceivePaymentModal customer={payFor} onClose={() => setPayFor(null)} onSuccess={loadLedger} />

      <DataTable
        data={entries}
        rowKey={(e) => `${e.kind}-${e.id}`}
        emptyText={t("noLedgerHistory")}
        toolbarLeft={
          <h3 className="font-bold text-stone-700">
            {t("ledgerHistory")} ({entries.length})
          </h3>
        }
        columns={[
          { key: "date", header: t("dateCol"), className: "whitespace-nowrap", cell: (e) => <span className="text-stone-500">{formatDate(e.date)}</span> },
          {
            key: "details",
            header: t("detailsCol"),
            cell: (e) => (
              <>
                <p className="font-semibold text-stone-800">{e.title}</p>
                {e.details && <p className="text-xs text-stone-500">{e.details}</p>}
              </>
            ),
          },
          {
            key: "amount",
            header: t("amountCol"),
            className: "whitespace-nowrap",
            cell: (e) => (
              <span className={`inline-flex items-center gap-1 font-bold ${e.kind === "sale" ? "text-red-600" : "text-emerald-600"}`}>
                {e.kind === "sale" ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                {formatMoney(e.amount)}
              </span>
            ),
          },
          {
            key: "balance",
            header: t("runningBalanceCol"),
            align: "right",
            className: "whitespace-nowrap",
            cell: (e) => <span className="font-bold text-stone-800">{formatMoney(e.balance)}</span>,
          },
        ]}
      />
    </div>
  );
}

function BackLink({ label }: { label: string }) {
  return (
    <Link
      href="/dashboard/udhar"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-stone-800"
    >
      <ArrowLeft size={16} /> {label}
    </Link>
  );
}
