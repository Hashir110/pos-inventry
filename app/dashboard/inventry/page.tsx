"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, Package, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "react-toastify";
import PageHeader from "../../components/PageHeader";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../store/useLanguage";
import { deleteProduct, listProducts, transferStock } from "../../lib/services/products";
import type { Product } from "../../types";

type StockFilter = "all" | "low" | "out";

export default function InventoryList() {
  const { currentUser } = useStore();
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<StockFilter>("all");

  // Transfer Stock Modal State
  const [transferProd, setTransferProd] = useState<Product | null>(null);
  const [transferQty, setTransferQty] = useState(1);
  const [transferFrom, setTransferFrom] = useState<"gudam" | "shop">("gudam");
  const [transferTo, setTransferTo] = useState<"gudam" | "shop">("shop");

  const fetchProducts = useCallback(async () => {
    if (!currentUser) return;
    try {
      setProducts(await listProducts(currentUser.uid));
    } catch (error) {
      console.error("Error fetching inventory:", error);
      toast.error("Inventory load nahi hui");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleDelete = async (product: Product) => {
    if (!confirm(`"${product.name}" delete karna hai?`)) return;
    try {
      await deleteProduct(product.id);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      toast.success("Delete ho gaya");
    } catch (error) {
      console.error(error);
      toast.error("Delete nahi hua");
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferProd) return;
    if (transferFrom === transferTo) {
      toast.warn("Different source aur destination select karein");
      return;
    }
    try {
      await transferStock(transferProd.id, Number(transferQty), transferFrom, transferTo);
      toast.success(
        `${transferQty} units ${transferFrom.toUpperCase()} se ${transferTo.toUpperCase()} transfer ho gaye!`
      );
      setTransferProd(null);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || "Transfer failed");
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
        subtitle="Gudam & Dukan Stock Manage & Transfer Karein"
        actions={
          <Link href="/dashboard/inventry/add" className="btn-primary">
            <Plus size={18} /> {t("addProductBtn")}
          </Link>
        }
      />

      <div className="card overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-stone-200 p-4 md:flex-row md:items-center md:justify-between">
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
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 font-bold uppercase text-xs">
              <tr>
                <th className="p-4">{t("productName")}</th>
                <th className="p-4">{t("type")}</th>
                <th className="p-4 text-right">{t("buyingPrice")}</th>
                <th className="p-4 text-right">{t("sellingPrice")}</th>
                <th className="p-4 text-center">Gudam Stock</th>
                <th className="p-4 text-center">Dukan Stock</th>
                <th className="p-4 text-right">Total Stock</th>
                <th className="p-4 text-right">{t("action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-stone-400">
                    {t("loading")}
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <Package className="mx-auto mb-2 text-stone-300" size={36} />
                    <p className="text-sm font-medium text-stone-400">{t("noItemsFound")}</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((item) => {
                  const unit = item.unitType === "weight" ? "kg" : "pcs";
                  const gudam = item.gudamStock ?? 0;
                  const shop = item.shopStock ?? item.stock ?? 0;
                  const total = item.stock;
                  const out = total <= 0;
                  const low = !out && total < 5;

                  return (
                    <tr key={item.id} className="hover:bg-stone-50">
                      <td className="p-4 font-bold text-stone-900">{item.name}</td>
                      <td className="p-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            item.unitType === "weight" ? "bg-orange-100 text-orange-800" : "bg-sky-100 text-sky-800"
                          }`}
                        >
                          {item.unitType === "weight" ? "Weight (kg)" : "Count (pcs)"}
                        </span>
                      </td>
                      <td className="p-4 text-right text-stone-500">Rs. {item.buyingPrice}</td>
                      <td className="p-4 text-right font-bold text-stone-900">Rs. {item.sellingPrice}</td>
                      
                      {/* Gudam Stock Badge */}
                      <td className="p-4 text-center">
                        <span className="rounded-full px-2.5 py-1 text-xs font-extrabold bg-purple-100 text-purple-800 border border-purple-200">
                          {gudam} {unit}
                        </span>
                      </td>

                      {/* Shop Stock Badge */}
                      <td className="p-4 text-center">
                        <span className="rounded-full px-2.5 py-1 text-xs font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                          {shop} {unit}
                        </span>
                      </td>

                      {/* Total Stock Badge */}
                      <td className="p-4 text-right">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            out
                              ? "bg-red-100 text-red-700"
                              : low
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {out ? t("outOfStock") : `${total} ${unit}`}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setTransferProd(item)}
                            className="rounded-lg p-2 text-purple-600 hover:bg-purple-50"
                            title="Gudam <-> Dukan Transfer"
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
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Transfer Modal */}
      {transferProd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-pop w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-purple-50">
              <h3 className="font-extrabold text-purple-900 text-sm flex items-center gap-2">
                <ArrowLeftRight size={18} className="text-purple-600" /> Stock Transfer ({transferProd.name})
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
                <p className="font-bold text-stone-800">Available Stock Breakdown:</p>
                <div className="flex justify-between text-stone-600">
                  <span>Gudam Stock: <b className="text-purple-700">{transferProd.gudamStock ?? 0}</b></span>
                  <span>Dukan Stock: <b className="text-blue-700">{transferProd.shopStock ?? transferProd.stock ?? 0}</b></span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">From (Kahan Se)</label>
                  <select
                    value={transferFrom}
                    onChange={(e) => {
                      const val = e.target.value as "gudam" | "shop";
                      setTransferFrom(val);
                      setTransferTo(val === "gudam" ? "shop" : "gudam");
                    }}
                    className="input-field"
                  >
                    <option value="gudam">Gudam</option>
                    <option value="shop">Dukan</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">To (Kahan Tak)</label>
                  <select
                    value={transferTo}
                    onChange={(e) => {
                      const val = e.target.value as "gudam" | "shop";
                      setTransferTo(val);
                      setTransferFrom(val === "gudam" ? "shop" : "gudam");
                    }}
                    className="input-field"
                  >
                    <option value="shop">Dukan</option>
                    <option value="gudam">Gudam</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Transfer Quantity *</label>
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
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1 text-xs font-bold !bg-purple-600 hover:!bg-purple-700">
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
