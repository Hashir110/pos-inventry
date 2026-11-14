"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Boxes,
  Filter,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "react-toastify";
import { useDialog } from "../../components/DialogProvider";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../store/useLanguage";
import { deleteProduct, listProducts, listStockTransfers, subscribeProducts, transferStock } from "../../lib/services/products";
import { listSupplierPurchases } from "../../lib/services/suppliers";
import { listRecentSales } from "../../lib/services/sales";
import { listReturns, type ReturnRecord } from "../../lib/services/returns";
import { isWithdrawalSale } from "../../lib/calc";
import { customerLabel } from "../../lib/format";
import type { Product, Sale, StockMovementRow, StockTransfer, SupplierPurchase } from "../../types";

export default function InventoryList() {
  const { confirm } = useDialog();
  const { currentUser } = useStore();
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const [transferProd, setTransferProd] = useState<Product | null>(null);
  const [transferQty, setTransferQty] = useState(1);
  const [transferFrom, setTransferFrom] = useState<"gudam" | "shop">("gudam");
  const [transferTo, setTransferTo] = useState<"gudam" | "shop">("shop");
  const [transferring, setTransferring] = useState(false);

  // Stock Movement History States
  const [purchases, setPurchases] = useState<SupplierPurchase[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [returnsList, setReturnsList] = useState<ReturnRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [movementFilter, setMovementFilter] = useState<"all" | "in" | "out" | "transfer">("all");
  const [movementSearch, setMovementSearch] = useState("");

  const fetchHistory = useCallback(async (force = false) => {
    if (!currentUser) return;
    setLoadingHistory(true);
    try {
      const [purData, salesData, trData, retData] = await Promise.all([
        listSupplierPurchases(currentUser.uid, force),
        listRecentSales(currentUser.uid, 500, force),
        listStockTransfers(currentUser.uid, 300),
        listReturns(currentUser.uid, 300),
      ]);
      setPurchases(purData);
      setSales(salesData);
      setTransfers(trData);
      setReturnsList(retData);
    } catch (err) {
      console.error("Failed to load stock movement history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Real-time synchronization so any inventory change updates instantly
  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    const unsubscribe = subscribeProducts(
      currentUser.uid,
      (items) => {
        setProducts(items);
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.error("Real-time products error:", error);
        setLoading(false);
        setRefreshing(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  const fetchProducts = useCallback(async (force = false) => {
    if (!currentUser) return;
    if (force) setRefreshing(true);
    try {
      const items = await listProducts(currentUser.uid, force);
      setProducts(items);
      if (force) toast.success("Inventory updated");

    } catch (error) {
      console.error("Error fetching inventory:", error);
      toast.error(t("inv_loadFailed"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser, t]);

  const handleDelete = async (product: Product) => {
    const ok = await confirm({
      title: t("inv_deleteTitle"),
      message: t("inv_deleteMessage", { name: product.name }),
      confirmLabel: t("delete"),
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteProduct(product.id, currentUser?.uid);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      toast.success(t("inv_deleted"));
    } catch (error) {
      console.error(error);
      toast.error(t("inv_deleteFailed"));
    }
  };


  const locationLabel = (loc: "gudam" | "shop") => (loc === "gudam" ? t("inv_warehouse") : t("inv_shop"));
  const unitLabel = (p: Product) => (p.unitType === "weight" ? t("inv_bags") : t("inv_pcs"));

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferProd) return;
    if (transferFrom === transferTo) {
      toast.warn(t("inv_selectDifferent"));
      return;
    }
    try {
      setTransferring(true);
      await transferStock(transferProd.id, Number(transferQty), transferFrom, transferTo, currentUser?.uid);
      toast.success(
        t("inv_transferred", { qty: transferQty, from: locationLabel(transferFrom), to: locationLabel(transferTo) })
      );
      setTransferProd(null);
      fetchProducts(true);
      fetchHistory(true);
    } catch (err: any) {
      toast.error(err.message || t("inv_transferFailed"));
    } finally {
      setTransferring(false);
    }
  };

  const counts = useMemo(
    () => ({
      all: products.length,
      warehouse: products.filter((p) => (p.gudamStock ?? 0) > 0).length,
      shop: products.filter((p) => (p.shopStock ?? p.stock ?? 0) > 0).length,
      low: products.filter((p) => p.stock > 0 && p.stock < 5).length,
      out: products.filter((p) => p.stock <= 0).length,
    }),
    [products]
  );

  // Dynamic category options from products and common grain/rice keywords
  const categoryOptions = useMemo(() => {
    const map = new Map<string, number>();

    // 1. Explicit categories
    products.forEach((p) => {
      const raw = p.category?.trim();
      if (raw) {
        const cat = raw.charAt(0).toUpperCase() + raw.slice(1);
        map.set(cat, (map.get(cat) || 0) + 1);
      }
    });

    // 2. Common keywords to automatically categorize rice & grain products
    const commonKeywords = [
      "Chawal",
      "Basmati",
      "Banaspati",
      "Tota",
      "Kainat",
      "Super Kernel",
      "Super",
      "Sella",
      "Daal",
      "Ghee",
      "Oil",
      "Sugar",
      "Atta",
    ];

    commonKeywords.forEach((kw) => {
      const kwLower = kw.toLowerCase();
      const count = products.filter((p) => {
        const inCat = p.category && p.category.toLowerCase().includes(kwLower);
        const inName = p.name.toLowerCase().includes(kwLower);
        return inCat || inName;
      }).length;

      if (count > 0 && !map.has(kw)) {
        map.set(kw, count);
      }
    });

    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return products.filter((p) => {
      if (term && !p.name.toLowerCase().includes(term)) return false;
      if (filter === "all") return true;
      if (filter === "warehouse") return (p.gudamStock ?? 0) > 0;
      if (filter === "shop") return (p.shopStock ?? p.stock ?? 0) > 0;
      if (filter === "low") return p.stock > 0 && p.stock < 5;
      if (filter === "out") return p.stock <= 0;
      if (filter.startsWith("cat:")) {
        const cat = filter.slice(4).toLowerCase();
        const inCat = Boolean(p.category && p.category.toLowerCase().includes(cat));
        const inName = p.name.toLowerCase().includes(cat);
        return inCat || inName;
      }
      return true;
    });
  }, [products, searchTerm, filter]);

  const stockMovements = useMemo<StockMovementRow[]>(() => {
    const list: StockMovementRow[] = [];

    // 1. Supplier Purchases (In)
    purchases.forEach((pur) => {
      (pur.items || []).forEach((item, idx) => {
        const prod = products.find(
          (p) =>
            p.id === item.productId ||
            p.name.trim().toLowerCase() === item.productName.trim().toLowerCase()
        );
        const unit = prod?.unitType === "weight" ? "Bags" : "Pcs";
        const totalWeight = item.totalWeight || (item.weight ? item.qty * item.weight : undefined);
        const dest = (item as any).destinationLocation || (item as any).destination || (pur as any).destination === "shop" ? "Shop" : "Gudam";
        list.push({
          id: `pur-${pur.id}-${idx}`,
          date: pur.date || (pur as any).createdAt || "",
          productId: item.productId,
          productName: item.productName,
          type: "in",
          subType: "purchase",
          qty: item.qty,
          unit,
          weight: totalWeight,
          rate: item.buyingPrice,
          total: item.total || item.qty * (item.buyingPrice || 0),
          partyName: pur.supplierName || "Supplier",
          reference: pur.billNo ? `#${pur.billNo}` : "Purchase Bill",
          location: dest,
        });
      });
    });

    // 2. Sales (Out)
    sales.forEach((sale) => {
      if (isWithdrawalSale(sale)) return;
      (sale.items || []).forEach((item, idx) => {
        if (item.id === "withdrawal") return;
        const prod = products.find(
          (p) =>
            p.id === (item.productId || item.id) ||
            p.name.trim().toLowerCase() === item.name.trim().toLowerCase()
        );
        const unit = item.type === "weight" || prod?.unitType === "weight" ? "Bags" : "Pcs";
        const bagWt = item.weightPerBag || prod?.weightPerBag || 25;
        const totalWeight = item.type === "weight" ? item.totalWeight ?? item.qty * bagWt : undefined;
        list.push({
          id: `sale-${sale.id}-${idx}`,
          date: sale.date || "",
          productId: item.productId || item.id,
          productName: item.name,
          type: "out",
          subType: "sale",
          qty: item.qty,
          unit,
          weight: totalWeight,
          rate: Number(item.price ?? item.sellingPrice ?? 0),
          total: item.total || item.qty * Number(item.price ?? item.sellingPrice ?? 0),
          partyName: customerLabel(sale.customerName),
          reference: sale.invoiceNo ? `#${sale.invoiceNo}` : "POS Invoice",
          location: "Shop",
        });
      });
    });

    // 3. Customer Returns (In)
    returnsList.forEach((ret) => {
      const prod = products.find(
        (p) =>
          p.id === ret.productId ||
          p.name.trim().toLowerCase() === ret.itemName.trim().toLowerCase()
      );
      const unit = prod?.unitType === "weight" ? "Bags" : "Pcs";
      list.push({
        id: `ret-${ret.id}`,
        date: ret.date || "",
        productId: ret.productId,
        productName: ret.itemName,
        type: "in",
        subType: "return",
        qty: ret.qty,
        unit,
        rate: ret.unitPrice,
        total: ret.refundAmount,
        partyName: "Customer Return",
        reference: "Return Slip",
        location: "Shop",
      });
    });

    // 4. Stock Transfers (Transfer)
    transfers.forEach((tr) => {
      const prod = products.find(
        (p) =>
          p.id === tr.productId ||
          p.name.trim().toLowerCase() === tr.productName.trim().toLowerCase()
      );
      const unit = prod?.unitType === "weight" ? "Bags" : "Pcs";
      const from = tr.fromLocation === "gudam" ? "Gudam" : "Shop";
      const to = tr.toLocation === "gudam" ? "Gudam" : "Shop";
      list.push({
        id: `tr-${tr.id}`,
        date: tr.date || "",
        productId: tr.productId,
        productName: tr.productName,
        type: "transfer",
        subType: "transfer",
        qty: tr.qty,
        unit,
        partyName: "Internal Transfer",
        reference: "Transfer",
        location: `${from} → ${to}`,
      });
    });

    return list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [products, purchases, sales, returnsList, transfers]);

  const filteredMovements = useMemo(() => {
    const term = movementSearch.trim().toLowerCase();
    return stockMovements.filter((m) => {
      if (movementFilter === "in" && m.type !== "in") return false;
      if (movementFilter === "out" && m.type !== "out") return false;
      if (movementFilter === "transfer" && m.type !== "transfer") return false;
      if (!term) return true;
      return (
        m.productName.toLowerCase().includes(term) ||
        (m.partyName && m.partyName.toLowerCase().includes(term)) ||
        (m.reference && m.reference.toLowerCase().includes(term)) ||
        (m.location && m.location.toLowerCase().includes(term))
      );
    });
  }, [stockMovements, movementFilter, movementSearch]);

  const movementStats = useMemo(() => {
    const totalIn = stockMovements.filter((m) => m.type === "in").reduce((sum, m) => sum + m.qty, 0);
    const totalOut = stockMovements.filter((m) => m.type === "out").reduce((sum, m) => sum + m.qty, 0);
    const totalTr = stockMovements.filter((m) => m.type === "transfer").reduce((sum, m) => sum + m.qty, 0);
    return { totalIn, totalOut, totalTr, totalCount: stockMovements.length };
  }, [stockMovements]);

  return (
    <div>
      <PageHeader
        title={t("inventoryManagement")}
        subtitle={t("inv_subtitle")}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchProducts(true);
                fetchHistory(true);
              }}
              disabled={refreshing}
              className="btn-secondary flex items-center gap-1.5"
              title="Refresh from server"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Link href="/dashboard/inventry/add" className="btn-primary">
              <Plus size={18} /> {t("addProductBtn")}
            </Link>
          </div>
        }
      />


      <DataTable
        data={filteredProducts}
        rowKey={(item) => item.id}
        loading={loading}
        emptyText={
          <div>
            <Package className="mx-auto mb-2 text-stone-300" size={36} />
            <p className="text-sm font-medium text-stone-400">{t("noItemsFound")}</p>
          </div>
        }
        toolbarLeft={
          <div className="flex flex-wrap items-center gap-2">
            {/* Category, Location & Stock Status Filter Dropdown */}
            <div className="relative inline-flex items-center">
              <Filter size={14} className="pointer-events-none absolute left-3 text-stone-500 z-10" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="cursor-pointer rounded-xl border border-stone-300 bg-white py-2 pl-8 text-xs font-bold text-stone-800 shadow-sm transition hover:border-brand-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <optgroup label="Locations & Stock Status">
                  <option value="all">All Items ({counts.all})</option>
                  <option value="warehouse">Warehouse / Gudam Stock ({counts.warehouse})</option>
                  <option value="shop">Shop Stock ({counts.shop})</option>
                  <option value="low">Low Stock &lt; 5 ({counts.low})</option>
                  <option value="out">Out of Stock ({counts.out})</option>
                </optgroup>
                {categoryOptions.length > 0 && (
                  <optgroup label="Categories">
                    {categoryOptions.map((cat) => (
                      <option key={cat.name} value={`cat:${cat.name}`}>
                        {cat.name} ({cat.count})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Quick Filter Pills */}
            <div className="flex flex-wrap items-center gap-1 rounded-xl bg-stone-100 p-1 text-xs">
              <button
                onClick={() => setFilter("all")}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  filter === "all" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"
                }`}
              >
                All <span className="text-[10px] opacity-75 font-normal">({counts.all})</span>
              </button>
              <button
                onClick={() => setFilter("warehouse")}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  filter === "warehouse" ? "bg-purple-600 text-white shadow-sm" : "text-stone-500 hover:text-stone-800"
                }`}
              >
                Warehouse <span className="text-[10px] opacity-80 font-normal">({counts.warehouse})</span>
              </button>
              <button
                onClick={() => setFilter("shop")}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  filter === "shop" ? "bg-blue-600 text-white shadow-sm" : "text-stone-500 hover:text-stone-800"
                }`}
              >
                Shop <span className="text-[10px] opacity-80 font-normal">({counts.shop})</span>
              </button>
              <button
                onClick={() => setFilter("low")}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  filter === "low" ? "bg-amber-500 text-white shadow-sm" : "text-stone-500 hover:text-stone-800"
                }`}
              >
                Low <span className="text-[10px] opacity-80 font-normal">({counts.low})</span>
              </button>
              <button
                onClick={() => setFilter("out")}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  filter === "out" ? "bg-rose-500 text-white shadow-sm" : "text-stone-500 hover:text-stone-800"
                }`}
              >
                Out <span className="text-[10px] opacity-80 font-normal">({counts.out})</span>
              </button>
              {filter.startsWith("cat:") && (
                <span className="flex items-center gap-1 rounded-lg bg-brand-500 px-2 py-1 text-xs font-bold text-white shadow-sm">
                  <span>{filter.slice(4)}</span>
                  <button
                    onClick={() => setFilter("all")}
                    className="hover:opacity-80 ml-0.5"
                    title="Clear category filter"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
            </div>
          </div>
        }
        toolbarRight={
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
            <input
              type="text"
              placeholder={t("searchItemsPlaceholder")}
              className="field pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        }
        columns={[
          { key: "name", header: t("productName"), cell: (item) => <span className="font-bold text-stone-900">{item.name}</span> },
          {
            key: "type",
            header: t("type"),
            cell: (item) => (
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  item.unitType === "weight" ? "bg-orange-100 text-orange-800" : "bg-sky-100 text-sky-800"
                }`}
              >
                {item.unitType === "weight"
                  ? item.weightPerBag === 50
                    ? t("inv_typeWeight50")
                    : t("inv_typeWeight")
                  : t("inv_typeCount")}
              </span>
            ),
          },
          { key: "buy", header: t("buyingPrice"), align: "right", cell: (item) => <span className="font-semibold text-stone-600">Rs. {item.buyingPrice ?? 0}</span> },
          { key: "sell", header: t("sellingPrice"), align: "right", cell: (item) => <span className="font-bold text-stone-900">Rs. {item.sellingPrice}</span> },
          {
            key: "gudam",
            header: t("inv_warehouseStock"),
            align: "center",
            cell: (item) => {
              const bagWt = item.weightPerBag || (item.unitType === "weight" ? 25 : 0);
              const totalKg = item.unitType === "weight" ? (item.gudamStock ?? 0) * bagWt : null;
              const isNeg = (item.gudamStock ?? 0) < 0;
              return (
                <div className="flex flex-col items-center">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold border ${
                    isNeg ? "bg-red-100 text-red-700 border-red-200" : "bg-purple-100 text-purple-800 border-purple-200"
                  }`}>
                    {item.gudamStock ?? 0} {unitLabel(item)}
                  </span>
                  {totalKg !== null && item.gudamStock !== 0 && (
                    <span className="text-[10px] font-bold text-stone-500 mt-0.5">
                      {totalKg.toLocaleString()} kg
                    </span>
                  )}
                </div>
              );
            },
          },
          {
            key: "shop",
            header: t("inv_shopStock"),
            align: "center",
            cell: (item) => {
              const bagWt = item.weightPerBag || (item.unitType === "weight" ? 25 : 0);
              const shopQty = item.shopStock ?? item.stock ?? 0;
              const totalKg = item.unitType === "weight" ? shopQty * bagWt : null;
              const isNeg = shopQty < 0;
              return (
                <div className="flex flex-col items-center">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold border ${
                    isNeg ? "bg-red-100 text-red-700 border-red-200" : "bg-blue-100 text-blue-800 border-blue-200"
                  }`}>
                    {shopQty} {unitLabel(item)}
                  </span>
                  {totalKg !== null && shopQty !== 0 && (
                    <span className="text-[10px] font-bold text-stone-500 mt-0.5">
                      {totalKg.toLocaleString()} kg
                    </span>
                  )}
                </div>
              );
            },
          },
          {
            key: "total",
            header: t("inv_totalStock"),
            align: "right",
            cell: (item) => {
              const unit = unitLabel(item);
              const out = item.stock <= 0;
              const low = !out && item.stock < 5;
              const bagWt = item.weightPerBag || (item.unitType === "weight" ? 25 : 0);
              const totalKg = item.unitType === "weight" ? (item.stock ?? 0) * bagWt : null;
              return (
                <div className="flex flex-col items-end">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      out ? "bg-red-100 text-red-700" : low ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {item.stock < 0 ? `${item.stock} ${unit}` : out ? t("outOfStock") : `${item.stock} ${unit}`}
                  </span>
                  {totalKg !== null && item.stock !== 0 && (
                    <span className="text-[10px] font-bold text-stone-500 mt-0.5">
                      {totalKg.toLocaleString()} kg
                    </span>
                  )}
                </div>
              );
            },
          },
          {
            key: "actions",
            header: t("action"),
            align: "right",
            cell: (item) => (
              <div className="flex justify-end gap-1">
                <button
                  onClick={() => setTransferProd(item)}
                  className="rounded-lg p-2 text-purple-600 hover:bg-purple-50"
                  title={t("inv_transferTooltip")}
                >
                  <ArrowLeftRight size={17} />
                </button>
                <Link
                  href={`/dashboard/inventry/edit/${item.id}`}
                  className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-brand-700"
                  title={t("edit")}
                >
                  <Pencil size={17} />
                </Link>
                <button
                  onClick={() => handleDelete(item)}
                  className="rounded-lg p-2 text-stone-500 hover:bg-red-50 hover:text-red-600"
                  title={t("delete")}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ),
          },
        ]}
      />

      {/* Stock Movement History Section */}
      <div className="mt-10 space-y-4 border-t-2 border-stone-200/80 pt-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700 shadow-sm border border-brand-100">
                <Boxes size={20} />
              </span>
              <div>
                <h2 className="text-lg font-black text-stone-900">
                  Stock Movement History
                </h2>
                <p className="text-xs font-semibold text-stone-500">
                  Track stock purchases, sales, returns, and warehouse transfers
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-sm">
              <ArrowDownLeft size={15} className="text-emerald-600" />
              <span>Total In: {movementStats.totalIn.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-800 shadow-sm">
              <ArrowUpRight size={15} className="text-rose-600" />
              <span>Total Out: {movementStats.totalOut.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-800 shadow-sm">
              <ArrowLeftRight size={15} className="text-purple-600" />
              <span>Transfers: {movementStats.totalTr.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <DataTable
          data={filteredMovements}
          rowKey={(m) => m.id}
          loading={loadingHistory}
          emptyText={
            <div className="py-6">
              <Package className="mx-auto mb-2 text-stone-300" size={36} />
              <p className="text-sm font-semibold text-stone-500">No stock movements found.</p>
              <p className="text-xs text-stone-400 mt-0.5">Purchases, sales, and transfers will automatically appear here.</p>
            </div>
          }
          paginate={filteredMovements.length > 15}
          toolbarLeft={
            <div className="flex flex-wrap gap-1 rounded-xl bg-stone-100 p-1">
              {[
                { key: "all", label: "All Movements", count: stockMovements.length },
                { key: "in", label: "Stock In", count: stockMovements.filter((m) => m.type === "in").length },
                { key: "out", label: "Stock Out", count: stockMovements.filter((m) => m.type === "out").length },
                { key: "transfer", label: "Transfers", count: stockMovements.filter((m) => m.type === "transfer").length },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setMovementFilter(tab.key as any)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    movementFilter === tab.key ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"
                  }`}
                >
                  {tab.label}
                  <span className={`rounded-full px-1.5 text-[10px] ${
                    movementFilter === tab.key ? "bg-brand-100 text-brand-700 font-extrabold" : "bg-stone-200 text-stone-600"
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          }
          toolbarRight={
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={15} />
              <input
                type="text"
                placeholder="Search product, bill, party..."
                className="field pl-9 !py-1.5 !text-xs font-medium"
                value={movementSearch}
                onChange={(e) => setMovementSearch(e.target.value)}
              />
            </div>
          }
          columns={[
            {
              key: "date",
              header: "Date & Time",
              className: "whitespace-nowrap",
              cell: (m) => (
                <div className="text-xs">
                  <p className="font-bold text-stone-800">
                    {m.date ? new Date(m.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </p>
                  <p className="text-[10px] text-stone-400">
                    {m.date ? new Date(m.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : ""}
                  </p>
                </div>
              ),
            },
            {
              key: "product",
              header: "Product",
              cell: (m) => (
                <div>
                  <span className="font-extrabold text-stone-900 text-xs block">{m.productName}</span>
                  {m.location && (
                    <span className="inline-block mt-0.5 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-600 border border-stone-200">
                      📍 {m.location}
                    </span>
                  )}
                </div>
              ),
            },
            {
              key: "type",
              header: "Movement Type",
              cell: (m) => {
                if (m.subType === "purchase") {
                  return (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-extrabold text-emerald-800 border border-emerald-200">
                      <ArrowDownLeft size={13} /> In (Purchase)
                    </span>
                  );
                }
                if (m.subType === "sale") {
                  return (
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-extrabold text-rose-800 border border-rose-200">
                      <ArrowUpRight size={13} /> Out (Sale)
                    </span>
                  );
                }
                if (m.subType === "return") {
                  return (
                    <span className="inline-flex items-center gap-1 rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-extrabold text-sky-800 border border-sky-200">
                      <RotateCcw size={13} /> Return (In)
                    </span>
                  );
                }
                return (
                  <span className="inline-flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-extrabold text-purple-800 border border-purple-200">
                    <ArrowLeftRight size={13} /> Transfer
                  </span>
                );
              },
            },
            {
              key: "qty",
              header: "Quantity",
              align: "right",
              cell: (m) => {
                const isIn = m.type === "in";
                const isOut = m.type === "out";
                return (
                  <div className="text-right">
                    <span
                      className={`font-mono text-xs font-black ${
                        isIn ? "text-emerald-700" : isOut ? "text-rose-600" : "text-purple-700"
                      }`}
                    >
                      {isIn ? "+ " : isOut ? "− " : ""}{m.qty.toLocaleString()} {m.unit || ""}
                    </span>
                    {m.weight !== undefined && m.weight > 0 && (
                      <p className="text-[10px] font-bold text-stone-500">
                        {m.weight.toLocaleString()} kg
                      </p>
                    )}
                  </div>
                );
              },
            },
            {
              key: "party",
              header: "Party / Reference",
              cell: (m) => (
                <div>
                  <p className="text-xs font-bold text-stone-800">{m.partyName || "—"}</p>
                  <p className="font-mono text-[10px] text-brand-700 font-bold">{m.reference || ""}</p>
                </div>
              ),
            },
            {
              key: "rate",
              header: "Rate / Value",
              align: "right",
              cell: (m) => (
                <div className="text-right">
                  {m.rate !== undefined && m.rate > 0 ? (
                    <>
                      <p className="font-mono text-xs font-bold text-stone-800">
                        Rs. {Math.round(m.rate).toLocaleString()}
                      </p>
                      {m.total !== undefined && m.total > 0 && (
                        <p className="text-[10px] text-stone-400 font-semibold">
                          Total: Rs. {Math.round(m.total).toLocaleString()}
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-stone-400">—</span>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>

      {transferProd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-pop w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-purple-50">
              <h3 className="font-extrabold text-purple-900 text-sm flex items-center gap-2">
                <ArrowLeftRight size={18} className="text-purple-600" /> {t("inv_stockTransfer")} ({transferProd.name})
              </h3>
              <button
                onClick={() => setTransferProd(null)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-200"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="p-5 space-y-4">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1">
                <p className="font-bold text-stone-800">{t("inv_availableBreakdown")}</p>
                <div className="flex justify-between text-stone-600">
                  <span>{t("inv_warehouseStock")}: <b className="text-purple-700">{transferProd.gudamStock ?? 0} {unitLabel(transferProd)}</b></span>
                  <span>{t("inv_shopStock")}: <b className="text-blue-700">{transferProd.shopStock ?? transferProd.stock ?? 0} {unitLabel(transferProd)}</b></span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">{t("inv_from")}</label>
                  <select
                    value={transferFrom}
                    onChange={(e) => {
                      const val = e.target.value as "gudam" | "shop";
                      setTransferFrom(val);
                      setTransferTo(val === "gudam" ? "shop" : "gudam");
                    }}
                    className="input-field"
                  >
                    <option value="gudam">{t("inv_warehouse")}</option>
                    <option value="shop">{t("inv_shop")}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">{t("inv_to")}</label>
                  <select
                    value={transferTo}
                    onChange={(e) => {
                      const val = e.target.value as "gudam" | "shop";
                      setTransferTo(val);
                      setTransferFrom(val === "gudam" ? "shop" : "gudam");
                    }}
                    className="input-field"
                  >
                    <option value="shop">{t("inv_shop")}</option>
                    <option value="gudam">{t("inv_warehouse")}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">{t("inv_transferQty")} *</label>
                <input
                  type="number"
                  min="1"
                  value={transferQty}
                  onChange={(e) => setTransferQty(Math.max(1, Number(e.target.value)))}
                  className="input-field text-base font-bold text-purple-900"
                  required
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setTransferProd(null)} className="btn-ghost flex-1 text-xs">
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={transferring}
                  className="btn-primary flex-1 text-xs font-bold !bg-purple-600 hover:!bg-purple-700 min-h-[38px] flex items-center justify-center"
                >
                  {transferring ? (
                    <Loader2 className="animate-spin text-white" size={16} />
                  ) : (
                    t("inv_confirmTransfer")
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
