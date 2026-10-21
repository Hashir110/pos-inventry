"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import DataTable from "../../components/DataTable";
import Link from "next/link";
import {
  AlertTriangle,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  listRecentSales,
  updateSaleFull,
  deleteSale,
} from "../../lib/services/sales";
import { listCustomers } from "../../lib/services/customers";
import SaleReceipt from "../../components/SaleReceipt";
import { saleNetAmount } from "../../lib/calc";
import { customerLabel, isCounterSale } from "../../lib/format";
import StatCard from "../../components/StatCard";
import PageHeader from "../../components/PageHeader";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../store/useLanguage";
import type { TranslationKey } from "../../lib/i18n/translations";
import type { Customer, PaymentMethod, Sale } from "../../types";

type SaleRow = Sale;
interface ItemDraft {
  qty: string;
  weight: string;
  manual: boolean;
  price: string;
}
type PayFilter = "all" | "Cash" | "Bank Account" | "Udhar";
type SortKey = "new" | "old" | "high";

const money = (n: number) => `Rs. ${Math.round(n || 0).toLocaleString()}`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const methodLabelKey = (m?: string): TranslationKey => {
  if (m === "Bank Account") return "sales_methodBank";
  if (m === "Udhar") return "sales_payCredit";
  return "cash";
};

const saleStatus = (sale: Sale): { labelKey: TranslationKey; tone: string } => {
  const refunded = sale.refundedAmount || 0;
  const allReturned =
    sale.items?.length > 0 &&
    sale.items.every((i) => (i.returnedQty || 0) >= i.qty);
  if (allReturned)
    return { labelKey: "sales_statusReturned", tone: "bg-red-100 text-red-700" };
  if (refunded > 0)
    return { labelKey: "sales_statusPartial", tone: "bg-amber-100 text-amber-800" };
  return {
    labelKey: "sales_statusCompleted",
    tone: "bg-emerald-100 text-emerald-700",
  };
};

const paymentInfo = (sale: Sale) => {
  const net = saleNetAmount(sale);
  const isUdhar = sale.paymentMethod === "Udhar";
  return {
    isUdhar,
    paid: isUdhar ? 0 : net,
    due: isUdhar ? net : 0,
    badge: isUdhar
      ? "bg-amber-100 text-amber-800"
      : "bg-emerald-100 text-emerald-700",
    labelKey: (isUdhar ? "due" : "paid") as TranslationKey,
  };
};

export default function SalesHistoryPage() {
  const { currentUser, currentShop } = useStore();
  const { t } = useLanguage();
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [payFilter, setPayFilter] = useState<PayFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("new");

  // Selected sale for detail modal
  const [selectedSale, setSelectedSale] = useState<SaleRow | null>(null);

  // Edit draft states
  const [draft, setDraft] = useState<ItemDraft[] | null>(null);
  const [draftCustomerName, setDraftCustomerName] = useState("");
  const [draftPaymentMethod, setDraftPaymentMethod] = useState<PaymentMethod>("Cash");
  const [draftCustomerId, setDraftCustomerId] = useState("");
  const [draftTransport, setDraftTransport] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftExtra, setDraftExtra] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete modal state
  const [deleteConfirmSale, setDeleteConfirmSale] = useState<SaleRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [receiptSale, setReceiptSale] = useState<SaleRow | null>(null);

  // Load customers for selection during edit
  useEffect(() => {
    if (currentUser?.uid) {
      listCustomers(currentUser.uid)
        .then(setCustomers)
        .catch(() => {});
    }
  }, [currentUser]);

  const closeDetail = () => {
    setSelectedSale(null);
    setDraft(null);
  };

  const startEdit = (sale: SaleRow) => {
    setDraftCustomerName(isCounterSale(sale.customerName) ? "" : sale.customerName || "");
    setDraftPaymentMethod((sale.paymentMethod as PaymentMethod) || "Cash");
    setDraftCustomerId(sale.customerId || "");
    setDraftTransport(sale.transport || "");
    setDraftDescription(sale.description || "");
    setDraftExtra(sale.extraCharges ? String(sale.extraCharges) : "");
    setDraft(
      sale.items.map((i) => ({
        qty: String(i.qty),
        weight:
          i.type === "weight"
            ? String(i.totalWeight ?? i.qty * (i.weightPerBag || 25))
            : "",
        manual: !!i.isManualWeight,
        price: String(i.price),
      }))
    );
  };

  const cancelEdit = () => {
    setDraft(null);
  };

  const changeDraft = (
    sale: SaleRow,
    index: number,
    field: "qty" | "weight" | "price",
    value: string
  ) => {
    setDraft((prev) =>
      prev
        ? prev.map((d, i) => {
            if (i !== index) return d;
            if (field === "weight") return { ...d, weight: value, manual: true };
            if (field === "price") return { ...d, price: value };
            const perBag = sale.items[i].weightPerBag || 25;
            const auto = d.manual
              ? d.weight
              : String((parseFloat(value) || 0) * perBag);
            return {
              ...d,
              qty: value,
              weight: sale.items[i].type === "weight" ? auto : d.weight,
            };
          })
        : prev
    );
  };

  const draftLineTotal = (sale: SaleRow, index: number) => {
    const d = draft?.[index];
    if (!d) return sale.items[index].total;
    const price = parseFloat(d.price) || 0;
    const units =
      sale.items[index].type === "weight"
        ? parseFloat(d.weight) || 0
        : parseFloat(d.qty) || 0;
    return units * price;
  };

  const saveEdit = async (sale: SaleRow) => {
    if (!draft || !currentUser) return;
    setSaving(true);
    try {
      const extraNow = Math.max(0, parseFloat(draftExtra) || 0);
      const updated = await updateSaleFull(sale.id, currentUser.uid, {
        items: draft.map((d, i) => ({
          qty: Math.max(0.1, parseFloat(d.qty) || 0),
          price: Math.max(0, parseFloat(d.price) || 0),
          ...(sale.items[i].type === "weight"
            ? { totalWeight: Math.max(0.1, parseFloat(d.weight) || 0) }
            : {}),
        })),
        customerName: draftCustomerName.trim() || "Counter Sale",
        customerId:
          draftPaymentMethod === "Udhar" ? draftCustomerId || undefined : undefined,
        paymentMethod: draftPaymentMethod,
        transport: draftTransport.trim(),
        extraCharges: extraNow,
        description: draftDescription.trim(),
      });

      setSales((prev) => prev.map((s) => (s.id === sale.id ? updated : s)));
      setSelectedSale(null);
      setDraft(null);
      setReceiptSale(updated);
      toast.success(t("sales_billUpdated"));
    } catch (error) {
      console.error("Update sale error:", error);
      toast.error(
        error instanceof Error ? error.message : t("sales_billUpdateFailed")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sale: SaleRow) => {
    if (!currentUser) return;
    setDeleting(true);
    try {
      await deleteSale(sale.id, currentUser.uid);
      setSales((prev) => prev.filter((s) => s.id !== sale.id));
      if (selectedSale?.id === sale.id) {
        closeDetail();
      }
      setDeleteConfirmSale(null);
      toast.success(t("sales_billDeleted"));
    } catch (error) {
      console.error("Delete sale error:", error);
      toast.error(
        error instanceof Error ? error.message : t("sales_deleteFailed")
      );
    } finally {
      setDeleting(false);
    }
  };

  const [refreshing, setRefreshing] = useState(false);

  const fetchSales = useCallback(
    async (force = false) => {
      if (!currentUser) return;
      if (force) setRefreshing(true);
      try {
        const recent = await listRecentSales(currentUser.uid, 50, force);
        setSales(recent);
        if (force) toast.success("Sales updated");
      } catch (error) {
        console.error("Error fetching sales:", error);
        toast.error(t("sales_loadFailed"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currentUser, t]
  );

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const stats = useMemo(
    () => ({
      totalRevenue: sales.reduce((s, x) => s + saleNetAmount(x), 0),
      totalOrders: sales.length,
    }),
    [sales]
  );

  const visibleSales = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = sales.filter((s) => {
      if (payFilter !== "all" && (s.paymentMethod || "Cash") !== payFilter)
        return false;
      if (!term) return true;
      return (
        (s.invoiceNo || "").toLowerCase().includes(term) ||
        customerLabel(s.customerName).toLowerCase().includes(term)
      );
    });
    return [...list].sort((a, b) => {
      if (sortKey === "old") return a.date.localeCompare(b.date);
      if (sortKey === "high") return saleNetAmount(b) - saleNetAmount(a);
      return b.date.localeCompare(a.date);
    });
  }, [sales, search, payFilter, sortKey]);

  return (
    <div>
      <PageHeader
        title={t("salesHistory")}
        subtitle={t("viewPastSales")}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchSales(true)}
              disabled={refreshing}
              className="btn-secondary flex items-center gap-1.5"
              title="Refresh from server"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Link href="/dashboard/pos" className="btn-primary">
              <Plus size={18} /> {t("newSale")}
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatCard
          title={t("totalSales")}
          value={money(stats.totalRevenue)}
          subtitle={t("afterRefunds")}
          icon={TrendingUp}
          theme="blue"
          loading={loading}
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

      <DataTable
        data={visibleSales}
        rowKey={(sale) => sale.id}
        loading={loading}
        emptyText={t("sales_noBills")}
        toolbarLeft={
          <div className="relative w-full lg:w-80">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
              size={16}
            />
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
              <option value="Udhar">{t("sales_payCredit")}</option>
            </select>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="field w-auto cursor-pointer"
            >
              <option value="new">{t("sortNewest")}</option>
              <option value="old">{t("sales_sortOldest")}</option>
              <option value="high">{t("sales_sortHighest")}</option>
            </select>
          </>
        }
        columns={[
          {
            key: "customer",
            header: t("customer"),
            cell: (sale) => {
              const name = customerLabel(sale.customerName);
              return (
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 font-display text-sm font-bold text-brand-700">
                    {name.trim().charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <span className="font-semibold text-stone-900 block">{name}</span>
                    {sale.transport && (
                      <span className="text-[11px] text-stone-400 block">
                        🚚 {sale.transport}
                      </span>
                    )}
                  </div>
                </div>
              );
            },
          },
          {
            key: "inv",
            header: t("invoices"),
            cell: (sale) => (
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-bold uppercase text-brand-700">
                  #{sale.invoiceNo || "-"}
                </span>
                {(sale.isOffline || sale.id.startsWith("local_")) && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                    Offline
                  </span>
                )}
              </div>
            ),
          },
          {
            key: "date",
            header: t("date"),
            className: "whitespace-nowrap",
            cell: (sale) => (
              <span className="text-stone-600">{formatDate(sale.date)}</span>
            ),
          },
          {
            key: "status",
            header: t("status"),
            cell: (sale) => {
              const status = saleStatus(sale);
              return (
                <span
                  className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${status.tone}`}
                >
                  {t(status.labelKey)}
                </span>
              );
            },
          },
          {
            key: "total",
            header: t("grandTotal"),
            align: "right",
            cell: (sale) => (
              <span className="font-extrabold text-stone-900">
                {money(saleNetAmount(sale))}
              </span>
            ),
          },
          {
            key: "paid",
            header: t("paid"),
            align: "right",
            cell: (sale) => (
              <span className="text-stone-700">
                {money(paymentInfo(sale).paid)}
              </span>
            ),
          },
          {
            key: "due",
            header: t("due"),
            align: "right",
            cell: (sale) => {
              const pay = paymentInfo(sale);
              return (
                <span
                  className={`font-semibold ${
                    pay.due > 0 ? "text-red-600" : "text-stone-500"
                  }`}
                >
                  {money(pay.due)}
                </span>
              );
            },
          },
          {
            key: "breakdown",
            header: t("paymentBreakdown"),
            cell: (sale) => {
              const pay = paymentInfo(sale);
              return (
                <div className="flex flex-col items-start gap-1">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${pay.badge}`}
                  >
                    ● {t(pay.labelKey)}
                  </span>
                  <span className="text-[11px] font-semibold text-stone-400">
                    {t(methodLabelKey(sale.paymentMethod))}
                  </span>
                </div>
              );
            },
          },
          {
            key: "actions",
            header: t("actions"),
            align: "right",
            cell: (sale) => {
              const hasReturns =
                (sale.refundedAmount || 0) > 0 ||
                sale.items?.some((i) => (i.returnedQty || 0) > 0);
              return (
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => {
                      setSelectedSale(sale);
                      setDraft(null);
                    }}
                    className="rounded-lg p-2 text-stone-500 transition hover:bg-brand-50 hover:text-brand-700"
                    title={t("sales_viewBill")}
                  >
                    <Eye size={17} />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSale(sale);
                      startEdit(sale);
                    }}
                    disabled={hasReturns}
                    className="rounded-lg p-2 text-stone-500 transition hover:bg-amber-50 hover:text-amber-700 disabled:opacity-30 disabled:hover:bg-transparent"
                    title={hasReturns ? t("sales_editBlocked") : t("sales_editBill")}
                  >
                    <Pencil size={17} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmSale(sale)}
                    className="rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                    title={t("sales_deleteBill")}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              );
            },
          },
        ]}
      />

      {/* Sale Detail & Edit Modal */}
      {selectedSale && (() => {
        const sale = selectedSale;
        const status = saleStatus(sale);
        const isEditing = draft !== null;
        const subTotal = isEditing
          ? sale.items.reduce((s, _i, idx) => s + draftLineTotal(sale, idx), 0)
          : sale.items.reduce((s, i) => s + (i.total || i.price * i.qty), 0);
        const refunded = sale.refundedAmount || 0;
        const extraVal = isEditing
          ? Math.max(0, parseFloat(draftExtra) || 0)
          : sale.extraCharges || 0;
        const grandTotalCalc = Math.max(0, subTotal + extraVal - refunded);
        const isUdharNow = isEditing
          ? draftPaymentMethod === "Udhar"
          : sale.paymentMethod === "Udhar";
        const payDisplay = {
          isUdhar: isUdharNow,
          paid: isUdharNow ? 0 : grandTotalCalc,
          due: isUdharNow ? grandTotalCalc : 0,
          badge: isUdharNow
            ? "bg-amber-100 text-amber-800"
            : "bg-emerald-100 text-emerald-700",
          labelKey: (isUdharNow ? "due" : "paid") as TranslationKey,
        };
        const hasReturns =
          refunded > 0 || sale.items.some((i) => (i.returnedQty || 0) > 0);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fadeIn">
            <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-stone-900">
                    {isEditing ? t("sales_editBill") : t("sales_detailTitle")}
                  </h3>
                  <span className="font-mono text-sm font-bold text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-md">
                    #{sale.invoiceNo}
                  </span>
                </div>
                <button
                  onClick={closeDetail}
                  className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  {/* Customer Column */}
                  <div>
                    <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-500">
                      {t("sales_customerInfo")}
                    </h4>
                    {isEditing ? (
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs font-semibold text-stone-600 block">
                            {t("sales_editCustomer")}
                          </label>
                          <input
                            type="text"
                            value={draftCustomerName}
                            onChange={(e) => {
                              setDraftCustomerName(e.target.value);
                              setDraftCustomerId("");
                            }}
                            placeholder="Counter Sale or Name"
                            className="field mt-1 text-sm font-bold"
                          />
                        </div>
                        {draftPaymentMethod === "Udhar" && customers.length > 0 && (
                          <div>
                            <label className="text-[11px] font-semibold text-stone-500 block">
                              Select Registered Party:
                            </label>
                            <select
                              value={draftCustomerId}
                              onChange={(e) => {
                                const sel = customers.find(
                                  (c) => c.id === e.target.value
                                );
                                if (sel) {
                                  setDraftCustomerId(sel.id);
                                  setDraftCustomerName(sel.name);
                                } else {
                                  setDraftCustomerId("");
                                }
                              }}
                              className="field mt-1 text-xs cursor-pointer"
                            >
                              <option value="">-- Choose Party --</option>
                              {customers.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} {c.phone ? `(${c.phone})` : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div>
                          <label className="text-xs font-semibold text-stone-600 block">
                            {t("sales_editPaymentMethod")}
                          </label>
                          <select
                            value={draftPaymentMethod}
                            onChange={(e) =>
                              setDraftPaymentMethod(
                                e.target.value as PaymentMethod
                              )
                            }
                            className="field mt-1 text-xs font-bold cursor-pointer"
                          >
                            <option value="Cash">{t("cash")}</option>
                            <option value="Bank Account">{t("bankOnline")}</option>
                            <option value="Udhar">{t("sales_payCredit")}</option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-lg font-bold text-stone-900">
                          {customerLabel(sale.customerName)}
                        </p>
                        {sale.transport && (
                          <p className="mt-1 text-xs font-semibold text-brand-700">
                            🚚 {sale.transport}
                          </p>
                        )}
                        {sale.description && (
                          <p className="mt-1 text-xs text-stone-500">
                            {t("sales_noteLine", { note: sale.description })}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Shop Column */}
                  <div>
                    <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-500">
                      {t("sales_shopInfo")}
                    </h4>
                    <p className="text-lg font-bold text-stone-900">
                      {currentShop?.shopName || "Eman Traders"}
                    </p>
                    <div className="mt-1 space-y-0.5 text-xs text-stone-500">
                      {currentShop?.address && <p>{currentShop.address}</p>}
                      {currentShop?.contact && (
                        <p>{t("sales_phoneLine", { phone: currentShop.contact })}</p>
                      )}
                      {currentShop?.email && <p>{currentShop.email}</p>}
                    </div>
                  </div>

                  {/* Invoice / Extra Info Column */}
                  <div>
                    <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-500">
                      {isEditing ? "Transport & Notes" : t("sales_invoiceInfo")}
                    </h4>
                    {isEditing ? (
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs font-semibold text-stone-600 block">
                            {t("sales_editTransport")}
                          </label>
                          <input
                            type="text"
                            value={draftTransport}
                            onChange={(e) => setDraftTransport(e.target.value)}
                            placeholder="e.g. Bilty #, Truck No, Driver"
                            className="field mt-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-stone-600 block">
                            {t("sales_editNotes")}
                          </label>
                          <input
                            type="text"
                            value={draftDescription}
                            onChange={(e) => setDraftDescription(e.target.value)}
                            placeholder="Optional notes or remarks"
                            className="field mt-1 text-xs"
                          />
                        </div>
                      </div>
                    ) : (
                      <dl className="space-y-1.5 text-sm">
                        <div className="flex gap-3">
                          <dt className="w-28 shrink-0 text-stone-500">{t("date")}</dt>
                          <dd className="font-semibold text-stone-800">
                            {formatDate(sale.date)}
                          </dd>
                        </div>
                        <div className="flex items-center gap-3">
                          <dt className="w-28 shrink-0 text-stone-500">{t("status")}</dt>
                          <dd>
                            <span
                              className={`rounded-md px-2.5 py-0.5 text-[11px] font-bold ${status.tone}`}
                            >
                              {t(status.labelKey)}
                            </span>
                          </dd>
                        </div>
                        <div className="flex items-center gap-3">
                          <dt className="w-28 shrink-0 text-stone-500">
                            {t("sales_paymentStatus")}
                          </dt>
                          <dd>
                            <span
                              className={`rounded-md px-2.5 py-0.5 text-[11px] font-bold ${payDisplay.badge}`}
                            >
                              ● {t(payDisplay.labelKey)}
                            </span>
                            <span className="ml-2 text-xs font-semibold text-stone-400">
                              {t(methodLabelKey(sale.paymentMethod))}
                            </span>
                          </dd>
                        </div>
                      </dl>
                    )}
                  </div>
                </div>

                <h4 className="mb-3 mt-7 text-sm font-bold text-stone-900">
                  {t("sales_orderSummary")}
                </h4>
                <div className="overflow-x-auto rounded-xl border border-stone-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-stone-50 text-stone-600 text-xs uppercase tracking-wider font-bold">
                      <tr>
                        <th className="px-4 py-3">{t("sales_product")}</th>
                        <th className="px-4 py-3 text-center">{t("sales_qtyBags")}</th>
                        <th className="px-4 py-3 text-center">{t("sales_totalWeight")}</th>
                        <th className="px-4 py-3 text-right">{t("sales_rate")}</th>
                        <th className="px-4 py-3 text-center">{t("sales_statusReturned")}</th>
                        <th className="px-4 py-3 text-right">{t("total")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {sale.items.map((item, idx) => {
                        const isWeight = item.type === "weight";
                        const weightVal =
                          item.totalWeight ??
                          (isWeight ? item.qty * (item.weightPerBag || 25) : undefined);
                        const weightStr =
                          weightVal !== undefined ? `${weightVal} kg` : "—";
                        const qtyStr = isWeight
                          ? t("sales_bagsCount", {
                              count: String(item.qty).padStart(2, "0"),
                            })
                          : t("sales_pcsCount", { count: item.qty });

                        return (
                          <tr key={idx} className="hover:bg-stone-50/50 transition">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 font-display text-sm font-bold text-brand-700">
                                  {item.name.trim().charAt(0).toUpperCase()}
                                </span>
                                <span className="font-semibold text-stone-900">
                                  {item.name}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-stone-800 tabular">
                              {isEditing ? (
                                <input
                                  type="number"
                                  min="0.1"
                                  step="any"
                                  value={draft[idx]?.qty ?? ""}
                                  onChange={(e) =>
                                    changeDraft(sale, idx, "qty", e.target.value)
                                  }
                                  className="field !w-20 !py-1 text-center font-bold"
                                />
                              ) : (
                                qtyStr
                              )}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-stone-900 tabular">
                              {isEditing && isWeight ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={draft[idx]?.weight ?? ""}
                                  onChange={(e) =>
                                    changeDraft(sale, idx, "weight", e.target.value)
                                  }
                                  className={`field !w-24 !py-1 text-center font-bold ${
                                    draft[idx]?.manual
                                      ? "!border-amber-300 !bg-amber-50"
                                      : ""
                                  }`}
                                />
                              ) : (
                                weightStr
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-stone-600 tabular">
                              {isEditing ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={draft[idx]?.price ?? ""}
                                  onChange={(e) =>
                                    changeDraft(sale, idx, "price", e.target.value)
                                  }
                                  className="field !w-24 !py-1 text-right font-bold"
                                />
                              ) : (
                                <>Rs. {item.price}</>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-red-600 tabular">
                              {(item.returnedQty || 0) > 0
                                ? isWeight
                                  ? `${item.returnedQty} kg`
                                  : item.returnedQty
                                : "—"}
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

                {isEditing && (
                  <div className="mt-4 flex items-center justify-end gap-3 bg-amber-50/60 border border-amber-200/60 p-3 rounded-xl">
                    <label
                      htmlFor="edit-extra"
                      className="text-xs font-bold text-stone-700"
                    >
                      {t("sales_extraCharges")}{" "}
                      <span className="font-normal text-stone-400">
                        {t("sales_extraChargesHint")}
                      </span>
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

                <div className="mt-4 flex justify-end">
                  <dl className="w-full max-w-sm overflow-hidden rounded-xl border border-stone-200 text-sm">
                    {[
                      { label: t("subtotal"), value: money(subTotal), tone: "" },
                      ...(isEditing || (sale.extraCharges ?? 0) > 0
                        ? [
                            {
                              label: t("sales_extraCharges"),
                              value: money(extraVal),
                              tone: "",
                            },
                          ]
                        : []),
                      ...(refunded > 0
                        ? [
                            {
                              label: t("sales_refundReturn"),
                              value: `− ${money(refunded)}`,
                              tone: "text-red-600",
                            },
                          ]
                        : []),
                      {
                        label: t("grandTotal"),
                        value: money(grandTotalCalc),
                        tone: "font-extrabold text-stone-900",
                      },
                      { label: t("paid"), value: money(payDisplay.paid), tone: "" },
                      {
                        label: t("due"),
                        value: money(payDisplay.due),
                        tone: payDisplay.due > 0 ? "font-bold text-red-600" : "",
                      },
                    ].map((row, i) => (
                      <div
                        key={row.label}
                        className={`flex justify-between px-4 py-2.5 ${
                          i % 2 === 0 ? "bg-stone-50" : "bg-white"
                        }`}
                      >
                        <dt className="text-stone-500">{row.label}</dt>
                        <dd className={`tabular text-stone-800 ${row.tone}`}>
                          {row.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {payDisplay.isUdhar && (
                  <p className="mt-3 text-right text-xs text-stone-400">
                    {t("sales_creditNote")}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-200 px-6 py-4 bg-stone-50/50">
                {isEditing ? (
                  <>
                    <p className="mr-auto text-xs text-stone-500">
                      {payDisplay.isUdhar
                        ? t("sales_editNoteStockCredit")
                        : t("sales_editNoteStock")}
                    </p>
                    <button
                      onClick={cancelEdit}
                      disabled={saving}
                      className="btn-ghost"
                    >
                      {t("cancel")}
                    </button>
                    <button
                      onClick={() => saveEdit(sale)}
                      disabled={saving}
                      className="btn-primary min-w-[170px]"
                    >
                      {saving ? (
                        <Loader2 className="animate-spin" size={18} />
                      ) : (
                        <>
                          <Printer size={16} /> {t("sales_saveSlip")}
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setDeleteConfirmSale(sale)}
                      className="mr-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 size={16} /> {t("sales_deleteBill")}
                    </button>
                    <button
                      onClick={() => setReceiptSale(sale)}
                      className="btn-ghost"
                    >
                      <Printer size={16} /> {t("sales_slip")}
                    </button>
                    <button
                      onClick={() => startEdit(sale)}
                      disabled={hasReturns}
                      title={
                        hasReturns
                          ? t("sales_editBlocked")
                          : t("sales_editBill")
                      }
                      className="btn-primary"
                    >
                      <Pencil size={16} /> {t("sales_editBill")}
                    </button>
                    <button onClick={closeDetail} className="btn-dark">
                      {t("sales_close")}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete Confirmation Modal */}
      {deleteConfirmSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-stone-100">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-stone-900">
                  {t("sales_deleteConfirmTitle", {
                    invoice: deleteConfirmSale.invoiceNo || "-",
                  })}
                </h3>
                <span className="text-xs font-semibold text-stone-500">
                  {customerLabel(deleteConfirmSale.customerName)} •{" "}
                  {money(saleNetAmount(deleteConfirmSale))}
                </span>
              </div>
            </div>

            <p className="text-sm text-stone-600 mb-6 bg-red-50/70 p-3.5 rounded-xl border border-red-100 leading-relaxed">
              {t("sales_deleteConfirmMsg")}
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmSale(null)}
                disabled={deleting}
                className="btn-ghost"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmSale)}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-red-700 active:scale-95 disabled:opacity-50 transition"
              >
                {deleting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{t("sales_deleting")}</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>{t("sales_deleteBill")}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Slip Modal */}
      {receiptSale && (
        <SaleReceipt
          shop={currentShop}
          invoiceNo={receiptSale.invoiceNo}
          date={receiptSale.date}
          customerName={
            isCounterSale(receiptSale.customerName)
              ? ""
              : receiptSale.customerName
          }
          transport={receiptSale.transport}
          extraCharges={receiptSale.extraCharges}
          items={receiptSale.items}
          total={saleNetAmount(receiptSale)}
          paymentMethod={receiptSale.paymentMethod}
          printLabel={t("printSlip")}
          closeLabel={t("sales_close")}
          onClose={() => setReceiptSale(null)}
        />
      )}
    </div>
  );
}
