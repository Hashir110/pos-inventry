"use client";

import { useState, useEffect } from "react";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../store/useLanguage";
import { listExpenses, addExpense, deleteExpense } from "../../lib/services/expenses";
import { Plus, Trash2, Calendar, Wallet, Loader2 } from "lucide-react";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import { toast } from 'react-toastify';
import type { Expense } from "../../types";

export default function ExpensesPage() {
  const { currentUser } = useStore();
  const { t } = useLanguage();
  
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [totalExpense, setTotalExpense] = useState(0);

  const [formData, setFormData] = useState({
    title: "",
    amount: "",
    category: "General"
  });

  const fetchExpenses = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
        const data = await listExpenses(currentUser.uid);
        setExpenses(data);
        calculateTotal(data);
    } catch (error) {
        console.error("Error fetching expenses:", error);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [currentUser]);

  const calculateTotal = (data: Expense[]) => {
    const total = data.reduce((sum: number, item: Expense) => sum + (item.amount || 0), 0);
    setTotalExpense(total);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSubmitting(true);

    try {
        await addExpense(currentUser.uid, {
            title: formData.title,
            amount: parseFloat(formData.amount),
            category: formData.category
        });

        setFormData({ title: "", amount: "", category: "General" });
        toast.success("Expense Added!");
        fetchExpenses(); 

    } catch (error) {
        console.error(error);
        toast.error("Failed to add expense");
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if(!confirm("Delete this expense?")) return;
    try {
        await deleteExpense(id);
        fetchExpenses();
    } catch (error) {
        console.error(error);
    }
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div>
      <PageHeader
        title={t("expensesTitle")}
        subtitle={t("expensesSubtitle")}
        actions={
          <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-2">
            <span className="rounded-lg bg-white p-2 text-red-500">
              <Wallet size={18} />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-red-600">{t("totalExpenses")}</p>
              <p className="tabular text-lg font-extrabold text-stone-900">Rs. {Math.round(totalExpense).toLocaleString()}</p>
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <form onSubmit={handleSubmit} className="card h-fit space-y-4 p-5 lg:col-span-1">
          <h3 className="flex items-center gap-2 text-base font-bold text-stone-900">
            <Plus size={18} className="text-brand-600" /> {t("newExpense")}
          </h3>

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
                min="0"
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
              <option value="General">General</option>
              <option value="Food">Khana / Chai</option>
              <option value="Transport">Transport</option>
              <option value="Utility">Bills / Utility</option>
              <option value="Salary">Salary / Mazdoori</option>
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

        <div className="lg:col-span-2">
          <DataTable
            data={expenses}
            rowKey={(item) => item.id}
            loading={loading}
            emptyText={t("noExpenses")}
            toolbarLeft={<h3 className="text-base font-bold text-stone-900">{t("history")}</h3>}
            columns={[
              {
                key: "date",
                header: t("date"),
                className: "whitespace-nowrap",
                cell: (item) => (
                  <span className="flex items-center gap-2 text-stone-500">
                    <Calendar size={14} />
                    {formatDate(item.date)}
                  </span>
                ),
              },
              { key: "title", header: t("description"), cell: (item) => <span className="font-semibold text-stone-900">{item.title}</span> },
              {
                key: "category",
                header: t("category"),
                cell: (item) => (
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-600">{item.category}</span>
                ),
              },
              {
                key: "amount",
                header: t("amount"),
                align: "right",
                cell: (item) => <span className="font-extrabold text-red-600">− Rs. {item.amount}</span>,
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
