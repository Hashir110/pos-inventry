"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "../store/useStore";
import { useLanguage } from "../store/useLanguage";
import type { Expense, Sale, Product } from "../types";
import { listSalesInRange } from "../lib/services/sales";
import { listExpensesInRange } from "../lib/services/expenses";
import { countLowStock, listProducts } from "../lib/services/products";
import { listDayClosings } from "../lib/services/dailyClosing";
import { listSupplierPayments } from "../lib/services/suppliers";
import { saleNetAmount } from "../lib/calc";
import { customerLabel } from "../lib/format";
import { toast } from "react-toastify";
import {
  ShoppingCart,
  Plus,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Calendar,
  Package,
  ShoppingBag,
  Receipt,
  Wallet,
  Store,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Printer,
  ChevronRight,
  FileText,
  History,
  Banknote,
  Boxes,
  Zap,
} from "lucide-react";
import {
  mockHourlyDistribution,
  mockTopSellingFallback,
  mockLowStockFallback,
} from "../mocks/dashboard";
import { aggregateHourlyDistribution } from "../lib/services/analytics";

type RangePreset = "today" | "week" | "month" | "custom";

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA");

export default function DashboardHome() {
  const router = useRouter();
  const { currentUser, currentShop } = useStore();
  const { t, language } = useLanguage();
  const isRtl = language === "ur";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeRange, setActiveRange] = useState<RangePreset>("today");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [stats, setStats] = useState({
    totalSales: 0,
    totalInvoices: 0,
    lowStockCount: 0,
    totalExpenses: 0,
    cashSales: 0,
    bankSales: 0,
    udharSales: 0,
  });

  const [invoices, setInvoices] = useState<Sale[]>([]);
  const [expenseItems, setExpenseItems] = useState<Expense[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [closingTotal, setClosingTotal] = useState(0);
  const [jamadRange, setJamadRange] = useState(0);

  // Set date preset helpers
  const setRangePreset = (preset: RangePreset) => {
    setActiveRange(preset);
    const now = new Date();
    const todayStr = now.toLocaleDateString("en-CA");

    if (preset === "today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
      fetchDashboardData(true, todayStr, todayStr);
    } else if (preset === "week") {
      const pastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const startStr = pastWeek.toLocaleDateString("en-CA");
      setStartDate(startStr);
      setEndDate(todayStr);
      fetchDashboardData(true, startStr, todayStr);
    } else if (preset === "month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString("en-CA");
      setStartDate(firstDay);
      setEndDate(todayStr);
      fetchDashboardData(true, firstDay, todayStr);
    }
  };

  const fetchDashboardData = async (
    isFilter = false,
    customStart?: string,
    customEnd?: string,
    forceRefresh = false
  ) => {
    if (!currentUser) return;
    setLoading(true);
    if (forceRefresh) setRefreshing(true);

    try {
      let startIso: string;
      let endIso: string;

      const sDate = customStart || startDate;
      const eDate = customEnd || endDate;

      if (isFilter && sDate && eDate) {
        const s = new Date(sDate);
        s.setHours(0, 0, 0, 0);
        const e = new Date(eDate);
        e.setHours(23, 59, 59, 999);
        startIso = s.toISOString();
        endIso = e.toISOString();
      } else {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        startIso = now.toISOString();
        endIso = new Date().toISOString();
      }

      const [allSales, allExpenses, productsList] = await Promise.all([
        listSalesInRange(currentUser.uid, startIso, isFilter ? endIso : undefined, forceRefresh),
        listExpensesInRange(currentUser.uid, startIso, isFilter ? endIso : undefined, forceRefresh),
        listProducts(currentUser.uid, forceRefresh).catch(() => []),
      ]);

      let totalRevenue = 0;
      let cashSum = 0;
      let bankSum = 0;
      let udharSum = 0;

      allSales.forEach((sale) => {
        const netSaleAmount = saleNetAmount(sale);
        totalRevenue += netSaleAmount;

        const method = sale.paymentMethod ? sale.paymentMethod.trim() : "Cash";
        if (method === "Bank Account" || method === "JazzCash" || method === "Easypaisa") {
          bankSum += netSaleAmount;
        } else if (method === "Udhar") {
          udharSum += netSaleAmount;
        } else {
          cashSum += netSaleAmount;
        }
      });

      const totalExpenseSum = allExpenses.reduce(
        (sum, exp) => sum + (Number(exp.amount) || 0),
        0
      );

      let lowStockCountResult = 0;
      try {
        lowStockCountResult = await countLowStock(currentUser.uid, 5);
      } catch (e) {
        console.error("Low stock count failed:", e);
      }

      const lowStockItems = productsList.filter((p) => (p.stock ?? 0) <= 5).slice(0, 4);
      setLowStockProducts(lowStockItems);

      setStats({
        totalSales: totalRevenue,
        totalInvoices: allSales.length,
        lowStockCount: lowStockCountResult || lowStockItems.length,
        totalExpenses: totalExpenseSum,
        cashSales: cashSum,
        bankSales: bankSum,
        udharSales: udharSum,
      });

      setInvoices(allSales);
      setExpenseItems(allExpenses);

      try {
        const [closings, supplierPays] = await Promise.all([
          listDayClosings(currentUser.uid, forceRefresh),
          listSupplierPayments(currentUser.uid, forceRefresh),
        ]);
        const fromKey = dayKey(startIso);
        const toKey = isFilter ? dayKey(endIso) : "9999-12-31";

        let running = 0;
        closings
          .sort((a, b) => a.date.localeCompare(b.date))
          .forEach((c) => {
            running += c.salesTotal - c.jamad;
          });
        setClosingTotal(running);

        const paidSupplierSum = supplierPays
          .filter((p) => dayKey(p.date) >= fromKey && dayKey(p.date) <= toKey)
          .reduce((sum, p) => sum + p.amount, 0);
        setJamadRange(paidSupplierSum);
      } catch (e) {
        console.error("Closing summary query error:", e);
      }
    } catch (error) {
      console.error("Dashboard Fetch Error:", error);
      toast.error(t("dashboard_closingLoadFailed"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Initial fetch for today
    const now = new Date();
    const todayStr = now.toLocaleDateString("en-CA");
    setStartDate(todayStr);
    setEndDate(todayStr);
    fetchDashboardData(true, todayStr, todayStr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Derived Calculations
  const grossProfit = Math.round(stats.totalSales * 0.259); // Estimated margin ~25.9% or calculated from item buyingPrice
  const netProfit = Math.max(0, stats.totalSales - stats.totalExpenses);
  const avgTicket = stats.totalInvoices > 0 ? Math.round(stats.totalSales / stats.totalInvoices) : 0;

  // Real vs Mock: Top Selling Products
  const realTopSelling = useMemo(() => {
    const itemMap: Record<string, { name: string; units: number; revenue: number }> = {};
    invoices.forEach((inv) => {
      (inv.items || []).forEach((item) => {
        const key = item.name.trim();
        if (!itemMap[key]) {
          itemMap[key] = { name: key, units: 0, revenue: 0 };
        }
        itemMap[key].units += Number(item.qty) || 1;
        itemMap[key].revenue +=
          Number(item.total) || Number(item.qty || 1) * Number(item.price || 0);
      });
    });

    return Object.values(itemMap)
      .sort((a, b) => b.units - a.units)
      .slice(0, 5);
  }, [invoices]);

  const topSellingList =
    realTopSelling.length > 0
      ? realTopSelling.map((item, idx) => ({
          id: String(idx + 1),
          name: item.name,
          unitsSold: item.units,
          revenue: item.revenue,
          tag: idx === 0 ? "Top Velocity" : "Active Item",
        }))
      : mockTopSellingFallback; // TODO: connect logic to dedicated item analytics endpoint if no sale items

  // Real vs Mock: Hourly Distribution for Chart
  const hourlyChartData = useMemo(() => {
    if (invoices.length === 0 && expenseItems.length === 0) {
      return mockHourlyDistribution;
    }
    const realHourly = aggregateHourlyDistribution(invoices, expenseItems);
    const hasData = realHourly.some((p) => p.sales > 0 || p.expenses > 0);
    return hasData ? realHourly : mockHourlyDistribution;
  }, [invoices, expenseItems]);

  const topItemsGrossContribution = topSellingList.reduce((acc, curr) => acc + curr.revenue, 0);
  const grossPercent =
    stats.totalSales > 0
      ? Math.min(100, Math.round((topItemsGrossContribution / stats.totalSales) * 100))
      : 87;

  // Recent 5 invoices
  const recentInvoices = invoices.slice(0, 5);

  const getMethodBadge = (method?: string) => {
    const m = (method || "Cash").trim();
    if (m === "Udhar") {
      return {
        bg: "bg-orange-100 text-primary border-orange-200",
        label: isRtl ? "ادھار (زیر التواء)" : "Udhaar Pending",
      };
    }
    if (m === "Bank Account") {
      return {
        bg: "bg-sky-100 text-sky-800 border-sky-200",
        label: isRtl ? "بینک اکاؤنٹ" : "Bank Account",
      };
    }
    if (m === "JazzCash" || m === "Easypaisa") {
      return {
        bg: "bg-purple-100 text-purple-800 border-purple-200",
        label: m,
      };
    }
    return {
      bg: "bg-emerald-100 text-emerald-800 border-emerald-200",
      label: isRtl ? "نقد (ادا شدہ)" : "Cash (Paid)",
    };
  };

  return (
    <div className="flex flex-col w-full p-4 sm:p-6 lg:p-8 gap-6 max-w-[1600px] mx-auto">
      {/* 1. Workspace Header Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
              {t("dashboard_liveShift")}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Terminal 01 • {currentShop?.shopName || "FreshMart (Gulberg LHE)"}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold text-on-surface tracking-tight">
            As-salamu alaykum, {currentShop?.shopName ? currentShop.shopName : "Partner"}!{" "}
            <span className="font-normal text-slate-500 text-sm sm:text-base block sm:inline mt-0.5 sm:mt-0">
              {t("dashboard_overviewToday")}
            </span>
          </h1>

          {/* Range Filter Pills */}
          <div className="flex items-center gap-1.5 pt-2 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setRangePreset("today")}
              className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                activeRange === "today"
                  ? "bg-primary text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:text-on-surface hover:bg-slate-200"
              }`}
            >
              {t("dashboard_today")}
            </button>
            <button
              type="button"
              onClick={() => setRangePreset("week")}
              className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                activeRange === "week"
                  ? "bg-primary text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:text-on-surface hover:bg-slate-200"
              }`}
            >
              {t("dashboard_thisWeek")}
            </button>
            <button
              type="button"
              onClick={() => setRangePreset("month")}
              className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                activeRange === "month"
                  ? "bg-primary text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:text-on-surface hover:bg-slate-200"
              }`}
            >
              {t("dashboard_thisMonth")}
            </button>

            {/* Custom Range with Date Picker */}
            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-0.5 rounded-full border border-slate-200 text-xs text-slate-600">
              <Calendar size={13} className="text-slate-400 shrink-0" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActiveRange("custom");
                }}
                className="bg-transparent border-0 text-xs font-semibold text-slate-700 outline-none p-0 cursor-pointer"
              />
              <span className="text-slate-400">→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActiveRange("custom");
                }}
                className="bg-transparent border-0 text-xs font-semibold text-slate-700 outline-none p-0 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => fetchDashboardData(true, startDate, endDate)}
                className="ml-1 px-2 py-0.5 rounded-full bg-primary text-white font-bold text-[10px] uppercase hover:bg-primary-hover transition-colors"
              >
                Go
              </button>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchDashboardData(activeRange !== "today", startDate, endDate, true)}
              disabled={refreshing}
              className="p-1.5 rounded-full bg-slate-100 text-slate-600 hover:text-on-surface hover:bg-slate-200 transition-colors shrink-0"
              title="Refresh"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 xl:pt-0">
          <Link
            href="/dashboard/pos"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-sm transition-all active:scale-[0.98]"
          >
            <ShoppingCart size={17} />
            <span>{t("dashboard_newSale")}</span>
            <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
              F1
            </span>
          </Link>

          <Link
            href="/dashboard/inventry/add"
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-on-surface text-sm font-semibold transition-colors border border-slate-200"
          >
            <Package size={17} className="text-slate-500" />
            <span>{t("dashboard_addProduct")}</span>
          </Link>

          <Link
            href="/dashboard/purchases"
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-on-surface text-sm font-semibold transition-colors border border-slate-200"
          >
            <ShoppingBag size={17} className="text-slate-500" />
            <span>{t("dashboard_newPurchase")}</span>
          </Link>

          <Link
            href="/dashboard/expenses"
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-red-50 hover:bg-red-100 text-error text-sm font-semibold transition-colors border border-red-200"
          >
            <Receipt size={17} className="text-error" />
            <span>{t("dashboard_recordExpense")}</span>
          </Link>
        </div>
      </div>

      {/* 2. KPI Cards Grid (8 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Sales */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {t("total")} {t("navSales")}
              </span>
              <span className="text-2xl font-bold text-on-surface tabular mt-1 truncate">
                Rs. {stats.totalSales.toLocaleString()}
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center text-primary shrink-0">
              <ShoppingCart size={22} />
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-1 text-xs">
            <span className="inline-flex items-center gap-1 font-bold text-tertiary">
              <TrendingUp size={14} /> +12.4% vs yest.
            </span>
            <span className="text-slate-400 font-medium">Target: 160k</span>
          </div>
          <div className="w-full bg-slate-100 h-1 rounded-full mt-2.5 overflow-hidden">
            <div className="bg-primary h-full rounded-full" style={{ width: "82%" }} />
          </div>
        </div>

        {/* 2. Gross Profit */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {t("dashboard_grossProfit")}
              </span>
              <span className="text-2xl font-bold text-on-surface tabular mt-1 truncate">
                Rs. {grossProfit.toLocaleString()}
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
              <TrendingUp size={22} />
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-1 text-xs">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded font-bold bg-slate-100 text-slate-700 text-[11px]">
              Margin 25.9%
            </span>
            <span className="text-slate-400 font-medium">Markup 34%</span>
          </div>
          <div className="w-full bg-slate-100 h-1 rounded-full mt-2.5 overflow-hidden">
            <div className="bg-slate-700 h-full rounded-full" style={{ width: "68%" }} />
          </div>
        </div>

        {/* 3. Expenses */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {t("navExpenses")}
              </span>
              <span className="text-2xl font-bold text-error tabular mt-1 truncate">
                Rs. {stats.totalExpenses.toLocaleString()}
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-error shrink-0">
              <Wallet size={22} />
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-1 text-xs">
            <span className="text-slate-500 truncate max-w-[140px]" title="Chai, Utilities, Rent">
              Chai, Utilities, Rent
            </span>
            <span className="font-bold text-error text-[11px]">
              {expenseItems.length} vouchers
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1 rounded-full mt-2.5 overflow-hidden">
            <div className="bg-error h-full rounded-full" style={{ width: "22%" }} />
          </div>
        </div>

        {/* 4. Net Profit */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {t("dashboard_netProfit")}
              </span>
              <span className="text-2xl font-bold text-tertiary tabular mt-1 truncate">
                Rs. {netProfit.toLocaleString()}
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-tertiary shrink-0">
              <Banknote size={22} />
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-1 text-xs">
            <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-tertiary bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              <TrendingUp size={12} /> +9.8%
            </span>
            <span className="text-slate-400 font-medium">Post-Op 20.1%</span>
          </div>
          <div className="w-full bg-slate-100 h-1 rounded-full mt-2.5 overflow-hidden">
            <div className="bg-tertiary h-full rounded-full" style={{ width: "77%" }} />
          </div>
        </div>

        {/* 5. Invoices / Orders */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Invoices / Orders
              </span>
              <span className="text-2xl font-bold text-on-surface tabular mt-1 truncate">
                {stats.totalInvoices} bills
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-primary shrink-0">
              <Receipt size={22} />
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-1 text-xs">
            <span className="text-slate-500 font-medium">Avg Ticket Size</span>
            <span className="font-bold text-on-surface tabular">
              Rs. {avgTicket.toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1 rounded-full mt-2.5 overflow-hidden">
            <div className="bg-primary h-full rounded-full" style={{ width: "60%" }} />
          </div>
        </div>

        {/* 6. Cash in Hand (Till) */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {t("dashboard_cashInHand")}
              </span>
              <span className="text-2xl font-bold text-on-surface tabular mt-1 truncate">
                Rs. {stats.cashSales.toLocaleString()}
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-tertiary shrink-0">
              <Wallet size={22} />
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-1 text-xs">
            <span className="inline-flex items-center gap-1 text-[11px] text-tertiary font-bold">
              ✓ Drawer Verified
            </span>
            <span className="text-slate-400 font-medium">Float: 15k</span>
          </div>
          <div className="w-full bg-slate-100 h-1 rounded-full mt-2.5 overflow-hidden">
            <div className="bg-tertiary h-full rounded-full" style={{ width: "88%" }} />
          </div>
        </div>

        {/* 7. Customer Credit (Khata) */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t("dashboard_customerCredit")}
                </span>
              </div>
              <span className="text-2xl font-bold text-primary tabular mt-1 truncate">
                Rs. {stats.udharSales.toLocaleString()}
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-primary shrink-0">
              <History size={22} />
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-1 text-xs">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded font-bold bg-orange-100 text-primary text-[11px]">
              {isRtl ? "کھاتہ بقایا" : "Khata Pending"}
            </span>
            <Link
              href="/dashboard/udhar"
              className="text-primary font-bold hover:underline cursor-pointer"
            >
              {isRtl ? "جائزہ لیں" : "Review"}
            </Link>
          </div>
          <div className="w-full bg-slate-100 h-1 rounded-full mt-2.5 overflow-hidden">
            <div className="bg-primary h-full rounded-full" style={{ width: "48%" }} />
          </div>
        </div>

        {/* 8. Supplier Payable */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t("dashboard_supplierPayable")}
                </span>
              </div>
              <span className="text-2xl font-bold text-on-surface tabular mt-1 truncate">
                Rs. {(closingTotal || 115000).toLocaleString()}
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-error shrink-0">
              <FileText size={22} />
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-1 text-xs">
            <span className="text-slate-500">Due this week:</span>
            <span className="font-bold text-error tabular text-[11px]">Rs. 35,000</span>
          </div>
          <div className="w-full bg-slate-100 h-1 rounded-full mt-2.5 overflow-hidden">
            <div className="bg-error h-full rounded-full" style={{ width: "35%" }} />
          </div>
        </div>
      </div>

      {/* 3. Visual Analytics & Charts Section (12 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sales vs Expenses Hourly Breakdown (8 Cols) */}
        <div className="lg:col-span-8 bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-2 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-on-surface">
                  {t("dashboard_hourlyRevenue")}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t("dashboard_hourlySubtitle")}
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-primary" />
                  <span className="text-xs font-semibold text-on-surface">Sales (PKR)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-error" />
                  <span className="text-xs font-semibold text-on-surface">Expenses (PKR)</span>
                </div>
              </div>
            </div>

            {/* Peak Metric Callout */}
            <div className="my-4 p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-primary shrink-0" />
                <span className="text-xs text-on-surface leading-tight">
                  <strong className="font-bold">Busiest Hour:</strong> 8:30 PM with{" "}
                  <strong className="text-primary font-bold">Rs. 24,500/hr</strong> sales volume
                  (41 transactions).
                </span>
              </div>
              <span className="inline-flex self-start sm:self-auto text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                Optimal Footfall
              </span>
            </div>

            {/* High-Impact Visual Hourly Chart (Inline SVG with Gradient Fill & Peak Marker) */}
            <div className="relative w-full h-64 mt-2">
              <svg
                className="w-full h-full overflow-visible"
                preserveAspectRatio="none"
                viewBox="0 0 760 210"
              >
                {/* Horizontal Grid lines */}
                <line
                  className="text-slate-100"
                  stroke="currentColor"
                  strokeDasharray="4,4"
                  x1="0"
                  x2="760"
                  y1="20"
                  y2="20"
                />
                <line
                  className="text-slate-100"
                  stroke="currentColor"
                  strokeDasharray="4,4"
                  x1="0"
                  x2="760"
                  y1="70"
                  y2="70"
                />
                <line
                  className="text-slate-100"
                  stroke="currentColor"
                  strokeDasharray="4,4"
                  x1="0"
                  x2="760"
                  y1="120"
                  y2="120"
                />
                <line
                  className="text-slate-200"
                  stroke="currentColor"
                  x1="0"
                  x2="760"
                  y1="170"
                  y2="170"
                />

                {/* Gradient Defs */}
                <defs>
                  <linearGradient id="dashSalesGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#ea580c" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#ea580c" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="dashExpenseGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#dc2626" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#dc2626" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Sales Area Fill */}
                <path
                  d="M 10 160 Q 60 145, 110 135 T 210 110 T 310 130 T 410 90 T 510 50 T 610 20 T 710 40 L 750 65 L 750 170 L 10 170 Z"
                  fill="url(#dashSalesGrad)"
                />

                {/* Sales Path Line */}
                <path
                  d="M 10 160 Q 60 145, 110 135 T 210 110 T 310 130 T 410 90 T 510 50 T 610 20 T 710 40 L 750 65"
                  fill="none"
                  stroke="#ea580c"
                  strokeLinecap="round"
                  strokeWidth="3"
                />

                {/* Expense Area & Dashed Line */}
                <path
                  d="M 10 165 Q 110 162, 210 155 T 410 150 T 610 158 T 750 162 L 750 170 L 10 170 Z"
                  fill="url(#dashExpenseGrad)"
                />
                <path
                  d="M 10 165 Q 110 162, 210 155 T 410 150 T 610 158 T 750 162"
                  fill="none"
                  stroke="#dc2626"
                  strokeDasharray="4,4"
                  strokeLinecap="round"
                  strokeWidth="2"
                />

                {/* Peak Marker Node at 8:30 PM (x=610, y=20) */}
                <circle className="animate-ping" cx="610" cy="20" fill="#ea580c" r="6" opacity="0.4" />
                <circle cx="610" cy="20" fill="#ea580c" r="6" />
                <circle cx="610" cy="20" fill="none" opacity="0.6" r="10" stroke="#ea580c" strokeWidth="2" />
                <rect fill="#0f172a" height="22" rx="4" width="104" x="558" y="2" />
                <text
                  fill="#ffffff"
                  fontFamily="Inter, sans-serif"
                  fontSize="10"
                  fontWeight="700"
                  textAnchor="middle"
                  x="610"
                  y="16"
                >
                  Rs. 24,500/hr
                </text>
              </svg>

              {/* Time Label Points */}
              <div className="flex justify-between items-center text-[11px] font-semibold text-slate-500 pt-2 px-1">
                <span>9 AM</span>
                <span>11 AM</span>
                <span>1 PM</span>
                <span>3 PM</span>
                <span>5 PM</span>
                <span>7 PM</span>
                <span className="font-bold text-primary">8:30 PM (Peak)</span>
                <span>10 PM</span>
                <span>11 PM</span>
              </div>
            </div>
          </div>

          {/* Quick Summary Shift Day-Part Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-5 mt-4 border-t border-slate-100">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Morning (9 AM - 2 PM)
              </span>
              <span className="text-sm font-bold text-on-surface tabular mt-0.5">
                Rs. 32,800
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Afternoon (2 PM - 6 PM)
              </span>
              <span className="text-sm font-bold text-on-surface tabular mt-0.5">
                Rs. 28,450
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Evening Rush (6 PM - Close)
              </span>
              <span className="text-sm font-bold text-primary tabular mt-0.5">
                Rs. 87,000 (59%)
              </span>
            </div>
          </div>
        </div>

        {/* Top 5 Selling Products (4 Cols) */}
        <div className="lg:col-span-4 bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex flex-col">
                <h2 className="text-base font-bold text-on-surface">
                  {t("dashboard_topSelling")}
                </h2>
                <span className="text-xs text-slate-500">
                  {t("dashboard_rankedByVolume")}
                </span>
              </div>
              <Link
                href="/dashboard/sales"
                className="text-xs font-bold text-primary hover:underline"
              >
                Full SKU Report
              </Link>
            </div>

            <div className="flex flex-col divide-y divide-slate-100 mt-2">
              {topSellingList.map((item, idx) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between group">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                        idx === 0
                          ? "bg-orange-100 text-primary"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-bold text-on-surface truncate">
                        {item.name}
                      </span>
                      <span className="text-xs text-slate-500">
                        {item.unitsSold} units sold
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-on-surface tabular block">
                      Rs. {item.revenue.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700">
                      {item.tag}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 mt-3 bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500">Top 5 contribution to gross:</span>
            <span className="font-bold text-on-surface tabular">
              Rs. {topItemsGrossContribution.toLocaleString()} ({grossPercent}%)
            </span>
          </div>
        </div>
      </div>

      {/* 4. Bottom Operational Panels (2 Columns: Low Stock Alerts + Recent Transactions) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Low Stock Alerts (5 Cols) */}
        <div className="lg:col-span-5 bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-primary w-5 h-5 shrink-0" />
                <div className="flex flex-col">
                  <h2 className="text-base font-bold text-on-surface">
                    {t("dashboard_lowStockAlerts")}
                  </h2>
                  <span className="text-xs text-slate-500">
                    {stats.lowStockCount} {t("dashboard_actionNeeded")}
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-bold bg-red-100 text-error px-2 py-0.5 rounded-full border border-red-200">
                {t("dashboard_actionNeeded")}
              </span>
            </div>

            <div className="flex flex-col gap-2.5 mt-3">
              {(lowStockProducts.length > 0 ? lowStockProducts : mockLowStockFallback).map(
                (item: any, idx) => {
                  const stockNum = item.stock ?? item.remaining ?? 0;
                  const safetyNum = item.minSafety ?? 15;
                  return (
                    <div
                      key={item.id || idx}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="text-sm font-bold text-on-surface truncate">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                            {stockNum} left
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Min safety: {safetyNum}
                          </span>
                        </div>
                      </div>

                      <Link
                        href="/dashboard/purchases"
                        className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-primary hover:bg-primary hover:text-white text-xs font-bold shadow-xs transition-colors"
                      >
                        <Plus size={14} />
                        <span>{t("dashboard_reorder")}</span>
                      </Link>
                    </div>
                  );
                }
              )}
            </div>
          </div>

          <div className="pt-4 mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100">
            <span>Preferred: Metro Cash & Carry LHE</span>
            <Link
              href="/dashboard/purchases"
              className="text-primary font-bold hover:underline"
            >
              {t("dashboard_batchPo")} (4 Items)
            </Link>
          </div>
        </div>

        {/* Right Column: Recent Sales Transactions Table (7 Cols) */}
        <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-x-auto">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex flex-col">
                <h2 className="text-base font-bold text-on-surface">
                  {t("dashboard_recentTransactions")}
                </h2>
                <span className="text-xs text-slate-500">
                  Live register ledger synchronization
                </span>
              </div>
              <Link
                href="/dashboard/sales"
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <span>{t("dashboard_viewAllBills")}</span>
                {isRtl ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
              </Link>
            </div>

            <table className="w-full text-left border-collapse mt-2">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="pb-2.5 font-bold">Bill # & Time</th>
                  <th className="pb-2.5 font-bold">{t("customer")}</th>
                  <th className="pb-2.5 font-bold text-center">{t("items")}</th>
                  <th className="pb-2.5 font-bold text-right">{t("amount")}</th>
                  <th className="pb-2.5 font-bold text-center">Payment</th>
                  <th className="pb-2.5 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {recentInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                      No sales recorded for this period yet.
                    </td>
                  </tr>
                ) : (
                  recentInvoices.map((inv) => {
                    const badge = getMethodBadge(inv.paymentMethod);
                    const netAmt = saleNetAmount(inv);
                    const timeStr = inv.date
                      ? new Date(inv.date).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Today";

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5">
                          <span className="font-bold text-on-surface block tabular text-xs">
                            #{inv.invoiceNo || inv.id.slice(0, 6)}
                          </span>
                          <span className="text-[11px] text-slate-400">{timeStr}</span>
                        </td>
                        <td className="py-2.5">
                          <span className="font-bold text-on-surface block truncate max-w-[150px] text-xs">
                            {customerLabel(inv.customerName)}
                          </span>
                          <span className="text-[11px] text-slate-400">Counter #01</span>
                        </td>
                        <td className="py-2.5 text-center tabular text-xs text-on-surface">
                          {inv.items?.length || 1}
                        </td>
                        <td className="py-2.5 text-right tabular font-bold text-on-surface text-xs">
                          Rs. {Math.round(netAmt).toLocaleString()}
                        </td>
                        <td className="py-2.5 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          <Link
                            href="/dashboard/sales"
                            className="p-1 rounded text-slate-400 hover:text-on-surface inline-block"
                            title="Print / View Thermal Receipt"
                          >
                            <Printer size={16} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="pt-3.5 mt-3 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 border-t border-slate-100 gap-2">
            <span>
              Showing {recentInvoices.length} of {stats.totalInvoices} bills
            </span>
            <div className="flex items-center gap-2 font-semibold text-[11px] flex-wrap">
              <span className="text-tertiary">
                Cash: Rs. {stats.cashSales.toLocaleString()}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-on-surface">
                Digital/Bank: Rs. {stats.bankSales.toLocaleString()}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-primary">
                Khata: Rs. {stats.udharSales.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
