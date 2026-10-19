"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, Package, Pencil, Plus, RefreshCw, Search, Trash2, X, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { useDialog } from "../../components/DialogProvider";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../store/useLanguage";
import { deleteProduct, listProducts, transferStock } from "../../lib/services/products";
import type { Product } from "../../types";

type StockFilter = "all" | "low" | "out";

export default function InventoryList() {
  const { confirm } = useDialog();
  const { currentUser } = useStore();
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<StockFilter>("all");

  const [transferProd, setTransferProd] = useState<Product | null>(null);
  const [transferQty, setTransferQty] = useState(1);
  const [transferFrom, setTransferFrom] = useState<"gudam" | "shop">("gudam");
  const [transferTo, setTransferTo] = useState<"gudam" | "shop">("shop");
  const [transferring, setTransferring] = useState(false);

  const fetchProducts = useCallback(async (force = false) => {
    if (!currentUser) return;
    if (force) setRefreshing(true);
    try {
      setProducts(await listProducts(currentUser.uid, force));
      if (force) toast.success("Inventory updated");

    } catch (error) {
      console.error("Error fetching inventory:", error);
      toast.error(t("inv_loadFailed"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser, t]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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
      await transferStock(transferProd.id, Number(transferQty), transferFrom, transferTo);
      toast.success(
        t("inv_transferred", { qty: transferQty, from: locationLabel(transferFrom), to: locationLabel(transferTo) })
      );
      setTransferProd(null);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || t("inv_transferFailed"));
    } finally {
      setTransferring(false);
    }
  };

  const counts = useMemo(
    () => ({
      all: products.length,
      low: products.filter((p) => p.stock > 0 && p.stock < 5).length,
      out: products.filter((p) => p.stock <= 0).length,
    }),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return products.filter((p) => {
      if (!p.name.toLowerCase().includes(term)) return false;
      if (filter === "low") return p.stock > 0 && p.stock < 5;
      if (filter === "out") return p.stock <= 0;
      return true;
    });
  }, [products, searchTerm, filter]);

  const tabs: { key: StockFilter; label: string }[] = [
    { key: "all", label: t("all") },
    { key: "low", label: t("lowStock") },
    { key: "out", label: t("outOfStock") },
  ];

  return (
    <div>
      <PageHeader
        title={t("inventoryManagement")}
        subtitle={t("inv_subtitle")}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchProducts(true)}
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
          <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-bold transition ${
                  filter === tab.key ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-full px-1.5 text-xs ${
                    filter === tab.key ? "bg-brand-100 text-brand-700" : "bg-stone-200 text-stone-500"
                  }`}
                >
                  {counts[tab.key]}
                </span>
              </button>
            ))}
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
                {item.unitType === "weight" ? t("inv_typeWeight") : t("inv_typeCount")}
              </span>
            ),
          },
          { key: "sell", header: t("sellingPrice"), align: "right", cell: (item) => <span className="font-bold text-stone-900">Rs. {item.sellingPrice}</span> },
          {
            key: "gudam",
            header: t("inv_warehouseStock"),
            align: "center",
            cell: (item) => (
              <span className="rounded-full px-2.5 py-1 text-xs font-extrabold bg-purple-100 text-purple-800 border border-purple-200">
                {item.gudamStock ?? 0} {unitLabel(item)}
              </span>
            ),
          },
          {
            key: "shop",
            header: t("inv_shopStock"),
            align: "center",
            cell: (item) => (
              <span className="rounded-full px-2.5 py-1 text-xs font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                {item.shopStock ?? item.stock ?? 0} {unitLabel(item)}
              </span>
            ),
          },
          {
            key: "total",
            header: t("inv_totalStock"),
            align: "right",
            cell: (item) => {
              const unit = unitLabel(item);
              const out = item.stock <= 0;
              const low = !out && item.stock < 5;
              return (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    out ? "bg-red-100 text-red-700" : low ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {out ? t("outOfStock") : `${item.stock} ${unit}`}
                </span>
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
