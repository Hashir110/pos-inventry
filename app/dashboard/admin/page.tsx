"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  DollarSign,
  Filter,
  History,
  Loader2,
  Lock,
  TrendingUp,
  Truck,
  Wallet,
} from "lucide-react";
import { toast } from "react-toastify";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../store/useLanguage";
import PageHeader from "../../components/PageHeader";
import StatCard from "../../components/StatCard";
import DataTable from "../../components/DataTable";
import AdminLoginModal from "../../components/AdminLoginModal";
import { customerLabel, formatDate, formatMoney } from "../../lib/format";
import { dayRange, isWithdrawalSale, saleNetAmount, saleProfit } from "../../lib/calc";
import { listSalesInRange } from "../../lib/services/sales";
import { listExpensesInRange } from "../../lib/services/expenses";
import { listSupplierPayments, listSupplierPurchases } from "../../lib/services/suppliers";
import { listProducts } from "../../lib/services/products";
import type { Expense, Product, Sale, SupplierPayment, SupplierPurchase } from "../../types";

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
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<SupplierPurchase[]>([]);

  const load = useCallback(
    async (filtered: boolean) => {
      if (!currentUser) return;
      setLoading(true);
      try {
        let startIso: string;
        let endIso: string | undefined;
        if (filtered && startDate && endDate) {
          const { startIso: sIso } = dayRange(startDate);
          const { endIso: eIso } = dayRange(endDate);
          startIso = sIso;
          endIso = eIso;
        } else {
          const now = new Date();
          startIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        }

        const [s, ex, sp, prods, pur] = await Promise.all([
          listSalesInRange(currentUser.uid, startIso, endIso),
          listExpensesInRange(currentUser.uid, startIso, endIso),
          listSupplierPayments(currentUser.uid),
          listProducts(currentUser.uid),
          listSupplierPurchases(currentUser.uid),
        ]);
        const inRange = (iso: string) => iso >= startIso && (!endIso || iso <= endIso);
        setSales(s);
        setExpenses(ex);
        setSupplierPayments(sp.filter((p) => inRange(p.date)));
        setProducts(prods);
        setPurchases(pur);
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

  const productPriceMap = useMemo(() => {
    const map = new Map<string, number>();

    // 1. Populate from supplier purchase bills (taking the purchase buying price)
    purchases.forEach((pur) => {
      (pur.items ?? []).forEach((it) => {
        const bp = Number(it.buyingPrice) || 0;
        if (bp > 0) {
          if (it.productId && !map.has(it.productId)) {
            map.set(it.productId, bp);
          }
          if (it.productName && !map.has(it.productName.trim().toLowerCase())) {
            map.set(it.productName.trim().toLowerCase(), bp);
          }
        }
      });
    });

    // 2. Override/update with product catalog buyingPrice if set
    products.forEach((p) => {
      const bp = Number(p.buyingPrice) || 0;
      if (bp > 0) {
        map.set(p.id, bp);
        if (p.name) {
          map.set(p.name.trim().toLowerCase(), bp);
        }
      }
    });

    return map;
  }, [products, purchases]);

  const missingBuyingCount = useMemo(() => {
    const regularSales = sales.filter((s) => !isWithdrawalSale(s));
    const seen = new Set<string>();
    for (const sale of regularSales) {
      for (const item of sale.items ?? []) {
        const prodId = item.productId || item.id;
        const fallback =
          productPriceMap.get(prodId) ??
          (item.name ? productPriceMap.get(item.name.trim().toLowerCase()) : undefined);
        const buying = Number(item.buyingPrice) || Number(fallback) || 0;
        if (buying <= 0 && !seen.has(prodId)) {
          seen.add(prodId);
        }
      }
    }
    return seen.size;
  }, [sales, productPriceMap]);

  const totals = useMemo(() => {
    const regularSales = sales.filter((s) => !isWithdrawalSale(s));
    const posSales = regularSales.reduce((sum, s) => sum + saleNetAmount(s), 0);
    const grossProfit = regularSales.reduce((sum, s) => sum + saleProfit(s, productPriceMap), 0);
    const expenseSum = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const jamad = supplierPayments.reduce((sum, p) => sum + p.amount, 0);
    const creditSales = regularSales
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
  }, [sales, expenses, supplierPayments, productPriceMap]);

  const lock = () => {
    setUnlocked(false);
    router.push("/dashboard");
  };

  if (!unlocked) {
    return (
      <AdminLoginModal open onClose={() => router.push("/dashboard")} onSuccess={() => setUnlocked(true)} />
    );
  }

  const regularSalesCount = sales.filter((s) => !isWithdrawalSale(s)).length;

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

      {missingBuyingCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-900 shadow-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1">
            {t("admin_missingBuyingHint", { count: missingBuyingCount })}
          </div>
          <button
            onClick={() => router.push("/dashboard/inventry")}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition"
          >
            {t("navInventory")}
          </button>
        </div>
      )}

      <DataTable
        data={sales}
        rowKey={(s) => s.id}
        loading={loading}
        emptyText={t("admin_noBills")}
        toolbarLeft={
          <h3 className="text-base font-bold text-stone-900">
            {t("admin_billProfit", { count: regularSalesCount })}
          </h3>
        }
        columns={[
          { key: "date", header: t("date"), className: "whitespace-nowrap", cell: (s) => <span className="text-stone-500">{formatDate(s.date)}</span> },
          { key: "inv", header: t("admin_colInvoice"), cell: (s) => <span className="font-mono text-xs font-bold text-brand-700">#{s.invoiceNo || "-"}</span> },
          {
            key: "cust",
            header: t("customer"),
            cell: (s) => (
              <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                {customerLabel(s.customerName)}
                {isWithdrawalSale(s) && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                    Withdrawal
                  </span>
                )}
              </span>
            ),
          },
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
              if (isWithdrawalSale(s)) {
                return <span className="text-xs text-stone-400 font-medium">—</span>;
              }
              const p = saleProfit(s, productPriceMap);
              return <span className={`tabular font-extrabold ${p < 0 ? "text-red-600" : "text-emerald-600"}`}>{signed(p)}</span>;
            },
          },
        ]}
      />
    </div>
  );
}
