"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import DataTable from "../../components/DataTable";
import { useStore } from "../../store/useStore";
import { subscribeProducts } from "../../lib/services/products";
import { subscribeCustomers } from "../../lib/services/customers";
import { deleteGatePass, issueGatePass, subscribeGatePasses, updateGatePass } from "../../lib/services/gatePasses";
import type { Product, Customer, GatePass } from "../../types";
import {
  FileText,
  Plus,
  Printer,
  Pencil,
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
import { useLanguage } from "../../store/useLanguage";
import AddPartyModal from "../../components/AddPartyModal";

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
  const { t } = useLanguage();
  const ownerId = currentShop?.uid || "";
  const unitLabel = (isWt: boolean) => (isWt ? "KG" : t("gatePass_unitBags"));
  const storedUnitLabel = (unit?: string) =>
    !unit || unit === "Bags"
      ? t("gatePass_unitBags")
      : unit === "Bags/Pcs"
        ? t("gatePass_unitBagsPcs")
        : unit;

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
  const partyListRef = useRef<HTMLDivElement>(null);

  const [isProductOpen, setIsProductOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const productListRef = useRef<HTMLDivElement>(null);

  const [printPass, setPrintPass] = useState<GatePass | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAddPartyModal, setShowAddPartyModal] = useState(false);

  // Delete modal state
  const [deleteConfirmPass, setDeleteConfirmPass] = useState<GatePass | null>(null);
  const [deletingPass, setDeletingPass] = useState(false);

  // Edit modal state
  const [editingPass, setEditingPass] = useState<GatePass | null>(null);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerId, setEditCustomerId] = useState("");
  const [editVehicleNo, setEditVehicleNo] = useState("");
  const [editDriverName, setEditDriverName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editItems, setEditItems] = useState<Array<{
    productId: string;
    productName: string;
    qty: number;
    weight: number;
    unit: string;
  }>>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // Add Item inside Edit Modal state
  const [editAddProductId, setEditAddProductId] = useState("");
  const [editAddQty, setEditAddQty] = useState<number | "">(1);
  const [editAddWeight, setEditAddWeight] = useState<number | "">(25);

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

  // Prevent background scroll when scrolling inside the product or party dropdown
  useEffect(() => {
    const attachWheelLock = (element: HTMLElement | null) => {
      if (!element) return () => {};

      const handleWheel = (e: WheelEvent) => {
        const { scrollTop, scrollHeight, clientHeight } = element;
        const isScrollingDown = e.deltaY > 0;
        const isScrollingUp = e.deltaY < 0;

        // If at boundaries, prevent the parent/background page from scrolling
        if (
          (isScrollingDown && Math.ceil(scrollTop + clientHeight) >= scrollHeight) ||
          (isScrollingUp && scrollTop <= 0)
        ) {
          e.preventDefault();
        }
        e.stopPropagation();
      };

      element.addEventListener("wheel", handleWheel, { passive: false });
      return () => element.removeEventListener("wheel", handleWheel);
    };

    const cleanupProduct = isProductOpen ? attachWheelLock(productListRef.current) : undefined;
    const cleanupParty = isPartyOpen ? attachWheelLock(partyListRef.current) : undefined;

    return () => {
      if (cleanupProduct) cleanupProduct();
      if (cleanupParty) cleanupParty();
    };
  }, [isProductOpen, isPartyOpen]);

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
    setItemWeight(isWeight ? 25 : "");
  };

  const handleQtyChange = (qtyVal: number | "") => {
    if (qtyVal === "") {
      setItemQty("");
      return;
    }
    const q = isNaN(qtyVal) || qtyVal < 1 ? 1 : qtyVal;
    setItemQty(q);
    if (selectedProduct?.unitType === "weight") {
      setItemWeight(q * 25);
    }
  };

  const handleAddItem = () => {
    if (!selectedProductId || !selectedProduct) {
      toast.warn(t("gatePass_toastSelectProduct"));
      return;
    }

    const gudamStock = selectedProduct.gudamStock ?? 0;
    if (gudamStock <= 0) {
      toast.error(t("gatePass_toastOutOfStock", { name: selectedProduct.name }));
      return;
    }

    const qty = Number(itemQty) || 1;
    if (qty <= 0) {
      toast.warn(t("gatePass_toastValidQty"));
      return;
    }

    const isWeight = selectedProduct.unitType === "weight";
    const weight = isWeight ? Number(itemWeight) || qty * 25 : 0;

    const deductAmount = qty;
    if (deductAmount > gudamStock) {
      toast.warn(
        t("gatePass_toastOnlyAvailable", { qty: gudamStock, unit: unitLabel(isWeight) })
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
      toast.warn(t("gatePass_toastSelectParty"));
      return;
    }
    if (items.length === 0) {
      toast.warn(t("gatePass_toastAddItems"));
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

      toast.success(t("gatePass_toastSaved", { no: created.gatePassNo }));
      setPrintPass(created);

      setCustomerName("");
      setCustomerId("");
      setItems([]);
      setSelectedProductId("");
      setItemQty(1);
      setItemWeight(25);
    } catch (err: any) {
      toast.error(err.message || t("gatePass_toastFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGatePass = async (pass: GatePass) => {
    if (!ownerId) return;
    setDeletingPass(true);
    try {
      await deleteGatePass(pass.id, ownerId);
      toast.success(t("gatePass_deleteSuccess", { no: pass.gatePassNo }));
      setDeleteConfirmPass(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || t("gatePass_deleteFailed"));
    } finally {
      setDeletingPass(false);
    }
  };

  const startEditGatePass = (pass: GatePass) => {
    setEditingPass(pass);
    setEditCustomerName(pass.customerName);
    setEditCustomerId(pass.customerId || "");
    setEditVehicleNo(pass.vehicleNo || "");
    setEditDriverName(pass.driverName || "");
    setEditNotes(pass.notes || "");
    setEditItems(
      pass.items.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        qty: i.qty,
        weight: i.weight || 0,
        unit: i.unit || "",
      }))
    );
    setEditAddProductId("");
    setEditAddQty(1);
    setEditAddWeight(25);
  };

  const handleEditAddProduct = () => {
    if (!editAddProductId) {
      toast.warn(t("gatePass_toastSelectProduct"));
      return;
    }
    const prod = products.find((p) => p.id === editAddProductId);
    if (!prod) return;
    const qty = Number(editAddQty) || 1;
    if (qty <= 0) {
      toast.warn(t("gatePass_toastValidQty"));
      return;
    }
    const isWeight = prod.unitType === "weight";
    const weight = isWeight ? Number(editAddWeight) || qty * 25 : 0;

    const existingIndex = editItems.findIndex((it) => it.productId === prod.id);
    if (existingIndex !== -1) {
      setEditItems((prev) =>
        prev.map((it, idx) =>
          idx === existingIndex
            ? { ...it, qty: it.qty + qty, weight: isWeight ? it.weight + weight : 0 }
            : it
        )
      );
    } else {
      setEditItems((prev) => [
        ...prev,
        {
          productId: prod.id,
          productName: prod.name,
          qty,
          weight,
          unit: prod.unitType === "weight" ? "Bags" : "Pcs",
        },
      ]);
    }

    setEditAddProductId("");
    setEditAddQty(1);
    setEditAddWeight(25);
  };

  const handleSaveEditedGatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPass || !ownerId) return;
    if (!editCustomerName.trim()) {
      toast.warn(t("gatePass_toastSelectParty"));
      return;
    }
    if (editItems.length === 0) {
      toast.warn(t("gatePass_toastAddItems"));
      return;
    }
    setSavingEdit(true);
    try {
      await updateGatePass(
        editingPass.id,
        {
          customerName: editCustomerName.trim(),
          customerId: editCustomerId || undefined,
          vehicleNo: editVehicleNo.trim(),
          driverName: editDriverName.trim(),
          notes: editNotes.trim(),
          items: editItems,
        },
        ownerId
      );
      toast.success(t("gatePass_updateSuccess", { no: editingPass.gatePassNo }));
      setEditingPass(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || t("gatePass_updateFailed"));
    } finally {
      setSavingEdit(false);
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
        title={t("gatePass_title")}
        subtitle={t("gatePass_subtitle")}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleCreateGatePass} className="space-y-6">
              <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
                <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-white rounded-t-xl">
                  <h5 className="flex items-center gap-2 text-sm font-bold text-stone-800">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-brand-500 text-brand-600 text-xs font-bold">
                      <User size={12} />
                    </span>
                    <span>{t("gatePass_detailsTitle")}</span>
                  </h5>
                </div>

                <div className="p-6 space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">
                      {t("gatePass_partyLabel")} <span className="text-red-500">*</span>
                    </label>

                    <div className="flex gap-2">
                      <div className={`relative min-w-0 flex-1 ${isPartyOpen ? "z-30" : "z-10"}`} ref={partyDropdownRef}>
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
                                      {t("gatePass_due", { amount: Math.round(selectedCustomer.balance).toLocaleString() })}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">
                                      Rs. 0
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs font-medium text-stone-400">
                                  {t("gatePass_selectParty")}
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
                                title={t("gatePass_clearSelection")}
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
                          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-xl border border-stone-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
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
                                  placeholder={t("gatePass_searchParty")}
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

                            <div
                              ref={partyListRef}
                              style={{ overscrollBehavior: "contain" }}
                              className="max-h-64 overflow-y-auto overscroll-contain divide-y divide-stone-50"
                            >
                              {filteredCustomers.length === 0 ? (
                                <div className="p-5 text-center text-stone-400 text-xs space-y-2.5">
                                  <p>{t("gatePass_noParty")} {partySearch ? `"${partySearch}"` : ""}</p>
                                  {partySearch.trim() && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsPartyOpen(false);
                                        setShowAddPartyModal(true);
                                      }}
                                      className="btn-primary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5 font-bold shadow-sm"
                                    >
                                      <Plus size={14} /> Add &quot;{partySearch.trim()}&quot;
                                    </button>
                                  )}
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

                            <div className="p-2 border-t border-stone-100 bg-stone-50">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsPartyOpen(false);
                                  setShowAddPartyModal(true);
                                }}
                                className="btn-primary w-full !py-2 text-xs flex items-center justify-center gap-1.5 font-bold shadow-sm"
                              >
                                <Plus size={14} /> {t("pos_select_new_party") || "Add New Party"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowAddPartyModal(true)}
                        className="flex shrink-0 items-center justify-center rounded-xl border border-brand-500 bg-brand-50 px-3.5 text-brand-700 transition hover:bg-brand-100 shadow-sm"
                        title={t("pos_select_new_party") || "Add New Party"}
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-stone-700 uppercase tracking-wider">
                      <Package size={15} className="text-brand-600" />
                      <span>{t("gatePass_dispatchEntry")}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className={`sm:col-span-6 ${isProductOpen ? "relative z-30" : "relative z-10"}`}>
                        <label className="block text-[11px] font-bold text-stone-600 mb-1">
                          {t("gatePass_itemProduct")} <span className="text-red-500">*</span>
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
                                      {t("gatePass_warehouseStock", {
                                        qty: selectedProduct.gudamStock ?? 0,
                                        unit: unitLabel(selectedProduct.unitType === "weight"),
                                      })}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-xs font-medium text-stone-400">
                                    {t("gatePass_selectItem")}
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
                                  title={t("gatePass_clearSelection")}
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
                            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-xl border border-stone-200 shadow-2xl overflow-hidden ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100">
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
                                    onKeyDown={(e) => {
                                      if (e.key === "Escape") {
                                        setIsProductOpen(false);
                                      } else if (e.key === "Enter" && filteredDropdownProducts.length === 1) {
                                        e.preventDefault();
                                        handleProductSelect(filteredDropdownProducts[0].id);
                                      }
                                    }}
                                    placeholder={t("gatePass_searchItem")}
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

                              <div
                                ref={productListRef}
                                style={{ overscrollBehavior: "contain" }}
                                className="max-h-72 overflow-y-auto overscroll-contain divide-y divide-stone-50"
                              >
                                {filteredDropdownProducts.length === 0 ? (
                                  <div className="p-4 text-center text-stone-400 text-xs">
                                    <p>{t("gatePass_noProduct")} {productSearch ? `"${productSearch}"` : ""}</p>
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
                                            {p.category || t("gatePass_general")}
                                          </p>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                          <span
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold tabular ${isAvailable
                                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                : "bg-red-50 text-red-700 border border-red-200"
                                              }`}
                                          >
                                            {t("gatePass_warehouseStock", { qty: stock, unit: unitLabel(isWt) })}
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

                              {filteredDropdownProducts.length > 0 && (
                                <div className="px-3 py-1.5 bg-stone-50/90 border-t border-stone-100 flex items-center justify-between text-[10px] text-stone-500 font-medium">
                                  <span>{filteredDropdownProducts.length} items</span>
                                  <span className="text-stone-400 text-[9px]">Scroll for more</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-bold text-stone-600 mb-1">
                          {t("gatePass_qtyBags")} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          placeholder={t("gatePass_qtyPlaceholder")}
                          value={itemQty}
                          onChange={(e) => handleQtyChange(e.target.value === "" ? "" : Number(e.target.value))}
                          onKeyDown={(e) => { if (e.key === "Enter" && selectedProduct) { e.preventDefault(); handleAddItem(); } }}
                          className="field w-full text-xs font-bold tabular !py-2"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-bold text-stone-600 mb-1">
                          {t("gatePass_totalWtKg")}
                        </label>
                        <input
                          type="number"
                          step="any"
                          placeholder={t("gatePass_weightPlaceholder")}
                          value={itemWeight}
                          onChange={(e) => setItemWeight(e.target.value === "" ? "" : Number(e.target.value))}
                          onKeyDown={(e) => { if (e.key === "Enter" && selectedProduct) { e.preventDefault(); handleAddItem(); } }}
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
                        <Plus size={15} /> {t("gatePass_addItem")}
                      </button>
                    </div>
                  </div>

                  {items.length > 0 && (
                    <div className="overflow-hidden border border-stone-200 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-stone-100 text-stone-700 uppercase font-bold border-b border-stone-200">
                          <tr>
                            <th className="p-3 text-center">#</th>
                            <th className="p-3">{t("gatePass_colItemName")}</th>
                            <th className="p-3 text-center">{t("gatePass_qtyBags")}</th>
                            <th className="p-3 text-center">{t("gatePass_colTotalWeight")}</th>
                            <th className="p-3 text-right">{t("gatePass_colWarehouseStock")}</th>
                            <th className="p-3 text-center">{t("action")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {items.map((it, idx) => (
                            <tr key={idx} className="hover:bg-stone-50">
                              <td className="p-3 text-center font-bold text-stone-400">{idx + 1}</td>
                              <td className="p-3 font-bold text-stone-900">{it.productName}</td>
                              <td className="p-3 text-center font-bold text-stone-800 tabular">
                                {t("gatePass_bagsCount", { qty: String(it.qty).padStart(2, "0") })}
                              </td>
                              <td className="p-3 text-center font-extrabold text-brand-700 tabular">
                                {it.weight > 0 ? `${it.weight} kg` : "—"}
                              </td>
                              <td className="p-3 text-right text-stone-500 tabular">
                                {t("gatePass_left", { qty: it.maxGudamQty })}
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                                  title={t("gatePass_deleteItem")}
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
                          <span>{t("gatePass_save")}</span>
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
                  <span>{t("gatePass_stockSummary")}</span>
                </h5>
                <span className="text-[11px] font-bold text-stone-400">
                  {t("gatePass_productsCount", { count: products.length })}
                </span>
              </div>

              <div className="p-3 border-b border-stone-100 bg-stone-50/60">
                <div className="relative">
                  <input
                    type="text"
                    placeholder={t("gatePass_searchItem")}
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    className="field w-full pl-8 !py-1.5 text-xs"
                  />
                  <Search className="absolute left-2.5 top-2 text-stone-400" size={13} />
                </div>
              </div>

              <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto divide-y divide-stone-50">
                {filteredStockProducts.length === 0 ? (
                  <p className="p-6 text-center text-xs text-stone-400">{t("gatePass_noItem")}</p>
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
                            {p.category || t("gatePass_general")}
                          </p>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0 tabular ${isAvailable
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                            }`}
                        >
                          {stock} {unitLabel(isWt)}
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
          emptyText={t("gatePass_noRecords")}
          toolbarLeft={
            <h5 className="text-sm font-bold text-stone-800 uppercase tracking-wider flex items-center gap-2">
              <History size={16} className="text-brand-600" />
              <span>{t("gatePass_historyTitle")}</span>
            </h5>
          }
          toolbarRight={
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder={t("gatePass_searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="field w-full pl-8 !py-1.5 text-xs"
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" size={14} />
            </div>
          }
          columns={[
            {
              key: "no",
              header: t("gatePass_colNo"),
              cell: (gp) => (
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-brand-700 font-mono">{gp.gatePassNo}</span>
                  {(gp.gatePassNo.startsWith("OFF-") || gp.id.startsWith("local_")) && (
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
              cell: (gp) => (
                <span className="text-stone-600">
                  {new Date(gp.date).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              ),
            },
            { key: "party", header: t("gatePass_colParty"), cell: (gp) => <span className="font-bold text-stone-900">{gp.customerName}</span> },
            {
              key: "items",
              header: t("gatePass_colItemsWeight"),
              cell: (gp) => (
                <span className="font-medium text-stone-700">
                  {gp.items
                    .map((i) =>
                      i.weight && i.weight > 0
                        ? t("gatePass_historyItemWeight", { name: i.productName, qty: i.qty, weight: i.weight })
                        : t("gatePass_historyItemUnit", { name: i.productName, qty: i.qty, unit: storedUnitLabel(i.unit) })
                    )
                    .join(", ")}
                </span>
              ),
            },
            {
              key: "status",
              header: t("status"),
              align: "center",
              cell: (gp) => <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">{gp.status === "Issued" ? t("gatePass_statusIssued") : gp.status}</span>,
            },
            {
              key: "actions",
              header: t("action"),
              align: "right",
              cell: (gp) => (
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => setPrintPass(gp)}
                    className="rounded-lg p-1.5 text-stone-600 hover:bg-stone-100 transition"
                    title={t("printSlip")}
                  >
                    <Printer size={15} />
                  </button>
                  <button
                    onClick={() => startEditGatePass(gp)}
                    className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 transition"
                    title="Edit Gate Pass"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmPass(gp)}
                    className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 transition"
                    title="Delete Gate Pass"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ),
            },
          ]}
        />

      {printPass && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-pop w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-stone-50 no-print">
              <div className="flex items-center gap-2">
                <Printer size={16} className="text-brand-600" />
                <h3 className="font-bold text-stone-900 text-sm">
                  {t("gatePass_modalTitle", { no: printPass.gatePassNo })}
                </h3>
              </div>
              <button
                onClick={() => setPrintPass(null)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-200"
              >
                <X size={18} />
              </button>
            </div>

            <div id="printable-receipt" className="p-5 overflow-y-auto flex-1 bg-white text-black font-sans">
              <div className="text-center border-b-2 border-black pb-3 mb-3">
                <h2 className="font-black text-xl text-black uppercase leading-tight tracking-wide">
                  {currentShop?.shopName || t("gatePass_defaultSlipTitle")}
                </h2>
                {currentShop?.address && (
                  <p className="text-[11px] font-bold text-black mt-0.5">{currentShop.address}</p>
                )}
                {currentShop?.contact && (
                  <p className="text-[11px] font-black text-black">Ph: {currentShop.contact}</p>
                )}
                <div className="mt-2 inline-block border-2 border-black px-3 py-0.5 rounded font-black text-xs uppercase tracking-wider text-black">
                  {t("gatePass_slipHeading")}
                </div>
                <p className="text-xs text-black mt-1.5 font-black">
                  #{printPass.gatePassNo} • {new Date(printPass.date).toLocaleString()}
                </p>
              </div>

              <div className="space-y-1 mb-3 text-xs text-black">
                <p className="font-bold">
                  <span className="font-black">{t("gatePass_partyColon")}</span>{" "}
                  <span className="font-black uppercase">{printPass.customerName}</span>
                </p>
              </div>

              <table className="w-full text-left text-xs border-collapse my-3">
                <thead>
                  <tr className="border-b-2 border-t-2 border-black font-black uppercase text-black text-[11px]">
                    <th className="py-1.5 pl-1">{t("gatePass_slipItem")}</th>
                    <th className="py-1.5 text-center">{t("gatePass_slipBags")}</th>
                    <th className="py-1.5 pr-1 text-right">{t("gatePass_slipTotalWt")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/20">
                  {printPass.items.map((it, idx) => (
                    <tr key={idx} className="font-bold text-black">
                      <td className="py-1.5 pl-1 font-black text-black">{it.productName}</td>
                      <td className="py-1.5 text-center text-black font-bold">
                        {t("gatePass_bagsCount", { qty: it.qty })}
                      </td>
                      <td className="py-1.5 pr-1 text-right font-black text-black">
                        {it.weight ? `${it.weight} kg` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="grid grid-cols-2 gap-6 mt-8 text-center text-[11px] font-bold text-black pt-4 border-t-2 border-dashed border-black">
                <div>
                  <div className="border-b-2 border-black h-8 mb-1"></div>
                  <span className="font-black">{t("gatePass_incharge")}</span>
                </div>
                <div>
                  <div className="border-b-2 border-black h-8 mb-1"></div>
                  <span className="font-black">{t("gatePass_receiver")}</span>
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-stone-200 bg-stone-50 flex justify-end gap-2 no-print">
              <button onClick={() => setPrintPass(null)} className="btn-ghost !py-2 text-xs">
                {t("gatePass_close")}
              </button>
              <button
                onClick={() => window.print()}
                className="btn-primary !py-2 text-xs font-bold flex items-center gap-1.5"
              >
                <Printer size={14} /> {t("gatePass_print")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 shrink-0">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  {t("gatePass_deleteTitle", { no: deleteConfirmPass.gatePassNo })}
                </h3>
                <span className="text-xs font-semibold text-stone-500">
                  {deleteConfirmPass.customerName} • {new Date(deleteConfirmPass.date).toLocaleDateString()}
                </span>
              </div>
            </div>

            <p className="text-sm text-stone-600 mb-6 bg-red-50/70 p-3.5 rounded-xl border border-red-100 leading-relaxed">
              {t("gatePass_deleteConfirmMsg")}
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmPass(null)}
                disabled={deletingPass}
                className="btn-ghost"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteGatePass(deleteConfirmPass)}
                disabled={deletingPass}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-red-700 active:scale-95 disabled:opacity-50 transition"
              >
                {deletingPass ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{t("gatePass_deleting")}</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Delete Gate Pass</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Gate Pass Modal */}
      {editingPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4 bg-stone-50">
              <div className="flex items-center gap-2">
                <Pencil size={18} className="text-brand-600" />
                <h3 className="text-base font-bold text-stone-900">
                  {t("gatePass_editTitle", { no: editingPass.gatePassNo })}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPass(null)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-200 hover:text-stone-700 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditedGatePass} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {t("gatePass_editParty")} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editCustomerName}
                    onChange={(e) => setEditCustomerName(e.target.value)}
                    className="field w-full text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {t("gatePass_vehicleNo")}
                  </label>
                  <input
                    type="text"
                    value={editVehicleNo}
                    onChange={(e) => setEditVehicleNo(e.target.value)}
                    placeholder="e.g. LES-1234"
                    className="field w-full text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {t("gatePass_driverName")}
                  </label>
                  <input
                    type="text"
                    value={editDriverName}
                    onChange={(e) => setEditDriverName(e.target.value)}
                    placeholder="Driver name"
                    className="field w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {t("gatePass_notes")}
                  </label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Notes..."
                    className="field w-full text-xs"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="border border-stone-200 rounded-xl overflow-hidden mt-3">
                <div className="bg-stone-100 px-4 py-2 border-b border-stone-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                    {t("gatePass_colItemsWeight")}
                  </span>
                  <span className="text-[11px] font-bold text-stone-500">
                    {editItems.length} items
                  </span>
                </div>

                <div className="divide-y divide-stone-100 max-h-56 overflow-y-auto">
                  {editItems.map((item, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between gap-3 hover:bg-stone-50">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs text-stone-900 truncate">{item.productName}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-20">
                          <label className="block text-[9px] font-bold text-stone-400 uppercase">Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => {
                              const q = Math.max(1, parseInt(e.target.value) || 1);
                              setEditItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, qty: q } : it))
                              );
                            }}
                            className="field !py-1 text-xs font-bold text-center"
                          />
                        </div>

                        <div className="w-24">
                          <label className="block text-[9px] font-bold text-stone-400 uppercase">Weight (kg)</label>
                          <input
                            type="number"
                            step="any"
                            value={item.weight}
                            onChange={(e) => {
                              const w = parseFloat(e.target.value) || 0;
                              setEditItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, weight: w } : it))
                              );
                            }}
                            className="field !py-1 text-xs font-bold text-center"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => setEditItems((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded mt-3"
                          title="Remove item"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Item to Gate Pass */}
                <div className="p-3 bg-stone-50 border-t border-stone-200">
                  <div className="text-[11px] font-bold text-stone-700 mb-2">+ Add Another Product</div>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-6">
                      <select
                        value={editAddProductId}
                        onChange={(e) => {
                          const pId = e.target.value;
                          setEditAddProductId(pId);
                          const p = products.find((pr) => pr.id === pId);
                          if (p?.unitType === "weight") {
                            setEditAddWeight(25);
                          } else {
                            setEditAddWeight(0);
                          }
                        }}
                        className="field w-full !py-1 text-xs bg-white"
                      >
                        <option value="">Select product...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Gudam: {p.gudamStock ?? 0})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={editAddQty}
                        onChange={(e) => {
                          const q = parseInt(e.target.value) || 1;
                          setEditAddQty(q);
                          const p = products.find((pr) => pr.id === editAddProductId);
                          if (p?.unitType === "weight") {
                            setEditAddWeight(q * 25);
                          }
                        }}
                        className="field w-full !py-1 text-xs font-bold text-center"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <input
                        type="number"
                        step="any"
                        placeholder="Weight"
                        value={editAddWeight}
                        onChange={(e) => setEditAddWeight(parseFloat(e.target.value) || 0)}
                        onKeyDown={(e) => { if (e.key === "Enter" && editAddProductId) { e.preventDefault(); handleEditAddProduct(); } }}
                        className="field w-full !py-1 text-xs font-bold text-center"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={handleEditAddProduct}
                        className="btn-primary w-full !py-1 text-xs font-bold flex items-center justify-center gap-1"
                      >
                        <Plus size={14} /> Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setEditingPass(null)}
                  disabled={savingEdit}
                  className="btn-ghost"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={savingEdit || editItems.length === 0}
                  className="btn-primary !py-2 !px-5 text-xs font-bold flex items-center gap-2 shadow-sm"
                >
                  {savingEdit ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>{t("gatePass_updating")}</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AddPartyModal
        open={showAddPartyModal}
        initialName={partySearch}
        onClose={() => setShowAddPartyModal(false)}
        onSaved={(created) => {
          setCustomerId(created.id);
          setCustomerName(created.name);
          setIsPartyOpen(false);
          setPartySearch("");
        }}
      />
    </div>
  );
}
