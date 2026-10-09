"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DollarSign, Eye, Plus, Search, ShoppingBag, TrendingUp, X } from "lucide-react";
import { toast } from "react-toastify";
import { listRecentSales } from "../../lib/services/sales";
import { saleNetAmount, saleProfit } from "../../lib/calc";
import StatCard from "../../components/StatCard";
import PageHeader from "../../components/PageHeader";
import { useStore } from "../../store/useStore";
import type { Sale } from "../../types";

type SaleRow = Sale & { profit: number };
type PayFilter = "all" | "Cash" | "Bank Account" | "Udhar";
type SortKey = "new" | "old" | "high";

const HIDDEN = "••••";
const money = (n: number) => `Rs. ${Math.round(n || 0).toLocaleString()}`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

const methodLabel = (m?: string) => (m === "Bank Account" ? "Bank" : m || "Cash");

/** Bill ki halat: poora / kuch wapas / sab wapas */
const saleStatus = (sale: Sale) => {
  const refunded = sale.refundedAmount || 0;
  const allReturned = sale.items?.length > 0 && sale.items.every((i) => (i.returnedQty || 0) >= i.qty);
  if (allReturned) return { label: "Returned", tone: "bg-red-100 text-red-700" };
  if (refunded > 0) return { label: "Partial Return", tone: "bg-amber-100 text-amber-800" };
  return { label: "Completed", tone: "bg-emerald-100 text-emerald-700" };
};

/** Udhar bill par abhi raqam baqi hai; baqi sab paid */
const paymentInfo = (sale: Sale) => {
  const net = saleNetAmount(sale);
  const isUdhar = sale.paymentMethod === "Udhar";
  return {
    isUdhar,
    paid: isUdhar ? 0 : net,
    due: isUdhar ? net : 0,
    badge: isUdhar ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700",
    label: isUdhar ? "Due" : "Paid",
  };
};

export default function SalesHistoryPage() {
  const { currentUser, currentShop } = useStore();
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [showRevenue, setShowRevenue] = useState(false);
  const [showProfit, setShowProfit] = useState(false);

  // Password modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [passInput, setPassInput] = useState("");
  const [targetField, setTargetField] = useState<"revenue" | "profit" | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [payFilter, setPayFilter] = useState<PayFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("new");

  const [selectedSale, setSelectedSale] = useState<SaleRow | null>(null);

  useEffect(() => {
    const fetchSales = async () => {
      if (!currentUser) return;
      try {
        const recent = await listRecentSales(currentUser.uid, 50);
        setSales(recent.map((sale) => ({ ...sale, profit: saleProfit(sale) })));
      } catch (error) {
        console.error("Error fetching sales:", error);
        toast.error("Sales load nahi hui");
      } finally {
        setLoading(false);
      }
    };
    fetchSales();
  }, [currentUser]);

  const stats = useMemo(
    () => ({
      totalRevenue: sales.reduce((s, x) => s + saleNetAmount(x), 0),
      totalProfit: sales.reduce((s, x) => s + x.profit, 0),
      totalOrders: sales.length,
    }),
    [sales]
  );

  const visibleSales = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = sales.filter((s) => {
      if (payFilter !== "all" && (s.paymentMethod || "Cash") !== payFilter) return false;
      if (!term) return true;
      return (
        (s.invoiceNo || "").toLowerCase().includes(term) ||
        (s.customerName || "walk-in").toLowerCase().includes(term)
      );
    });
    return [...list].sort((a, b) => {
      if (sortKey === "old") return a.date.localeCompare(b.date);
      if (sortKey === "high") return saleNetAmount(b) - saleNetAmount(a);
      return b.date.localeCompare(a.date);
    });
  }, [sales, search, payFilter, sortKey]);

  const handleToggle = (field: "revenue" | "profit") => {
    if (field === "revenue" && showRevenue) return setShowRevenue(false);
    if (field === "profit" && showProfit) return setShowProfit(false);
    setTargetField(field);
    setPassInput("");
    setIsModalOpen(true);
  };

  const verifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    const savedPass = localStorage.getItem("dashboardPass");
    if (!savedPass) {
      toast.error("Pehle Settings mein password set karein!");
      return;
    }
    if (passInput === savedPass) {
      if (targetField === "revenue") setShowRevenue(true);
      if (targetField === "profit") setShowProfit(true);
      setIsModalOpen(false);
      toast.success("Access Granted");
    } else {
      toast.error("Wrong Password!");
    }
  };

  const mask = (value: string, visible: boolean) => (visible ? value : HIDDEN);

  return (
    <div>
      <PageHeader
        title="Sales History"
        subtitle="Pichle 50 bills — dekhne ke liye aankh par click karein"
        actions={
          <Link href="/dashboard/pos" className="btn-primary">
            <Plus size={18} /> Naya Bill
          </Link>
        }
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="Total Sale (Recent)"
          value={money(stats.totalRevenue)}
          subtitle="Refund minus karke"
          icon={TrendingUp}
          theme="blue"
          loading={loading}
          isPrivate
          isVisible={showRevenue}
          onToggle={() => handleToggle("revenue")}
        />
        <StatCard
          title="Total Profit (Recent)"
          value={money(stats.totalProfit)}
          subtitle="Discount aur return ke baad"
          icon={DollarSign}
          theme="green"
          loading={loading}
          isPrivate
          isVisible={showProfit}
          onToggle={() => handleToggle("profit")}
        />
        <StatCard
          title="Total Orders"
          value={stats.totalOrders}
          subtitle="Pichle 50 bills"
          icon={ShoppingBag}
          theme="amber"
          loading={loading}
        />
      </div>

      {/* Table card */}
      <div className="card overflow-hidden">
        {/* Filters */}
        <div className="flex flex-col gap-3 border-b border-stone-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
            <input
              type="text"
              placeholder="Invoice ya customer dhoondein..."
              className="field pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={payFilter}
              onChange={(e) => setPayFilter(e.target.value as PayFilter)}
              className="field w-auto cursor-pointer"
            >
              <option value="all">Payment: Sab</option>
              <option value="Cash">Cash</option>
              <option value="Bank Account">Bank / Online</option>
              <option value="Udhar">Udhar</option>
            </select>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="field w-auto cursor-pointer"
            >
              <option value="new">Sort: Naye pehle</option>
              <option value="old">Sort: Purane pehle</option>
              <option value="high">Sort: Bara bill pehle</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200">
              <tr>
                <th className="p-4">Customer</th>
                <th className="p-4">Invoice</th>
                <th className="p-4">Date</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Grand Total</th>
                <th className="p-4 text-right">Paid</th>
                <th className="p-4 text-right">Due</th>
                <th className="p-4">Payment</th>
                <th className="p-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr><td colSpan={9} className="p-10 text-center text-stone-400">Loading Data...</td></tr>
              ) : visibleSales.length === 0 ? (
                <tr><td colSpan={9} className="p-12 text-center text-stone-400">Koi bill nahi mila.</td></tr>
              ) : (
                visibleSales.map((sale) => {
                  const status = saleStatus(sale);
                  const pay = paymentInfo(sale);
                  const name = sale.customerName || "Walk-in";
                  return (
                    <tr key={sale.id} className="hover:bg-stone-50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 font-display text-sm font-bold text-brand-700">
                            {name.trim().charAt(0).toUpperCase()}
                          </span>
                          <span className="font-semibold text-stone-900">{name}</span>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-xs font-bold uppercase text-brand-700">#{sale.invoiceNo || "-"}</td>
                      <td className="whitespace-nowrap p-4 text-stone-600">{formatDate(sale.date)}</td>
                      <td className="p-4">
                        <span className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${status.tone}`}>{status.label}</span>
                      </td>
                      <td className="p-4 text-right font-extrabold text-stone-900">
                        {mask(money(saleNetAmount(sale)), showRevenue)}
                      </td>
                      <td className="p-4 text-right text-stone-700">{mask(money(pay.paid), showRevenue)}</td>
                      <td className={`p-4 text-right font-semibold ${pay.due > 0 ? "text-red-600" : "text-stone-500"}`}>
                        {mask(money(pay.due), showRevenue)}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${pay.badge}`}>● {pay.label}</span>
                          <span className="text-[11px] font-semibold text-stone-400">{methodLabel(sale.paymentMethod)}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setSelectedSale(sale)}
                          className="rounded-lg p-2 text-stone-500 transition hover:bg-brand-50 hover:text-brand-700"
                          title="Bill dekhein"
                        >
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && visibleSales.length > 0 && (
          <div className="border-t border-stone-200 bg-stone-50/60 px-4 py-3 text-xs font-semibold text-stone-500">
            {visibleSales.length} bill{visibleSales.length === 1 ? "" : "s"} dikh rahe hain
          </div>
        )}
      </div>

      {/* --- Sales Detail --- */}
      {selectedSale && (() => {
        const sale = selectedSale;
        const status = saleStatus(sale);
        const pay = paymentInfo(sale);
        const subTotal = sale.items.reduce((s, i) => s + i.price * i.qty, 0);
        const discount = sale.items.reduce((s, i) => s + (i.discount || 0), 0);
        const refunded = sale.refundedAmount || 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-pop">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
                <h3 className="text-lg font-bold text-stone-900">Sales Detail</h3>
                <button
                  onClick={() => setSelectedSale(null)}
                  className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                {/* Info columns */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <div>
                    <h4 className="mb-2 text-sm font-bold text-stone-900">Customer Info</h4>
                    <p className="text-lg font-bold text-stone-900">{sale.customerName || "Walk-in"}</p>
                    {sale.description && (
                      <p className="mt-1 text-sm text-stone-500">Note: {sale.description}</p>
                    )}
                  </div>

                  <div>
                    <h4 className="mb-2 text-sm font-bold text-stone-900">Shop Info</h4>
                    <p className="text-lg font-bold text-stone-900">{currentShop?.shopName || "—"}</p>
                    <div className="mt-1 space-y-0.5 text-sm text-stone-500">
                      {currentShop?.address && <p>{currentShop.address}</p>}
                      {currentShop?.contact && <p>Phone: {currentShop.contact}</p>}
                      {currentShop?.email && <p>{currentShop.email}</p>}
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-2 text-sm font-bold text-stone-900">Invoice Info</h4>
                    <dl className="space-y-1.5 text-sm">
                      <div className="flex gap-3">
                        <dt className="w-28 shrink-0 text-stone-500">Invoice</dt>
                        <dd className="font-mono font-bold text-brand-700">#{sale.invoiceNo}</dd>
                      </div>
                      <div className="flex gap-3">
                        <dt className="w-28 shrink-0 text-stone-500">Date</dt>
                        <dd className="font-semibold text-stone-800">{formatDate(sale.date)}</dd>
                      </div>
                      <div className="flex items-center gap-3">
                        <dt className="w-28 shrink-0 text-stone-500">Status</dt>
                        <dd>
                          <span className={`rounded-md px-2.5 py-0.5 text-[11px] font-bold ${status.tone}`}>{status.label}</span>
                        </dd>
                      </div>
                      <div className="flex items-center gap-3">
                        <dt className="w-28 shrink-0 text-stone-500">Payment Status</dt>
                        <dd>
                          <span className={`rounded-md px-2.5 py-0.5 text-[11px] font-bold ${pay.badge}`}>● {pay.label}</span>
                          <span className="ml-2 text-xs font-semibold text-stone-400">{methodLabel(sale.paymentMethod)}</span>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {/* Order summary */}
                <h4 className="mb-3 mt-7 text-sm font-bold text-stone-900">Order Summary</h4>
                <div className="overflow-x-auto rounded-lg border border-stone-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-stone-100">
                      <tr>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3 text-right">Price</th>
                        <th className="px-4 py-3 text-right">Qty</th>
                        <th className="px-4 py-3 text-right">Discount</th>
                        <th className="px-4 py-3 text-right">Wapas</th>
                        <th className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {sale.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-100 font-display text-sm font-bold text-brand-700">
                                {item.name.trim().charAt(0).toUpperCase()}
                              </span>
                              <span className="font-semibold text-stone-900">{item.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-stone-600">{item.price}</td>
                          <td className="px-4 py-3 text-right text-stone-800">
                            {item.qty} {item.type === "weight" ? "kg" : "pcs"}
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-700">{item.discount > 0 ? item.discount : "0"}</td>
                          <td className="px-4 py-3 text-right font-semibold text-red-600">
                            {(item.returnedQty || 0) > 0 ? item.returnedQty : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-stone-900">{Math.round(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="mt-5 flex justify-end">
                  <dl className="w-full max-w-sm overflow-hidden rounded-lg border border-stone-200 text-sm">
                    {[
                      { label: "Sub Total", value: money(subTotal), tone: "" },
                      { label: "Discount", value: `− ${money(discount)}`, tone: discount > 0 ? "text-emerald-700" : "" },
                      ...(refunded > 0 ? [{ label: "Refund (return)", value: `− ${money(refunded)}`, tone: "text-red-600" }] : []),
                      { label: "Grand Total", value: money(saleNetAmount(sale)), tone: "font-extrabold text-stone-900" },
                      { label: "Paid", value: money(pay.paid), tone: "" },
                      { label: "Due", value: money(pay.due), tone: pay.due > 0 ? "font-bold text-red-600" : "" },
                      ...(showProfit ? [{ label: "Profit", value: money(sale.profit), tone: "font-bold text-emerald-700" }] : []),
                    ].map((row, i) => (
                      <div key={row.label} className={`flex justify-between px-4 py-2.5 ${i % 2 === 0 ? "bg-stone-50" : "bg-white"}`}>
                        <dt className="text-stone-500">{row.label}</dt>
                        <dd className={`tabular text-stone-800 ${row.tone}`}>{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {pay.isUdhar && (
                  <p className="mt-3 text-right text-xs text-stone-400">
                    Udhar ki wasooli &quot;Udhar Khata&quot; page par customer ke naam par darj hoti hai.
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 border-t border-stone-200 px-6 py-4">
                <button onClick={() => setSelectedSale(null)} className="btn-dark">
                  Band karein
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Password modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[99] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-pop">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            >
              <X size={20} />
            </button>

            <h3 className="mb-1 text-lg font-bold text-stone-900">Security Check</h3>
            <p className="mb-4 text-sm text-stone-500">Chhupi hui raqam dekhne ke liye password likhein.</p>

            <form onSubmit={verifyPassword}>
              <input
                type="password"
                autoFocus
                className="field mb-4 text-center text-lg tracking-widest"
                placeholder="Password"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
              />
              <button type="submit" className="btn-primary w-full !py-3">
                Unlock
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
