"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import { db } from "../lib/firebase"; 
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore"; // orderBy aur limit add kiya
import { 
  DollarSign, 
  Package, 
  TrendingUp, 
  FileText, 
  Search, 
  Calendar,
  Filter,
  Loader2,
  Wallet
} from "lucide-react";

export default function DashboardHome() {
  const { currentUser, currentShop } = useStore();
  const [loading, setLoading] = useState(true);
  
  // Date Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Stats Data
  const [stats, setStats] = useState({
    totalSales: 0,
    netProfit: 0,
    totalInvoices: 0,
    lowStockCount: 0,
    expenses: 0
  });

  // Invoices List
  const [invoices, setInvoices] = useState([]);
  const [searchInvoice, setSearchInvoice] = useState("");

  // 1. Fetch Dashboard Data
 const fetchDashboardData = async (isFilter = false) => {
    if (!currentUser) return;
    setLoading(true);

    try {
        // --- A. GET SALES DATA ---
        let salesQuery = query(
            collection(db, "sales"), 
            where("ownerId", "==", currentUser.uid),
            orderBy("date", "desc")
        );

        const salesSnapshot = await getDocs(salesQuery);
        let allSales = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // --- B. GET EXPENSES DATA (NEW) ---
        let expensesQuery = query(
            collection(db, "expenses"),
            where("ownerId", "==", currentUser.uid),
            orderBy("date", "desc")
        );
        const expenseSnapshot = await getDocs(expensesQuery);
        let allExpenses = expenseSnapshot.docs.map(doc => doc.data());


        // --- FILTER LOGIC (Sales & Expenses Dono par lagega) ---
        if (isFilter && startDate && endDate) {
            const start = new Date(startDate).setHours(0,0,0,0);
            const end = new Date(endDate).setHours(23,59,59,999);

            // Filter Sales
            allSales = allSales.filter(sale => {
                const saleDate = new Date(sale.date).getTime();
                return saleDate >= start && saleDate <= end;
            });

            // Filter Expenses
            allExpenses = allExpenses.filter(exp => {
                const expDate = new Date(exp.date).getTime();
                return expDate >= start && expDate <= end;
            });
        } 
        
        // --- CALCULATIONS ---
        
        // 1. Calculate Sales & Gross Profit
        let totalRevenue = 0;
        let grossProfit = 0;

        allSales.forEach(sale => {
            totalRevenue += sale.totalAmount || 0;
            
            if(sale.items) {
                sale.items.forEach(item => {
                    const buying = item.buyingPrice || 0;
                    const selling = item.price || 0;
                    const qty = item.qty || 0;
                    grossProfit += (selling - buying) * qty;
                });
            }
        });

        // 2. Calculate Total Expenses
        let totalExpenseSum = 0;
        allExpenses.forEach(exp => {
            totalExpenseSum += (parseFloat(exp.amount) || 0);
        });

        // 3. Calculate FINAL Net Profit (Gross Profit - Expenses)
        const finalNetProfit = grossProfit - totalExpenseSum;

        // --- C. GET LOW STOCK ---
        const productsQuery = query(
            collection(db, "products"), 
            where("ownerId", "==", currentUser.uid)
        );
        const productsSnap = await getDocs(productsQuery);
        let lowStock = 0;
        productsSnap.forEach(doc => {
            const p = doc.data();
            if(p.stock < 5) lowStock++; 
        });

        // --- UPDATE STATE ---
        setStats({
            totalSales: totalRevenue,
            netProfit: finalNetProfit, // Ab ye Expense minus karke dikhayega
            totalInvoices: allSales.length,
            lowStockCount: lowStock,
            totalExpenses: totalExpenseSum // Store Update
        });
        setInvoices(allSales); 

    } catch (error) {
        console.error("Error fetching dashboard:", error);
    } finally {
        setLoading(false);
    }
  };

  // Initial Load
  useEffect(() => {
    fetchDashboardData(); 
  }, [currentUser]);

  // Filter Handler
  const applyFilter = () => {
    fetchDashboardData(true);
  };

  // Helper for Date Formatting
  const formatDate = (isoString) => {
    if(!isoString) return "-";
    return new Date(isoString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  // Filtered Invoices for Search
  const filteredInvoicesList = invoices.filter(inv => 
    inv.id.toLowerCase().includes(searchInvoice.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans">
      
      {/* 1. Dashboard Heading */}
      <div className="flex flex-col">
        <h1 className="text-4xl font-bold text-gray-800 tracking-tight">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview for {currentShop?.shopName || "your shop"}</p>
      </div>

      {/* 2. Filter Section */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Filter size={16} /> Filter Overview
        </h3>
        <div className="flex flex-col md:flex-row gap-4 items-end md:items-center">
            
            {/* Start Date */}
            <div className="w-full md:w-auto flex-1">
                <label className="text-xs font-semibold text-gray-500 mb-1 block ml-1">From</label>
                <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input 
                        type="date" 
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                </div>
            </div>

            {/* End Date */}
            <div className="w-full md:w-auto flex-1">
                 <label className="text-xs font-semibold text-gray-500 mb-1 block ml-1">To</label>
                 <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input 
                        type="date" 
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                    />
                </div>
            </div>

            {/* Filter Button */}
            <div className="w-full md:w-auto md:mt-4"> 
              <button 
                onClick={applyFilter}
                className="w-full md:w-auto h-[38px] px-6 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center justify-center"
            >
                {loading ? <Loader2 className="animate-spin h-4 w-4" /> : "Apply Filter"}
            </button>
            </div>
        </div>
      </div>

      {/* 3. Stats Cards Grid */}
     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard 
          title="TOTAL SALES" 
          value={`Rs ${Math.round(stats.totalSales).toLocaleString()}`} 
          subtitle="Total revenue"
          icon={DollarSign} 
          theme="blue"
          loading={loading}
        />
        
        {/* NEW EXPENSE CARD */}
        <StatCard 
          title="EXPENSES" 
          value={`Rs ${Math.round(stats.totalExpenses).toLocaleString()}`} 
          subtitle="Total costs"
          icon={Wallet} 
          theme="red" // Red theme for expenses
          loading={loading}
        />

        <StatCard 
          title="NET PROFIT" 
          value={`Rs ${Math.round(stats.netProfit).toLocaleString()}`} 
          subtitle="Sales Profit - Expenses"
          icon={TrendingUp} 
          theme="green"
          loading={loading}
        />

        <StatCard 
          title="LOW STOCK" 
          value={stats.lowStockCount} 
          subtitle="Items need restock"
          icon={Package} 
          theme="orange"
          loading={loading}
        />
        
        <StatCard 
          title="INVOICES" 
          value={stats.totalInvoices} 
          subtitle="Total bills created"
          icon={FileText} 
          theme="purple"
          loading={loading}
        />
      </div>
      
      {/* 4. All Invoices Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        {/* Card Header */}
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50">
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-500" />
                Recent Invoices
            </h3>
            
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input 
                    type="text" 
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    placeholder="Search ID..."
                    value={searchInvoice}
                    onChange={(e) => setSearchInvoice(e.target.value)}
                />
            </div>
        </div>

        {/* Invoice List Table */}
        <div className="overflow-x-auto">
            {loading ? (
                <div className="p-10 text-center text-gray-400">Loading data...</div>
            ) : filteredInvoicesList.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                    <div className="bg-gray-100 p-4 rounded-full mb-3">
                        <FileText className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 text-sm font-medium">No invoices found for this period</p>
                    <button onClick={() => window.location.href = "/dashboard/pos"} className="mt-2 text-blue-600 hover:text-blue-800 text-xs font-semibold hover:underline">
                        Create new sale
                    </button>
                </div>
            ) : (
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="p-4 font-semibold text-gray-600">Date</th>
                            <th className="p-4 font-semibold text-gray-600">Invoice ID</th>
                            <th className="p-4 font-semibold text-gray-600">Items</th>
                            <th className="p-4 font-semibold text-gray-600 text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {filteredInvoicesList.slice(0, 5).map((inv) => (
                            <tr key={inv.id} className="hover:bg-blue-50/30 transition">
                                <td className="p-4 text-gray-600">{formatDate(inv.date)}</td>
                                <td className="p-4 font-mono text-xs text-gray-500">#{inv.id.slice(0, 8)}...</td>
                                <td className="p-4 text-gray-800">{inv.items?.length || 0} items</td>
                                <td className="p-4 text-right font-bold text-gray-800">
                                    Rs {Math.round(inv.totalAmount).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
        {/* Footer Link */}
        {filteredInvoicesList.length > 0 && (
            <div className="p-3 border-t bg-gray-50 text-center">
                <a href="/dashboard/sales" className="text-xs font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wide">
                    View All Sales History
                </a>
            </div>
        )}
      </div>
    </div>
  );
}

// Updated StatCard with Loading State
function StatCard({ title, value, subtitle, icon: Icon, theme, loading }) {
  
  const styles = {
    blue: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-600", iconBg: "bg-blue-100" },
    orange: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-600", iconBg: "bg-orange-100" },
    green: { bg: "bg-green-50", border: "border-green-200", text: "text-green-600", iconBg: "bg-green-100" },
    purple: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-600", iconBg: "bg-purple-100" }
  };

  const currentStyle = styles[theme] || styles.blue;

  return (
    <div className={`${currentStyle.bg} border ${currentStyle.border} p-5 rounded-xl shadow-sm flex flex-col justify-between h-32 relative overflow-hidden transition-all hover:shadow-md`}>
      <div className="flex justify-between items-start">
        <div className="z-10 relative">
          <p className={`text-xs font-bold uppercase tracking-wider ${currentStyle.text} mb-1 opacity-90`}>{title}</p>
          {loading ? (
              <div className="h-8 w-24 bg-gray-200 animate-pulse rounded"></div>
          ) : (
              <h3 className="text-2xl font-bold text-gray-800 tracking-tight">{value}</h3>
          )}
        </div>
        <div className={`p-2.5 rounded-lg ${currentStyle.iconBg} ${currentStyle.text}`}>
             <Icon size={20} />
        </div>
      </div>
      <div className="mt-auto z-10">
        <p className={`text-xs ${currentStyle.text} opacity-80 font-medium truncate`}>{subtitle}</p>
      </div>
    </div>
  );
}