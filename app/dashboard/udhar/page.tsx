"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  Wallet,
  Phone,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  MessageCircle,
  DollarSign,
  TrendingUp,
  CreditCard,
  FileText,
  UserPlus,
  ChevronRight,
  ShieldCheck,
  Loader2,
  Clock,
  Printer,
  History,
} from "lucide-react";
import { toast } from "react-toastify";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../store/useLanguage";
import ReceivePaymentModal from "../../components/ReceivePaymentModal";
import { formatMoney } from "../../lib/format";
import { addCustomer, listCustomers, listCustomerCreditSales, listPayments } from "../../lib/services/customers";
import { saleNetAmount } from "../../lib/calc";
import type { Customer, CustomerPayment, Sale } from "../../types";

const money = (n: number) => `Rs. ${Math.round(n || 0).toLocaleString()}`;

export default function UdharPage() {
  const { currentUser, currentShop } = useStore();
  const { t, language } = useLanguage();
  const isRTL = language === "ur";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "due" | "clear">("all");

  // Selection for right panel
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Selected customer statement
  const [statementLoading, setStatementLoading] = useState(false);
  const [custSales, setCustSales] = useState<Sale[]>([]);
  const [custPayments, setCustPayments] = useState<CustomerPayment[]>([]);

  // Add Customer Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [adding, setAdding] = useState(false);

  // Receive Payment Modal
  const [payFor, setPayFor] = useState<Customer | null>(null);

  const fetchCustomers = useCallback(
    async (force = false) => {
      if (!currentUser) return;
      if (force) setRefreshing(true);
      try {
        const list = await listCustomers(currentUser.uid, force);
        setCustomers(list);
        if (list.length > 0 && !selectedCustomerId) {
          // Default to first customer with balance or first customer
          const firstDue = list.find((c) => c.balance > 0) || list[0];
          setSelectedCustomerId(firstDue.id);
        }
        if (force) toast.success("Customers updated");
      } catch (error) {
        console.error(error);
        toast.error(t("credit_loadFailed") || "Failed to load customers");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currentUser, t, selectedCustomerId]
  );

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Load statement when selected customer changes
  useEffect(() => {
    if (!currentUser || !selectedCustomerId) return;
    setStatementLoading(true);
    Promise.all([
      listCustomerCreditSales(currentUser.uid, selectedCustomerId),
      listPayments(currentUser.uid, selectedCustomerId),
    ])
      .then(([s, p]) => {
        setCustSales(s);
        setCustPayments(p);
      })
      .catch((err) => console.error("Error loading statement:", err))
      .finally(() => setStatementLoading(false));
  }, [currentUser, selectedCustomerId]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  // Summary Metrics
  const totalOutstanding = useMemo(
    () => customers.reduce((sum, c) => sum + (c.balance || 0), 0),
    [customers]
  );
  const debtorsCount = useMemo(() => customers.filter((c) => c.balance > 0).length, [customers]);
  const clearCount = useMemo(() => customers.filter((c) => (c.balance || 0) <= 0).length, [customers]);

  // Filtered List
  const filteredCustomers = useMemo(() => {
    const term = search.toLowerCase().trim();
    return customers.filter((c) => {
      const matchName = c.name.toLowerCase().includes(term);
      const matchPhone = (c.phone ?? "").includes(term);
      if (!matchName && !matchPhone) return false;

      if (filter === "due") return (c.balance || 0) > 0;
      if (filter === "clear") return (c.balance || 0) <= 0;
      return true;
    });
  }, [customers, search, filter]);

  // Add Customer Submit
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newName.trim()) return;
    setAdding(true);
    try {
      const newCust = await addCustomer(currentUser.uid, { name: newName, phone: newPhone });
      setNewName("");
      setNewPhone("");
      setShowAddForm(false);
      toast.success(t("credit_addSuccess") || "Customer added successfully");
      await fetchCustomers(true);
      if (newCust?.id) setSelectedCustomerId(newCust.id);
    } catch (error) {
      console.error(error);
      toast.error(t("credit_addFailed") || "Failed to add customer");
    } finally {
      setAdding(false);
    }
  };

  // Statement entries
  const statementEntries = useMemo(() => {
    const raw = [
      ...custSales.map((s) => ({
        id: s.id,
        date: s.date,
        kind: "sale" as const,
        title: `Bill #${s.invoiceNo || s.id.slice(0, 6)}`,
        details: s.items.map((i) => `${i.name} × ${i.qty}`).join(", "),
        amount: saleNetAmount(s),
      })),
      ...custPayments.map((p) => ({
        id: p.id,
        date: p.date,
        kind: "payment" as const,
        title: "Cash Collection",
        details: `${p.method || "Cash"}${p.note ? ` • ${p.note}` : ""}`,
        amount: p.amount,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    let running = 0;
    return raw
      .map((e) => {
        running += e.kind === "sale" ? e.amount : -e.amount;
        return { ...e, balance: Math.max(0, Math.round(running * 100) / 100) };
      })
      .reverse();
  }, [custSales, custPayments]);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* 1. TOP HEADER & ACTIONS */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {t("creditLedger") || "Customer Khata (Udhaar Ledger)"}
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {t("manageCustomerBalances") || "Track receivables, credit limits, recovery payments, and automated WhatsApp reminders."}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => fetchCustomers(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
            title="Refresh from server"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin text-orange-600" : "text-slate-500"} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 transition-colors shadow-sm"
          >
            <UserPlus size={16} />
            <span>Add New Customer</span>
          </button>
        </div>
      </div>

      {/* Quick Add Customer Collapsible Form */}
      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 md:items-end"
        >
          <div className="flex-1">
            <label className="text-xs font-bold text-slate-700 mb-1 block">Customer Full Name *</label>
            <input
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Mian Tariq Sahib"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none"
            />
          </div>
          <div className="w-full md:w-64">
            <label className="text-xs font-bold text-slate-700 mb-1 block">Mobile Number (WhatsApp)</label>
            <input
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="0300-1234567"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={adding}
              className="px-5 py-2 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              <span>Save Customer</span>
            </button>
          </div>
        </form>
      )}

      {/* 2. 4 SUMMARY METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Outstanding */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Khata Outstanding
            </span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <Wallet size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-orange-600 tabular-nums">
              {money(totalOutstanding)}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Total due across all Khatas</div>
          </div>
        </div>

        {/* Active Due Customers */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Customers With Balance
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-700 tabular-nums">{debtorsCount}</div>
            <div className="text-xs text-slate-500 mt-0.5">Parties with pending payments</div>
          </div>
        </div>

        {/* Cleared Accounts */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              All-Clear Accounts
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-700 tabular-nums">{clearCount}</div>
            <div className="text-xs text-emerald-700 font-semibold mt-0.5">
              {customers.length > 0 ? Math.round((clearCount / customers.length) * 100) : 0}% Healthy Rate
            </div>
          </div>
        </div>

        {/* Total Registered */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Registered Customers
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{customers.length}</div>
            <div className="text-xs text-slate-500 mt-0.5">Active ledger profiles</div>
          </div>
        </div>
      </div>

      {/* 3. DUAL-PANEL MASTER-DETAIL LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANEL: Customer Directory (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {/* Search & Filter Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or mobile #..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none"
              />
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`px-3 py-1 rounded-full transition-all ${
                  filter === "all" ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All ({customers.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("due")}
                className={`px-3 py-1 rounded-full transition-all ${
                  filter === "due" ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Active Due ({debtorsCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter("clear")}
                className={`px-3 py-1 rounded-full transition-all ${
                  filter === "clear" ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Clear ({clearCount})
              </button>
            </div>
          </div>

          {/* Customer Cards List */}
          <div className="flex flex-col gap-2 max-h-[650px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
                <Loader2 className="animate-spin text-orange-600 mx-auto" size={24} />
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
                No matching customer accounts found.
              </div>
            ) : (
              filteredCustomers.map((c) => {
                const isSelected = selectedCustomerId === c.id;
                const hasDue = (c.balance || 0) > 0;

                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCustomerId(c.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "bg-orange-50/70 border-orange-500 shadow-sm"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                          hasDue ? "bg-orange-100 text-orange-800" : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-slate-900 text-xs truncate">{c.name}</span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Phone size={11} /> {c.phone || "No phone"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0 pl-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Balance</span>
                      <span
                        className={`font-bold text-xs tabular-nums ${
                          hasDue ? "text-orange-600" : "text-emerald-700"
                        }`}
                      >
                        {hasDue ? money(c.balance) : "Rs. 0 (Clear ✓)"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Selected Customer Statement & Actions (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {selectedCustomer ? (
            <>
              {/* Customer Hero Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-orange-600 text-white font-bold text-base flex items-center justify-center shadow-xs">
                      {selectedCustomer.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <h2 className="text-lg font-bold text-slate-900">{selectedCustomer.name}</h2>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Phone size={13} className="text-orange-600" /> {selectedCustomer.phone || "No phone"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/dashboard/udhar/${selectedCustomer.id}`}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 bg-orange-50 px-2.5 py-1.5 rounded-lg border border-orange-200"
                  >
                    <History size={14} />
                    <span>Full Ledger Page</span>
                  </Link>
                </div>

                {/* OUTSTANDING HERO BANNER */}
                <div className="p-4 rounded-xl bg-slate-900 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      Current Outstanding Balance
                    </span>
                    <div className="text-2xl sm:text-3xl font-extrabold text-orange-400 tracking-tight mt-0.5 tabular-nums">
                      {money(selectedCustomer.balance || 0)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* WhatsApp Reminder Button */}
                    {selectedCustomer.phone && (
                      <a
                        href={`https://wa.me/${selectedCustomer.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                          `السلام علیکم ${selectedCustomer.name} صاحب! ${currentShop?.shopName || "AsaanPOS"} پر آپ کا بقایا ادھار بیلنس ${money(
                            selectedCustomer.balance || 0
                          )} ہے۔ برائے مہربانی تشریف لا کر حساب کلیئر فرمائیں۔ شکریہ!`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                      >
                        <MessageCircle size={15} />
                        <span>WhatsApp Reminder</span>
                      </a>
                    )}

                    {/* Receive Payment Button */}
                    <button
                      type="button"
                      onClick={() => setPayFor(selectedCustomer)}
                      className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <DollarSign size={15} />
                      <span>Receive Payment</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Statement Ledger Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-orange-600" />
                    <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                      Recent Statement Activity ({statementEntries.length} Records)
                    </h3>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3 text-right">Debit / Sale</th>
                        <th className="py-2.5 px-3 text-right">Credit / Recv</th>
                        <th className="py-2.5 px-4 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {statementLoading ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            <Loader2 className="animate-spin text-orange-600 mx-auto" size={20} />
                          </td>
                        </tr>
                      ) : statementEntries.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            No ledger transactions recorded yet.
                          </td>
                        </tr>
                      ) : (
                        statementEntries.map((e) => (
                          <tr key={e.id} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                              {new Date(e.date).toLocaleDateString()}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-slate-800 block">{e.title}</span>
                              <span className="text-[11px] text-slate-400 truncate block max-w-xs">
                                {e.details}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">
                              {e.kind === "sale" ? formatMoney(e.amount) : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-700 tabular-nums">
                              {e.kind === "payment" ? formatMoney(e.amount) : "—"}
                            </td>
                            <td className="py-2.5 px-4 text-right font-extrabold text-orange-600 tabular-nums">
                              {formatMoney(e.balance)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400">
              Select a customer from the left directory to inspect their Khata ledger.
            </div>
          )}
        </div>
      </div>

      {/* Receive Payment Modal */}
      {payFor && (
        <ReceivePaymentModal
          customer={payFor}
          onClose={() => setPayFor(null)}
          onSuccess={() => {
            setPayFor(null);
            fetchCustomers(true);
          }}
        />
      )}
    </div>
  );
}
