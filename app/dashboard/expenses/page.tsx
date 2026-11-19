"use client";

import { useState, useEffect, useMemo } from "react";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../store/useLanguage";
import { listExpenses, addExpense, deleteExpense } from "../../lib/services/expenses";
import {
  Plus,
  Trash2,
  Calendar,
  Wallet,
  Loader2,
  Receipt,
  TrendingDown,
  Coffee,
  Fuel,
  Lightbulb,
  Truck,
  Wrench,
  Layers,
  Banknote,
  Search,
  Filter,
} from "lucide-react";
import { toast } from "react-toastify";
import { useDialog } from "../../components/DialogProvider";
import type { Expense } from "../../types";

const money = (n: number) => `Rs. ${Math.round(n || 0).toLocaleString()}`;

const CATEGORIES = [
  { id: "General", label: "General Store", icon: Layers },
  { id: "Food", label: "Staff Tea / Food", icon: Coffee },
  { id: "Utility", label: "Electricity / Bills", icon: Lightbulb },
  { id: "Transport", label: "Rider / Transport", icon: Truck },
  { id: "Fuel", label: "Generator / Fuel", icon: Fuel },
  { id: "Maintenance", label: "Shop Repairs", icon: Wrench },
] as const;

export default function ExpensesPage() {
  const { confirm } = useDialog();
  const { currentUser, currentShop } = useStore();
  const { t, language } = useLanguage();
  const isRTL = language === "ur";

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("all");

  const [formData, setFormData] = useState({
    title: "",
    amount: "",
    category: "General",
  });

  const fetchExpenses = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const data = await listExpenses(currentUser.uid);
      setExpenses(data);
    } catch (error) {
      console.error("Error fetching expenses:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const num = parseFloat(formData.amount);
    if (!formData.title.trim() || isNaN(num) || num <= 0) {
      toast.warn("Please enter a valid title and positive amount.");
      return;
    }

    setSubmitting(true);
    try {
      await addExpense(currentUser.uid, {
        title: formData.title.trim(),
        amount: num,
        category: formData.category,
      });

      setFormData({ title: "", amount: "", category: "General" });
      toast.success(t("expenses_added") || "Expense voucher recorded");
      fetchExpenses();
    } catch (error) {
      console.error(error);
      toast.error(t("expenses_addFailed") || "Failed to record expense");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, title?: string) => {
    const ok = await confirm({
      title: t("expenses_deleteTitle") || "Delete Expense Voucher",
      message: t("expenses_deleteMessage") || `Are you sure you want to delete ${title || "this expense"}?`,
      confirmLabel: t("delete") || "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteExpense(id);
      toast.success("Expense voucher removed");
      fetchExpenses();
    } catch (error) {
      console.error(error);
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const count = expenses.length;
    const avg = count > 0 ? Math.round(total / count) : 0;

    // Category breakdown
    const byCategory: Record<string, number> = {};
    expenses.forEach((e) => {
      const cat = e.category || "General";
      byCategory[cat] = (byCategory[cat] || 0) + (Number(e.amount) || 0);
    });

    let topCat = "General";
    let topCatSum = 0;
    Object.entries(byCategory).forEach(([cat, sum]) => {
      if (sum > topCatSum) {
        topCat = cat;
        topCatSum = sum;
      }
    });

    return { total, count, avg, topCat, topCatSum };
  }, [expenses]);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return expenses.filter((e) => {
      const matchTitle = (e.title || "").toLowerCase().includes(term);
      const matchCat = (e.category || "").toLowerCase().includes(term);
      if (!matchTitle && !matchCat) return false;

      if (selectedCat !== "all" && (e.category || "General") !== selectedCat) return false;
      return true;
    });
  }, [expenses, searchTerm, selectedCat]);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* 1. TOP HEADER & ACTIONS */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {t("expensesTitle") || "Daily Store Expenses"}
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {t("expensesSubtitle") || "Log till cash deductions, generator fuel, tea, utility bills, and maintenance costs."}
          </p>
        </div>
      </div>

      {/* 2. 4 SUMMARY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Outlays</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
              <TrendingDown size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-700 tabular-nums">{money(metrics.total)}</div>
            <div className="text-xs text-slate-500 mt-0.5">Across {metrics.count} total vouchers</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Voucher Count</span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <Receipt size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{metrics.count}</div>
            <div className="text-xs text-slate-500 mt-0.5">Signed till vouchers</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Top Outlay Category</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Coffee size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg font-bold text-slate-900 truncate">{metrics.topCat}</div>
            <div className="text-xs text-amber-700 font-semibold mt-0.5">{money(metrics.topCatSum)} total</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Average Voucher</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Wallet size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{money(metrics.avg)}</div>
            <div className="text-xs text-slate-500 mt-0.5">Per recorded voucher</div>
          </div>
        </div>
      </div>

      {/* 3. DUAL-PANEL: ADD EXPENSE VOUCHER (Left) + EXPENSE LEDGER (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form (4 cols) */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col gap-4"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Plus size={18} className="text-orange-600" />
            <h2 className="text-sm font-bold text-slate-900">Record Till Cash Deduction</h2>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Expense Title / Description *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Staff Tea & Biscuits, Generator Diesel..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Amount (PKR) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                Rs.
              </span>
              <input
                type="number"
                required
                min="1"
                step="any"
                placeholder="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((c) => {
                const isSelected = formData.category === c.id;
                const Icon = c.icon;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, category: c.id })}
                    className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all text-left ${
                      isSelected
                        ? "bg-orange-50 border-orange-500 text-orange-700"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <Icon size={14} className={isSelected ? "text-orange-600" : "text-slate-400"} />
                    <span className="truncate">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 mt-2"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            <span>Record Expense Voucher</span>
          </button>
        </form>

        {/* Right Ledger Table (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          {/* Table Filters Header */}
          <div className="p-3.5 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search expense title..."
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
              <button
                type="button"
                onClick={() => setSelectedCat("all")}
                className={`px-2.5 py-1 rounded-full font-bold transition-all ${
                  selectedCat === "all"
                    ? "bg-orange-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All
              </button>
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCat(c.id)}
                  className={`px-2.5 py-1 rounded-full font-semibold transition-all whitespace-nowrap ${
                    selectedCat === c.id
                      ? "bg-orange-600 text-white font-bold"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200">
                  <th className="py-2.5 px-4">Voucher / Title</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <Loader2 className="animate-spin text-orange-600 mx-auto" size={22} />
                    </td>
                  </tr>
                ) : filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <Receipt size={32} className="mx-auto mb-2 text-slate-300" />
                      <p className="text-sm font-semibold text-slate-600">No expense vouchers recorded</p>
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 text-xs block">{e.title}</span>
                        <span className="text-[10px] text-slate-400">Voucher #{e.id.slice(0, 6)}</span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {e.category || "General"}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                        {e.date ? new Date(e.date).toLocaleString() : "—"}
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-rose-600 tabular-nums text-sm">
                        {money(Number(e.amount) || 0)}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(e.id, e.title)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete Voucher"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
