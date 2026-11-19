"use client";

// TODO: connect logic with backend physical stock audit service in next phase

import { useState } from "react";
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
} from "lucide-react";
import { mockStockAuditMetrics, mockAuditItems, type AuditItem } from "../../mocks/stockAudit";
import { toast } from "react-toastify";

export default function StockAuditPage() {
  const [items, setItems] = useState<AuditItem[]>(mockAuditItems);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "discrepancy" | "matched">("all");

  const filteredItems = items.filter((item) => {
    const match =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.barcode.includes(searchTerm);
    if (!match) return false;

    if (filter === "discrepancy") return item.status === "discrepancy";
    if (filter === "matched") return item.status === "matched";
    return true;
  });

  const handleAdjust = (id: string, newCount: number) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              physicalCount: newCount,
              status: newCount === i.systemStock ? "matched" : "discrepancy",
            }
          : i
      )
    );
    toast.success("Count updated");
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

        <button
          onClick={() => toast.success("Stock Audit Variance Report exported")}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors shadow-xs"
        >
          <Download size={14} className="text-slate-500" />
          <span>Export Audit Log</span>
        </button>
      </div>

      {/* 2. 5 KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Asset Value</span>
          <div className="mt-2">
            <div className="text-xl font-bold text-slate-900 tabular-nums">
              {mockStockAuditMetrics.totalValue}
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">Physical Inventory</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tracked SKUs</span>
          <div className="mt-2">
            <div className="text-xl font-bold text-slate-900 tabular-nums">
              {mockStockAuditMetrics.trackedSkus} Items
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">8 Store Categories</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Low Stock</span>
          <div className="mt-2">
            <div className="text-xl font-bold text-amber-700 tabular-nums">
              {mockStockAuditMetrics.lowStockCount} SKUs
            </div>
            <div className="text-[11px] text-amber-700 font-semibold mt-0.5">Reorder Threshold Reached</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Out of Stock</span>
          <div className="mt-2">
            <div className="text-xl font-bold text-rose-700 tabular-nums">
              {mockStockAuditMetrics.outOfStockCount} SKU
            </div>
            <div className="text-[11px] text-rose-600 font-semibold mt-0.5">Shelf stockout alert</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Expiring &lt;30d</span>
          <div className="mt-2">
            <div className="text-xl font-bold text-slate-900 tabular-nums">
              {mockStockAuditMetrics.expiringBatches} Batches
            </div>
            <div className="text-[11px] text-orange-600 font-semibold mt-0.5">Inspection needed</div>
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
              placeholder="Search product, SKU or scan barcode..."
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
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200">
                <th className="py-2.5 px-4">Item &amp; Barcode</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-center">System Recorded</th>
                <th className="py-2.5 px-4 text-center">Physical Count</th>
                <th className="py-2.5 px-3 text-center">Variance</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Last Verified</th>
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
                        SKU: {item.sku} • {item.barcode}
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
                          onClick={() => handleAdjust(item.id, Math.max(0, item.physicalCount - 1))}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={item.physicalCount}
                          onChange={(e) => handleAdjust(item.id, Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-12 text-center py-0.5 border border-slate-200 rounded font-bold bg-slate-50"
                        />
                        <button
                          type="button"
                          onClick={() => handleAdjust(item.id, item.physicalCount + 1)}
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

                    <td className="py-3 px-4 text-right text-slate-400 text-[11px] whitespace-nowrap">
                      {item.lastCounted}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
