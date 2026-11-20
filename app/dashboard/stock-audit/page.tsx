"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Boxes,
  ClipboardCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Barcode,
  ArrowRight,
  TrendingUp,
  Download,
  Filter,
  RefreshCw,
  Loader2,
  Save,
  Check,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "react-toastify";
import { useStore } from "../../store/useStore";
import {
  loadAuditProducts,
  calculateStockAuditMetrics,
  applyStockAuditReconciliation,
  type RealAuditItem,
  type StockAuditAdjustment,
} from "../../lib/services/stockAudit";

export default function StockAuditPage() {
  const { currentUser, currentShop } = useStore();
  const [items, setItems] = useState<RealAuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingReconciliation, setSavingReconciliation] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [adjustmentReason, setAdjustmentReason] = useState("Physical Stock Count Variance");

  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "discrepancy" | "matched">("all");

  const loadData = async (isManual = false) => {
    if (!currentUser?.uid) return;
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await loadAuditProducts(currentUser.uid);
      setItems(data);
    } catch (error) {
      console.error("Failed to load audit products:", error);
      toast.error("Could not load products catalog for audit.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.uid]);

  const metrics = useMemo(() => calculateStockAuditMetrics(items), [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const term = searchTerm.toLowerCase();
      const match =
        item.name.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term) ||
        item.sku.toLowerCase().includes(term);
      if (!match) return false;

      if (filter === "discrepancy") return item.status === "discrepancy";
      if (filter === "matched") return item.status === "matched";
      return true;
    });
  }, [items, searchTerm, filter]);

  const discrepancies = useMemo(() => {
    return items.filter((i) => i.physicalCount !== i.systemStock);
  }, [items]);

  const handleAdjustCount = (id: string, newCount: number) => {
    const val = Math.max(0, newCount);
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              physicalCount: val,
              status: val === i.systemStock ? "matched" : "discrepancy",
            }
          : i
      )
    );
  };

  const handleApplyReconciliation = async () => {
    if (!currentUser?.uid || discrepancies.length === 0) return;
    setSavingReconciliation(true);

    try {
      const adjustments: StockAuditAdjustment[] = discrepancies.map((d) => {
        const diff = d.physicalCount - d.systemStock;
        return {
          productId: d.id,
          name: d.name,
          oldStock: d.systemStock,
          newStock: d.physicalCount,
          variance: diff,
          unitBuyingPrice: d.buyingPrice,
          financialImpact: diff * (d.sellingPrice || d.buyingPrice || 0),
          reason: adjustmentReason,
        };
      });

      await applyStockAuditReconciliation(currentUser.uid, adjustments);
      toast.success(
        `Successfully adjusted ${adjustments.length} product(s) to match physical shelf count!`
      );
      setShowConfirmModal(false);

      // Refresh to pull updated stock
      await loadData();
    } catch (error) {
      console.error("Failed to save audit adjustments:", error);
      toast.error("Could not save audit reconciliation. Please check connection.");
    } finally {
      setSavingReconciliation(false);
    }
  };

  const handleExportAuditCSV = () => {
    if (items.length === 0) return;

    const rows: string[][] = [
      [`AsaanPOS - Physical Stock Audit Report (${currentShop?.shopName || "Store"})`],
      [`Date: ${new Date().toLocaleString()}`],
      [],
      [
        "Product Name",
        "Category",
        "System Stock",
        "Physical Shelf Count",
        "Variance",
        "Status",
        "Selling Rate",
        "Variance Value (PKR)",
      ],
      ...items.map((i) => {
        const diff = i.physicalCount - i.systemStock;
        const val = diff * (i.sellingPrice || 0);
        return [
          i.name,
          i.category,
          String(i.systemStock),
          String(i.physicalCount),
          diff === 0 ? "0" : diff > 0 ? `+${diff}` : `${diff}`,
          i.status,
          `Rs. ${i.sellingPrice}`,
          `Rs. ${val}`,
        ];
      }),
    ];

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      rows.map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Stock_Audit_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Stock Audit Variance CSV exported");
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* 1. TOP HEADER & ACTIONS */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Stock Audit & Physical Reconciliation
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Audit on-shelf physical inventory counts against system database records to resolve shrink and theft.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
            title="Reload products from server"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin text-orange-600" : "text-slate-500"} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleExportAuditCSV}
            disabled={items.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
          >
            <Download size={14} className="text-slate-500" />
            <span>Export Audit Log</span>
          </button>

          {discrepancies.length > 0 && (
            <button
              onClick={() => setShowConfirmModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition-colors shadow-sm"
            >
              <Save size={14} />
              <span>Reconcile {discrepancies.length} Discrepancies</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. 5 KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Asset Value</span>
          <div className="mt-2">
            <div className="text-xl font-bold text-slate-900 tabular-nums">
              Rs. {Math.round(metrics.totalAssetValue).toLocaleString()}
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">Physical Inventory</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tracked SKUs</span>
          <div className="mt-2">
            <div className="text-xl font-bold text-slate-900 tabular-nums">
              {metrics.trackedSkus} Items
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Live in Database</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Low Stock</span>
          <div className="mt-2">
            <div className="text-xl font-bold text-amber-700 tabular-nums">
              {metrics.lowStockCount} SKUs
            </div>
            <div className="text-[11px] text-amber-700 font-semibold mt-0.5">Stock &le; 5 units</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Out of Stock</span>
          <div className="mt-2">
            <div className="text-xl font-bold text-rose-700 tabular-nums">
              {metrics.outOfStockCount} SKUs
            </div>
            <div className="text-[11px] text-rose-600 font-semibold mt-0.5">Zero shelf inventory</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700">Discrepancies</span>
          <div className="mt-2">
            <div className="text-xl font-bold text-orange-700 tabular-nums">
              {metrics.discrepancyCount} Items
            </div>
            <div className="text-[11px] text-orange-600 font-semibold mt-0.5">
              {metrics.discrepancyCount > 0 ? "Action required" : "100% Balanced"}
            </div>
          </div>
        </div>
      </div>

      {/* 3. AUDIT RECONCILIATION TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
        {/* Filter & Search Bar */}
        <div className="p-3.5 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search product name, category or SKU..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1 rounded-full transition-all ${
                filter === "all" ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Items ({items.length})
            </button>
            <button
              onClick={() => setFilter("discrepancy")}
              className={`px-3 py-1 rounded-full transition-all ${
                filter === "discrepancy" ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Discrepancies ({items.filter((i) => i.status === "discrepancy").length})
            </button>
            <button
              onClick={() => setFilter("matched")}
              className={`px-3 py-1 rounded-full transition-all ${
                filter === "matched" ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Matched ({items.filter((i) => i.status === "matched").length})
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-orange-600 mb-2" />
              <span className="text-xs font-semibold text-slate-600">Loading catalog from Firestore...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center">
              <Boxes className="w-10 h-10 text-slate-300 mb-2" />
              <span className="text-xs font-semibold text-slate-600">No products found matching filter</span>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200">
                  <th className="py-2.5 px-4">Item &amp; Details</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-center">System Recorded</th>
                  <th className="py-2.5 px-4 text-center">Physical Count</th>
                  <th className="py-2.5 px-3 text-center">Variance</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Selling Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => {
                  const diff = item.physicalCount - item.systemStock;
                  const isMatched = diff === 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block text-xs">{item.name}</span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          ID: {item.sku}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-slate-600">{item.category}</td>

                      <td className="py-3 px-3 text-center font-bold text-slate-700 tabular-nums">
                        {item.systemStock} {item.unit}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAdjustCount(item.id, item.physicalCount - 1)}
                            className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={item.physicalCount}
                            onChange={(e) => handleAdjustCount(item.id, parseInt(e.target.value) || 0)}
                            className="w-14 text-center py-0.5 border border-slate-200 rounded font-bold bg-slate-50 text-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => handleAdjustCount(item.id, item.physicalCount + 1)}
                            className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center font-bold tabular-nums">
                        {isMatched ? (
                          <span className="text-slate-400">0</span>
                        ) : diff > 0 ? (
                          <span className="text-sky-700">+{diff} (Over)</span>
                        ) : (
                          <span className="text-rose-600">{diff} (Short)</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isMatched
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {isMatched ? "Matched ✓" : "Discrepancy ⚠"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right text-slate-700 font-bold tabular-nums">
                        Rs. {item.sellingPrice.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* CONFIRMATION RECONCILIATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="p-4 bg-orange-50 border-b border-orange-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-orange-600" size={18} />
                <h3 className="font-bold text-orange-950 text-sm">Confirm Stock Reconciliation</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                You are about to adjust <strong>{discrepancies.length} item(s)</strong> in your Firestore database to match the physical shelf counts recorded.
              </p>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1.5">
                <span className="font-bold text-slate-800">Reason for Stock Adjustment:</span>
                <select
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="w-full bg-white border border-slate-200 py-1.5 px-2.5 rounded-lg text-xs font-medium text-slate-800 outline-none"
                >
                  <option>Physical Stock Count Variance</option>
                  <option>Damaged / Broken / Expired Stock Written Off</option>
                  <option>Theft / Shrinkage Unaccounted Loss</option>
                  <option>Correction of Incorrect Previous Receiving</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={savingReconciliation}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyReconciliation}
                  disabled={savingReconciliation}
                  className="px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {savingReconciliation ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Saving to Firestore...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Apply & Update Stock</span>
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
