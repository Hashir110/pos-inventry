"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, DollarSign, Filter, History, Loader2, Lock, TrendingUp, Truck, Wallet } from "lucide-react";
import { toast } from "react-toastify";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../store/useLanguage";
import PageHeader from "../../components/PageHeader";
import StatCard from "../../components/StatCard";
import DataTable from "../../components/DataTable";
import AdminLoginModal from "../../components/AdminLoginModal";
import { customerLabel, formatDate, formatMoney } from "../../lib/format";
import { saleNetAmount, saleProfit } from "../../lib/calc";
import { listSalesInRange } from "../../lib/services/sales";
import { listExpensesInRange } from "../../lib/services/expenses";
import { listSupplierPayments } from "../../lib/services/suppliers";
import type { Expense, Sale, SupplierPayment } from "../../types";

const signed = (n: number) => `${n < 0 ? "− " : ""}${formatMoney(Math.abs(n))}`;

export default function AdminPage() {
  const router = useRouter();
  const { currentUser } = useStore();
  const { t } = useLanguage();

  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);

  const load = useCallback(
    async (filtered: boolean) => {
      if (!currentUser) return;
      setLoading(true);
      try {
        let startIso: string;
        let endIso: string | undefined;
        if (filtered && startDate && endDate) {
          const s = new Date(startDate);
          s.setHours(0, 0, 0, 0);
          const e = new Date(endDate);
          e.setHours(23, 59, 59, 999);
          startIso = s.toISOString();
          endIso = e.toISOString();
        } else {
          const now = new Date();
          startIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        }

        const [s, ex, sp] = await Promise.all([
          listSalesInRange(currentUser.uid, startIso, endIso),
          listExpensesInRange(currentUser.uid, startIso, endIso),
          listSupplierPayments(currentUser.uid),
        ]);
        const inRange = (iso: string) => iso >= startIso && (!endIso || iso <= endIso);
        setSales(s);
        setExpenses(ex);
        setSupplierPayments(sp.filter((p) => inRange(p.date)));
      } catch (error) {
        console.error(error);
        toast.error(t("admin_loadFailed"));
      } finally {
        setLoading(false);
      }
    },
    [currentUser, startDate, endDate, t]
  );

  useEffect(() => {
    if (unlocked && currentUser) load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, currentUser]);

  const totals = useMemo(() => {
    const posSales = sales.reduce((sum, s) => sum + saleNetAmount(s), 0);
    const grossProfit = sales.reduce((sum, s) => sum + saleProfit(s), 0);
    const expenseSum = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const jamad = supplierPayments.reduce((sum, p) => sum + p.amount, 0);
    const creditSales = sales
      .filter((s) => (s.paymentMethod || "").trim() === "Udhar")
      .reduce((sum, s) => sum + saleNetAmount(s), 0);
    return {
      creditSales,
      posSales,
      grossProfit,
      expenseSum,
      netProfit: grossProfit - expenseSum,
      jamad,
      baqi: posSales - jamad,
    };
  }, [sales, expenses, supplierPayments]);

  const lock = () => {
    setUnlocked(false);
    router.push("/dashboard");
  };

  if (!unlocked) {
    return (
      <AdminLoginModal open onClose={() => router.push("/dashboard")} onSuccess={() => setUnlocked(true)} />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin_title")}
        subtitle={t("admin_subtitle")}
        actions={
          <>
            <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-1.5 shadow-card">
              <Calendar className="h-4 w-4 text-stone-400" />
              <input
                type="date"
                className="border-0 bg-transparent p-1 text-sm font-medium text-stone-700 outline-none focus:ring-0"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="text-stone-300">→</span>
              <input
                type="date"
                className="border-0 bg-transparent p-1 text-sm font-medium text-stone-700 outline-none focus:ring-0"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <button onClick={() => load(true)} className="btn-dark !py-2.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter size={15} />} {t("apply")}
            </button>
            <button onClick={lock} className="btn-ghost !py-2.5">
              <Lock size={15} /> {t("admin_lock")}
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title={t("admin_posSales")} value={formatMoney(totals.posSales)} subtitle={t("afterRefunds")} icon={DollarSign} theme="blue" loading={loading} />
        <StatCard title={t("admin_grossProfit")} value={signed(totals.grossProfit)} subtitle={t("admin_grossHint")} icon={TrendingUp} theme="green" loading={loading} />
        <StatCard title={t("expenses")} value={formatMoney(totals.expenseSum)} subtitle={t("totalExpenses")} icon={Wallet} theme="red" loading={loading} />
        <StatCard title={t("netProfit")} value={signed(totals.netProfit)} subtitle={t("admin_netHint")} icon={TrendingUp} theme="purple" loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title={t("admin_creditSales")} value={formatMoney(totals.creditSales)} subtitle={t("admin_creditHint")} icon={History} theme="purple" loading={loading} />
        <StatCard title={t("admin_paidSuppliers")} value={formatMoney(totals.jamad)} subtitle={t("admin_paidOut")} icon={Truck} theme="red" loading={loading} />
        <StatCard title={t("admin_balance")} value={signed(totals.baqi)} subtitle={t("admin_balanceHint")} icon={Wallet} theme="green" loading={loading} />
      </div>

      <DataTable
        data={sales}
        rowKey={(s) => s.id}
        loading={loading}
        emptyText={t("admin_noBills")}
        toolbarLeft={<h3 className="text-base font-bold text-stone-900">{t("admin_billProfit", { count: sales.length })}</h3>}
        columns={[
          { key: "date", header: t("date"), className: "whitespace-nowrap", cell: (s) => <span className="text-stone-500">{formatDate(s.date)}</span> },
          { key: "inv", header: t("admin_colInvoice"), cell: (s) => <span className="font-mono text-xs font-bold text-brand-700">#{s.invoiceNo || "-"}</span> },
          { key: "cust", header: t("customer"), cell: (s) => <span className="font-semibold text-stone-800">{customerLabel(s.customerName)}</span> },
          {
            key: "pay",
            header: t("admin_colPayment"),
            cell: (s) => (
              <span className="text-stone-600">
                {s.paymentMethod === "Bank Account" ? t("admin_payBank") : s.paymentMethod === "Udhar" ? t("admin_payCredit") : t("cash")}
              </span>
            ),
          },
          { key: "amount", header: t("amount"), align: "right", cell: (s) => <span className="tabular font-bold">{formatMoney(saleNetAmount(s))}</span> },
          {
            key: "profit",
            header: t("admin_colProfit"),
            align: "right",
            cell: (s) => {
              const p = saleProfit(s);
              return <span className={`tabular font-extrabold ${p < 0 ? "text-red-600" : "text-emerald-600"}`}>{signed(p)}</span>;
            },
          },
        ]}
      />
    </div>
  );
}
