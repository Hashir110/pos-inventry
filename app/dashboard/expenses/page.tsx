"use client";

import { useState, useEffect } from "react";
import { useStore } from "../../store/useStore";
import { listExpenses, addExpense, deleteExpense } from "../../lib/services/expenses";
import { Plus, Trash2, Calendar, Wallet } from "lucide-react";
import PageHeader from "../../components/PageHeader";
// Is line ko code ke top par likhein:
import { toast } from 'react-toastify';
import type { Expense } from "../../types";
export default function ExpensesPage() {
  const { currentUser } = useStore();
  
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [totalExpense, setTotalExpense] = useState(0);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    amount: "",
    category: "General"
  });

  // 1. Fetch Expenses (Sirf Aaj Ke ya Last 50)
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

  // 2. Calculate Today's Expense
  const calculateTotal = (data: Expense[]) => {
    // Agar aap chaho to sirf aaj ka total dikha sakte ho
    // Filhal main list mein maujood sab items ka total dikha raha hun
    const total = data.reduce((sum: number, item: Expense) => sum + (item.amount || 0), 0);
    setTotalExpense(total);
  };

  // 3. Add Expense Handler
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

        // Reset & Refresh
        setFormData({ title: "", amount: "", category: "General" });
        toast.success("Expense Added!");
        fetchExpenses(); 

    } catch (error) {
        console.error(error);
        toast.error("Failed to add expense");
    }
    setSubmitting(false);
  };

  // 4. Delete Handler
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
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Expenses"
        subtitle="Dukaan ke roz ke kharche"
        actions={
          <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-2">
            <span className="rounded-lg bg-white p-2 text-red-500">
              <Wallet size={18} />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-red-600">Total kharche</p>
              <p className="tabular text-lg font-extrabold text-stone-900">Rs. {Math.round(totalExpense).toLocaleString()}</p>
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Add form */}
        <form onSubmit={handleSubmit} className="card h-fit space-y-4 p-5 lg:col-span-1">
          <h3 className="flex items-center gap-2 text-base font-bold text-stone-900">
            <Plus size={18} className="text-brand-600" /> Naya kharcha
          </h3>

          <div>
            <label className="mb-1.5 block text-sm font-bold text-stone-700">Kis cheez ka?</label>
            <input
              type="text"
              required
              placeholder="e.g. Chai / Bijli ka bill"
              className="field"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-bold text-stone-700">Raqam</label>
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
            <label className="mb-1.5 block text-sm font-bold text-stone-700">Category</label>
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

          <button type="submit" disabled={submitting} className="btn-primary w-full !py-3">
            {submitting ? "Add ho raha hai..." : "Kharcha Add Karein"}
          </button>
        </form>

        {/* List */}
        <div className="card overflow-hidden lg:col-span-2">
          <div className="border-b border-stone-200 p-4">
            <h3 className="text-base font-bold text-stone-900">History</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-stone-200">
                <tr>
                  <th className="p-4">Date</th>
                  <th className="p-4">Detail</th>
                  <th className="p-4">Category</th>
                  <th className="p-4 text-right">Raqam</th>
                  <th className="p-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr><td colSpan={5} className="p-10 text-center text-stone-400">Loading...</td></tr>
                ) : expenses.length === 0 ? (
                  <tr><td colSpan={5} className="p-12 text-center text-stone-400">Abhi koi kharcha darj nahi.</td></tr>
                ) : (
                  expenses.map((item) => (
                    <tr key={item.id} className="hover:bg-stone-50">
                      <td className="whitespace-nowrap p-4 text-stone-500">
                        <span className="flex items-center gap-2">
                          <Calendar size={14} />
                          {formatDate(item.date)}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-stone-900">{item.title}</td>
                      <td className="p-4">
                        <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-600">
                          {item.category}
                        </span>
                      </td>
                      <td className="p-4 text-right font-extrabold text-red-600">− Rs. {item.amount}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 size={17} />
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