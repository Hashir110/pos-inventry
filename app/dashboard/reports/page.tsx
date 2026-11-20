"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Calendar,
  Download,
  TrendingUp,
  PieChart,
  ShoppingBag,
  RefreshCw,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";
import { useLanguage } from "../../store/useLanguage";
import { useStore } from "../../store/useStore";
import { toast } from "react-toastify";
import {
  fetchAnalyticsReport,
  type AnalyticsSummary,
  getDateRangeBounds,
} from "../../lib/services/analytics";

export default function AnalyticsReportsPage() {
  const { t, language } = useLanguage();
  const { currentUser, currentShop } = useStore();
  const [activeTab, setActiveTab] = useState<"pnl" | "products" | "categories">("pnl");
  const [timeRange, setTimeRange] = useState("This Month");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [report, setReport] = useState<AnalyticsSummary | null>(null);

  const loadData = async (isManualRefresh = false) => {
    if (!currentUser?.uid) return;
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await fetchAnalyticsReport(currentUser.uid, timeRange);
      setReport(data);
    } catch (error) {
      console.error("Failed to load analytics report:", error);
      toast.error("Could not calculate financial analytics. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.uid, timeRange]);

  const handleExportCSV = () => {
    if (!report) return;
    const { label } = getDateRangeBounds(timeRange);

    const rows: string[][] = [
      [`AsaanPOS - Financial & Performance Report (${currentShop?.shopName || "Retail Store"})`],
      [`Period: ${label}`, `Generated on: ${new Date().toLocaleString()}`],
      [],
      ["=== FINANCIAL EXECUTIVE SUMMARY (P&L) ==="],
      ["Metric", "Value", "Notes"],
      ...report.metrics.map((m) => [m.title, m.value, `${m.subtext} (${m.change})`]),
      [],
      ["=== TOP PERFORMING PRODUCTS ==="],
      ["Rank", "Product Name", "Category", "Units Sold", "Revenue", "Margin %"],
      ...report.topPerformers.map((p) => [
        `#${p.rank}`,
        p.name,
        p.category,
        p.sold,
        p.revenue,
        p.margin,
      ]),
      [],
      ["=== CATEGORY REVENUE DISTRIBUTION ==="],
      ["Category", "Sales", "Share %"],
      ...report.categoryShares.map((c) => [c.name, c.sales, `${c.percentage}%`]),
    ];

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      rows.map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Financial_Report_${timeRange.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Executive Financial Report exported as CSV");
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* 1. TOP HEADER & RANGE SELECTOR */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Analytics & Executive Reports
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Real-time Profit &amp; Loss statements, COGS margins, inventory turn, and category trends calculated from live sales.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
            title="Recalculate report from server"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin text-orange-600" : "text-slate-500"} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs">
            <Calendar size={14} className="text-slate-400" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-transparent outline-none cursor-pointer"
            >
              <option value="Today">Today</option>
              <option value="This Week">This Week</option>
              <option value="This Month">This Month</option>
              <option value="Last 30 Days">Last 30 Days</option>
              <option value="This Fiscal Quarter">This Fiscal Quarter</option>
            </select>
          </div>

          <button
            onClick={handleExportCSV}
            disabled={!report || loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
          >
            <Download size={14} className="text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. REPORT TABS */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 pb-2">
        {[
          { id: "pnl", label: "Profit & Loss (P&L)", icon: TrendingUp },
          { id: "products", label: "Product Performance", icon: ShoppingBag },
          { id: "categories", label: "Category Sales", icon: PieChart },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? "bg-orange-600 text-white shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200 shadow-xs">
          <Loader2 className="w-8 h-8 animate-spin text-orange-600 mb-3" />
          <span className="text-sm font-semibold text-slate-600">
            Calculating real-time financial statements & COGS...
          </span>
          <span className="text-xs text-slate-400 mt-1">Aggregating Firestore invoices, products, and expenses</span>
        </div>
      ) : !report ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
          <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h3 className="font-bold text-slate-700 text-base">No Analytics Available</h3>
          <p className="text-xs text-slate-400 mt-1">Sign in and record retail sales to see your live financial report.</p>
        </div>
      ) : (
        <>
          {/* 3. 6 EXECUTIVE KPI SUMMARY CARDS */}
          {(activeTab === "pnl" || activeTab === "products" || activeTab === "categories") && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {report.metrics.map((m, idx) => (
                <div
                  key={idx}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {m.title}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        m.positive ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {m.change}
                    </span>
                  </div>

                  <div className="mt-1">
                    <div className="text-xl font-bold text-slate-900 tracking-tight tabular-nums">
                      {m.value}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-0.5">
                      <span>{m.subtext}</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${m.positive ? "bg-orange-600" : "bg-rose-500"}`}
                      style={{ width: `${m.barPct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 4. MAIN SPLIT REPORT VIEW: Products & Category Share */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Top Selling Products Ledger (7 cols) */}
            <div
              className={`lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col ${
                activeTab === "categories" ? "hidden lg:flex" : ""
              }`}
            >
              <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="text-orange-600" size={17} />
                  <h2 className="font-bold text-slate-900 text-sm">
                    Top Performing Revenue Drivers
                  </h2>
                </div>
                <span className="text-xs text-slate-500 font-medium">{timeRange}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200">
                      <th className="py-2.5 px-4 w-12 text-center">Rank</th>
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-center">Units Sold</th>
                      <th className="py-2.5 px-3 text-right">Revenue</th>
                      <th className="py-2.5 px-4 text-right">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.topPerformers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No product transactions recorded during this period.
                        </td>
                      </tr>
                    ) : (
                      report.topPerformers.map((p) => (
                        <tr key={p.rank} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 text-center font-bold text-slate-400">#{p.rank}</td>
                          <td className="py-3 px-3 font-bold text-slate-900">{p.name}</td>
                          <td className="py-3 px-3 text-slate-500">{p.category}</td>
                          <td className="py-3 px-3 text-center font-semibold text-slate-700">{p.sold}</td>
                          <td className="py-3 px-3 text-right font-bold text-slate-900 tabular-nums">
                            {p.revenue}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-700 tabular-nums">
                            {p.margin}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column: Category Distribution & Gross Margin (5 cols) */}
            <div
              className={`lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between gap-4 ${
                activeTab === "products" ? "hidden lg:flex" : ""
              }`}
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <div className="flex items-center gap-2">
                    <PieChart className="text-orange-600" size={18} />
                    <h3 className="font-bold text-slate-900 text-sm">Category Sales Distribution</h3>
                  </div>
                  <span className="text-xs text-slate-400">Share %</span>
                </div>

                <div className="flex flex-col gap-3">
                  {report.categoryShares.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      No category distribution data recorded yet.
                    </div>
                  ) : (
                    report.categoryShares.map((cat) => (
                      <div key={cat.name} className="flex flex-col gap-1 text-xs">
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-slate-800">{cat.name}</span>
                          <span className="text-slate-900 font-bold tabular-nums">
                            {cat.sales} ({cat.percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${cat.color}`} style={{ width: `${cat.percentage}%` }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-500 flex items-center justify-between border border-slate-200">
                <span>Aggregated across {report.invoicesCleared.toLocaleString()} retail invoices</span>
                <span className="font-bold text-emerald-700">100% Balanced</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
