"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import { db } from "../lib/firebase";
import { toast } from 'react-toastify';
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
    Wallet,
    EyeOff,
    Eye,
    X
} from "lucide-react";

export default function DashboardHome() {
    const { currentUser, currentShop } = useStore();
    const [loading, setLoading] = useState(true);

    // Date Filters
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const [showSales, setShowSales] = useState(false);
    const [showProfit, setShowProfit] = useState(false);

    const [isPassModalOpen, setIsPassModalOpen] = useState(false);
    const [passInput, setPassInput] = useState("");
    const [targetField, setTargetField] = useState(null);

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
            // --- 1. DATE LOGIC SETTING ---
            let startIso, endIso;

            if (isFilter && startDate && endDate) {
                // User ne Date Select ki hai
                const s = new Date(startDate); s.setHours(0, 0, 0, 0);
                const e = new Date(endDate); e.setHours(23, 59, 59, 999);
                startIso = s.toISOString();
                endIso = e.toISOString();
            } else {
                // Default: Sirf is mahine ka data (1st Date to Now)
                const now = new Date();
                const s = new Date(now.getFullYear(), now.getMonth(), 1); // 1st of month
                startIso = s.toISOString();
                endIso = new Date().toISOString(); // Abhi tak
            }

            // --- A. GET SALES DATA (Optimized) ---
            // Hum query mein hi bata rahe hain ke kab se kab tak ka data chahiye
            let salesQuery = query(
                collection(db, "sales"),
                where("ownerId", "==", currentUser.uid),
                where("date", ">=", startIso), // Start Date
                ...(isFilter ? [where("date", "<=", endIso)] : []), // End Date (agar filter ho)
                orderBy("date", "desc")
            );

            const salesSnapshot = await getDocs(salesQuery);
            // Ab JS filter ki zarurat nahi, data pehle hi filtered aaya hai
            let allSales = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // --- B. GET EXPENSES DATA (Optimized) ---
            let expensesQuery = query(
                collection(db, "expenses"),
                where("ownerId", "==", currentUser.uid),
                where("date", ">=", startIso),
                ...(isFilter ? [where("date", "<=", endIso)] : []),
                orderBy("date", "desc")
            );

            const expenseSnapshot = await getDocs(expensesQuery);
            let allExpenses = expenseSnapshot.docs.map(doc => doc.data());

            // --- CALCULATIONS (Same as before) ---

            // 1. Calculate Sales & Gross Profit
            let totalRevenue = 0;
            let grossProfit = 0;

            allSales.forEach(sale => {
                // A. Net Sales Calculation
                // Asal Sale - Wapas kiya gaya paisa
                const originalAmount = sale.totalAmount || 0;
                const refunded = sale.refundedAmount || 0; // Ye field humne return process mein banayi thi

                totalRevenue += (originalAmount - refunded);

                // B. Profit Calculation (Item wise)
                if (sale.items) {
                    sale.items.forEach(item => {
                        const buying = parseFloat(item.buyingPrice || 0);
                        // Price check (sellingPrice ya price)
                        const selling = parseFloat(item.sellingPrice || item.price || 0);

                        const originalQty = parseFloat(item.qty || 0);
                        const returnedQty = parseFloat(item.returnedQty || 0); // Jo wapas aa gaya

                        // Asal mein kitna bika? (Sold - Returned)
                        const actualSoldQty = originalQty - returnedQty;

                        if (actualSoldQty > 0) {
                            // Profit sirf us maal ka juro jo abhi bhi customer ke paas hai
                            grossProfit += (selling - buying) * actualSoldQty;
                        }
                    });
                }
            });

            // 2. Calculate Total Expenses
            let totalExpenseSum = 0;
            allExpenses.forEach(exp => {
                totalExpenseSum += (parseFloat(exp.amount) || 0);
            });

            // 3. Calculate FINAL Net Profit
            const finalNetProfit = grossProfit - totalExpenseSum;
            // --- C. GET LOW STOCK (Optimized) ---
            // Isay bhi optimize kar diya hai: Pura products fetch karne ke bajaye query karo
            const productsQuery = query(
                collection(db, "products"),
                where("ownerId", "==", currentUser.uid),
                where("stock", "<", 5) // Sirf kam stock wale fetch karo
            );
            // Note: Is query ke liye bhi Index mangega shayad
            // Agar ye index error de, toh filhal purana method use karein,
            // Lekin best practice yehi hai.
            const productsSnap = await getDocs(productsQuery);
            let lowStock = productsSnap.size; // Direct count mil gaya

            // --- UPDATE STATE ---
            setStats({
                totalSales: totalRevenue,
                netProfit: finalNetProfit,
                totalInvoices: allSales.length,
                lowStockCount: lowStock,
                totalExpenses: totalExpenseSum
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
        if (!isoString) return "-";
        return new Date(isoString).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    };

    // Filtered Invoices for Search
    const filteredInvoicesList = invoices.filter(inv =>
        inv.id.toLowerCase().includes(searchInvoice.toLowerCase())
    );

    const handleToggle = (field) => {
        // Agar pehle se khula hai toh band kardo (No password needed to hide)
        if (field === 'sales' && showSales) return setShowSales(false);
        if (field === 'profit' && showProfit) return setShowProfit(false);

        // Agar hidden hai toh password modal kholo
        setTargetField(field);
        setPassInput(""); // Clear previous input
        setIsPassModalOpen(true);
    };

    const verifyPassword = (e) => {
        e.preventDefault();
        const savedPass = localStorage.getItem("dashboardPass");

        if (!savedPass) {
            toast.error("Please set a password in Settings first!");
            return;
        }

        if (passInput === savedPass) {
            if (targetField === 'sales') setShowSales(true);
            if (targetField === 'profit') setShowProfit(true);
            setIsPassModalOpen(false); // Close Modal
            toast.success("Access Granted");
        } else {
            toast.error("Wrong Password!");
        }
    };

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
                    isPrivate={true}           // Yeh card private hai
                    isVisible={showSales}      // State se control hoga
                    onToggle={() => handleToggle('sales')}
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
                    isPrivate={true}           // Yeh card private hai
                    isVisible={showProfit}     // State se control hoga
                    onToggle={() => handleToggle('profit')}
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
                                        <td className="p-4 font-mono text-xs text-gray-500">#{inv.id
                                        }</td>
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

            {isPassModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[99] backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm relative animate-in fade-in zoom-in duration-200">

                        <button
                            onClick={() => setIsPassModalOpen(false)}
                            className="absolute top-3 right-3 text-gray-400 hover:text-black"
                        >
                            <X size={20} />
                        </button>

                        <h3 className="text-lg font-bold mb-4 text-center">Security Check 🔒</h3>
                        <p className="text-sm text-gray-500 mb-4 text-center">Enter dashboard password to view this amount.</p>

                        <form onSubmit={verifyPassword}>
                            <input
                                type="password"
                                autoFocus
                                className="w-full p-3 border rounded-lg mb-4 text-center text-lg tracking-widest outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter Password"
                                value={passInput}
                                onChange={(e) => setPassInput(e.target.value)}
                            />
                            <button
                                type="submit"
                                className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition"
                            >
                                Unlock
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// Updated StatCard with Loading State
function StatCard({ title, value, subtitle, icon: Icon, theme, loading, isPrivate, isVisible, onToggle }) {

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
                        <h3 className="text-2xl font-bold text-gray-800 tracking-tight">{isPrivate && !isVisible ? "****" : value}</h3>
                    )}
                    {isPrivate && (
                        <button onClick={onToggle} className="text-gray-400 hover:text-gray-600">
                            {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
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