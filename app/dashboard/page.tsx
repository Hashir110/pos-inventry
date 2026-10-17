"use client";
import { useState, useEffect } from "react";
import DataTable from "../components/DataTable";
import { useStore } from "../store/useStore";
import { toast } from 'react-toastify';
import StatCard from "../components/StatCard";
import PageHeader from "../components/PageHeader";
import type { Expense, Sale } from "../types";
import { listSalesInRange } from "../lib/services/sales";
import { listExpensesInRange } from "../lib/services/expenses";
import { countLowStock } from "../lib/services/products";
import { listDayClosings } from "../lib/services/dailyClosing";
import { listSupplierPayments } from "../lib/services/suppliers";
import { saleNetAmount } from "../lib/calc";
import { customerLabel } from "../lib/format";
import { useLanguage } from "../store/useLanguage";
import { DualSeriesCanvasChart } from "../components/CanvasDiagram";
import {
    DollarSign,
    Package,
    FileText,
    Search,
    Calendar,
    Filter,
    Loader2,
    Wallet,
    Banknote,
    CreditCard,
    History,
    ClipboardCheck,
    Truck,
    PiggyBank
} from "lucide-react";

interface ClosingDay {
    day: string;
    sale: number;
    jamad: number;
    baqi: number;
    total: number;
}

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA");

export default function DashboardHome() {
    const { currentUser, currentShop } = useStore();
    const { t } = useLanguage();
    const [loading, setLoading] = useState(true);

    // Date Filters
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    // Stats Data
    const [stats, setStats] = useState({
        totalSales: 0,
        totalInvoices: 0,
        lowStockCount: 0,
        totalExpenses: 0,
        cashSales: 0,
        bankSales: 0,
        udharSales: 0
    });

    const [expenseItems, setExpenseItems] = useState<Expense[]>([]);
    const [closingDays, setClosingDays] = useState<ClosingDay[]>([]);
    const [closingTotal, setClosingTotal] = useState(0);
    const [jamadRange, setJamadRange] = useState(0);

    // Invoices List
    const [invoices, setInvoices] = useState<Sale[]>([]);
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

            const [allSales, allExpenses] = await Promise.all([
                listSalesInRange(currentUser.uid, startIso, isFilter ? endIso : undefined),
                listExpensesInRange(currentUser.uid, startIso, isFilter ? endIso : undefined),
            ]);

            // --- CALCULATIONS ---
            let totalRevenue = 0;
            let cashSum = 0;
            let bankSum = 0;
            let udharSum = 0;

            allSales.forEach(sale => {
                const netSaleAmount = saleNetAmount(sale);
                totalRevenue += netSaleAmount;

                // trim: extra space ka masla na ho. Unknown method ko Cash mein ginte hain.
                const method = sale.paymentMethod ? sale.paymentMethod.trim() : "Cash";
                if (method === "Bank Account") bankSum += netSaleAmount;
                else if (method === "Udhar") udharSum += netSaleAmount;
                else cashSum += netSaleAmount;
            });

            const totalExpenseSum = allExpenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

            // Low stock fail ho (index na ho) to baaki data phir bhi dikhe
            let lowStock = 0;
            try {
                lowStock = await countLowStock(currentUser.uid, 5);
            } catch (e) {
                console.error("Low stock query failed:", e);
            }
        setStats({
            totalSales: totalRevenue,
            totalInvoices: allSales.length,
            lowStockCount: lowStock,
            totalExpenses: totalExpenseSum,
            cashSales: cashSum,
            bankSales: bankSum,
            udharSales: udharSum
        });
        setInvoices(allSales);
        setExpenseItems(allExpenses);

               try {
            const [closings, supplierPays] = await Promise.all([
                listDayClosings(currentUser.uid),
                listSupplierPayments(currentUser.uid),
            ]);
            const fromKey = dayKey(startIso);
            const toKey = isFilter ? dayKey(endIso) : "9999-12-31";

            let running = 0;
            const all = [...closings]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((c) => {
                    const baqi = c.salesTotal - c.jamad;
                    running += baqi;
                    return { day: c.date, sale: c.salesTotal, jamad: c.jamad, baqi, total: running };
                });
            setClosingTotal(running);
            setClosingDays(all.filter((d) => d.day >= fromKey && d.day <= toKey).reverse());
            setJamadRange(
                supplierPays
                    .filter((p) => dayKey(p.date) >= fromKey && dayKey(p.date) <= toKey)
                    .reduce((sum, p) => sum + p.amount, 0)
            );
        } catch (e) {
            console.error("Closing summary failed:", e);
            toast.error("Closing hisaab load nahi hua (Firestore rules deploy karein)");
        }

    } catch (error) {
        console.error("Dashboard Fetch Error:", error);
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
    const formatDate = (isoString?: string) => {
        if (!isoString) return "-";
        return new Date(isoString).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    };

    // Filtered Invoices for Search
    const filteredInvoicesList = invoices.filter(inv =>
        inv.invoiceNo?.toLowerCase().includes(searchInvoice.toLowerCase()));

    const money = (n: number) => `Rs ${Math.round(n || 0).toLocaleString()}`;
    const signedMoney = (n: number) => `${n < 0 ? "− " : ""}${money(Math.abs(n))}`;
    const paymentTotal =(stats.cashSales || 0) + (stats.bankSales || 0) + (stats.udharSales || 0);
    const pct = (n: number) => (paymentTotal > 0 ? Math.max(0, Math.min(100, ((n || 0) / paymentTotal) * 100)) : 0);

    const paymentRows = [
        { label: "Cash", value: stats.cashSales, icon: Banknote, bar: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-700" },
        { label: "Bank / Online", value: stats.bankSales, icon: CreditCard, bar: "bg-sky-500", chip: "bg-sky-100 text-sky-700" },
        { label: "Udhar", value: stats.udharSales, icon: History, bar: "bg-amber-500", chip: "bg-amber-100 text-amber-700" },
    ];

    const methodBadge = (method?: string) => {
        const m = (method || "Cash").trim();
        if (m === "Udhar") return "bg-amber-100 text-amber-800";
        if (m === "Bank Account") return "bg-sky-100 text-sky-800";
        return "bg-emerald-100 text-emerald-800";
    };

    const salesTrendData = (() => {
        const map: Record<string, number> = {};
        [...invoices].reverse().forEach((inv) => {
            if (!inv.date) return;
            const d = new Date(inv.date);
            const dayLabel = `${d.getDate()} ${d.toLocaleString("default", { month: "short" })}`;
            map[dayLabel] = (map[dayLabel] || 0) + saleNetAmount(inv);
        });
        return Object.entries(map).map(([label, amount]) => ({ label, amount })).slice(-10);
    })();

    return (
        <div className="space-y-6">

            <PageHeader
                title={t("navDashboard")}
                subtitle={t("dashboardOverview", { shop: currentShop?.shopName || "Your shop", period: startDate && endDate ? t("selectedPeriod") : t("thisMonth") })}
                actions={
                    <>
                        <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-1.5 shadow-card">
                            <Calendar className="h-4 w-4 text-stone-400" />
                            <input
                                type="date"
                                className="border-0 bg-transparent p-1 text-sm font-medium text-stone-700 outline-none focus:ring-0"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                            <span className="text-stone-300">→</span>
                            <input
                                type="date"
                                className="border-0 bg-transparent p-1 text-sm font-medium text-stone-700 outline-none focus:ring-0"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                        <button onClick={applyFilter} className="btn-dark !py-2.5">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter size={15} />} {t("apply")}
                        </button>
                    </>
                }
            />

            {/* Main numbers */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    title={t("totalSales")}
                    value={money(stats.totalSales)}
                    subtitle={t("afterRefunds")}
                    icon={DollarSign}
                    theme="blue"
                    loading={loading}
                />
                <StatCard
                    title={t("expenses")}
                    value={money(stats.totalExpenses)}
                    subtitle={t("totalExpenses")}
                    icon={Wallet}
                    theme="red"
                    loading={loading}
                />
                <StatCard
                    title={t("invoices")}
                    value={stats.totalInvoices}
                    subtitle={t("billsGenerated")}
                    icon={FileText}
                    theme="purple"
                    loading={loading}
                />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard
                    title="Supplier ko diye"
                    value={money(jamadRange)}
                    subtitle="Jamad (supplier payments)"
                    icon={Truck}
                    theme="red"
                    loading={loading}
                />
                <StatCard
                    title="Baqi"
                    value={signedMoney(stats.totalSales - jamadRange)}
                    subtitle="Sales − Supplier payment"
                    icon={Wallet}
                    theme="green"
                    loading={loading}
                />
                <StatCard
                    title="Total Jama"
                    value={signedMoney(closingTotal)}
                    subtitle="Sab dinon ka Baqi (ab tak)"
                    icon={PiggyBank}
                    theme="purple"
                    loading={loading}
                />
            </div>

            <DataTable
                data={closingDays}
                rowKey={(d) => d.day}
                loading={loading}
                emptyText="Is period mein koi closing nahi."
                toolbarLeft={
                    <h3 className="flex items-center gap-2 text-base font-bold text-stone-900">
                        <ClipboardCheck className="h-4 w-4 text-stone-400" />
                        Din-ba-Din Closing Hisaab
                    </h3>
                }
                columns={[
                    { key: "day", header: t("date"), className: "whitespace-nowrap", cell: (d) => <span className="font-semibold text-stone-800">{formatDate(d.day)}</span> },
                    { key: "sale", header: "Sale", align: "right", cell: (d) => <span className="tabular font-bold">{money(d.sale)}</span> },
                    { key: "jamad", header: "Jamad", align: "right", cell: (d) => <span className="tabular font-bold text-red-600">{`− ${money(d.jamad)}`}</span> },
                    { key: "baqi", header: "Baqi", align: "right", cell: (d) => <span className={`tabular font-extrabold ${d.baqi < 0 ? "text-red-600" : "text-emerald-600"}`}>{signedMoney(d.baqi)}</span> },
                    { key: "total", header: "Total (ab tak)", align: "right", cell: (d) => <span className="tabular font-extrabold text-stone-900">{signedMoney(d.total)}</span> },
                ]}
            />

            {/* Interactive Canvas Diagram Chart matching Reference Image Design */}
            <DualSeriesCanvasChart
                title="Sales & Expenses"
                series1Label="Sales Volume"
                series2Label="Expenses"
                series1Color="#fe9f43"
                series2Color="#ef4444"
                data={
                    invoices.length > 0
                        ? (() => {
                            const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                            const map1: Record<string, number> = {};
                            const map2: Record<string, number> = {};
                            expenseItems.forEach((ex) => {
                                if (!ex.date) return;
                                const dn = new Date(ex.date).toLocaleDateString("en-US", { weekday: "short" });
                                map2[dn] = (map2[dn] || 0) + (Number(ex.amount) || 0);
                            });
                            invoices.forEach((inv) => {
                                if (!inv.date) return;
                                const d = new Date(inv.date);
                                const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
                                map1[dayName] = (map1[dayName] || 0) + saleNetAmount(inv);
                                
                            });
                            return days.map((day) => ({
                                label: day,
                                val1: Math.round((map1[day] || 0) / 1000), // Scale in thousands for clean Y-axis
                                val2: Math.round((map2[day] || 0) / 1000),
                            }));
                        })()
                        : [
                            { label: "Mon", val1: 0, val2: 5 },
                            { label: "Tue", val1: 18, val2: 14 },
                            { label: "Wed", val1: 10, val2: 0 },
                            { label: "Thu", val1: 38, val2: 42 },
                            { label: "Fri", val1: 26, val2: 29 },
                            { label: "Sat", val1: 60, val2: 62 },
                            { label: "Sun", val1: 50, val2: 52 },
                        ]
                }
                height={220}
            />

            {/* Payment split + low stock */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="card p-5 lg:col-span-2">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-base font-bold text-stone-900">{t("paymentBreakdown")}</h3>
                        <span className="tabular text-sm font-bold text-stone-500">{money(paymentTotal)}</span>
                    </div>

                    {/* Stacked bar */}
                    <div className="mb-5 flex h-3 w-full overflow-hidden rounded-full bg-stone-100">
                        {paymentRows.map((row) => (
                            <div key={row.label} className={row.bar} style={{ width: `${pct(row.value)}%` }} />
                        ))}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {paymentRows.map((row) => {
                            const Icon = row.icon;
                            return (
                                <div key={row.label} className="rounded-xl border border-stone-200 p-3.5">
                                    <div className="mb-2 flex items-center gap-2">
                                        <span className={`rounded-lg p-1.5 ${row.chip}`}>
                                            <Icon size={15} />
                                        </span>
                                        <span className="text-xs font-bold uppercase tracking-wider text-stone-500">{row.label}</span>
                                    </div>
                                    <p className="tabular text-lg font-extrabold text-stone-900">
                                        {loading ? "…" : money(row.value)}
                                    </p>
                                    <p className="text-xs text-stone-400">{Math.round(pct(row.value))}%</p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="card flex flex-col justify-between p-5">
                    <div>
                        <div className="mb-3 flex items-center gap-2">
                            <span className="rounded-lg bg-orange-100 p-2 text-orange-700">
                                <Package size={18} />
                            </span>
                            <h3 className="text-base font-bold text-stone-900">{t("lowStock")}</h3>
                        </div>
                        <p className="tabular text-4xl font-extrabold text-stone-900">{loading ? "…" : stats.lowStockCount}</p>
                        <p className="mt-1 text-sm text-stone-500">{t("itemsLowStock")}</p>
                    </div>
                    <a href="/dashboard/inventry" className="btn-ghost mt-5 !py-2.5">
                        {t("viewInventory")}
                    </a>
                </div>
            </div>

            {/* Recent invoices */}
            <DataTable
                data={filteredInvoicesList.slice(0, 6)}
                rowKey={(inv) => inv.id}
                paginate={false}
                loading={loading}
                emptyText={
                    <div className="flex flex-col items-center justify-center py-2">
                        <div className="mb-3 rounded-full bg-stone-100 p-4">
                            <FileText className="h-8 w-8 text-stone-400" />
                        </div>
                        <p className="text-sm font-medium text-stone-500">{t("noInvoicesPeriod")}</p>
                        <a href="/dashboard/pos" className="btn-primary mt-4 !py-2">
                            {t("startNewSale")}
                        </a>
                    </div>
                }
                toolbarLeft={
                    <h3 className="flex items-center gap-2 text-base font-bold text-stone-900">
                        <FileText className="h-4 w-4 text-stone-400" />
                        {t("recentInvoices")}
                    </h3>
                }
                toolbarRight={
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                        <input
                            type="text"
                            className="field !py-2 pl-9"
                            placeholder={t("searchInvoicesPlaceholder")}
                            value={searchInvoice}
                            onChange={(e) => setSearchInvoice(e.target.value)}
                        />
                    </div>
                }
                footer={
                    filteredInvoicesList.length > 0 && (
                        <div className="border-t border-stone-100 p-3 text-center">
                            <a href="/dashboard/sales" className="text-xs font-bold uppercase tracking-wide text-brand-700 hover:text-brand-800">
                                {t("viewAllSalesHistory")}
                            </a>
                        </div>
                    )
                }
                columns={[
                    { key: "date", header: t("date"), cell: (inv) => <span className="text-stone-600">{formatDate(inv.date)}</span> },
                    { key: "inv", header: t("invoices"), cell: (inv) => <span className="font-mono text-xs font-semibold text-stone-500">#{inv.invoiceNo || "-"}</span> },
                    { key: "customer", header: t("customer"), cell: (inv) => <span className="font-semibold text-stone-800">{customerLabel(inv.customerName)}</span> },
                    {
                        key: "pay",
                        header: t("paymentBreakdown"),
                        cell: (inv) => (
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${methodBadge(inv.paymentMethod)}`}>
                                {inv.paymentMethod === "Bank Account" ? "Bank" : inv.paymentMethod || "Cash"}
                            </span>
                        ),
                    },
                    { key: "items", header: t("items"), cell: (inv) => <span className="text-stone-600">{inv.items?.length || 0}</span> },
                    { key: "amount", header: t("amount"), align: "right", cell: (inv) => <span className="font-extrabold text-stone-900">{money(inv.totalAmount)}</span> },
                ]}
            />

        </div>
    );
}
