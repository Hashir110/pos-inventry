"use client";

// TODO: connect logic with backend reporting service in next phase

import { useState } from "react";
import {
  BarChart3,
  Calendar,
  Download,
  TrendingUp,
  Receipt,
  PieChart,
  ShoppingBag,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  DollarSign,
  Printer,
  Sparkles,
} from "lucide-react";
import { useLanguage } from "../../store/useLanguage";
import { mockReportMetrics, mockCategoryShares, mockTopPerformers } from "../../mocks/reports";
import { toast } from "react-toastify";

export default function AnalyticsReportsPage() {
  const { t, language } = useLanguage();
  const isRTL = language === "ur";
  const [activeTab, setActiveTab] = useState<"pnl" | "products" | "categories">("pnl");
  const [timeRange, setTimeRange] = useState("This Month (Oct 2024)");

  const handleExport = () => {
    toast.success("Executive Financial Report exported as PDF / Excel");
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
            Real-time Profit &amp; Loss statements, COGS margins, inventory turn, and category trends.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs">
            <Calendar size={14} className="text-slate-400" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-transparent outline-none cursor-pointer"
            >
              <option>Today</option>
              <option>This Week</option>
              <option>This Month (Oct 2024)</option>
              <option>Last 30 Days</option>
              <option>This Fiscal Quarter</option>
            </select>
          </div>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Download size={14} className="text-slate-500" />
            <span>Export Report</span>
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

      {/* 3. 6 EXECUTIVE KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {mockReportMetrics.map((m, idx) => (
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
                <span className="text-slate-400 text-[10px]">{m.urdu}</span>
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

      {/* 4. MAIN SPLIT REPORT VIEW: P&L & Category Share */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Top Selling Products Ledger (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
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
                {mockTopPerformers.map((p) => (
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
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Category Distribution & Gross Margin (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <PieChart className="text-orange-600" size={18} />
                <h3 className="font-bold text-slate-900 text-sm">Category Sales Distribution</h3>
              </div>
              <span className="text-xs text-slate-400">Share %</span>
            </div>

            <div className="flex flex-col gap-3">
              {mockCategoryShares.map((cat) => (
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
              ))}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-500 flex items-center justify-between border border-slate-200">
            <span>Aggregated across 4,210 cleared retail invoices</span>
            <span className="font-bold text-emerald-700">100% Balanced</span>
          </div>
        </div>
      </div>
    </div>
  );
}
