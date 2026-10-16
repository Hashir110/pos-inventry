"use client";

import { useEffect, useMemo, useState } from "react";
import DataTable from "../../components/DataTable";
import Link from "next/link";
import { DollarSign, Eye, Loader2, Pencil, Plus, Printer, Search, ShoppingBag, TrendingUp, X } from "lucide-react";
import { toast } from "react-toastify";
import { listRecentSales, updateSaleItems } from "../../lib/services/sales";
import SaleReceipt from "../../components/SaleReceipt";
import { saleNetAmount, saleProfit } from "../../lib/calc";
import StatCard from "../../components/StatCard";
import PageHeader from "../../components/PageHeader";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../store/useLanguage";
import type { Sale } from "../../types";

type SaleRow = Sale & { profit: number };
interface ItemDraft {
  qty: string;
  weight: string;
  manual: boolean;
  price: string;
}
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
  const { t } = useLanguage();
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [showRevenue, setShowRevenue] = useState(false);
  const [showProfit, setShowProfit] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [passInput, setPassInput] = useState("");
  const [targetField, setTargetField] = useState<"revenue" | "profit" | null>(null);

  const [search, setSearch] = useState("");
  const [payFilter, setPayFilter] = useState<PayFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("new");

  const [selectedSale, setSelectedSale] = useState<SaleRow | null>(null);
  const [draft, setDraft] = useState<ItemDraft[] | null>(null);
  const [draftExtra, setDraftExtra] = useState("");
  const [saving, setSaving] = useState(false);
  const [receiptSale, setReceiptSale] = useState<SaleRow | null>(null);

  const closeDetail = () => {
    setSelectedSale(null);
    setDraft(null);
  };

  const startEdit = (sale: SaleRow) => {
    setDraftExtra(sale.extraCharges ? String(sale.extraCharges) : "");
    setDraft(
      sale.items.map((i) => ({
        qty: String(i.qty),
        weight: i.type === "weight" ? String(i.totalWeight ?? i.qty * (i.weightPerBag || 25)) : "",
        manual: !!i.isManualWeight,
        price: String(i.price),
      }))
    );
  };

  const changeDraft = (sale: SaleRow, index: number, field: "qty" | "weight" | "price", value: string) => {
    setDraft((prev) =>
      prev
        ? prev.map((d, i) => {
            if (i !== index) return d;
            if (field === "weight") return { ...d, weight: value, manual: true };
            if (field === "price") return { ...d, price: value };
            const perBag = sale.items[i].weightPerBag || 25;
            const auto = d.manual ? d.weight : String((parseFloat(value) || 0) * perBag);
            return { ...d, qty: value, weight: sale.items[i].type === "weight" ? auto : d.weight };
          })
        : prev
    );
  };

  const draftLineTotal = (sale: SaleRow, index: number) => {
    const d = draft?.[index];
    if (!d) return sale.items[index].total;
    const price = parseFloat(d.price) || 0;
    const units = sale.items[index].type === "weight" ? parseFloat(d.weight) || 0 : parseFloat(d.qty) || 0;
    return units * price;
  };

  const saveEdit = async (sale: SaleRow) => {
    if (!draft) return;
    setSaving(true);
    try {
      const extraNow = Math.max(0, parseFloat(draftExtra) || 0);
      const { items, totalAmount, extraCharges } = await updateSaleItems(
        sale.id,
        draft.map((d, i) => ({
          qty: parseFloat(d.qty),
          price: parseFloat(d.price),
          ...(sale.items[i].type === "weight" ? { totalWeight: parseFloat(d.weight) } : {}),
        })),
        extraNow
      );
      const updated: SaleRow = { ...sale, items, totalAmount, extraCharges };
      updated.profit = saleProfit(updated);
      setSales((prev) => prev.map((s) => (s.id === sale.id ? updated : s)));
      setSelectedSale(null);
      setDraft(null);
      setReceiptSale(updated);
      toast.success("Bill update ho gaya");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bill update nahi hua");
    } finally {
      setSaving(false);
    }
  };

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
        title={t("salesHistory")}
        subtitle={t("viewPastSales")}
        actions={
          <Link href="/dashboard/pos" className="btn-primary">
            <Plus size={18} /> {t("newSale")}
          </Link>
        }
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title={t("totalSales")}
          value={money(stats.totalRevenue)}
          subtitle={t("afterRefunds")}
          icon={TrendingUp}
          theme="blue"
          loading={loading}
          isPrivate
          isVisible={showRevenue}
          onToggle={() => handleToggle("revenue")}
        />
        <StatCard
          title={t("totalProfitRecent")}
          value={money(stats.totalProfit)}
          subtitle={t("afterRefunds")}
          icon={DollarSign}
          theme="green"
          loading={loading}
          isPrivate
          isVisible={showProfit}
          onToggle={() => handleToggle("profit")}
        />
        <StatCard
          title={t("totalOrders")}
          value={stats.totalOrders}
          subtitle={t("invoices")}
          icon={ShoppingBag}
          theme="amber"
          loading={loading}
        />
      </div>

      {/* Table card */}
      <DataTable
        data={visibleSales}
        rowKey={(sale) => sale.id}
        loading={loading}
        emptyText="Koi bill nahi mila."
        toolbarLeft={
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
            <input
              type="text"
              placeholder={t("filterCustomerInvoice")}
              className="field pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        }
        toolbarRight={
          <>
            <select
              value={payFilter}
              onChange={(e) => setPayFilter(e.target.value as PayFilter)}
              className="field w-auto cursor-pointer"
            >
              <option value="all">{t("allPayments")}</option>
              <option value="Cash">{t("cash")}</option>
              <option value="Bank Account">{t("bankOnline")}</option>
              <option value="Udhar">{t("udhar")}</option>
            </select>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="field w-auto cursor-pointer"
            >
              <option value="new">{t("sortNewest")}</option>
              <option value="old">Sort: Oldest</option>
              <option value="high">Sort: Highest Amount</option>
            </select>
          </>
        }
        columns={[
          {
            key: "customer",
            header: t("customer"),
            cell: (sale) => {
              const name = sale.customerName || "Walk-in";
              return (
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 font-display text-sm font-bold text-brand-700">
                    {name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="font-semibold text-stone-900">{name}</span>
                </div>
              );
            },
          },
          { key: "inv", header: t("invoices"), cell: (sale) => <span className="font-mono text-xs font-bold uppercase text-brand-700">#{sale.invoiceNo || "-"}</span> },
          { key: "date", header: t("date"), className: "whitespace-nowrap", cell: (sale) => <span className="text-stone-600">{formatDate(sale.date)}</span> },
          {
            key: "status",
            header: t("status"),
            cell: (sale) => {
              const status = saleStatus(sale);
              return <span className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${status.tone}`}>{status.label}</span>;
            },
          },
          { key: "total", header: t("grandTotal"), align: "right", cell: (sale) => <span className="font-extrabold text-stone-900">{mask(money(saleNetAmount(sale)), showRevenue)}</span> },
          { key: "paid", header: t("paid"), align: "right", cell: (sale) => <span className="text-stone-700">{mask(money(paymentInfo(sale).paid), showRevenue)}</span> },
          {
            key: "due",
            header: t("due"),
            align: "right",
            cell: (sale) => {
              const pay = paymentInfo(sale);
              return <span className={`font-semibold ${pay.due > 0 ? "text-red-600" : "text-stone-500"}`}>{mask(money(pay.due), showRevenue)}</span>;
            },
          },
          {
            key: "breakdown",
            header: t("paymentBreakdown"),
            cell: (sale) => {
              const pay = paymentInfo(sale);
              return (
                <div className="flex flex-col items-start gap-1">
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${pay.badge}`}>● {pay.label}</span>
                  <span className="text-[11px] font-semibold text-stone-400">{methodLabel(sale.paymentMethod)}</span>
                </div>
              );
            },
          },
          {
            key: "actions",
            header: "",
            align: "right",
            cell: (sale) => (
              <button
                onClick={() => setSelectedSale(sale)}
                className="rounded-lg p-2 text-stone-500 transition hover:bg-brand-50 hover:text-brand-700"
                title="Bill dekhein"
              >
                <Eye size={18} />
              </button>
            ),
          },
        ]}
      />

      {/* --- Sales Detail --- */}
      {selectedSale && (() => {
        const sale = selectedSale;
        const status = saleStatus(sale);
        const pay = paymentInfo(sale);
        const subTotal = draft
          ? sale.items.reduce((s, _i, idx) => s + draftLineTotal(sale, idx), 0)
          : sale.items.reduce((s, i) => s + (i.total || (i.price * i.qty)), 0);
        const refunded = sale.refundedAmount || 0;
        const hasReturns = refunded > 0 || sale.items.some((i) => (i.returnedQty || 0) > 0);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-pop">
              <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
                <h3 className="text-lg font-bold text-stone-900">Sales Detail</h3>
                <button
                  onClick={closeDetail}
                  className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
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

                <h4 className="mb-3 mt-7 text-sm font-bold text-stone-900">Order Summary</h4>
                <div className="overflow-x-auto rounded-lg border border-stone-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-stone-100">
                      <tr>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3 text-center">Qty (Bags)</th>
                        <th className="px-4 py-3 text-center">Total Weight</th>
                        <th className="px-4 py-3 text-right">Rate</th>
                        <th className="px-4 py-3 text-center">Wapas</th>
                        <th className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {sale.items.map((item, idx) => {
                        const isWeight = item.type === "weight";
                        const weightVal = item.totalWeight ?? (isWeight ? item.qty * (item.weightPerBag || 25) : undefined);
                        const weightStr = weightVal !== undefined ? `${weightVal} kg` : "—";
                        const qtyStr = isWeight ? `${String(item.qty).padStart(2, "0")} Bags` : `${item.qty} pcs`;

                        return (
                          <tr key={idx}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-100 font-display text-sm font-bold text-brand-700">
                                  {item.name.trim().charAt(0).toUpperCase()}
                                </span>
                                <span className="font-semibold text-stone-900">{item.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-stone-800 tabular">
                              {draft ? (
                                <input
                                  type="number"
                                  min="1"
                                  step="any"
                                  value={draft[idx]?.qty ?? ""}
                                  onChange={(e) => changeDraft(sale, idx, "qty", e.target.value)}
                                  className="field !w-20 !py-1.5 text-center font-bold"
                                />
                              ) : (
                                qtyStr
                              )}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-stone-900 tabular">
                              {draft && isWeight ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={draft[idx]?.weight ?? ""}
                                  onChange={(e) => changeDraft(sale, idx, "weight", e.target.value)}
                                  className={`field !w-24 !py-1.5 text-center font-bold ${draft[idx]?.manual ? "!border-amber-300 !bg-amber-50" : ""}`}
                                />
                              ) : (
                                weightStr
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-stone-600 tabular">
                              {draft ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={draft[idx]?.price ?? ""}
                                  onChange={(e) => changeDraft(sale, idx, "price", e.target.value)}
                                  className="field !w-24 !py-1.5 text-right font-bold"
                                />
                              ) : (
                                <>Rs. {item.price}</>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-red-600 tabular">
                              {(item.returnedQty || 0) > 0 ? (isWeight ? `${item.returnedQty} kg` : item.returnedQty) : "—"}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-stone-900 tabular">
                              Rs. {Math.round(draftLineTotal(sale, idx)).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {draft && (
                  <div className="mt-5 flex items-center justify-end gap-3">
                    <label htmlFor="edit-extra" className="text-sm font-bold text-stone-700">
                      Extra Charges <span className="font-normal text-stone-400">(transport waghera)</span>
                    </label>
                    <input
                      id="edit-extra"
                      type="number"
                      min="0"
                      step="any"
                      value={draftExtra}
                      onChange={(e) => setDraftExtra(e.target.value)}
                      placeholder="0"
                      className="field !w-32 !py-1.5 text-right font-bold"
                    />
                  </div>
                )}

                <div className="mt-3 flex justify-end">
                  <dl className="w-full max-w-sm overflow-hidden rounded-lg border border-stone-200 text-sm">
                    {[
                      { label: "Sub Total", value: money(subTotal), tone: "" },
                      ...(draft || (sale.extraCharges ?? 0) > 0 ? [{ label: "Extra Charges", value: money(draft ? Math.max(0, parseFloat(draftExtra) || 0) : sale.extraCharges ?? 0), tone: "" }] : []),
                      ...(refunded > 0 ? [{ label: "Refund (return)", value: `− ${money(refunded)}`, tone: "text-red-600" }] : []),
                      { label: "Grand Total", value: money(draft ? subTotal + Math.max(0, parseFloat(draftExtra) || 0) : saleNetAmount(sale)), tone: "font-extrabold text-stone-900" },
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
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-200 px-6 py-4">
                {draft ? (
                  <>
                    <p className="mr-auto text-xs text-stone-400">
                      Stock{pay.isUdhar ? " aur party ka udhar" : ""} farq ke hisaab se khud theek ho jayega.
                    </p>
                    <button onClick={() => setDraft(null)} disabled={saving} className="btn-ghost">
                      Cancel
                    </button>
                    <button onClick={() => saveEdit(sale)} disabled={saving} className="btn-primary min-w-[170px]">
                      {saving ? <Loader2 className="animate-spin" size={18} /> : <><Printer size={16} /> Save &amp; Slip</>}
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setReceiptSale(sale)} className="btn-ghost">
                      <Printer size={16} /> Slip
                    </button>
                    <button
                      onClick={() => startEdit(sale)}
                      disabled={hasReturns}
                      title={hasReturns ? "Return wala bill edit nahi ho sakta" : "Bill edit karein"}
                      className="btn-primary"
                    >
                      <Pencil size={16} /> Edit Bill
                    </button>
                    <button onClick={closeDetail} className="btn-dark">
                      Band karein
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {receiptSale && (
        <SaleReceipt
          shop={currentShop}
          invoiceNo={receiptSale.invoiceNo}
          date={receiptSale.date}
          customerName={receiptSale.customerName === "Walk-in" ? "" : receiptSale.customerName}
          transport={receiptSale.transport}
          extraCharges={receiptSale.extraCharges}
          items={receiptSale.items}
          total={saleNetAmount(receiptSale)}
          paymentMethod={receiptSale.paymentMethod}
          printLabel={t("printSlip")}
          closeLabel="Band karein"
          onClose={() => setReceiptSale(null)}
        />
      )}

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
