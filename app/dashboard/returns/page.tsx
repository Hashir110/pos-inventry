"use client";

import { useEffect, useState, useMemo } from "react";
import { toast } from "react-toastify";
import { useDialog } from "../../components/DialogProvider";
import { customerLabel } from "../../lib/format";
import type { Sale, SaleItem } from "../../types";
import {
  RotateCcw,
  Eye,
  FileText,
  Search,
  X,
  Loader2,
  Receipt,
  Calendar,
  User,
  Store,
  CheckCircle2,
  AlertTriangle,
  Minus,
  Plus,
  ArrowRight,
  ShieldAlert,
  Wallet,
  Clock,
  Printer,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import { findSaleByInvoice, getSaleById, listRecentSales } from "../../lib/services/sales";
import { processReturn } from "../../lib/services/returns";
import { useLanguage } from "../../store/useLanguage";

const money = (n: number) => `Rs. ${Math.round(n || 0).toLocaleString()}`;

interface ReturnDraftItem {
  selected: boolean;
  qty: number;
  maxQty: number;
  condition: "Sealed" | "Damaged" | "Open Box";
}

export default function ReturnsPage() {
  const { promptNumber } = useDialog();
  const { t, language } = useLanguage();
  const isRTL = language === "ur";
  const { currentUser, currentShop } = useStore();

  const [invoiceId, setInvoiceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [saleData, setSaleData] = useState<Sale | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<Sale[]>([]);

  // Return configuration
  const [returnDrafts, setReturnDrafts] = useState<Record<number, ReturnDraftItem>>({});
  const [returnReason, setReturnReason] = useState("Customer Changed Mind");
  const [settlementMethod, setSettlementMethod] = useState<"cash" | "khata" | "exchange">("cash");
  const [restockInventory, setRestockInventory] = useState(true);

  // Note Modal
  const [isDesModalOpen, setIsDesModalOpen] = useState(false);
  const [selectedDescription, setSelectedDescription] = useState("");

  // Load recent invoices for quick chips
  useEffect(() => {
    if (!currentUser) return;
    listRecentSales(currentUser.uid, 5)
      .then((sales) => setRecentInvoices(sales))
      .catch((err) => console.error("Error loading recent invoices:", err));
  }, [currentUser]);

  // When a sale is loaded, initialize return drafts
  const initDrafts = (sale: Sale) => {
    const drafts: Record<number, ReturnDraftItem> = {};
    sale.items.forEach((item, index) => {
      const available = Math.max(0, item.qty - (item.returnedQty || 0));
      drafts[index] = {
        selected: available > 0,
        qty: available > 0 ? 1 : 0,
        maxQty: available,
        condition: "Sealed",
      };
    });
    setReturnDrafts(drafts);
  };

  const handleSearch = async (e?: React.FormEvent, targetInvoice?: string) => {
    if (e) e.preventDefault();
    const query = (targetInvoice ?? invoiceId).trim();
    if (!query || !currentUser) return;

    setLoading(true);
    setSaleData(null);
    try {
      const sale = await findSaleByInvoice(currentUser.uid, query);
      if (sale) {
        setSaleData(sale);
        setInvoiceId(sale.invoiceNo || query);
        initDrafts(sale);
        toast.success(t("returns_invoiceFound") || "Invoice located successfully");
      } else {
        toast.error(t("returns_invoiceNotFound") || "No matching invoice found");
      }
    } catch (error) {
      console.error(error);
      toast.error(t("returns_searchError") || "Error searching invoice");
    } finally {
      setLoading(false);
    }
  };

  // Toggle select all
  const toggleSelectAll = (select: boolean) => {
    setReturnDrafts((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        const idx = Number(key);
        if (next[idx].maxQty > 0) {
          next[idx] = {
            ...next[idx],
            selected: select,
            qty: select ? Math.min(next[idx].maxQty, Math.max(1, next[idx].qty)) : 0,
          };
        }
      });
      return next;
    });
  };

  // Update item return qty
  const updateItemQty = (index: number, delta: number) => {
    setReturnDrafts((prev) => {
      const curr = prev[index];
      if (!curr) return prev;
      const newQty = Math.max(0, Math.min(curr.maxQty, curr.qty + delta));
      return {
        ...prev,
        [index]: {
          ...curr,
          qty: newQty,
          selected: newQty > 0,
        },
      };
    });
  };

  // Calculate return totals
  const refundSummary = useMemo(() => {
    if (!saleData) return { totalRefund: 0, totalUnits: 0, itemsToReturn: [] };
    let totalRefund = 0;
    let totalUnits = 0;
    const itemsToReturn: { index: number; item: SaleItem; returnQty: number }[] = [];

    saleData.items.forEach((item, index) => {
      const draft = returnDrafts[index];
      if (draft && draft.selected && draft.qty > 0) {
        const isWeight = item.type === "weight";
        const bagWeight = item.weightPerBag || 25;
        const returnUnits = isWeight ? draft.qty * bagWeight : draft.qty;
        const unitPrice = Number(item.price ?? item.sellingPrice ?? 0);
        const subtotal = returnUnits * unitPrice;

        totalRefund += subtotal;
        totalUnits += draft.qty;
        itemsToReturn.push({ index, item, returnQty: draft.qty });
      }
    });

    return { totalRefund, totalUnits, itemsToReturn };
  }, [saleData, returnDrafts]);

  // Execute return for all selected items
  const handleConfirmReturn = async () => {
    if (!saleData || refundSummary.itemsToReturn.length === 0) {
      toast.warn("Please select at least one item and quantity to return.");
      return;
    }

    setProcessing(true);
    let successCount = 0;
    try {
      for (const { index, item, returnQty } of refundSummary.itemsToReturn) {
        await processReturn(saleData.id, index, item.id, returnQty);
        successCount++;
      }
      toast.success(
        `Successfully processed refund of ${money(refundSummary.totalRefund)} for ${successCount} item(s)!`
      );

      // Refresh invoice
      const updated = await getSaleById(saleData.id);
      if (updated) {
        setSaleData(updated);
        initDrafts(updated);
      }
    } catch (error) {
      console.error("Return error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to process return");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* 1. TOP HEADER & SEARCH BAR */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {t("returns_title") || "Customer Returns & Refunds"}
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {t("returns_subtitle") || "Look up customer receipts to process merchandise returns, credit notes, or cash refunds."}
          </p>
        </div>

        {/* Invoice Lookup Form */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-3">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder={t("returns_invoicePlaceholder") || "Enter Invoice # (e.g. 10842) or scan bill barcode..."}
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all font-medium"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !invoiceId.trim()}
              className="px-5 py-2.5 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 min-w-[130px]"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <Search size={16} />
                  <span>{t("returns_findBill") || "Search Bill"}</span>
                </>
              )}
            </button>
          </form>

          {/* Recent Invoice Quick Pills */}
          {recentInvoices.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pt-1 border-t border-slate-100 text-xs text-slate-500">
              <span className="font-bold text-slate-400 whitespace-nowrap flex items-center gap-1">
                <Clock size={12} /> Recent Bills:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {recentInvoices.map((rec) => (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => {
                      setInvoiceId(rec.invoiceNo || rec.id);
                      handleSearch(undefined, rec.invoiceNo || rec.id);
                    }}
                    className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-orange-50 hover:text-orange-700 text-slate-700 font-semibold transition-all flex items-center gap-1 border border-slate-200/60"
                  >
                    <span className="font-mono font-bold">#{rec.invoiceNo || rec.id.slice(0, 6)}</span>
                    <span className="text-slate-400">({money(rec.totalAmount)})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. EMPTY STATE WHEN NO INVOICE IS LOADED */}
      {!saleData && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center shadow-xs">
          <div className="w-14 h-14 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mb-3">
            <RotateCcw size={28} />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Invoice Selected</h3>
          <p className="text-sm text-slate-500 max-w-md mt-1">
            {t("returns_emptyPrompt") || "Enter an invoice number above or click on one of the recent bills to inspect line items for return."}
          </p>
        </div>
      )}

      {/* 3. ACTIVE RETURN PROCESSING WORKSPACE */}
      {saleData && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          {/* Invoice Summary Header Bar */}
          <div className="bg-slate-50 p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-xs">
                <Receipt size={22} />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold font-mono text-slate-900">
                    Invoice #{saleData.invoiceNo || saleData.id.slice(0, 8)}
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {saleData.paymentMethod === "Udhar" ? "UDHAAR BILL" : "ORIGINAL PAID"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1">
                    <Calendar size={13} /> {new Date(saleData.date).toLocaleDateString()}
                  </span>
                  <span>•</span>
                  <span>Counter: Cashier</span>
                  <span>•</span>
                  <span>{currentShop?.shopName || "FreshMart"}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Customer Account Pill */}
              <div className="flex items-center gap-2.5 bg-white px-3.5 py-1.5 rounded-lg border border-slate-200 shadow-xs">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                  {customerLabel(saleData.customerName).slice(0, 2).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Customer</span>
                  <span className="text-xs font-bold text-slate-800">
                    {customerLabel(saleData.customerName)}
                  </span>
                </div>
              </div>

              {/* Original Bill Total */}
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Original Total</span>
                <span className="text-base font-bold text-slate-900 tabular-nums">
                  {money(saleData.totalAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Main Return Form Area */}
          <div className="p-4 sm:p-6 flex flex-col gap-6">
            {/* Table Header controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">Select Line Items for Return / Refund</h2>
                <p className="text-xs text-slate-500">
                  Tick products the customer wishes to exchange or return. Adjust quantities using the counter buttons.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => toggleSelectAll(true)}
                  className="text-orange-600 hover:text-orange-700 hover:underline"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => toggleSelectAll(false)}
                  className="text-slate-500 hover:text-slate-800"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-3 w-10 text-center">✓</th>
                    <th className="py-3 px-4">Item Description</th>
                    <th className="py-3 px-3 text-center">Sold Qty</th>
                    <th className="py-3 px-3 text-right">Unit Price</th>
                    <th className="py-3 px-4 text-center w-48">Return Qty</th>
                    <th className="py-3 px-4 text-right">Refund Subtotal</th>
                    <th className="py-3 px-3 text-center w-28">Condition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {saleData.items.map((item, index) => {
                    const draft = returnDrafts[index] || {
                      selected: false,
                      qty: 0,
                      maxQty: Math.max(0, item.qty - (item.returnedQty || 0)),
                      condition: "Sealed",
                    };
                    const isWeight = item.type === "weight";
                    const bagWeight = item.weightPerBag || 25;
                    const unitPrice = Number(item.price ?? item.sellingPrice ?? 0);
                    const lineRefund = draft.selected
                      ? (isWeight ? draft.qty * bagWeight : draft.qty) * unitPrice
                      : 0;
                    const alreadyReturned = item.returnedQty || 0;
                    const isFullyReturned = draft.maxQty <= 0;

                    return (
                      <tr
                        key={index}
                        className={`transition-colors ${
                          draft.selected ? "bg-orange-50/50" : "hover:bg-slate-50/60"
                        } ${isFullyReturned ? "opacity-50 bg-slate-50/50" : ""}`}
                      >
                        {/* Checkbox */}
                        <td className="py-3.5 px-3 text-center">
                          <input
                            type="checkbox"
                            disabled={isFullyReturned}
                            checked={draft.selected}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setReturnDrafts((prev) => ({
                                ...prev,
                                [index]: {
                                  ...draft,
                                  selected: checked,
                                  qty: checked ? Math.max(1, draft.qty) : 0,
                                },
                              }));
                            }}
                            className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 accent-orange-600 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>

                        {/* Item Info */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{item.name}</span>
                            <span className="text-[11px] text-slate-400">
                              {isWeight ? `Weight Unit: ${bagWeight} kg/bag` : "Standard Piece"}
                              {alreadyReturned > 0 && (
                                <span className="ml-2 text-rose-600 font-semibold">
                                  ({alreadyReturned} already returned)
                                </span>
                              )}
                            </span>
                          </div>
                        </td>

                        {/* Sold Qty */}
                        <td className="py-3.5 px-3 text-center font-bold text-slate-700 tabular-nums">
                          {item.qty} {isWeight ? "bags" : "pcs"}
                        </td>

                        {/* Unit Price */}
                        <td className="py-3.5 px-3 text-right font-medium text-slate-700 tabular-nums">
                          Rs. {unitPrice}
                        </td>

                        {/* Return Qty Counter */}
                        <td className="py-3.5 px-4 text-center">
                          {isFullyReturned ? (
                            <span className="text-xs font-bold text-slate-400">Fully Returned</span>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                disabled={!draft.selected || draft.qty <= 0}
                                onClick={() => updateItemQty(index, -1)}
                                className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm disabled:opacity-40 transition-colors"
                              >
                                -
                              </button>
                              <span className="w-10 py-1 text-center font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded text-xs tabular-nums">
                                {draft.qty}
                              </span>
                              <button
                                type="button"
                                disabled={!draft.selected || draft.qty >= draft.maxQty}
                                onClick={() => updateItemQty(index, 1)}
                                className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm disabled:opacity-40 transition-colors"
                              >
                                +
                              </button>
                              <span className="text-[11px] text-slate-400 font-medium ml-1">
                                / {draft.maxQty} max
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Refund Subtotal */}
                        <td className="py-3.5 px-4 text-right">
                          <span
                            className={`font-bold tabular-nums ${
                              draft.selected ? "text-orange-600 font-bold" : "text-slate-400"
                            }`}
                          >
                            Rs. {Math.round(lineRefund).toLocaleString()}
                          </span>
                        </td>

                        {/* Condition */}
                        <td className="py-3.5 px-3 text-center">
                          <select
                            disabled={!draft.selected}
                            value={draft.condition}
                            onChange={(e) =>
                              setReturnDrafts((prev) => ({
                                ...prev,
                                [index]: { ...draft, condition: e.target.value as any },
                              }))
                            }
                            className="py-1 px-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-md focus:ring-1 focus:ring-orange-500 cursor-pointer disabled:opacity-50"
                          >
                            <option value="Sealed">Sealed</option>
                            <option value="Damaged">Damaged</option>
                            <option value="Open Box">Open Box</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 2-COLUMN SETTLEMENT & CONFIGURATION */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
              {/* Left Column: Return Reason & Restock Rule (7 cols) */}
              <div className="lg:col-span-7 bg-slate-50 rounded-xl p-5 border border-slate-200 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center">
                    2
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm">Return Reason & Stock Disposition</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                      Primary Return Reason *
                    </label>
                    <select
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      className="w-full bg-white border border-slate-200 py-2 px-3 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option>Customer Changed Mind</option>
                      <option>Defective / Expired Product</option>
                      <option>Wrong Item Scanned at Register</option>
                      <option>Packaging Damaged / Broken Seal</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                      Return Authorization
                    </label>
                    <select className="w-full bg-white border border-slate-200 py-2 px-3 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500">
                      <option>Shift Cashier Direct Clearance</option>
                      <option>Supervisor Authorization</option>
                      <option>Manager Approved</option>
                    </select>
                  </div>
                </div>

                {/* Restock Toggle */}
                <label className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50/80 transition-colors">
                  <input
                    type="checkbox"
                    checked={restockInventory}
                    onChange={(e) => setRestockInventory(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 mt-0.5"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-800">
                      Restock returned items back to active shelf inventory
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Stock counts in warehouse will automatically increment upon refund processing.
                    </span>
                  </div>
                </label>
              </div>

              {/* Right Column: Refund Settlement Box (5 cols) */}
              <div className="lg:col-span-5 bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Refund Settlement
                    </span>
                    <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                      {refundSummary.totalUnits} Units Selected
                    </span>
                  </div>

                  {/* Grand Refund Amount */}
                  <div className="my-4 text-center p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                      Total Refund Payable
                    </span>
                    <div className="text-3xl font-extrabold text-orange-600 tracking-tight mt-1 tabular-nums">
                      {money(refundSummary.totalRefund)}
                    </div>
                  </div>

                  {/* Settlement method options */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 block mb-1">Refund Method:</label>
                    <div className="space-y-1.5 text-xs">
                      <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                        <input
                          type="radio"
                          name="refundMethod"
                          checked={settlementMethod === "cash"}
                          onChange={() => setSettlementMethod("cash")}
                          className="accent-orange-600"
                        />
                        <span className="font-semibold text-slate-800">Cash Payout from Till Drawer</span>
                      </label>
                      <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                        <input
                          type="radio"
                          name="refundMethod"
                          checked={settlementMethod === "khata"}
                          onChange={() => setSettlementMethod("khata")}
                          className="accent-orange-600"
                        />
                        <span className="font-semibold text-slate-800">Customer Khata / Store Credit Adjustment</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Final Submit Button */}
                <button
                  type="button"
                  disabled={processing || refundSummary.totalUnits === 0}
                  onClick={handleConfirmReturn}
                  className="w-full py-3 rounded-lg bg-orange-600 text-white font-bold text-sm hover:bg-orange-700 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      <span>Confirm & Process Refund</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
