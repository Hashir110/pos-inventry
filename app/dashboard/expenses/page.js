"use client";

import { useState, useEffect } from "react";
import { db } from "../../lib/firebase"; 
import { collection, addDoc, query, where, orderBy, getDocs, deleteDoc, doc, Timestamp } from "firebase/firestore";
import { useStore } from "../../store/useStore";
import { Plus, Trash2, Calendar, DollarSign, Wallet } from "lucide-react";
// Is line ko code ke top par likhein:
import { toast } from 'react-toastify';
export default function ExpensesPage() {
  const { currentUser } = useStore();
  
  const [expenses, setExpenses] = useState([]);
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
        const q = query(
            collection(db, "expenses"),
            where("ownerId", "==", currentUser.uid),
            orderBy("date", "desc")
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
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
  const calculateTotal = (data) => {
    // Agar aap chaho to sirf aaj ka total dikha sakte ho
    // Filhal main list mein maujood sab items ka total dikha raha hun
    const total = data.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    setTotalExpense(total);
  };

  // 3. Add Expense Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    setSubmitting(true);

    try {
        await addDoc(collection(db, "expenses"), {
            ownerId: currentUser.uid,
            title: formData.title, // e.g. Chai, Bill, Lunch
            amount: parseFloat(formData.amount),
            category: formData.category,
            date: new Date().toISOString()
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
  const handleDelete = async (id) => {
    if(!confirm("Delete this expense?")) return;
    try {
        await deleteDoc(doc(db, "expenses", id));
        fetchExpenses();
    } catch (error) {
        console.error(error);
    }
  };

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-800">Daily Expenses</h1>
            <p className="text-sm text-gray-500">Track your shop's daily running costs</p>
        </div>
        
        {/* Total Card */}
        <div className="bg-red-50 border border-red-100 px-6 py-3 rounded-xl flex items-center gap-4 shadow-sm">
            <div className="bg-white p-2 rounded-full text-red-500">
                <Wallet size={24} />
            </div>
            <div>
                <p className="text-xs text-red-600 font-bold uppercase">Total Expenses</p>
                <h3 className="text-xl font-extrabold text-gray-800">Rs. {Math.round(totalExpense).toLocaleString()}</h3>
            </div>
        </div>
      </div>

      {/* --- ADD EXPENSE FORM --- */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
            <Plus size={18} className="text-blue-600" /> Add New Expense
        </h3>
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">
            
            <div className="flex-1 w-full">
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Description</label>
                <input 
                    type="text" required
                    placeholder="e.g. Chai / Electricity Bill / Lunch"
                    className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                />
            </div>

            <div className="w-full md:w-40">
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Amount (Rs)</label>
                <input 
                    type="number" required min="0"
                    placeholder="0"
                    className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                />
            </div>

            <div className="w-full md:w-40">
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Category</label>
                <select 
                    className="w-full p-2.5 border rounded-lg bg-white outline-none cursor-pointer"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                >
                    <option value="General">General</option>
                    <option value="Food">Food/Tea</option>
                    <option value="Transport">Transport</option>
                    <option value="Utility">Bills/Utility</option>
                    <option value="Salary">Salary/Labor</option>
                </select>
            </div>

            <button 
                type="submit" 
                disabled={submitting}
                className="w-full md:w-auto px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-bold transition flex justify-center items-center gap-2"
            >
                {submitting ? "Adding..." : "Add Expense"}
            </button>
        </form>
      </div>

      {/* --- EXPENSE LIST --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b bg-gray-50/50">
            <h3 className="font-bold text-gray-700">Expense History</h3>
        </div>
        
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b">
                    <tr>
                        <th className="p-4 font-semibold text-gray-600">Date</th>
                        <th className="p-4 font-semibold text-gray-600">Description</th>
                        <th className="p-4 font-semibold text-gray-600">Category</th>
                        <th className="p-4 font-semibold text-gray-600">Amount</th>
                        <th className="p-4 font-semibold text-gray-600 text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {loading ? (
                        <tr><td colSpan="5" className="p-6 text-center text-gray-400">Loading...</td></tr>
                    ) : expenses.length === 0 ? (
                        <tr><td colSpan="5" className="p-8 text-center text-gray-400">No expenses recorded yet.</td></tr>
                    ) : (
                        expenses.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50 transition">
                                <td className="p-4 text-gray-500 flex items-center gap-2">
                                    <Calendar size={14} />
                                    {formatDate(item.date)}
                                </td>
                                <td className="p-4 font-medium text-gray-800">{item.title}</td>
                                <td className="p-4">
                                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs border border-gray-200">
                                        {item.category}
                                    </span>
                                </td>
                                <td className="p-4 font-bold text-red-600">
                                    - Rs. {item.amount}
                                </td>
                                <td className="p-4 text-right">
                                    <button 
                                        onClick={() => handleDelete(item.id)}
                                        className="text-gray-400 hover:text-red-500 p-2 rounded-full transition"
                                    >
                                        <Trash2 size={18} />
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
  );
}