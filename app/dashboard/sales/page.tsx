"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  RefreshCw,
  Plus,
  Download,
  Calendar,
  CreditCard,
  Banknote,
  BookOpen,
  ArrowRight,
  ChevronRight,
  Eye,
  CheckCircle2,
  Clock,
  Printer,
  Pencil,
  X,
  Loader2,
  FileSpreadsheet,
  AlertCircle,
  TrendingUp,
  Receipt,
  RotateCcw,
  ShoppingBag,
  Store,
  User,
  Phone,
  MapPin,
} from "lucide-react";
import { toast } from "react-toastify";
import { listRecentSales, updateSaleItems } from "../../lib/services/sales";
import SaleReceipt from "../../components/SaleReceipt";
import { saleNetAmount } from "../../lib/calc";
import { customerLabel, isCounterSale } from "../../lib/format";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../store/useLanguage";
import type { TranslationKey } from "../../lib/i18n/translations";
import type { Sale } from "../../types";

type SaleRow = Sale;
interface ItemDraft {
  qty: string;
  weight: string;
  manual: boolean;
  price: string;
}
type PayFilter = "all" | "Cash" | "Bank Account" | "Udhar";
type StatusFilter = "all" | "paid" | "partial" | "udhar" | "refunded";
type DateFilter = "today" | "yesterday" | "week" | "month" | "all";

const money = (n: number) => `Rs. ${Math.round(n || 0).toLocaleString()}`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

const saleStatus = (sale: Sale): { key: "paid" | "partial" | "udhar" | "refunded"; label: string; tone: string; bgTone: string } => {
  const refunded = sale.refundedAmount || 0;
  const allReturned = sale.items?.length > 0 && sale.items.every((i) => (i.returnedQty || 0) >= i.qty);
  if (allReturned) {
    return { key: "refunded", label: "Refunded", tone: "text-rose-700", bgTone: "bg-rose-50 border border-rose-200 text-rose-700" };
  }
  if (refunded > 0) {
    return { key: "partial", label: "Partial Return", tone: "text-amber-700", bgTone: "bg-amber-50 border border-amber-200 text-amber-700" };
  }
  if (sale.paymentMethod === "Udhar") {
    return { key: "udhar", label: "Udhaar Due", tone: "text-orange-700", bgTone: "bg-orange-50 border border-orange-200 text-orange-700" };
  }
  return { key: "paid", label: "Paid", tone: "text-emerald-700", bgTone: "bg-emerald-50 border border-emerald-200 text-emerald-700" };
};

const paymentInfo = (sale: Sale) => {
  const net = saleNetAmount(sale);
  const isUdhar = sale.paymentMethod === "Udhar";
  return {
    isUdhar,
    paid: isUdhar ? 0 : net,
    due: isUdhar ? net : 0,
    badge: isUdhar ? "bg-orange-50 text-orange-700 border border-orange-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200",
    label: isUdhar ? "Due" : "Paid",
  };
};

export default function SalesHistoryPage() {
  const { currentUser, currentShop } = useStore();
  const { t, language } = useLanguage();
  const isRTL = language === "ur";
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [payFilter, setPayFilter] = useState<PayFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  // Selection & Details / Edit
  const [selectedSale, setSelectedSale] = useState<SaleRow | null>(null);
  const [draft, setDraft] = useState<ItemDraft[] | null>(null);
  const [draftExtra, setDraftExtra] = useState("");
  const [saving, setSaving] = useState(false);
  const [receiptSale, setReceiptSale] = useState<SaleRow | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const fetchSales = useCallback(
    async (force = false) => {
      if (!currentUser) return;
      if (force) setRefreshing(true);
      try {
        const recent = await listRecentSales(currentUser.uid, 100, force);
        setSales(recent);
        if (force) toast.success(t("sales_billUpdated") || "Sales refreshed");
      } catch (error) {
        console.error("Error fetching sales:", error);
        toast.error(t("sales_loadFailed"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currentUser, t]
  );

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  // Edit Handlers
  const startEdit = (sale: SaleRow) => {
    setDraftExtra(sale.extraCharges ? String(sale.extraCharges) : "");
    setDraft(
      sale.items.map((i) => ({
        qty: String(i.qty),
        weight: i.type === "weight" ? String(i.totalWeight ?? i.qty * (i.weightPerBag || 25)) : "",
        manual: !!i.isManualWeight,
        price: String(i.price),
      }))
    );
  };

  const changeDraft = (sale: SaleRow, index: number, field: "qty" | "weight" | "price", value: string) => {
    setDraft((prev) =>
      prev
        ? prev.map((d, i) => {
            if (i !== index) return d;
            if (field === "weight") return { ...d, weight: value, manual: true };
            if (field === "price") return { ...d, price: value };
            const perBag = sale.items[i].weightPerBag || 25;
            const auto = d.manual ? d.weight : String((parseFloat(value) || 0) * perBag);
            return { ...d, qty: value, weight: sale.items[i].type === "weight" ? auto : d.weight };
          })
        : prev
    );
  };

  const draftLineTotal = (sale: SaleRow, index: number) => {
    const d = draft?.[index];
    if (!d) return sale.items[index].total || sale.items[index].price * sale.items[index].qty;
    const price = parseFloat(d.price) || 0;
    const units = sale.items[index].type === "weight" ? parseFloat(d.weight) || 0 : parseFloat(d.qty) || 0;
    return units * price;
  };

  const saveEdit = async (sale: SaleRow) => {
    if (!draft) return;
    setSaving(true);
    try {
      const extraNow = Math.max(0, parseFloat(draftExtra) || 0);
      const { items, totalAmount, extraCharges } = await updateSaleItems(
        sale.id,
        draft.map((d, i) => ({
          qty: parseFloat(d.qty),
          price: parseFloat(d.price),
          ...(sale.items[i].type === "weight" ? { totalWeight: parseFloat(d.weight) } : {}),
        })),
        extraNow
      );
      const updated: SaleRow = { ...sale, items, totalAmount, extraCharges };
      setSales((prev) => prev.map((s) => (s.id === sale.id ? updated : s)));
      setSelectedSale(updated);
      setDraft(null);
      setReceiptSale(updated);
      toast.success(t("sales_billUpdated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("sales_billUpdateFailed"));
    } finally {
      setSaving(false);
    }
  };

  // Date filters helper
  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

  // Filtered Sales
  const filteredSales = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    return sales.filter((s) => {
      // Payment filter
      if (payFilter !== "all" && (s.paymentMethod || "Cash") !== payFilter) return false;

      // Status filter
      if (statusFilter !== "all") {
        const st = saleStatus(s).key;
        if (statusFilter !== st) return false;
      }

      // Date filter
      if (dateFilter !== "all") {
        const saleDate = new Date(s.date);
        if (dateFilter === "today" && !isSameDay(saleDate, now)) return false;
        if (dateFilter === "yesterday" && !isSameDay(saleDate, yesterday)) return false;
        if (dateFilter === "week" && saleDate < sevenDaysAgo) return false;
        if (dateFilter === "month" && saleDate < thirtyDaysAgo) return false;
      }

      // Search term
      if (!term) return true;
      const invMatch = (s.invoiceNo || "").toLowerCase().includes(term);
      const custMatch = customerLabel(s.customerName).toLowerCase().includes(term);
      return invMatch || custMatch;
    });
  }, [sales, search, payFilter, statusFilter, dateFilter]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredSales.length / pageSize));
  const displayedSales = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSales.slice(start, start + pageSize);
  }, [filteredSales, page, pageSize]);

  // Summary KPI Calculations
  const stats = useMemo(() => {
    const totalSales = filteredSales.reduce((s, x) => s + saleNetAmount(x), 0);
    const invoiceCount = filteredSales.length;
    const paidAmount = filteredSales
      .filter((s) => s.paymentMethod !== "Udhar")
      .reduce((s, x) => s + saleNetAmount(x), 0);
    const dueKhata = filteredSales
      .filter((s) => s.paymentMethod === "Udhar")
      .reduce((s, x) => s + saleNetAmount(x), 0);
    const khataCount = filteredSales.filter((s) => s.paymentMethod === "Udhar").length;
    const avgTicket = invoiceCount > 0 ? Math.round(totalSales / invoiceCount) : 0;
    const paidPct = totalSales > 0 ? Math.round((paidAmount / totalSales) * 100) : 0;
    const duePct = totalSales > 0 ? Math.round((dueKhata / totalSales) * 100) : 0;

    return {
      totalSales,
      invoiceCount,
      paidAmount,
      dueKhata,
      khataCount,
      avgTicket,
      paidPct,
      duePct,
    };
  }, [filteredSales]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredSales.length === 0) {
      toast.info("No data to export");
      return;
    }
    const headers = ["Invoice #", "Date", "Customer", "Payment Method", "Items Count", "Net Amount", "Status"];
    const rows = filteredSales.map((s) => [
      `"${s.invoiceNo || s.id}"`,
      `"${formatDate(s.date)}"`,
      `"${customerLabel(s.customerName)}"`,
      `"${s.paymentMethod || "Cash"}"`,
      s.items?.length || 0,
      saleNetAmount(s),
      `"${saleStatus(s).label}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `AsaanPOS_Sales_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV Export downloaded");
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* 1. TOP HEADER & ACTIONS */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {t("sales_title") || "Sales History & Invoices"}
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {t("sales_subtitle") || "Real-time transaction register across POS terminals and branches"}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => fetchSales(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
            title="Refresh from server"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin text-orange-600" : "text-slate-500"} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Download size={16} className="text-slate-500" />
            <span>{t("sales_export") || "Export CSV"}</span>
          </button>

          <Link
            href="/dashboard/pos"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 transition-colors shadow-sm"
          >
            <Plus size={16} />
            <span>{t("sales_newInvoice") || "New Direct Invoice"}</span>
          </Link>
        </div>
      </div>

      {/* 2. 4 KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Total Sales */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {t("sales_totalSalesToday") || "Total Sales"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600">
              <Receipt size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              {money(stats.totalSales)}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-emerald-600 font-semibold">
              <TrendingUp size={14} />
              <span>Active Revenue</span>
            </div>
          </div>
        </div>

        {/* Card 2: Total Invoices */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {t("sales_totalInvoicesCount") || "Total Invoices"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <ShoppingBag size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              {stats.invoiceCount}
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
              <span>{t("sales_avgTicket") || "Avg Ticket"}:</span>
              <span className="font-bold text-slate-800">{money(stats.avgTicket)}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Paid (Cash & Digital) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {t("sales_paidCashDigital") || "Paid (Realized)"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-emerald-700 tabular-nums">
              {money(stats.paidAmount)}
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-emerald-700 font-semibold">
              <span>{stats.paidPct}%</span>
              <span className="text-slate-400 font-normal">{t("sales_realized") || "realized in till/bank"}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Due Khata */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {t("sales_dueKhataTitle") || "Due Khata"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600">
              <BookOpen size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-orange-600 tabular-nums">
              {money(stats.dueKhata)}
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
              <span className="font-bold text-orange-600">{stats.duePct}%</span>
              <span>across {stats.khataCount} invoices</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. FILTERS & SEARCH ROW */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-3">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          {/* Search bar (lg: 6 cols) */}
          <div className="lg:col-span-6 relative flex items-center">
            <Search className="absolute left-3.5 text-slate-400 pointer-events-none" size={17} />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t("filterCustomerInvoice") || "Search by Invoice # (e.g. 10892), Customer Name, or Phone..."}
              className="w-full pl-10 pr-12 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
            />
            <span className="absolute right-3 px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 text-[11px] font-bold">
              F2
            </span>
          </div>

          {/* Payment Method Filter (lg: 3 cols) */}
          <div className="lg:col-span-3">
            <select
              value={payFilter}
              onChange={(e) => {
                setPayFilter(e.target.value as PayFilter);
                setPage(1);
              }}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
            >
              <option value="all">{t("sales_allMethods") || "All Methods"}</option>
              <option value="Cash">{t("cash") || "Cash"}</option>
              <option value="Bank Account">{t("bankOnline") || "Bank / Digital"}</option>
              <option value="Udhar">{t("sales_payCredit") || "Udhaar / Khata"}</option>
            </select>
          </div>

          {/* Status Filter (lg: 3 cols) */}
          <div className="lg:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter);
                setPage(1);
              }}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
            >
              <option value="all">{t("sales_allStatuses") || "All Statuses"}</option>
              <option value="paid">{t("sales_statusPaid") || "Paid"}</option>
              <option value="partial">{t("sales_statusPartialTitle") || "Partial"}</option>
              <option value="udhar">{t("sales_statusUdhaar") || "Udhaar Due"}</option>
              <option value="refunded">{t("sales_statusRefunded") || "Refunded"}</option>
            </select>
          </div>
        </div>

        {/* Date Presets Row */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
              <Calendar size={13} /> {t("date") || "Date"}:
            </span>
            {(
              [
                { id: "all", label: t("sales_dateAll") || "All Time" },
                { id: "today", label: t("sales_dateToday") || "Today" },
                { id: "yesterday", label: t("sales_dateYesterday") || "Yesterday" },
                { id: "week", label: t("sales_dateThisWeek") || "This Week" },
                { id: "month", label: t("sales_dateThisMonth") || "This Month" },
              ] as const
            ).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setDateFilter(d.id);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  dateFilter === d.id
                    ? "bg-orange-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{displayedSales.length}</strong> of{" "}
            <strong className="text-slate-800">{filteredSales.length}</strong> transactions
          </div>
        </div>
      </div>

      {/* 4. SPLIT LAYOUT: Invoices Register Table (Left) + Detail Panel / Drawer (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Table Column: spans 7 cols when selectedSale is active, 12 cols otherwise */}
        <div
          className={`${
            selectedSale ? "lg:col-span-7" : "lg:col-span-12"
          } bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col transition-all`}
        >
          {/* Table Header */}
          <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="text-orange-600" size={18} />
              <h2 className="font-bold text-slate-900 text-sm sm:text-base">
                {t("sales_invoicesRegister") || "Invoices Register"}
              </h2>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              {t("sales_liveUpdating") || "Live Updating"}
            </span>
          </div>

          {/* Table Element */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200">
                  <th className="py-3 px-4">{t("sales_colInvoice") || "Invoice #"}</th>
                  <th className="py-3 px-3">{t("sales_colCustomer") || "Customer"}</th>
                  <th className="py-3 px-3 text-center">{t("sales_colItems") || "Items"}</th>
                  <th className="py-3 px-3 text-right">{t("sales_colAmount") || "Amount"}</th>
                  <th className="py-3 px-3">{t("sales_colMethod") || "Method"}</th>
                  <th className="py-3 px-3">{t("sales_colStatus") || "Status"}</th>
                  <th className="py-3 px-4 text-right">{t("sales_colAction") || "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="animate-spin text-orange-600" size={24} />
                        <span className="text-xs font-semibold">Loading sales register...</span>
                      </div>
                    </td>
                  </tr>
                ) : displayedSales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <ShoppingBag size={28} className="text-slate-300" />
                        <p className="text-sm font-semibold text-slate-600">{t("sales_noBills") || "No invoices found"}</p>
                        <p className="text-xs text-slate-400">Try adjusting your filters or date range.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedSales.map((sale) => {
                    const status = saleStatus(sale);
                    const isSelected = selectedSale?.id === sale.id;
                    const itemsCount = sale.items?.reduce((s, i) => s + (i.qty || 1), 0) || 0;

                    return (
                      <tr
                        key={sale.id}
                        onClick={() => setSelectedSale(sale)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-orange-50/70 border-l-4 border-l-orange-600"
                            : "hover:bg-slate-50/80"
                        }`}
                      >
                        {/* Invoice # & Time */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-mono text-xs font-bold text-slate-900 flex items-center gap-1">
                              #{sale.invoiceNo || sale.id.slice(0, 8)}
                              {(sale.isOffline || sale.id.startsWith("local_")) && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                                  OFFLINE
                                </span>
                              )}
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium">
                              {formatTime(sale.date)}
                            </span>
                          </div>
                        </td>

                        {/* Customer */}
                        <td className="py-3.5 px-3">
                          <div className="flex flex-col min-w-0 max-w-[160px]">
                            <span className="font-bold text-slate-800 truncate">
                              {customerLabel(sale.customerName)}
                            </span>
                            <span className="text-[11px] text-slate-400 truncate">
                              {isCounterSale(sale.customerName) ? "Walk-in Customer" : "Registered Party"}
                            </span>
                          </div>
                        </td>

                        {/* Items */}
                        <td className="py-3.5 px-3 text-center font-bold text-slate-700 tabular-nums">
                          {itemsCount}
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-3 text-right">
                          <span className="font-bold text-slate-900 tabular-nums">
                            {money(saleNetAmount(sale))}
                          </span>
                        </td>

                        {/* Method */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1 text-xs text-slate-600 font-medium">
                            {sale.paymentMethod === "Udhar" ? (
                              <>
                                <BookOpen size={13} className="text-orange-600" />
                                <span className="text-orange-700 font-bold">Udhaar</span>
                              </>
                            ) : sale.paymentMethod === "Bank Account" ? (
                              <>
                                <CreditCard size={13} className="text-sky-600" />
                                <span>Bank / QR</span>
                              </>
                            ) : (
                              <>
                                <Banknote size={13} className="text-emerald-600" />
                                <span>Cash</span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${status.bgTone}`}
                          >
                            {status.label}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSale(sale);
                            }}
                            className={`p-1.5 rounded-md transition-colors ${
                              isSelected
                                ? "bg-orange-600 text-white"
                                : "text-slate-400 hover:text-orange-600 hover:bg-slate-100"
                            }`}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-3.5 bg-slate-50/70 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-slate-500 font-medium">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const num = i + 1;
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setPage(num)}
                    className={`w-7 h-7 rounded text-xs font-bold transition-all ${
                      page === num
                        ? "bg-orange-600 text-white"
                        : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {num}
                  </button>
                );
              })}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Right Detail Drawer / Slideover (5 cols) */}
        {selectedSale && (
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-md flex flex-col overflow-hidden sticky top-20">
            {/* Drawer Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-bold text-slate-900">
                    #{selectedSale.invoiceNo || selectedSale.id.slice(0, 8)}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                      saleStatus(selectedSale).bgTone
                    }`}
                  >
                    {saleStatus(selectedSale).label}
                  </span>
                </div>
                <span className="text-xs text-slate-500 mt-0.5">
                  {formatDate(selectedSale.date)} • Counter #01
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedSale(null);
                  setDraft(null);
                }}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-4 sm:p-5 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
              {/* Customer Box */}
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center">
                      {customerLabel(selectedSale.customerName).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800">
                        {customerLabel(selectedSale.customerName)}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {selectedSale.customerId ? "Khata Account Party" : "Walk-in Retail Customer"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Method</span>
                    <span className="text-xs font-bold text-slate-800">
                      {selectedSale.paymentMethod || "Cash"}
                    </span>
                  </div>
                </div>

                {selectedSale.description && (
                  <p className="mt-1 text-xs text-slate-600 italic bg-white p-2 rounded border border-slate-200">
                    Note: {selectedSale.description}
                  </p>
                )}
              </div>

              {/* Order Items Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {t("sales_orderSummary") || "Order Summary"}
                  </h3>
                  {draft && (
                    <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Editing Mode Active
                    </span>
                  )}
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Item</th>
                        <th className="py-2.5 px-2 text-center">Qty</th>
                        <th className="py-2.5 px-2 text-right">Rate</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedSale.items.map((item, idx) => {
                        const isWeight = item.type === "weight";
                        const weightVal =
                          item.totalWeight ?? (isWeight ? item.qty * (item.weightPerBag || 25) : undefined);

                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-900">{item.name}</div>
                              {weightVal !== undefined && (
                                <div className="text-[10px] text-slate-400">{weightVal} kg</div>
                              )}
                              {(item.returnedQty || 0) > 0 && (
                                <div className="text-[10px] text-rose-600 font-bold">
                                  Returned: {item.returnedQty}
                                </div>
                              )}
                            </td>

                            <td className="py-2.5 px-2 text-center tabular-nums">
                              {draft ? (
                                <input
                                  type="number"
                                  min="1"
                                  step="any"
                                  value={draft[idx]?.qty ?? ""}
                                  onChange={(e) => changeDraft(selectedSale, idx, "qty", e.target.value)}
                                  className="w-14 py-1 text-center font-bold border border-slate-300 rounded bg-white text-slate-900 focus:ring-1 focus:ring-orange-500"
                                />
                              ) : (
                                <span className="font-bold text-slate-700">
                                  {isWeight ? `${item.qty} bags` : `${item.qty} pcs`}
                                </span>
                              )}
                            </td>

                            <td className="py-2.5 px-2 text-right tabular-nums">
                              {draft ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={draft[idx]?.price ?? ""}
                                  onChange={(e) => changeDraft(selectedSale, idx, "price", e.target.value)}
                                  className="w-16 py-1 text-right font-bold border border-slate-300 rounded bg-white text-slate-900 focus:ring-1 focus:ring-orange-500"
                                />
                              ) : (
                                <span className="text-slate-600">Rs. {item.price}</span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">
                              Rs. {Math.round(draftLineTotal(selectedSale, idx)).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Extra charges in edit mode */}
              {draft && (
                <div className="flex items-center justify-between p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-xs">
                  <span className="font-bold text-amber-900">
                    {t("sales_extraCharges") || "Extra / Delivery Charges"}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={draftExtra}
                    onChange={(e) => setDraftExtra(e.target.value)}
                    placeholder="0"
                    className="w-24 py-1 px-2 text-right font-bold border border-amber-300 rounded bg-white text-slate-900"
                  />
                </div>
              )}

              {/* Financial Breakdown Table */}
              {(() => {
                const subTotal = draft
                  ? selectedSale.items.reduce((s, _i, idx) => s + draftLineTotal(selectedSale, idx), 0)
                  : selectedSale.items.reduce((s, i) => s + (i.total || i.price * i.qty), 0);
                const refunded = selectedSale.refundedAmount || 0;
                const extraVal = draft
                  ? Math.max(0, parseFloat(draftExtra) || 0)
                  : selectedSale.extraCharges || 0;
                const grandTotal = draft ? subTotal + extraVal : saleNetAmount(selectedSale);
                const pay = paymentInfo(selectedSale);

                return (
                  <div className="rounded-lg border border-slate-200 overflow-hidden text-xs">
                    <div className="flex justify-between py-2 px-3 bg-slate-50 text-slate-600 border-b border-slate-200">
                      <span>{t("subtotal") || "Subtotal"}</span>
                      <span className="font-semibold text-slate-800">{money(subTotal)}</span>
                    </div>

                    {extraVal > 0 && (
                      <div className="flex justify-between py-2 px-3 bg-white text-slate-600 border-b border-slate-200">
                        <span>{t("sales_extraCharges") || "Extra Charges"}</span>
                        <span className="font-semibold text-slate-800">{money(extraVal)}</span>
                      </div>
                    )}

                    {refunded > 0 && (
                      <div className="flex justify-between py-2 px-3 bg-rose-50 text-rose-700 border-b border-slate-200 font-semibold">
                        <span>{t("sales_refundReturn") || "Refunds / Returns"}</span>
                        <span>- {money(refunded)}</span>
                      </div>
                    )}

                    <div className="flex justify-between py-2.5 px-3 bg-slate-100 text-slate-900 font-bold border-b border-slate-200 text-sm">
                      <span>{t("grandTotal") || "Net Payable Total"}</span>
                      <span className="text-orange-700">{money(grandTotal)}</span>
                    </div>

                    <div className="flex justify-between py-2 px-3 bg-white text-slate-600 border-b border-slate-100">
                      <span>{t("paid") || "Paid Amount"}</span>
                      <span className="font-semibold text-emerald-700">{money(pay.paid)}</span>
                    </div>

                    <div className="flex justify-between py-2 px-3 bg-white text-slate-600">
                      <span>{t("due") || "Due / Udhaar Balance"}</span>
                      <span className={`font-bold ${pay.due > 0 ? "text-orange-600" : "text-slate-500"}`}>
                        {money(pay.due)}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Drawer Action Buttons */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              {draft ? (
                <>
                  <button
                    type="button"
                    onClick={() => setDraft(null)}
                    disabled={saving}
                    className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100"
                  >
                    {t("cancel") || "Cancel"}
                  </button>
                  <button
                    type="button"
                    onClick={() => saveEdit(selectedSale)}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 flex items-center gap-1.5 shadow-sm"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
                    <span>{t("sales_saveSlip") || "Save & Print"}</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setReceiptSale(selectedSale)}
                    className="px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 shadow-xs"
                  >
                    <Printer size={14} className="text-slate-500" />
                    <span>{t("sales_slip") || "Thermal Slip"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => startEdit(selectedSale)}
                    disabled={(selectedSale.refundedAmount || 0) > 0}
                    className="px-3.5 py-2 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 flex items-center gap-1.5 shadow-xs disabled:opacity-40"
                    title={
                      (selectedSale.refundedAmount || 0) > 0
                        ? "Bills with returns cannot be edited"
                        : "Edit quantities and rates"
                    }
                  >
                    <Pencil size={14} />
                    <span>{t("sales_editBill") || "Edit Bill"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSale(null);
                      setDraft(null);
                    }}
                    className="px-3 py-2 rounded-lg bg-slate-800 text-white text-xs font-bold hover:bg-slate-900"
                  >
                    {t("sales_close") || "Close"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Thermal Receipt Print Preview */}
      {receiptSale && (
        <SaleReceipt
          shop={currentShop}
          invoiceNo={receiptSale.invoiceNo}
          date={receiptSale.date}
          customerName={isCounterSale(receiptSale.customerName) ? "" : receiptSale.customerName}
          transport={receiptSale.transport}
          extraCharges={receiptSale.extraCharges}
          items={receiptSale.items}
          total={saleNetAmount(receiptSale)}
          paymentMethod={receiptSale.paymentMethod}
          printLabel={t("printSlip") || "Print Receipt"}
          closeLabel={t("sales_close") || "Close"}
          onClose={() => setReceiptSale(null)}
        />
      )}
    </div>
  );
}
