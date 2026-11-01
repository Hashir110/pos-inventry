"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../store/useLanguage";
import { listExpenses, addExpense, deleteExpense } from "../../lib/services/expenses";
import { listSalesInRange } from "../../lib/services/sales";
import { saleNetAmount } from "../../lib/calc";
import { formatMoney } from "../../lib/format";
import {
  Plus,
  Trash2,
  Calendar,
  Wallet,
  Loader2,
  TrendingUp,
  RefreshCw,
  Clock,
  Filter,
} from "lucide-react";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import StatCard from "../../components/StatCard";
import { toast } from "react-toastify";
import { useDialog } from "../../components/DialogProvider";
import type { Expense, Sale } from "../../types";

const todayKey = () => new Date().toLocaleDateString("en-CA");
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA");
const dayRange = (day: string) => {
  const start = new Date(`${day}T00:00:00`);
  const end = new Date(`${day}T23:59:59.999`);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
};

export default function ExpensesPage() {
  const { confirm } = useDialog();
  const { currentUser } = useStore();
  const { t } = useLanguage();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string>(todayKey());
  const [filterMode, setFilterMode] = useState<"date" | "all">("date");

  const [formData, setFormData] = useState({
    title: "",
    amount: "",
    category: "General",
    date: todayKey(),
  });

  const loadData = useCallback(
    async (forceRefresh = false) => {
      if (!currentUser) return;
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const { startIso, endIso } = dayRange(selectedDate);
        const [expData, salesData] = await Promise.all([
          listExpenses(currentUser.uid, forceRefresh),
          listSalesInRange(currentUser.uid, startIso, endIso, forceRefresh),
        ]);

        setExpenses(expData);
        setSales(salesData);
      } catch (error) {
        console.error("Error loading expenses/sales data:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currentUser, selectedDate]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Expenses for the selected date
  const selectedDateExpenses = useMemo(() => {
    return expenses.filter((e) => dayKey(e.date) === selectedDate);
  }, [expenses, selectedDate]);

  // Daily expenses total
  const dailyExpenseTotal = useMemo(() => {
    return selectedDateExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [selectedDateExpenses]);

  // Overall expenses total (all time)
  const overallExpenseTotal = useMemo(() => {
    return expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [expenses]);

  // Daily sales total for selected date
  const dailySalesTotal = useMemo(() => {
    return sales.reduce((sum, item) => sum + saleNetAmount(item), 0);
  }, [sales]);

  // Net sales today (Total Sales minus Daily Expenses)
  const netDailySales = useMemo(() => {
    return dailySalesTotal - dailyExpenseTotal;
  }, [dailySalesTotal, dailyExpenseTotal]);

  // Visible expenses based on current view mode
  const visibleExpenses = useMemo(() => {
    if (filterMode === "all") return expenses;
    return selectedDateExpenses;
  }, [expenses, selectedDateExpenses, filterMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const amountVal = parseFloat(formData.amount);
    if (!amountVal || amountVal <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setSubmitting(true);
    try {
      await addExpense(currentUser.uid, {
        title: formData.title.trim(),
        amount: amountVal,
        category: formData.category,
        date: formData.date,
      });

      // If user added for a date different from selected, switch to that date
      if (formData.date !== selectedDate && filterMode === "date") {
        setSelectedDate(formData.date);
      }

      setFormData((prev) => ({
        ...prev,
        title: "",
        amount: "",
        category: "General",
      }));
      toast.success(t("expenses_added"));
      await loadData(true);
    } catch (error) {
      console.error("Error adding expense:", error);
      toast.error(t("expenses_addFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: t("expenses_deleteTitle"),
      message: t("expenses_deleteMessage"),
      confirmLabel: t("delete"),
      tone: "danger",
    });
    if (!ok) return;

    // Optimistically remove from state immediately
    const prevList = [...expenses];
    setExpenses((prev) => prev.filter((item) => item.id !== id));

    try {
      await deleteExpense(id, currentUser?.uid);
      toast.success(t("expenses_deleted"));
      if (currentUser) {
        await loadData(true);
      }
    } catch (error) {
      console.error("Error deleting expense:", error);
      setExpenses(prevList);
      toast.error(t("expenses_deleteFailed"));
    }
  };

  const categoryLabels: Record<string, string> = {
    General: t("expenses_catGeneral"),
    Food: t("expenses_catFood"),
    Transport: t("expenses_catTransport"),
    Utility: t("expenses_catUtility"),
    Salary: t("expenses_catSalary"),
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isToday = selectedDate === todayKey();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("expensesTitle")}
        subtitle={t("expensesSubtitle")}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing || loading}
              className="btn-secondary flex items-center gap-1.5"
              title="Refresh"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={isToday ? t("todayExpenses") : `${t("expenses")} (${selectedDate})`}
          value={`Rs. ${Math.round(dailyExpenseTotal).toLocaleString()}`}
          subtitle={`${selectedDateExpenses.length} ${t("expenses")}`}
          isPrivate
          icon={Wallet}
          theme="red"
          loading={loading}
        />
        <StatCard
          title={isToday ? t("todaySales") : `${t("totalSales")} (${selectedDate})`}
          value={`Rs. ${Math.round(dailySalesTotal).toLocaleString()}`}
          subtitle={`${sales.length} ${t("invoices")}`}
          isPrivate
          icon={TrendingUp}
          theme="blue"
          loading={loading}
        />
        <StatCard
          title={t("netDailySales")}
          value={`${netDailySales < 0 ? "− " : ""}Rs. ${Math.round(Math.abs(netDailySales)).toLocaleString()}`}
          subtitle={t("netDailySalesSubtitle")}
          isPrivate
          icon={TrendingUp}
          theme={netDailySales >= 0 ? "green" : "red"}
          loading={loading}
        />
        <StatCard
          title={t("overallExpenses")}
          value={`Rs. ${Math.round(overallExpenseTotal).toLocaleString()}`}
          subtitle={`${expenses.length} ${t("history")}`}
          isPrivate
          icon={Wallet}
          theme="purple"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Add Expense Form */}
        <form onSubmit={handleSubmit} className="card h-fit space-y-4 p-5 lg:col-span-1">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <h3 className="flex items-center gap-2 text-base font-bold text-stone-900">
              <Plus size={18} className="text-brand-600" /> {t("newExpense")}
            </h3>
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">
              {t("dailyExpenses")}
            </span>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-bold text-stone-700">{t("expenseDateLabel")}</label>
            <input
              type="date"
              required
              className="field cursor-pointer font-medium"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-bold text-stone-700">{t("expenseTitleLabel")}</label>
            <input
              type="text"
              required
              placeholder={t("expenseTitlePlaceholder")}
              className="field"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-bold text-stone-700">{t("expenseAmountLabel")}</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-stone-400">Rs.</span>
              <input
                type="number"
                required
                min="1"
                step="any"
                placeholder="0"
                className="field pl-11 font-bold"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-bold text-stone-700">{t("category")}</label>
            <select
              className="field cursor-pointer"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            >
              <option value="General">{t("expenses_catGeneral")}</option>
              <option value="Food">{t("expenses_catFood")}</option>
              <option value="Transport">{t("expenses_catTransport")}</option>
              <option value="Utility">{t("expenses_catUtility")}</option>
              <option value="Salary">{t("expenses_catSalary")}</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full !py-3 flex items-center justify-center min-h-[46px]"
          >
            {submitting ? (
              <Loader2 className="animate-spin text-white" size={18} />
            ) : (
              t("addExpenseBtn")
            )}
          </button>
        </form>

        {/* Expenses List & Filter */}
        <div className="lg:col-span-2 space-y-4">
          <DataTable
            data={visibleExpenses}
            rowKey={(item) => item.id}
            loading={loading}
            emptyText={t("noExpenses")}
            toolbarLeft={
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded-xl bg-stone-100 p-1">
                  <button
                    type="button"
                    onClick={() => setFilterMode("date")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      filterMode === "date"
                        ? "bg-white text-stone-900 shadow-sm"
                        : "text-stone-500 hover:text-stone-900"
                    }`}
                  >
                    {t("filterDailyExpenses")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("all")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      filterMode === "all"
                        ? "bg-white text-stone-900 shadow-sm"
                        : "text-stone-500 hover:text-stone-900"
                    }`}
                  >
                    {t("filterAllExpenses")}
                  </button>
                </div>

                {filterMode === "date" && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        setFormData((prev) => ({ ...prev, date: e.target.value }));
                      }}
                      className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-semibold text-stone-700 outline-none focus:border-brand-500"
                    />
                    {!isToday && (
                      <button
                        type="button"
                        onClick={() => {
                          const today = todayKey();
                          setSelectedDate(today);
                          setFormData((prev) => ({ ...prev, date: today }));
                        }}
                        className="rounded-lg bg-stone-100 px-2 py-1 text-xs font-bold text-stone-600 hover:bg-stone-200"
                      >
                        {t("todayFilter")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            }
            toolbarRight={
              <div className="text-right">
                <span className="text-xs text-stone-500">
                  {filterMode === "date" ? `${t("todayExpenses")}: ` : `${t("overallExpenses")}: `}
                </span>
                <span className="text-sm font-extrabold text-red-600">
                  Rs. {Math.round(
                    filterMode === "date" ? dailyExpenseTotal : overallExpenseTotal
                  ).toLocaleString()}
                </span>
              </div>
            }
            columns={[
              {
                key: "date",
                header: t("date"),
                className: "whitespace-nowrap",
                cell: (item) => (
                  <span className="flex items-center gap-2 text-stone-500 text-xs">
                    <Calendar size={13} className="text-stone-400" />
                    {formatDate(item.date)}
                  </span>
                ),
              },
              {
                key: "title",
                header: t("description"),
                cell: (item) => (
                  <span className="font-semibold text-stone-900">{item.title}</span>
                ),
              },
              {
                key: "category",
                header: t("category"),
                cell: (item) => (
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-600">
                    {categoryLabels[item.category] ?? item.category}
                  </span>
                ),
              },
              {
                key: "amount",
                header: t("amount"),
                align: "right",
                cell: (item) => (
                  <span className="font-extrabold text-red-600">
                    − Rs. {Number(item.amount).toLocaleString()}
                  </span>
                ),
              },
              {
                key: "actions",
                header: "",
                align: "right",
                cell: (item) => (
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                    title={t("delete")}
                  >
                    <Trash2 size={17} />
                  </button>
                ),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
