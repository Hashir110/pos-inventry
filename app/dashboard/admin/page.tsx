"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, DollarSign, Filter, Loader2, Lock, TrendingUp, Truck, Wallet } from "lucide-react";
import { toast } from "react-toastify";
import { useStore } from "../../store/useStore";
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
        toast.error("Data load nahi hua");
      } finally {
        setLoading(false);
      }
    },
    [currentUser, startDate, endDate]
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
    return {
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
        title="Admin"
        subtitle="Sales, profit aur hisaab ka poora khulasa"
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
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter size={15} />} Apply
            </button>
            <button onClick={lock} className="btn-ghost !py-2.5">
              <Lock size={15} /> Lock
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="POS Sales" value={formatMoney(totals.posSales)} subtitle="Refund ke baad" icon={DollarSign} theme="blue" loading={loading} />
        <StatCard title="Gross Profit" value={signed(totals.grossProfit)} subtitle="(Selling − Buying) × bika qty" icon={TrendingUp} theme="green" loading={loading} />
        <StatCard title="Expenses" value={formatMoney(totals.expenseSum)} subtitle="Total kharche" icon={Wallet} theme="red" loading={loading} />
        <StatCard title="Net Profit" value={signed(totals.netProfit)} subtitle="Gross Profit − Expenses" icon={TrendingUp} theme="purple" loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard title="Supplier ko diye" value={formatMoney(totals.jamad)} subtitle="Jamad" icon={Truck} theme="red" loading={loading} />
        <StatCard title="Baqi" value={signed(totals.baqi)} subtitle="POS Sales − Supplier payment" icon={Wallet} theme="green" loading={loading} />
      </div>

      <DataTable
        data={sales}
        rowKey={(s) => s.id}
        loading={loading}
        emptyText="Is period mein koi bill nahi."
        toolbarLeft={<h3 className="text-base font-bold text-stone-900">Bill-wise Profit ({sales.length})</h3>}
        columns={[
          { key: "date", header: "Date", className: "whitespace-nowrap", cell: (s) => <span className="text-stone-500">{formatDate(s.date)}</span> },
          { key: "inv", header: "Invoice", cell: (s) => <span className="font-mono text-xs font-bold text-brand-700">#{s.invoiceNo || "-"}</span> },
          { key: "cust", header: "Customer", cell: (s) => <span className="font-semibold text-stone-800">{customerLabel(s.customerName)}</span> },
          { key: "pay", header: "Payment", cell: (s) => <span className="text-stone-600">{s.paymentMethod === "Bank Account" ? "Bank" : s.paymentMethod || "Cash"}</span> },
          { key: "amount", header: "Amount", align: "right", cell: (s) => <span className="tabular font-bold">{formatMoney(saleNetAmount(s))}</span> },
          {
            key: "profit",
            header: "Profit",
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
