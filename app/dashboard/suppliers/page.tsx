"use client";

import { useEffect, useState } from "react";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../store/useLanguage";
import {
  subscribeSuppliers,
  addSupplier,
  updateSupplier,
  deleteSupplier,
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
  Pencil,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "react-toastify";
import DataTable from "../../components/DataTable";
import HiddenAmount from "../../components/HiddenAmount";

export default function SuppliersPage() {
  const { currentShop } = useStore();
  const { t } = useLanguage();
  const ownerId = currentShop?.uid || "";

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<SupplierPurchase[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState<Supplier | null>(null);

  const [newSupName, setNewSupName] = useState("");
  const [newSupPhone, setNewSupPhone] = useState("");
  const [newSupAddress, setNewSupAddress] = useState("");

  const [purchaseSupId, setPurchaseSupId] = useState("");
  const [purchaseProdId, setPurchaseProdId] = useState("");
  const [purchaseQty, setPurchaseQty] = useState<number | "">(1);
  const [purchaseWeight, setPurchaseWeight] = useState<number | "">(25);
  const [isManualWeight, setIsManualWeight] = useState(false);
  const [purchaseBuyingPrice, setPurchaseBuyingPrice] = useState<number | "">("");
  const [purchaseDestination, setPurchaseDestination] = useState<"gudam" | "shop">("gudam");
  const [purchasePaidAmount, setPurchasePaidAmount] = useState<number | "">("");

  const [paymentSupId, setPaymentSupId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Bank Account">("Cash");
  const [paymentNote, setPaymentNote] = useState("");

  const [addingSupplier, setAddingSupplier] = useState(false);
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);

  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editSupName, setEditSupName] = useState("");
  const [editSupPhone, setEditSupPhone] = useState("");
  const [editSupAddress, setEditSupAddress] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteSupplierTarget, setDeleteSupplierTarget] = useState<Supplier | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState(false);

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

  const totalSupplierPayable = suppliers.reduce((sum, s) => sum + (s.balance || 0), 0);

  const selectedPurchaseProduct = products.find((p) => p.id === purchaseProdId);
  const isPurchaseWeight = selectedPurchaseProduct?.unitType === "weight";
  const purchaseBagWeight = (selectedPurchaseProduct as any)?.weightPerBag || 25;

  const currentPurchaseWeight = isPurchaseWeight
    ? (typeof purchaseWeight === "number" ? purchaseWeight : (Number(purchaseQty) || 0) * purchaseBagWeight)
    : 0;

  const currentPurchaseTotalBill = isPurchaseWeight
    ? currentPurchaseWeight * (Number(purchaseBuyingPrice) || 0)
    : (Number(purchaseQty) || 0) * (Number(purchaseBuyingPrice) || 0);

  const handlePurchaseQtyChange = (val: string) => {
    if (val === "") {
      setPurchaseQty("");
      if (!isManualWeight && isPurchaseWeight) {
        setPurchaseWeight("");
      }
      return;
    }
    const num = Number(val);
    setPurchaseQty(num);
    if (!isManualWeight && isPurchaseWeight) {
      setPurchaseWeight(num * purchaseBagWeight);
    }
  };

  const handlePurchaseWeightChange = (val: string) => {
    if (val === "") {
      setPurchaseWeight("");
      setIsManualWeight(true);
      return;
    }
    setPurchaseWeight(Number(val));
    setIsManualWeight(true);
  };

  const resetWeightToAuto = () => {
    const q = typeof purchaseQty === "number" ? purchaseQty : 1;
    setPurchaseWeight(q * purchaseBagWeight);
    setIsManualWeight(false);
  };

  const handleAddSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupName.trim()) {
      toast.warn(t("suppliers_warn_name"));
      return;
    }
    try {
      setAddingSupplier(true);
      await addSupplier(ownerId, {
        name: newSupName,
        phone: newSupPhone,
        address: newSupAddress,
      });
      toast.success(t("suppliers_added", { name: newSupName }));
      setShowAddSupplierModal(false);
      setNewSupName("");
      setNewSupPhone("");
      setNewSupAddress("");
    } catch (err: any) {
      toast.error(err.message || t("suppliers_err_add"));
    } finally {
      setAddingSupplier(false);
    }
  };

  const startEditSupplier = (s: Supplier) => {
    setEditingSupplier(s);
    setEditSupName(s.name);
    setEditSupPhone(s.phone || "");
    setEditSupAddress(s.address || "");
  };

  const handleEditSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier) return;
    if (!editSupName.trim()) {
      toast.warn(t("suppliers_warn_name"));
      return;
    }
    try {
      setSavingEdit(true);
      await updateSupplier(
        editingSupplier.id,
        {
          name: editSupName,
          phone: editSupPhone,
          address: editSupAddress,
        },
        ownerId
      );
      toast.success(t("suppliers_updated", { name: editSupName }));
      setEditingSupplier(null);
    } catch (err: any) {
      toast.error(err.message || t("suppliers_err_update"));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!deleteSupplierTarget) return;
    try {
      setDeletingSupplier(true);
      await deleteSupplier(deleteSupplierTarget.id, ownerId);
      toast.success(t("suppliers_deleted", { name: deleteSupplierTarget.name }));
      setDeleteSupplierTarget(null);
    } catch (err: any) {
      toast.error(err.message || t("suppliers_err_delete"));
    } finally {
      setDeletingSupplier(false);
    }
  };

  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseSupId) {
      toast.warn(t("suppliers_warn_select_supplier"));
      return;
    }
    if (!purchaseProdId) {
      toast.warn(t("suppliers_warn_select_product"));
      return;
    }
    const prod = products.find((p) => p.id === purchaseProdId);
    const sup = suppliers.find((s) => s.id === purchaseSupId);

    if (!prod || !sup) return;

    const isWeight = prod.unitType === "weight";
    const bagWeight = (prod as any)?.weightPerBag || 25;
    const finalWeight = isWeight
      ? (typeof purchaseWeight === "number" ? purchaseWeight : Number(purchaseQty) * bagWeight)
      : undefined;

    if (isWeight && (!finalWeight || finalWeight <= 0)) {
      toast.warn(t("suppliers_warn_weight"));
      return;
    }

    const totalBill = isWeight
      ? (finalWeight || 0) * Number(purchaseBuyingPrice)
      : Number(purchaseQty) * Number(purchaseBuyingPrice);

    if (Number(purchasePaidAmount) > totalBill) {
      toast.warn(
        t("suppliers_warn_paid_excess", {
          amount: Number(purchasePaidAmount).toLocaleString(),
          total: totalBill.toLocaleString(),
        })
      );
      return;
    }

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
            weight: finalWeight,
            totalWeight: finalWeight,
            buyingPrice: Number(purchaseBuyingPrice),
            total: totalBill,
            destinationLocation: purchaseDestination,
          },
        ],
        totalAmount: totalBill,
        paidAmount: Number(purchasePaidAmount),
      });

      toast.success(
        t("suppliers_purchase_recorded", {
          location: t(purchaseDestination === "gudam" ? "suppliers_dest_warehouse" : "suppliers_dest_shop"),
        })
      );
      setShowPurchaseModal(false);

      const pur = await listSupplierPurchases(ownerId);
      setPurchases(pur);

      setPurchaseSupId("");
      setPurchaseProdId("");
      setPurchaseQty(1);
      setPurchaseWeight(25);
      setIsManualWeight(false);
      setPurchaseBuyingPrice("");
      setPurchasePaidAmount("");
    } catch (err: any) {
      toast.error(err.message || t("suppliers_err_purchase"));
    } finally {
      setSavingPurchase(false);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentSupId) {
      toast.warn(t("suppliers_warn_select_supplier"));
      return;
    }
    const payAmt = Number(paymentAmount) || 0;
    if (payAmt <= 0) {
      toast.warn(t("suppliers_warn_amount"));
      return;
    }
    const sup = suppliers.find((s) => s.id === paymentSupId);
    if (!sup) return;
    try {
      setSavingPayment(true);
      await addSupplierPayment(ownerId, {
        supplierId: sup.id,
        supplierName: sup.name,
        amount: payAmt,
        method: paymentMethod,
        note: paymentNote,
      });

      toast.success(t("suppliers_payment_recorded", { amount: payAmt, name: sup.name }));
      setShowPaymentModal(false);

      const pay = await listSupplierPayments(ownerId);
      setPayments(pay);

      setPaymentSupId("");
      setPaymentAmount("");
      setPaymentNote("");
    } catch (err: any) {
      toast.error(err.message || t("suppliers_err_payment"));
    } finally {
      setSavingPayment(false);
    }
  };

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.phone && s.phone.includes(searchTerm))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-stone-900 flex items-center gap-2">
            <Truck className="text-brand-600" size={24} /> {t("suppliers_title")}
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            {t("suppliers_subtitle")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowAddSupplierModal(true)}
            className="btn-ghost text-xs font-bold flex items-center gap-1.5"
          >
            <UserPlus size={16} /> {t("suppliers_new_supplier")}
          </button>
          <button
            onClick={() => setShowPurchaseModal(true)}
            className="btn-primary text-xs font-bold flex items-center gap-1.5 !bg-amber-600 hover:!bg-amber-700"
          >
            <ArrowUpRight size={16} /> {t("suppliers_purchase_btn")}
          </button>
          <button
            onClick={() => setShowPaymentModal(true)}
            className="btn-primary text-xs font-bold flex items-center gap-1.5"
          >
            <ArrowDownLeft size={16} /> {t("suppliers_pay_btn")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-100 text-amber-700">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-xs text-stone-500 font-bold uppercase">{t("suppliers_total_payable")}</p>
            <div className="flex items-center gap-2">
              <HiddenAmount
                value={`Rs. ${totalSupplierPayable.toLocaleString()}`}
                className="text-xl font-black text-amber-900"
                iconSize={16}
              />
            </div>
            <p className="text-[11px] text-stone-400">{t("suppliers_total_payable_hint")}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-brand-100 text-brand-700">
            <Building2 size={24} />
          </div>
          <div>
            <p className="text-xs text-stone-500 font-bold uppercase">{t("suppliers_total_registered")}</p>
            <p className="text-xl font-black text-stone-900">{suppliers.length}</p>
            <p className="text-[11px] text-stone-400">{t("suppliers_active_accounts")}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-100 text-emerald-700">
            <Package size={24} />
          </div>
          <div>
            <p className="text-xs text-stone-500 font-bold uppercase">{t("suppliers_total_bills")}</p>
            <p className="text-xl font-black text-stone-900">{purchases.length}</p>
            <p className="text-[11px] text-stone-400">{t("suppliers_recorded_receipts")}</p>
          </div>
        </div>
      </div>

      <DataTable
        data={filteredSuppliers}
        rowKey={(s) => s.id}
        emptyText={<>{t("suppliers_empty")}</>}
        toolbarLeft={
          <h2 className="text-sm font-bold text-stone-800 uppercase tracking-wider">{t("suppliers_list_title")}</h2>
        }
        toolbarRight={
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder={t("suppliers_search_placeholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-9 text-xs"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={14} />
          </div>
        }
        columns={[
          { key: "name", header: t("suppliers_col_name"), cell: (s) => <span className="font-extrabold text-stone-900">{s.name}</span> },
          { key: "phone", header: t("phone"), cell: (s) => <span className="text-stone-600">{s.phone || "-"}</span> },
          { key: "address", header: t("address"), cell: (s) => <span className="text-stone-500">{s.address || "-"}</span> },
          {
            key: "balance",
            header: t("suppliers_col_balance"),
            align: "right",
            cell: (s) => (
              (s.balance || 0) < 0 ? (
                <span className="font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full text-xs">
                  Advance: Rs. {Math.abs(s.balance).toLocaleString()}
                </span>
              ) : (
                <span className="font-black text-amber-700">Rs. {(s.balance || 0).toLocaleString()}</span>
              )
            ),
          },
          {
            key: "actions",
            header: t("actions"),
            align: "center",
            cell: (s) => (
              <div className="flex justify-center gap-2 text-xs">
                <button
                  onClick={() => {
                    setPurchaseSupId(s.id);
                    setShowPurchaseModal(true);
                  }}
                  className="px-2.5 py-1 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200 hover:bg-amber-100"
                >
                  {t("suppliers_add_purchase_bill")}
                </button>
                <button
                  onClick={() => {
                    setPaymentSupId(s.id);
                    setShowPaymentModal(true);
                  }}
                  className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 hover:bg-emerald-100"
                >
                  {t("suppliers_add_payment")}
                </button>
                <button
                  onClick={() => setShowHistoryModal(s)}
                  className="p-1 text-stone-500 hover:bg-stone-100 rounded"
                  title={t("suppliers_view_ledger")}
                >
                  <History size={16} />
                </button>
                <button
                  onClick={() => startEditSupplier(s)}
                  className="p-1 text-blue-600 hover:bg-blue-50 rounded transition"
                  title={t("suppliers_edit_title")}
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => setDeleteSupplierTarget(s)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded transition"
                  title={t("suppliers_delete_title")}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ),
          },
        ]}
      />

      {showAddSupplierModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-pop w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-stone-50">
              <h3 className="font-extrabold text-stone-900 text-sm flex items-center gap-2">
                <UserPlus size={18} className="text-brand-600" /> {t("suppliers_modal_add_title")}
              </h3>
              <button
                onClick={() => setShowAddSupplierModal(false)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-200"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddSupplierSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  {t("suppliers_label_name")}
                </label>
                <input
                  type="text"
                  placeholder={t("suppliers_placeholder_name")}
                  value={newSupName}
                  onChange={(e) => setNewSupName(e.target.value)}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  {t("suppliers_label_phone")}
                </label>
                <input
                  type="text"
                  placeholder="03xx-xxxxxxx"
                  value={newSupPhone}
                  onChange={(e) => setNewSupPhone(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">{t("address")}</label>
                <input
                  type="text"
                  placeholder={t("address")}
                  value={newSupAddress}
                  onChange={(e) => setNewSupAddress(e.target.value)}
                  className="input-field"
                />
              </div>
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="btn-ghost flex-1 text-xs"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={addingSupplier}
                  className="btn-primary flex-1 text-xs font-bold min-h-[38px] flex items-center justify-center"
                >
                  {addingSupplier ? (
                    <Loader2 className="animate-spin text-white" size={16} />
                  ) : (
                    t("suppliers_save_supplier")
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPurchaseModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-pop w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-amber-50">
              <h3 className="font-extrabold text-amber-900 text-sm flex items-center gap-2">
                <ArrowUpRight size={18} className="text-amber-600" /> {t("suppliers_modal_purchase_title")}
              </h3>
              <button
                onClick={() => setShowPurchaseModal(false)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-200"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handlePurchaseSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  {t("suppliers_label_supplier")}
                </label>
                <select
                  value={purchaseSupId}
                  onChange={(e) => setPurchaseSupId(e.target.value)}
                  className="input-field"
                  required
                >
                  <option value="">{t("suppliers_select_supplier")}</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.balance < 0
                        ? `${s.name} (Advance: Rs. ${Math.abs(s.balance).toLocaleString()})`
                        : t("suppliers_option_balance", { name: s.name, amount: s.balance || 0 })}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  {t("suppliers_label_item")}
                </label>
                <select
                  value={purchaseProdId}
                  onChange={(e) => {
                    const prodId = e.target.value;
                    setPurchaseProdId(prodId);
                    const pr = products.find((p) => p.id === prodId);
                    if (pr) {
                      setPurchaseBuyingPrice(pr.buyingPrice ? pr.buyingPrice : "");
                      if (pr.unitType === "weight") {
                        const bw = (pr as any).weightPerBag || 25;
                        const q = typeof purchaseQty === "number" ? purchaseQty : 1;
                        setPurchaseWeight(q * bw);
                        setIsManualWeight(false);
                      } else {
                        setPurchaseWeight("");
                        setIsManualWeight(false);
                      }
                    } else {
                      setPurchaseWeight("");
                      setIsManualWeight(false);
                    }
                  }}
                  className="input-field"
                  required
                >
                  <option value="">{t("suppliers_select_item")}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {t("suppliers_option_rate", { name: p.name, amount: p.buyingPrice })}
                    </option>
                  ))}
                </select>
              </div>

              {isPurchaseWeight ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-stone-700 block mb-1">
                      {t("suppliers_label_qty_bags")}
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="1"
                      value={purchaseQty}
                      onChange={(e) => handlePurchaseQtyChange(e.target.value)}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-stone-700">
                        {t("suppliers_label_weight")}
                      </label>
                      {isManualWeight && (
                        <button
                          type="button"
                          onClick={resetWeightToAuto}
                          className="text-[10px] text-amber-600 hover:text-amber-800 font-semibold"
                        >
                          {t("suppliers_reset_weight", { perBag: purchaseBagWeight })}
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      min="0.1"
                      step="any"
                      placeholder={String((Number(purchaseQty) || 1) * purchaseBagWeight)}
                      value={purchaseWeight}
                      onChange={(e) => handlePurchaseWeightChange(e.target.value)}
                      className={`input-field ${isManualWeight ? "border-amber-400 bg-amber-50/50" : ""}`}
                      required
                    />
                    <p className="text-[10px] text-stone-500 mt-1 font-medium">
                      {isManualWeight
                        ? t("suppliers_weight_manual_hint", { weight: currentPurchaseWeight })
                        : t("suppliers_weight_auto_hint", {
                            weight: currentPurchaseWeight,
                            perBag: purchaseBagWeight,
                          })}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-700 block mb-1">
                      {t("suppliers_label_rate_kg")}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={purchaseBuyingPrice}
                      onChange={(e) => setPurchaseBuyingPrice(e.target.value === "" ? "" : Number(e.target.value))}
                      className="input-field"
                      required
                    />
                    <p className="text-[10px] text-stone-500 mt-1 font-medium">
                      {t("suppliers_per_bag", {
                        amount: (
                          (Number(purchaseBuyingPrice) || 0) *
                          ((Number(purchaseQty) || 1) > 0 ? currentPurchaseWeight / (Number(purchaseQty) || 1) : purchaseBagWeight)
                        ).toLocaleString(undefined, { maximumFractionDigits: 1 }),
                      })}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-stone-700 block mb-1">
                      {t("suppliers_label_qty_pcs")}
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="1"
                      value={purchaseQty}
                      onChange={(e) => setPurchaseQty(e.target.value === "" ? "" : Number(e.target.value))}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-700 block mb-1">
                      {t("suppliers_label_rate_pc")}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={purchaseBuyingPrice}
                      onChange={(e) => setPurchaseBuyingPrice(e.target.value === "" ? "" : Number(e.target.value))}
                      className="input-field"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    {t("suppliers_label_destination")}
                  </label>
                  <select
                    value={purchaseDestination}
                    onChange={(e) =>
                      setPurchaseDestination(e.target.value as "gudam" | "shop")
                    }
                    className="input-field"
                  >
                    <option value="gudam">{t("suppliers_dest_warehouse")}</option>
                    <option value="shop">{t("suppliers_dest_shop")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    {t("suppliers_label_advance")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={purchasePaidAmount}
                    onChange={(e) => setPurchasePaidAmount(e.target.value === "" ? "" : Number(e.target.value))}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs flex justify-between font-bold items-center">
                <span>
                  {t("suppliers_total_bill")}
                  {isPurchaseWeight && (
                    <span className="text-[11px] text-stone-500 font-normal ml-1">
                      ({currentPurchaseWeight} kg × Rs. {Number(purchaseBuyingPrice) || 0})
                    </span>
                  )}
                </span>
                <span className="text-amber-900 font-extrabold text-sm">
                  Rs. {currentPurchaseTotalBill.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowPurchaseModal(false);
                    setPurchaseProdId("");
                    setPurchaseQty(1);
                    setPurchaseWeight(25);
                    setIsManualWeight(false);
                    setPurchaseBuyingPrice("");
                    setPurchasePaidAmount("");
                  }}
                  className="btn-ghost flex-1 text-xs"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={savingPurchase}
                  className="btn-primary flex-1 text-xs font-bold !bg-amber-600 hover:!bg-amber-700 min-h-[38px] flex items-center justify-center"
                >
                  {savingPurchase ? (
                    <Loader2 className="animate-spin text-white" size={16} />
                  ) : (
                    t("suppliers_save_purchase")
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-pop w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-emerald-50">
              <h3 className="font-extrabold text-emerald-900 text-sm flex items-center gap-2">
                <ArrowDownLeft size={18} className="text-emerald-600" /> {t("suppliers_modal_payment_title")}
              </h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-200"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handlePaymentSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  {t("suppliers_label_supplier")}
                </label>
                <select
                  value={paymentSupId}
                  onChange={(e) => setPaymentSupId(e.target.value)}
                  className="input-field"
                  required
                >
                  <option value="">{t("suppliers_select_supplier")}</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.balance < 0
                        ? `${s.name} (Advance: Rs. ${Math.abs(s.balance).toLocaleString()})`
                        : t("suppliers_option_payable", { name: s.name, amount: s.balance || 0 })}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-stone-700">
                    {t("suppliers_label_payment_amount")}
                  </label>
                  {paymentSupId && (() => {
                    const bal = suppliers.find((s) => s.id === paymentSupId)?.balance || 0;
                    return (
                      <span className="text-[11px] font-semibold text-stone-500">
                        {bal < 0 ? "Advance with Supplier: " : "We Owe: "}
                        <span className={`font-bold ${bal > 0 ? "text-red-600" : "text-emerald-600"}`}>
                          Rs. {Math.abs(bal).toLocaleString()}
                        </span>
                      </span>
                    );
                  })()}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    placeholder="0"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value === "" ? "" : Number(e.target.value))}
                    className="input-field text-lg font-bold text-emerald-800 pr-20"
                    required
                  />
                  {paymentSupId && (suppliers.find((s) => s.id === paymentSupId)?.balance || 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const bal = suppliers.find((s) => s.id === paymentSupId)?.balance || 0;
                        setPaymentAmount(bal);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-200"
                    >
                      Pay Full
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    {t("suppliers_label_payment_method")}
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) =>
                      setPaymentMethod(e.target.value as "Cash" | "Bank Account")
                    }
                    className="input-field"
                  >
                    <option value="Cash">{t("cash")}</option>
                    <option value="Bank Account">{t("suppliers_method_bank")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">{t("suppliers_label_note")}</label>
                  <input
                    type="text"
                    placeholder={t("suppliers_placeholder_note")}
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="btn-ghost flex-1 text-xs"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={savingPayment}
                  className="btn-primary flex-1 text-xs font-bold min-h-[38px] flex items-center justify-center"
                >
                  {savingPayment ? (
                    <Loader2 className="animate-spin text-white" size={16} />
                  ) : (
                    t("suppliers_save_payment")
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-pop w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-stone-50">
              <div>
                <h3 className="font-extrabold text-stone-900 text-sm">
                  {t("suppliers_history_title", { name: showHistoryModal.name })}
                </h3>
                <p className="text-xs font-bold">
                  {(showHistoryModal.balance || 0) < 0 ? (
                    <span className="text-emerald-700">Advance: Rs. {Math.abs(showHistoryModal.balance || 0).toLocaleString()}</span>
                  ) : (
                    <span className="text-amber-700">{t("suppliers_history_balance", { amount: (showHistoryModal.balance || 0).toLocaleString() })}</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setShowHistoryModal(null)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-6">
              <div>
                <h4 className="text-xs font-bold text-stone-700 uppercase border-b pb-2 mb-3">
                  {t("suppliers_history_purchases")}
                </h4>
                <div className="space-y-2">
                  {purchases
                    .filter((p) => p.supplierId === showHistoryModal.id)
                    .map((pur) => (
                      <div
                        key={pur.id}
                        className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs flex justify-between items-center"
                      >
                        <div>
                          <p className="font-bold text-stone-900">
                            {pur.items
                              .map((i) =>
                                (i as any).totalWeight || (i as any).weight
                                  ? `${i.productName} (${i.qty} Bags • ${(i as any).totalWeight || (i as any).weight} kg @ Rs. ${i.buyingPrice})`
                                  : t("suppliers_history_item", { name: i.productName, qty: i.qty, price: i.buyingPrice })
                              )
                              .join(", ")}
                          </p>
                          <p className="text-[11px] text-stone-500">
                            {new Date(pur.date).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="font-black text-amber-800">
                          Rs. {pur.totalAmount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-stone-700 uppercase border-b pb-2 mb-3">
                  {t("suppliers_history_payments")}
                </h4>
                <div className="space-y-2">
                  {payments
                    .filter((p) => p.supplierId === showHistoryModal.id)
                    .map((pay) => (
                      <div
                        key={pay.id}
                        className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs flex justify-between items-center"
                      >
                        <div>
                          <p className="font-bold text-emerald-900">
                            {t("suppliers_history_payment_line", {
                              method: pay.method === "Cash" ? t("cash") : pay.method === "Bank Account" ? t("suppliers_method_bank") : pay.method,
                            })}{" "}
                            {pay.note ? `- ${pay.note}` : ""}
                          </p>
                          <p className="text-[11px] text-emerald-600">
                            {new Date(pay.date).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="font-black text-emerald-800">
                          - Rs. {pay.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Supplier Modal */}
      {editingSupplier && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-pop w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-blue-50">
              <h3 className="font-extrabold text-blue-900 text-sm flex items-center gap-2">
                <Pencil size={18} className="text-blue-600" /> {t("suppliers_modal_edit_title")}
              </h3>
              <button
                onClick={() => setEditingSupplier(null)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-200"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSupplierSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  {t("suppliers_label_name")}
                </label>
                <input
                  type="text"
                  placeholder={t("suppliers_placeholder_name")}
                  value={editSupName}
                  onChange={(e) => setEditSupName(e.target.value)}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  {t("suppliers_label_phone")}
                </label>
                <input
                  type="text"
                  placeholder="03xx-xxxxxxx"
                  value={editSupPhone}
                  onChange={(e) => setEditSupPhone(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">{t("address")}</label>
                <input
                  type="text"
                  placeholder={t("address")}
                  value={editSupAddress}
                  onChange={(e) => setEditSupAddress(e.target.value)}
                  className="input-field"
                />
              </div>
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingSupplier(null)}
                  className="btn-ghost flex-1 text-xs"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn-primary flex-1 text-xs font-bold min-h-[38px] flex items-center justify-center bg-blue-600 hover:bg-blue-700"
                >
                  {savingEdit ? (
                    <Loader2 className="animate-spin text-white" size={16} />
                  ) : (
                    t("suppliers_update_supplier")
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteSupplierTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="p-2.5 rounded-full bg-red-100">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-bold text-stone-900">
                {t("suppliers_delete_title")}
              </h3>
            </div>

            <p className="text-sm text-stone-600 mb-2">
              {t("suppliers_delete_confirm", { name: deleteSupplierTarget.name })}
            </p>

            {deleteSupplierTarget.balance > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 font-semibold mb-4">
                {t("suppliers_delete_balance_warning", {
                  balance: (deleteSupplierTarget.balance || 0).toLocaleString(),
                })}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setDeleteSupplierTarget(null)}
                disabled={deletingSupplier}
                className="btn-ghost !py-2 text-xs"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleDeleteSupplier}
                disabled={deletingSupplier}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                {deletingSupplier ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>{t("delete")}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
