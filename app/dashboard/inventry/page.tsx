"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import PageHeader from "../../components/PageHeader";
import { useStore } from "../../store/useStore";
import { deleteProduct, listProducts } from "../../lib/services/products";
import type { Product } from "../../types";

type StockFilter = "all" | "low" | "out";

export default function InventoryList() {
  const { currentUser } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<StockFilter>("all");

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
    { key: "all", label: "Sab" },
    { key: "low", label: "Kam stock" },
    { key: "out", label: "Khatam" },
  ];

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Products, qeemat aur stock"
        actions={
          <Link href="/dashboard/inventry/add" className="btn-primary">
            <Plus size={18} /> Naya Product
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
              placeholder="Product dhoondein..."
              className="field pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200">
              <tr>
                <th className="p-4">Product</th>
                <th className="p-4">Type</th>
                <th className="p-4 text-right">Khareed</th>
                <th className="p-4 text-right">Bikri</th>
                <th className="p-4 text-right">Stock</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-stone-400">
                    Loading Inventory...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <Package className="mx-auto mb-2 text-stone-300" size={36} />
                    <p className="text-sm font-medium text-stone-400">Koi product nahi mila</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((item) => {
                  const unit = item.unitType === "weight" ? "kg" : "pcs";
                  const out = item.stock <= 0;
                  const low = !out && item.stock < 5;
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
                          {out ? "Khatam" : `${item.stock} ${unit}`}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-1">
                          <Link
                            href={`/dashboard/inventry/edit/${item.id}`}
                            className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-brand-700"
                            title="Edit"
                          >
                            <Pencil size={17} />
                          </Link>
                          <button
                            onClick={() => handleDelete(item)}
                            className="rounded-lg p-2 text-stone-500 hover:bg-red-50 hover:text-red-600"
                            title="Delete"
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
    </div>
  );
}
