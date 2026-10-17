"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import DataTable from "../../components/DataTable";
import { useStore } from "../../store/useStore";
import { subscribeProducts } from "../../lib/services/products";
import { subscribeCustomers } from "../../lib/services/customers";
import { issueGatePass, subscribeGatePasses } from "../../lib/services/gatePasses";
import type { Product, Customer, GatePass } from "../../types";
import {
  FileText,
  Plus,
  Printer,
  Search,
  CheckCircle2,
  Trash2,
  User,
  Package,
  X,
  History,
  Warehouse,
  ChevronDown,
  Check,
  Wallet,
  Loader2,
} from "lucide-react";
import { toast } from "react-toastify";
import PageHeader from "../../components/PageHeader";

interface PassItem {
  productId: string;
  productName: string;
  qty: number;
  weight: number;
  unit: string;
  maxGudamQty: number;
}

export default function GatePassPage() {
  const { currentShop } = useStore();
  const ownerId = currentShop?.uid || "";

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [gatePasses, setGatePasses] = useState<GatePass[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [stockSearch, setStockSearch] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState<PassItem[]>([]);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [itemQty, setItemQty] = useState<number | "">(1);
  const [itemWeight, setItemWeight] = useState<number | "">(25);

  const [isPartyOpen, setIsPartyOpen] = useState(false);
  const [partySearch, setPartySearch] = useState("");
  const partyDropdownRef = useRef<HTMLDivElement>(null);

  const [isProductOpen, setIsProductOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const productDropdownRef = useRef<HTMLDivElement>(null);

  const [printPass, setPrintPass] = useState<GatePass | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!ownerId) return;

    const unsubProd = subscribeProducts(ownerId, setProducts);
    const unsubCust = subscribeCustomers(ownerId, setCustomers);
    const unsubPass = subscribeGatePasses(ownerId, setGatePasses);

    return () => {
      unsubProd();
      unsubCust();
      unsubPass();
    };
  }, [ownerId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        partyDropdownRef.current &&
        !partyDropdownRef.current.contains(e.target as Node)
      ) {
        setIsPartyOpen(false);
      }
      if (
        productDropdownRef.current &&
        !productDropdownRef.current.contains(e.target as Node)
      ) {
        setIsProductOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId) || null,
    [customers, customerId]
  );

  const filteredCustomers = useMemo(() => {
    const term = partySearch.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.phone && c.phone.includes(term))
    );
  }, [customers, partySearch]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );

  const filteredDropdownProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.category && p.category.toLowerCase().includes(term))
    );
  }, [products, productSearch]);

  const handleProductSelect = (prodId: string) => {
    setSelectedProductId(prodId);
    setIsProductOpen(false);
    setProductSearch("");
    const prod = products.find((p) => p.id === prodId);
    if (!prod) {
      setItemQty(1);
      setItemWeight(25);
      return;
    }
    const isWeight = prod.unitType === "weight";
    setItemQty(1);
    setItemWeight(isWeight ? 25 : 0);
  };

  const handleQtyChange = (qtyVal: number) => {
    const q = isNaN(qtyVal) || qtyVal < 1 ? 1 : qtyVal;
    setItemQty(q);
    if (selectedProduct?.unitType === "weight") {
      setItemWeight(q * 25);
    }
  };

  const handleAddItem = () => {
    if (!selectedProductId || !selectedProduct) {
      toast.warn("Item / Product select karein");
      return;
    }

    const gudamStock = selectedProduct.gudamStock ?? 0;
    if (gudamStock <= 0) {
      toast.error(`"${selectedProduct.name}" ka Gudam mein stock 0 hai!`);
      return;
    }

    const qty = Number(itemQty) || 1;
    if (qty <= 0) {
      toast.warn("Sahi quantity likhein");
      return;
    }

    const isWeight = selectedProduct.unitType === "weight";
    const weight = isWeight ? Number(itemWeight) || qty * 25 : 0;

    const deductAmount = qty;
    if (deductAmount > gudamStock) {
      toast.warn(
        `Gudam mein sirf ${gudamStock} ${isWeight ? "KG" : "Bags"} available hain!`
      );
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        qty,
        weight,
        unit: isWeight ? "KG" : "Bags/Pcs",
        maxGudamQty: gudamStock,
      },
    ]);

    setSelectedProductId("");
    setItemQty(1);
    setItemWeight(25);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateGatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalPartyName = customerName.trim();
    if (!finalPartyName) {
      toast.warn("Party / Customer select karein");
      return;
    }
    if (items.length === 0) {
      toast.warn("Maal / Item add karein");
      return;
    }

    setSubmitting(true);
    try {
      const created = await issueGatePass(ownerId, {
        customerName: finalPartyName,
        ...(customerId ? { customerId } : {}),
        items: items.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          qty: i.qty,
          weight: i.weight || 0,
          unit: i.unit || "",
        })),
      });

      toast.success(`Gate Pass #${created.gatePassNo} save ho gaya!`);

      setCustomerName("");
      setCustomerId("");
      setItems([]);
      setSelectedProductId("");
      setItemQty(1);
      setItemWeight(25);
    } catch (err: any) {
      toast.error(err.message || "Failed to issue gate pass");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStockProducts = useMemo(() => {
    const term = stockSearch.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.category && p.category.toLowerCase().includes(term))
    );
  }, [products, stockSearch]);

  const filteredPasses = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return gatePasses;
    return gatePasses.filter(
      (gp) =>
        gp.gatePassNo.toLowerCase().includes(term) ||
        gp.customerName.toLowerCase().includes(term)
    );
  }, [gatePasses, searchTerm]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gate Pass"
        subtitle="Gudam se party ko maal dispatch karne ke liye entry karein aur stock maintain karein"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleCreateGatePass} className="space-y-6">
              <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-white">
                  <h5 className="flex items-center gap-2 text-sm font-bold text-stone-800">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-brand-500 text-brand-600 text-xs font-bold">
                      <User size={12} />
                    </span>
                    <span>Party & Maal Details</span>
                  </h5>
                </div>

                <div className="p-6 space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">
                      Party / Customer Name <span className="text-red-500">*</span>
                    </label>

                    <div className="relative w-full" ref={partyDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsPartyOpen((prev) => !prev)}
                          className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white rounded-xl border border-stone-300 text-left transition shadow-sm hover:border-brand-400 focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <User
                              size={16}
                              className={
                                selectedCustomer ? "text-brand-600 shrink-0" : "text-stone-400 shrink-0"
                              }
                            />
                            <div className="truncate">
                              {selectedCustomer ? (
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-stone-900 truncate">
                                    {selectedCustomer.name}
                                  </span>
                                  {selectedCustomer.phone && (
                                    <span className="text-[11px] text-stone-400 tabular shrink-0">
                                      ({selectedCustomer.phone})
                                    </span>
                                  )}
                                  {selectedCustomer.balance > 0 ? (
                                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">
                                      Due: Rs. {Math.round(selectedCustomer.balance).toLocaleString()}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">
                                      Rs. 0
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs font-medium text-stone-400">
                                  Party chunein
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {selectedCustomer && (
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCustomerId("");
                                  setCustomerName("");
                                }}
                                className="p-1 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-100"
                                title="Clear Selection"
                              >
                                <X size={14} />
                              </span>
                            )}
                            <ChevronDown
                              size={16}
                              className={`text-stone-400 transition-transform ${isPartyOpen ? "rotate-180" : ""
                                }`}
                            />
                          </div>
                        </button>

                        {isPartyOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-xl border border-stone-200 shadow-xl overflow-hidden">
                            <div className="p-2.5 border-b border-stone-100 bg-stone-50/80">
                              <div className="relative">
                                <Search
                                  size={14}
                                  className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                                />
                                <input
                                  type="text"
                                  autoFocus
                                  value={partySearch}
                                  onChange={(e) => setPartySearch(e.target.value)}
                                  placeholder="Party ya phone search karein"
                                  className="w-full pl-8 pr-7 py-2 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                                />
                                {partySearch && (
                                  <button
                                    type="button"
                                    onClick={() => setPartySearch("")}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                                  >
                                    <X size={13} />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="max-h-56 overflow-y-auto divide-y divide-stone-50">
                              {filteredCustomers.length === 0 ? (
                                <div className="p-5 text-center text-stone-400 text-xs">
                                  <p>Koi party nahi mili {partySearch ? `"${partySearch}"` : ""}</p>
                                </div>
                              ) : (
                                filteredCustomers.map((c) => {
                                  const isSelected = c.id === customerId;
                                  return (
                                    <button
                                      key={c.id}
                                      type="button"
                                      onClick={() => {
                                        setCustomerId(c.id);
                                        setCustomerName(c.name);
                                        setIsPartyOpen(false);
                                        setPartySearch("");
                                      }}
                                      className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between text-xs transition ${isSelected
                                          ? "bg-brand-50 text-brand-900 font-bold"
                                          : "hover:bg-stone-50 text-stone-800"
                                        }`}
                                    >
                                      <div className="min-w-0 pr-2">
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold truncate">{c.name}</span>
                                          {c.phone && (
                                            <span className="text-[11px] text-stone-400 tabular shrink-0">
                                              ({c.phone})
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0">
                                        {c.balance > 0 ? (
                                          <span className="text-[10px] font-bold tabular text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <Wallet size={10} />
                                            Rs. {Math.round(c.balance).toLocaleString()}
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                            Rs. 0
                                          </span>
                                        )}
                                        {isSelected && <Check size={14} className="text-brand-600" />}
                                      </div>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                  </div>

                  <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-stone-700 uppercase tracking-wider">
                      <Package size={15} className="text-brand-600" />
                      <span>Dispatch Item Entry</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-6">
                        <label className="block text-[11px] font-bold text-stone-600 mb-1">
                          Item / Product <span className="text-red-500">*</span>
                        </label>
                        <div className="relative w-full" ref={productDropdownRef}>
                          <button
                            type="button"
                            onClick={() => setIsProductOpen((prev) => !prev)}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white rounded-xl border border-stone-300 text-left transition shadow-sm hover:border-brand-400 focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Package
                                size={15}
                                className={
                                  selectedProduct ? "text-brand-600 shrink-0" : "text-stone-400 shrink-0"
                                }
                              />
                              <div className="truncate">
                                {selectedProduct ? (
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-xs text-stone-900 truncate">
                                      {selectedProduct.name}
                                    </span>
                                    <span
                                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 tabular ${(selectedProduct.gudamStock ?? 0) > 0
                                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                          : "bg-red-50 text-red-700 border border-red-200"
                                        }`}
                                    >
                                      Gudam: {selectedProduct.gudamStock ?? 0}{" "}
                                      {selectedProduct.unitType === "weight" ? "KG" : "Bags"}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-xs font-medium text-stone-400">
                                    Item chunein
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {selectedProduct && (
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedProductId("");
                                    setItemQty(1);
                                    setItemWeight(25);
                                  }}
                                  className="p-1 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-100"
                                  title="Clear Selection"
                                >
                                  <X size={13} />
                                </span>
                              )}
                              <ChevronDown
                                size={15}
                                className={`text-stone-400 transition-transform ${isProductOpen ? "rotate-180" : ""
                                  }`}
                              />
                            </div>
                          </button>

                          {isProductOpen && (
                            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-xl border border-stone-200 shadow-xl overflow-hidden">
                              <div className="p-2 border-b border-stone-100 bg-stone-50/80">
                                <div className="relative">
                                  <Search
                                    size={13}
                                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400"
                                  />
                                  <input
                                    type="text"
                                    autoFocus
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    placeholder="Item search karein"
                                    className="w-full pl-7 pr-7 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                                  />
                                  {productSearch && (
                                    <button
                                      type="button"
                                      onClick={() => setProductSearch("")}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                                    >
                                      <X size={12} />
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="max-h-56 overflow-y-auto divide-y divide-stone-50">
                                {filteredDropdownProducts.length === 0 ? (
                                  <div className="p-4 text-center text-stone-400 text-xs">
                                    <p>Koi product nahi mila {productSearch ? `"${productSearch}"` : ""}</p>
                                  </div>
                                ) : (
                                  filteredDropdownProducts.map((p) => {
                                    const isSelected = p.id === selectedProductId;
                                    const stock = p.gudamStock ?? 0;
                                    const isWt = p.unitType === "weight";
                                    const isAvailable = stock > 0;
                                    return (
                                      <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => handleProductSelect(p.id)}
                                        className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs transition ${isSelected
                                            ? "bg-brand-50 text-brand-900 font-bold"
                                            : "hover:bg-stone-50 text-stone-800"
                                          }`}
                                      >
                                        <div className="min-w-0 pr-2">
                                          <p className="font-bold truncate">{p.name}</p>
                                          <p className="text-[10px] text-stone-400">
                                            {p.category || "General"}
                                          </p>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                          <span
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold tabular ${isAvailable
                                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                : "bg-red-50 text-red-700 border border-red-200"
                                              }`}
                                          >
                                            Gudam: {stock} {isWt ? "KG" : "Bags"}
                                          </span>
                                          {isSelected && (
                                            <Check size={14} className="text-brand-600" />
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-bold text-stone-600 mb-1">
                          Qty (Bags) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={itemQty}
                          onChange={(e) => handleQtyChange(Number(e.target.value))}
                          className="field w-full text-xs font-bold tabular !py-2"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-bold text-stone-600 mb-1">
                          Total Wt (KG)
                        </label>
                        <input
                          type="number"
                          step="any"
                          placeholder="Weight"
                          value={itemWeight}
                          onChange={(e) => setItemWeight(Number(e.target.value))}
                          disabled={selectedProduct?.unitType === "count"}
                          className="field w-full text-xs font-bold tabular !py-2 disabled:bg-stone-100 disabled:text-stone-400"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="btn-primary !py-2 !px-4 text-xs font-bold flex items-center gap-1.5"
                      >
                        <Plus size={15} /> Item Add Karein
                      </button>
                    </div>
                  </div>

                  {items.length > 0 && (
                    <div className="overflow-hidden border border-stone-200 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-stone-100 text-stone-700 uppercase font-bold border-b border-stone-200">
                          <tr>
                            <th className="p-3 text-center">#</th>
                            <th className="p-3">Item Name</th>
                            <th className="p-3 text-center">Qty (Bags)</th>
                            <th className="p-3 text-center">Total Weight</th>
                            <th className="p-3 text-right">Gudam Stock</th>
                            <th className="p-3 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {items.map((it, idx) => (
                            <tr key={idx} className="hover:bg-stone-50">
                              <td className="p-3 text-center font-bold text-stone-400">{idx + 1}</td>
                              <td className="p-3 font-bold text-stone-900">{it.productName}</td>
                              <td className="p-3 text-center font-bold text-stone-800 tabular">
                                {String(it.qty).padStart(2, "0")} Bags
                              </td>
                              <td className="p-3 text-center font-extrabold text-brand-700 tabular">
                                {it.weight > 0 ? `${it.weight} kg` : "—"}
                              </td>
                              <td className="p-3 text-right text-stone-500 tabular">
                                {it.maxGudamQty} left
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                                  title="Item Delete"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting || items.length === 0}
                      className="btn-primary w-full !py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 min-h-[46px]"
                    >
                      {submitting ? (
                        <Loader2 size={20} className="animate-spin text-white" />
                      ) : (
                        <>
                          <CheckCircle2 size={18} />
                          <span>Gate Pass Save Karein</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-stone-200 bg-white flex items-center justify-between">
                <h5 className="flex items-center gap-2 text-xs font-bold text-stone-800 uppercase tracking-wider">
                  <Warehouse size={15} className="text-brand-600" />
                  <span>Gudam Stock Summary</span>
                </h5>
                <span className="text-[11px] font-bold text-stone-400">
                  {products.length} Products
                </span>
              </div>

              <div className="p-3 border-b border-stone-100 bg-stone-50/60">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Item search karein"
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    className="field w-full pl-8 !py-1.5 text-xs"
                  />
                  <Search className="absolute left-2.5 top-2 text-stone-400" size={13} />
                </div>
              </div>

              <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto divide-y divide-stone-50">
                {filteredStockProducts.length === 0 ? (
                  <p className="p-6 text-center text-xs text-stone-400">Koi item nahi mila</p>
                ) : (
                  filteredStockProducts.map((p) => {
                    const stock = p.gudamStock ?? 0;
                    const isWt = p.unitType === "weight";
                    const isAvailable = stock > 0;
                    return (
                      <div
                        key={p.id}
                        className="pt-2 first:pt-0 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-stone-900 truncate">{p.name}</p>
                          <p className="text-[10px] text-stone-400">
                            {p.category || "General"}
                          </p>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0 tabular ${isAvailable
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                            }`}
                        >
                          {stock} {isWt ? "KG" : "Bags"}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        <DataTable
          data={filteredPasses}
          rowKey={(gp) => gp.id}
          emptyText="Koi Gate Pass record nahi mila"
          toolbarLeft={
            <h5 className="text-sm font-bold text-stone-800 uppercase tracking-wider flex items-center gap-2">
              <History size={16} className="text-brand-600" />
              <span>Issued Gate Passes History</span>
            </h5>
          }
          toolbarRight={
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="Gate pass # ya party"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="field w-full pl-8 !py-1.5 text-xs"
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" size={14} />
            </div>
          }
          columns={[
            { key: "no", header: "Gate Pass #", cell: (gp) => <span className="font-extrabold text-brand-700 font-mono">{gp.gatePassNo}</span> },
            {
              key: "date",
              header: "Date",
              className: "whitespace-nowrap",
              cell: (gp) => (
                <span className="text-stone-600">
                  {new Date(gp.date).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              ),
            },
            { key: "party", header: "Party Name", cell: (gp) => <span className="font-bold text-stone-900">{gp.customerName}</span> },
            {
              key: "items",
              header: "Items & Weight",
              cell: (gp) => (
                <span className="font-medium text-stone-700">
                  {gp.items
                    .map((i) =>
                      i.weight && i.weight > 0
                        ? `${i.productName} (${i.qty} Bags • ${i.weight}kg)`
                        : `${i.productName} (${i.qty} ${i.unit || "Bags"})`
                    )
                    .join(", ")}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              align: "center",
              cell: (gp) => <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">{gp.status}</span>,
            },
            {
              key: "slip",
              header: "Slip",
              align: "right",
              cell: (gp) => (
                <button onClick={() => setPrintPass(gp)} className="btn-ghost !py-1 !px-2.5 text-xs inline-flex items-center gap-1.5">
                  <Printer size={13} /> Parchi
                </button>
              ),
            },
          ]}
        />

      {printPass && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-pop w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-stone-50">
              <div className="flex items-center gap-2">
                <Printer size={16} className="text-brand-600" />
                <h3 className="font-bold text-stone-900 text-sm">
                  Gate Pass #{printPass.gatePassNo}
                </h3>
              </div>
              <button
                onClick={() => setPrintPass(null)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-white">
              <div className="text-center border-b border-stone-200 pb-3 mb-3">
                <h2 className="font-extrabold text-base text-stone-900 uppercase">
                  {currentShop?.shopName || "GUDAM DISPATCH SLIP"}
                </h2>
                <p className="text-[11px] text-stone-500 font-bold uppercase tracking-widest mt-0.5">
                  Gate Pass
                </p>
                <p className="text-[11px] text-stone-400 mt-1 font-mono">
                  #{printPass.gatePassNo} • {new Date(printPass.date).toLocaleDateString()}
                </p>
              </div>

              <div className="space-y-1 mb-4 text-xs text-stone-700">
                <p>
                  <span className="font-bold text-stone-900">Party:</span> {printPass.customerName}
                </p>
              </div>

              <table className="w-full text-left text-xs border-t border-b border-stone-200 my-3">
                <thead>
                  <tr className="border-b border-stone-200 font-bold text-stone-700">
                    <th className="py-2">Item</th>
                    <th className="py-2 text-center">Bags</th>
                    <th className="py-2 text-right">Total Wt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {printPass.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2 font-bold text-stone-900">{it.productName}</td>
                      <td className="py-2 text-center text-stone-800 font-semibold">
                        {it.qty} Bags
                      </td>
                      <td className="py-2 text-right font-extrabold text-stone-900">
                        {it.weight ? `${it.weight} kg` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="grid grid-cols-2 gap-4 mt-8 text-center text-[10px] text-stone-400 pt-3 border-t border-dashed border-stone-200">
                <div>
                  <div className="border-b border-stone-300 h-6 mb-1"></div>
                  <span>Gudam Incharge</span>
                </div>
                <div>
                  <div className="border-b border-stone-300 h-6 mb-1"></div>
                  <span>Receiver / Party</span>
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-stone-200 bg-stone-50 flex justify-end gap-2">
              <button onClick={() => setPrintPass(null)} className="btn-ghost !py-2 text-xs">
                Band Karein
              </button>
              <button
                onClick={() => window.print()}
                className="btn-primary !py-2 text-xs font-bold flex items-center gap-1.5"
              >
                <Printer size={14} /> Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
