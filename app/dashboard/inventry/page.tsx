"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  Loader2,
  Barcode,
  Layers,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Boxes,
  Store,
  Warehouse,
  ChevronRight,
  Filter,
} from "lucide-react";
import { toast } from "react-toastify";
import { useDialog } from "../../components/DialogProvider";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../store/useLanguage";
import { deleteProduct, listProducts, transferStock } from "../../lib/services/products";
import type { Product } from "../../types";

type StockFilter = "all" | "low" | "out" | "weight" | "count";

export default function InventoryList() {
  const { confirm } = useDialog();
  const { currentUser, currentShop } = useStore();
  const { t, language } = useLanguage();
  const isRTL = language === "ur";

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<StockFilter>("all");

  // Stock Transfer Modal
  const [transferProd, setTransferProd] = useState<Product | null>(null);
  const [transferQty, setTransferQty] = useState(1);
  const [transferFrom, setTransferFrom] = useState<"gudam" | "shop">("gudam");
  const [transferTo, setTransferTo] = useState<"gudam" | "shop">("shop");
  const [transferring, setTransferring] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const fetchProducts = useCallback(
    async (force = false) => {
      if (!currentUser) return;
      if (force) setRefreshing(true);
      try {
        setProducts(await listProducts(currentUser.uid, force));
        if (force) toast.success("Inventory updated");
      } catch (error) {
        console.error("Error fetching inventory:", error);
        toast.error(t("inv_loadFailed") || "Failed to load inventory");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currentUser, t]
  );

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleDelete = async (product: Product) => {
    const ok = await confirm({
      title: t("inv_deleteTitle") || "Delete Product",
      message: t("inv_deleteMessage", { name: product.name }) || `Are you sure you want to delete ${product.name}?`,
      confirmLabel: t("delete") || "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteProduct(product.id, currentUser?.uid);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      toast.success(t("inv_deleted") || "Product deleted");
    } catch (error) {
      console.error(error);
      toast.error(t("inv_deleteFailed") || "Delete failed");
    }
  };

  const locationLabel = (loc: "gudam" | "shop") =>
    loc === "gudam" ? t("inv_warehouse") || "Warehouse (Gudam)" : t("inv_shop") || "Front Shop";
  const unitLabel = (p: Product) =>
    p.unitType === "weight" ? t("inv_bags") || "bags" : t("inv_pcs") || "pcs";

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferProd) return;
    if (transferFrom === transferTo) {
      toast.warn(t("inv_selectDifferent") || "Please select different source and destination locations.");
      return;
    }
    try {
      setTransferring(true);
      await transferStock(transferProd.id, Number(transferQty), transferFrom, transferTo);
      toast.success(
        t("inv_transferred", {
          qty: transferQty,
          from: locationLabel(transferFrom),
          to: locationLabel(transferTo),
        }) || `Transferred ${transferQty} from ${locationLabel(transferFrom)} to ${locationLabel(transferTo)}`
      );
      setTransferProd(null);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || t("inv_transferFailed") || "Transfer failed");
    } finally {
      setTransferring(false);
    }
  };

  // Metrics
  const counts = useMemo(() => {
    const totalValuation = products.reduce((acc, p) => acc + (p.stock || 0) * (p.buyingPrice || p.sellingPrice || 0), 0);
    return {
      all: products.length,
      low: products.filter((p) => p.stock > 0 && p.stock < 5).length,
      out: products.filter((p) => p.stock <= 0).length,
      weight: products.filter((p) => p.unitType === "weight").length,
      count: products.filter((p) => p.unitType !== "weight").length,
      totalValuation,
    };
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return products.filter((p) => {
      const matchName = p.name.toLowerCase().includes(term);
      const matchCat = (p.category || "").toLowerCase().includes(term);
      if (!matchName && !matchCat) return false;

      if (filter === "low") return p.stock > 0 && p.stock < 5;
      if (filter === "out") return p.stock <= 0;
      if (filter === "weight") return p.unitType === "weight";
      if (filter === "count") return p.unitType !== "weight";
      return true;
    });
  }, [products, searchTerm, filter]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const displayedProducts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, page, pageSize]);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* 1. TOP HEADER & ACTIONS */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {t("inventoryManagement") || "Products Catalog & Inventory"}
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {t("inv_subtitle") || "Manage SKUs, wholesale & retail prices, barcode identifiers, and warehouse stock transfers."}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => fetchProducts(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
            title="Refresh from server"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin text-orange-600" : "text-slate-500"} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <Link
            href="/dashboard/inventry/add"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 transition-colors shadow-sm"
          >
            <Plus size={16} />
            <span>{t("addProductBtn") || "Add New Product"}</span>
          </Link>
        </div>
      </div>

      {/* 2. 4 SUMMARY STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Active SKUs</span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <Boxes size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{counts.all}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {counts.count} Standard • {counts.weight} Weight items
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Low Stock Alert</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-700 tabular-nums">{counts.low}</div>
            <div className="text-xs text-amber-700 font-semibold mt-0.5">Under 5 units remaining</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Out of Stock</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
              <Package size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-700 tabular-nums">{counts.out}</div>
            <div className="text-xs text-rose-600 font-semibold mt-0.5">Needs immediate reorder</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Est. Inventory Value</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-700 tabular-nums">
              Rs. {Math.round(counts.totalValuation).toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Cost-based asset estimate</div>
          </div>
        </div>
      </div>

      {/* 3. SEARCH & FILTER PILLS ROW */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder={t("searchItemsPlaceholder") || "Search by product name, SKU, or scan barcode..."}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all font-medium"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { key: "all", label: "All Items", count: counts.all },
              { key: "low", label: "Low Stock", count: counts.low },
              { key: "out", label: "Out of Stock", count: counts.out },
              { key: "weight", label: "Weight (Bags)", count: counts.weight },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setFilter(tab.key);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                filter === tab.key
                  ? "bg-orange-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  filter === tab.key ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. HIGH DENSITY RESPONSIVE TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
        <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Store size={15} className="text-orange-600" />
            <span>Displaying {displayedProducts.length} of {filteredProducts.length} products</span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
            Warehouse & Front Shop Unified Ledger
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4">Product Detail</th>
                <th className="py-3 px-3">Type / Unit</th>
                <th className="py-3 px-3 text-right">Cost Price</th>
                <th className="py-3 px-3 text-right">Retail Sale</th>
                <th className="py-3 px-3 text-center">Gudam (Wh)</th>
                <th className="py-3 px-3 text-center">Shop Stock</th>
                <th className="py-3 px-3 text-center">Total Stock</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="animate-spin text-orange-600" size={24} />
                      <span className="text-xs font-semibold">Loading catalog...</span>
                    </div>
                  </td>
                </tr>
              ) : displayedProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Package size={32} className="text-slate-300" />
                      <p className="text-sm font-semibold text-slate-600">No products found</p>
                      <p className="text-xs text-slate-400">Try adjusting your search or stock filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedProducts.map((p) => {
                  const isWeight = p.unitType === "weight";
                  const unit = unitLabel(p);
                  const isOut = p.stock <= 0;
                  const isLow = !isOut && p.stock < 5;
                  const marginPct =
                    p.buyingPrice && p.sellingPrice && p.sellingPrice > 0
                      ? Math.round(((p.sellingPrice - p.buyingPrice) / p.sellingPrice) * 100)
                      : null;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Product Detail */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {p.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-slate-900 truncate">{p.name}</span>
                            <span className="text-[11px] text-slate-400">
                              {p.category || (isWeight ? "Bulk Goods" : "General Item")}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Type / Unit */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            isWeight
                              ? "bg-orange-50 text-orange-700 border border-orange-200"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {isWeight ? "Bags (Weight)" : "Standard Pcs"}
                        </span>
                      </td>

                      {/* Cost Price */}
                      <td className="py-3 px-3 text-right font-medium text-slate-500 tabular-nums">
                        {p.buyingPrice ? `Rs. ${p.buyingPrice}` : "—"}
                      </td>

                      {/* Retail Sale Price */}
                      <td className="py-3 px-3 text-right font-bold text-slate-900 tabular-nums">
                        Rs. {p.sellingPrice}
                        {marginPct !== null && (
                          <span className="block text-[10px] text-emerald-600 font-medium">
                            {marginPct}% margin
                          </span>
                        )}
                      </td>

                      {/* Gudam (Wh) Stock */}
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-bold text-[11px] tabular-nums">
                          {p.gudamStock ?? 0} {unit}
                        </span>
                      </td>

                      {/* Shop Stock */}
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-bold text-[11px] tabular-nums">
                          {p.shopStock ?? p.stock ?? 0} {unit}
                        </span>
                      </td>

                      {/* Total Stock */}
                      <td className="py-3 px-3 text-center font-bold text-slate-900 tabular-nums">
                        {p.stock} {unit}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                            isOut
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : isLow
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {isOut ? "Out of Stock" : isLow ? "Low Stock" : "In Stock"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setTransferProd(p)}
                            className="p-1.5 rounded-md text-purple-600 hover:bg-purple-50 transition-colors"
                            title="Transfer Stock between Warehouse & Shop"
                          >
                            <ArrowLeftRight size={15} />
                          </button>
                          <Link
                            href={`/dashboard/inventry/edit/${p.id}`}
                            className="p-1.5 rounded-md text-slate-500 hover:text-orange-600 hover:bg-slate-100 transition-colors"
                            title="Edit Product"
                          >
                            <Pencil size={15} />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(p)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete Product"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3.5 bg-slate-50/70 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs">
          <span className="text-slate-500 font-medium">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded bg-white border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Prev
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const num = i + 1;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPage(num)}
                  className={`w-7 h-7 rounded font-bold transition-all ${
                    page === num
                      ? "bg-orange-600 text-white"
                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {num}
                </button>
              );
            })}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded bg-white border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* 5. MODAL: STOCK TRANSFER */}
      {transferProd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="p-4 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="text-purple-700" size={18} />
                <h3 className="font-bold text-purple-900 text-sm">
                  Stock Transfer: {transferProd.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTransferProd(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="p-5 flex flex-col gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Warehouse (Gudam)</span>
                  <span className="font-bold text-purple-800 text-sm">
                    {transferProd.gudamStock ?? 0} {unitLabel(transferProd)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Front Shop Counter</span>
                  <span className="font-bold text-sky-800 text-sm">
                    {transferProd.shopStock ?? transferProd.stock ?? 0} {unitLabel(transferProd)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Transfer From:</label>
                  <select
                    value={transferFrom}
                    onChange={(e) => setTransferFrom(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                  >
                    <option value="gudam">Warehouse (Gudam)</option>
                    <option value="shop">Front Shop</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Transfer To:</label>
                  <select
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                  >
                    <option value="shop">Front Shop</option>
                    <option value="gudam">Warehouse (Gudam)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Quantity ({unitLabel(transferProd)}):
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={transferQty}
                  onChange={(e) => setTransferQty(Math.max(1, parseFloat(e.target.value) || 0))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTransferProd(null)}
                  className="px-3.5 py-2 rounded-lg bg-white border border-slate-200 font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferring}
                  className="px-4 py-2 rounded-lg bg-orange-600 text-white font-bold hover:bg-orange-700 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {transferring ? <Loader2 size={14} className="animate-spin" /> : <ArrowLeftRight size={14} />}
                  <span>Transfer Stock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
