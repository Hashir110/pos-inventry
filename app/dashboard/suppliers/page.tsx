"use client";

import { useEffect, useState, useMemo } from "react";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../store/useLanguage";
import {
  subscribeSuppliers,
  addSupplier,
  addSupplierPurchase,
  addSupplierPayment,
  listSupplierPurchases,
  listSupplierPayments,
} from "../../lib/services/suppliers";
import { subscribeProducts } from "../../lib/services/products";
import type { Supplier, Product, SupplierPurchase, SupplierPayment } from "../../types";
import {
  Truck,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  Search,
  UserPlus,
  Package,
  History,
  X,
  Building2,
  CheckCircle2,
  Loader2,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { toast } from "react-toastify";

const money = (n: number) => `Rs. ${Math.round(n || 0).toLocaleString()}`;

export default function SuppliersPage() {
  const { currentShop } = useStore();
  const { t, language } = useLanguage();
  const isRTL = language === "ur";
  const ownerId = currentShop?.uid || "";

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<SupplierPurchase[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "due" | "clear">("all");

  // Modals
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState<Supplier | null>(null);

  // Add Supplier Form
  const [newSupName, setNewSupName] = useState("");
  const [newSupPhone, setNewSupPhone] = useState("");
  const [newSupAddress, setNewSupAddress] = useState("");

  // Purchase Form
  const [purchaseSupId, setPurchaseSupId] = useState("");
  const [purchaseProdId, setPurchaseProdId] = useState("");
  const [purchaseQty, setPurchaseQty] = useState(1);
  const [purchaseBuyingPrice, setPurchaseBuyingPrice] = useState(0);
  const [purchaseDestination, setPurchaseDestination] = useState<"gudam" | "shop">("gudam");
  const [purchasePaidAmount, setPurchasePaidAmount] = useState(0);

  // Payment Form
  const [paymentSupId, setPaymentSupId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Bank Account">("Cash");
  const [paymentNote, setPaymentNote] = useState("");

  const [addingSupplier, setAddingSupplier] = useState(false);
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);

  useEffect(() => {
    if (!ownerId) return;

    const unsubSup = subscribeSuppliers(ownerId, setSuppliers);
    const unsubProd = subscribeProducts(ownerId, setProducts);

    const loadRecords = async () => {
      try {
        const pur = await listSupplierPurchases(ownerId);
        const pay = await listSupplierPayments(ownerId);
        setPurchases(pur);
        setPayments(pay);
      } catch (e) {
        console.error("Failed to load supplier history:", e);
      }
    };

    loadRecords();

    return () => {
      unsubSup();
      unsubProd();
    };
  }, [ownerId]);

  // Financial Metrics
  const totalSupplierPayable = useMemo(
    () => suppliers.reduce((sum, s) => sum + (s.balance || 0), 0),
    [suppliers]
  );
  const dueSuppliersCount = useMemo(() => suppliers.filter((s) => (s.balance || 0) > 0).length, [suppliers]);
  const clearSuppliersCount = useMemo(() => suppliers.filter((s) => (s.balance || 0) <= 0).length, [suppliers]);
  const totalPurchasedMonth = useMemo(
    () => purchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0),
    [purchases]
  );

  // Filtered Suppliers
  const filteredSuppliers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return suppliers.filter((s) => {
      const matchName = s.name.toLowerCase().includes(term);
      const matchPhone = (s.phone || "").toLowerCase().includes(term);
      if (!matchName && !matchPhone) return false;

      if (filter === "due") return (s.balance || 0) > 0;
      if (filter === "clear") return (s.balance || 0) <= 0;
      return true;
    });
  }, [suppliers, searchTerm, filter]);

  // Handlers
  const handleAddSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupName.trim()) {
      toast.warn(t("suppliers_warn_name") || "Please enter supplier name");
      return;
    }
    try {
      setAddingSupplier(true);
      await addSupplier(ownerId, {
        name: newSupName,
        phone: newSupPhone,
        address: newSupAddress,
      });
      toast.success(t("suppliers_added", { name: newSupName }) || `Supplier ${newSupName} added!`);
      setShowAddSupplierModal(false);
      setNewSupName("");
      setNewSupPhone("");
      setNewSupAddress("");
    } catch (err: any) {
      toast.error(err.message || t("suppliers_err_add") || "Failed to add supplier");
    } finally {
      setAddingSupplier(false);
    }
  };

  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseSupId) {
      toast.warn(t("suppliers_warn_select_supplier") || "Select a supplier");
      return;
    }
    if (!purchaseProdId) {
      toast.warn(t("suppliers_warn_select_product") || "Select a product");
      return;
    }
    const prod = products.find((p) => p.id === purchaseProdId);
    const sup = suppliers.find((s) => s.id === purchaseSupId);

    if (!prod || !sup) return;

    const isWeight = prod.unitType === "weight";
    const totalBill = isWeight
      ? Number(purchaseQty) * 25 * Number(purchaseBuyingPrice)
      : Number(purchaseQty) * Number(purchaseBuyingPrice);

    try {
      setSavingPurchase(true);
      await addSupplierPurchase(ownerId, {
        supplierId: sup.id,
        supplierName: sup.name,
        items: [
          {
            productId: prod.id,
            productName: prod.name,
            qty: Number(purchaseQty),
            buyingPrice: Number(purchaseBuyingPrice),
            total: totalBill,
            destination: purchaseDestination,
          },
        ],
        totalAmount: totalBill,
        paidAmount: Number(purchasePaidAmount),
      });

      toast.success("Purchase saved successfully");
      setShowPurchaseModal(false);
      setPurchaseSupId("");
      setPurchaseProdId("");
      setPurchaseQty(1);
      setPurchaseBuyingPrice(0);
      setPurchasePaidAmount(0);

      const pur = await listSupplierPurchases(ownerId);
      setPurchases(pur);
    } catch (err: any) {
      toast.error(err.message || "Purchase failed");
    } finally {
      setSavingPurchase(false);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentSupId) {
      toast.warn("Please select a supplier");
      return;
    }
    if (paymentAmount <= 0) {
      toast.warn("Please enter a valid payment amount");
      return;
    }
    const sup = suppliers.find((s) => s.id === paymentSupId);
    if (!sup) return;

    try {
      setSavingPayment(true);
      await addSupplierPayment(ownerId, {
        supplierId: sup.id,
        supplierName: sup.name,
        amount: Number(paymentAmount),
        method: paymentMethod,
        note: paymentNote,
      });

      toast.success("Payment recorded successfully");
      setShowPaymentModal(false);
      setPaymentSupId("");
      setPaymentAmount(0);
      setPaymentNote("");

      const pay = await listSupplierPayments(ownerId);
      setPayments(pay);
    } catch (err: any) {
      toast.error(err.message || "Payment failed");
    } finally {
      setSavingPayment(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* 1. TOP HEADER & ACTIONS */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Suppliers & Vendor Accounts
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Manage wholesale suppliers, purchase inventory bills, and register payment settlements.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setShowPurchaseModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Package size={16} className="text-orange-600" />
            <span>Record Stock Purchase</span>
          </button>

          <button
            onClick={() => setShowPaymentModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors shadow-xs"
          >
            <DollarSign size={16} className="text-emerald-600" />
            <span>Pay Supplier</span>
          </button>

          <button
            onClick={() => setShowAddSupplierModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 transition-colors shadow-sm"
          >
            <UserPlus size={16} />
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      {/* 2. 4 SUMMARY STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Payables</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
              <ArrowUpRight size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-700 tabular-nums">{money(totalSupplierPayable)}</div>
            <div className="text-xs text-slate-500 mt-0.5">Across {dueSuppliersCount} pending accounts</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Suppliers</span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <Truck size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{suppliers.length}</div>
            <div className="text-xs text-slate-500 mt-0.5">Registered vendors</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">All-Clear Vendors</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-700 tabular-nums">{clearSuppliersCount}</div>
            <div className="text-xs text-emerald-700 font-semibold mt-0.5">Zero balance remaining</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Stock Purchases</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Package size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{money(totalPurchasedMonth)}</div>
            <div className="text-xs text-slate-500 mt-0.5">{purchases.length} invoices received</div>
          </div>
        </div>
      </div>

      {/* 3. SEARCH & FILTER ROW */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search supplier name or phone..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all font-medium"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filter === "all" ? "bg-orange-600 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Vendors ({suppliers.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("due")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filter === "due" ? "bg-orange-600 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Outstanding Due ({dueSuppliersCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("clear")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filter === "clear" ? "bg-orange-600 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Clear ({clearSuppliersCount})
          </button>
        </div>
      </div>

      {/* 4. SUPPLIER DIRECTORY TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4">Supplier Profile</th>
                <th className="py-3 px-3">Contact</th>
                <th className="py-3 px-3">Address</th>
                <th className="py-3 px-3 text-right">Payable Balance</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <Truck size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-600">No suppliers found</p>
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((s) => {
                  const hasDue = (s.balance || 0) > 0;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 ${
                              hasDue ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {s.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 text-sm">{s.name}</span>
                            <span className="text-[11px] text-slate-400">Vendor ID: #{s.id.slice(0, 6)}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 font-medium text-slate-700">
                        {s.phone ? (
                          <span className="flex items-center gap-1 text-slate-600">
                            <Phone size={12} className="text-orange-600" /> {s.phone}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="py-3 px-3 text-slate-500">
                        {s.address ? (
                          <span className="flex items-center gap-1">
                            <MapPin size={12} /> {s.address}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <span
                          className={`font-bold tabular-nums text-sm ${
                            hasDue ? "text-rose-600" : "text-emerald-700"
                          }`}
                        >
                          {hasDue ? money(s.balance) : "Rs. 0 (Clear ✓)"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setPurchaseSupId(s.id);
                              setShowPurchaseModal(true);
                            }}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-orange-50 hover:text-orange-700 text-slate-700 font-semibold"
                            title="Record Purchase"
                          >
                            + Purchase
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentSupId(s.id);
                              setShowPaymentModal(true);
                            }}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 font-semibold"
                            title="Pay Supplier"
                          >
                            Pay
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowHistoryModal(s)}
                            className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100"
                            title="View Statement History"
                          >
                            <History size={16} />
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

      {/* MODAL 1: ADD SUPPLIER */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="text-orange-600" size={18} />
                <h3 className="font-bold text-slate-900 text-sm">Add New Supplier / Vendor</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSupplierModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSupplierSubmit} className="p-5 flex flex-col gap-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Company / Supplier Name *</label>
                <input
                  type="text"
                  required
                  value={newSupName}
                  onChange={(e) => setNewSupName(e.target.value)}
                  placeholder="e.g. Tapal Tea Distributors"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={newSupPhone}
                  onChange={(e) => setNewSupPhone(e.target.value)}
                  placeholder="0300-1234567"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Address / Warehouse Location</label>
                <input
                  type="text"
                  value={newSupAddress}
                  onChange={(e) => setNewSupAddress(e.target.value)}
                  placeholder="e.g. Circular Road, Lahore"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="px-4 py-2 rounded-lg bg-white border border-slate-200 font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingSupplier}
                  className="px-5 py-2 rounded-lg bg-orange-600 text-white font-bold hover:bg-orange-700 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {addingSupplier ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  <span>Save Supplier</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECORD STOCK PURCHASE */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
            <div className="p-4 bg-orange-50 border-b border-orange-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="text-orange-600" size={18} />
                <h3 className="font-bold text-orange-900 text-sm">Record Stock Purchase from Vendor</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPurchaseModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePurchaseSubmit} className="p-5 flex flex-col gap-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Select Supplier *</label>
                  <select
                    value={purchaseSupId}
                    onChange={(e) => setPurchaseSupId(e.target.value)}
                    required
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-medium"
                  >
                    <option value="">-- Choose Vendor --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Select Product *</label>
                  <select
                    value={purchaseProdId}
                    onChange={(e) => {
                      setPurchaseProdId(e.target.value);
                      const prod = products.find((p) => p.id === e.target.value);
                      if (prod && prod.buyingPrice) setPurchaseBuyingPrice(prod.buyingPrice);
                    }}
                    required
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-medium"
                  >
                    <option value="">-- Choose Item --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={purchaseQty}
                    onChange={(e) => setPurchaseQty(Math.max(1, parseFloat(e.target.value) || 0))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Unit Buying Rate</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={purchaseBuyingPrice}
                    onChange={(e) => setPurchaseBuyingPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Destination</label>
                  <select
                    value={purchaseDestination}
                    onChange={(e) => setPurchaseDestination(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                  >
                    <option value="gudam">Warehouse (Gudam)</option>
                    <option value="shop">Front Shop</option>
                  </select>
                </div>
              </div>

              {/* Amount Paid Now vs Khata Balance */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Cash Paid at Delivery (Balance goes to Khata):
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={purchasePaidAmount}
                  onChange={(e) => setPurchasePaidAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0 if fully on credit"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-emerald-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPurchaseModal(false)}
                  className="px-4 py-2 rounded-lg bg-white border border-slate-200 font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPurchase}
                  className="px-5 py-2 rounded-lg bg-orange-600 text-white font-bold hover:bg-orange-700 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {savingPurchase ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
                  <span>Save Purchase Bill</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: PAY SUPPLIER */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="text-emerald-700" size={18} />
                <h3 className="font-bold text-emerald-900 text-sm">Pay Supplier / Settle Due</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="p-5 flex flex-col gap-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Select Supplier *</label>
                <select
                  value={paymentSupId}
                  onChange={(e) => setPaymentSupId(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-sm"
                >
                  <option value="">-- Choose Supplier to Pay --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Balance: {money(s.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Payment Amount (PKR) *</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={paymentAmount || ""}
                    onChange={(e) => setPaymentAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="e.g. 5000"
                    required
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-emerald-700"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                  >
                    <option value="Cash">Till Cash</option>
                    <option value="Bank Account">Bank Transfer / Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Payment Note / Cheque #</label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="e.g. Paid cash to driver Tariq"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 rounded-lg bg-white border border-slate-200 font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPayment}
                  className="px-5 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {savingPayment ? <Loader2 size={16} className="animate-spin" /> : <DollarSign size={16} />}
                  <span>Save Payment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: SUPPLIER STATEMENT HISTORY */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="text-orange-600" size={18} />
                <h3 className="font-bold text-slate-900 text-sm">
                  Ledger History: {showHistoryModal.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex flex-col gap-3">
              <div className="p-3 bg-orange-50 rounded-lg flex items-center justify-between text-xs">
                <span className="font-bold text-orange-900">Current Outstanding Balance:</span>
                <span className="font-extrabold text-orange-700 text-base tabular-nums">
                  {money(showHistoryModal.balance || 0)}
                </span>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 font-bold text-slate-500 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Details</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      ...purchases
                        .filter((p) => p.supplierId === showHistoryModal.id)
                        .map((p) => ({
                          id: p.id,
                          date: p.date,
                          kind: "Purchase",
                          details: p.items.map((i) => `${i.productName} × ${i.qty}`).join(", "),
                          amount: p.totalAmount,
                        })),
                      ...payments
                        .filter((p) => p.supplierId === showHistoryModal.id)
                        .map((p) => ({
                          id: p.id,
                          date: p.date,
                          kind: "Payment",
                          details: `${p.method}${p.note ? ` • ${p.note}` : ""}`,
                          amount: p.amount,
                        })),
                    ]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                            {new Date(rec.date).toLocaleDateString()}
                          </td>
                          <td className="py-2 px-3 font-bold">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] ${
                                rec.kind === "Purchase"
                                  ? "bg-rose-50 text-rose-700"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {rec.kind}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-600 truncate max-w-xs">{rec.details}</td>
                          <td className="py-2 px-3 text-right font-bold tabular-nums">
                            {money(rec.amount)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHistoryModal(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-bold hover:bg-slate-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
