"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { toast } from "react-toastify";
import DataTable from "../../components/DataTable";

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
  const [purchaseQty, setPurchaseQty] = useState(1);
  const [purchaseBuyingPrice, setPurchaseBuyingPrice] = useState(0);
  const [purchaseDestination, setPurchaseDestination] = useState<"gudam" | "shop">("gudam");
  const [purchasePaidAmount, setPurchasePaidAmount] = useState(0);

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

  const totalSupplierPayable = suppliers.reduce((sum, s) => sum + (s.balance || 0), 0);

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
    const totalBill = isWeight
      ? Number(purchaseQty) * 25 * Number(purchaseBuyingPrice)
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
      setPurchaseBuyingPrice(0);
      setPurchasePaidAmount(0);
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
    if (paymentAmount <= 0) {
      toast.warn(t("suppliers_warn_amount"));
      return;
    }
    const sup = suppliers.find((s) => s.id === paymentSupId);
    if (!sup) return;

    const currentBalance = sup.balance || 0;
    if (currentBalance <= 0) {
      toast.error(t("suppliers_err_no_balance"));
      return;
    }

    if (paymentAmount > currentBalance) {
      toast.error(
        t("suppliers_err_excess_payment", {
          amount: paymentAmount.toLocaleString(),
          balance: currentBalance.toLocaleString(),
        })
      );
      return;
    }

    try {
      setSavingPayment(true);
      await addSupplierPayment(ownerId, {
        supplierId: sup.id,
        supplierName: sup.name,
        amount: Number(paymentAmount),
        method: paymentMethod,
        note: paymentNote,
      });

      toast.success(t("suppliers_payment_recorded", { amount: paymentAmount, name: sup.name }));
      setShowPaymentModal(false);

      const pay = await listSupplierPayments(ownerId);
      setPayments(pay);

      setPaymentSupId("");
      setPaymentAmount(0);
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
            <p className="text-xl font-black text-amber-900">
              Rs. {totalSupplierPayable.toLocaleString()}
            </p>
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
            cell: (s) => <span className="font-black text-amber-700">Rs. {(s.balance || 0).toLocaleString()}</span>,
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
                      {t("suppliers_option_balance", { name: s.name, amount: s.balance || 0 })}
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
                    setPurchaseProdId(e.target.value);
                    const pr = products.find((p) => p.id === e.target.value);
                    if (pr) setPurchaseBuyingPrice(pr.buyingPrice || 0);
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    {products.find((p) => p.id === purchaseProdId)?.unitType === "weight" ? t("suppliers_label_qty_bags") : t("suppliers_label_qty_pcs")}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={purchaseQty}
                    onChange={(e) => setPurchaseQty(Math.max(1, Number(e.target.value)))}
                    className="input-field"
                    required
                  />
                  {products.find((p) => p.id === purchaseProdId)?.unitType === "weight" && (
                    <p className="text-[10px] text-stone-500 mt-1 font-medium">
                      {t("suppliers_weight_line", { weight: purchaseQty * 25 })}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    {products.find((p) => p.id === purchaseProdId)?.unitType === "weight" ? t("suppliers_label_rate_kg") : t("suppliers_label_rate_pc")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={purchaseBuyingPrice}
                    onChange={(e) => setPurchaseBuyingPrice(Number(e.target.value))}
                    className="input-field"
                    required
                  />
                  {products.find((p) => p.id === purchaseProdId)?.unitType === "weight" && (
                    <p className="text-[10px] text-stone-500 mt-1 font-medium">
                      {t("suppliers_per_bag", { amount: (purchaseBuyingPrice * 25).toLocaleString() })}
                    </p>
                  )}
                </div>
              </div>

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
                    value={purchasePaidAmount}
                    onChange={(e) => setPurchasePaidAmount(Number(e.target.value))}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs flex justify-between font-bold items-center">
                <span>
                  {t("suppliers_total_bill")}
                  {products.find((p) => p.id === purchaseProdId)?.unitType === "weight" && (
                    <span className="text-[11px] text-stone-500 font-normal ml-1">
                      ({purchaseQty * 25} kg × Rs. {purchaseBuyingPrice})
                    </span>
                  )}
                </span>
                <span className="text-amber-900 font-extrabold text-sm">
                  Rs. {(
                    products.find((p) => p.id === purchaseProdId)?.unitType === "weight"
                      ? purchaseQty * 25 * purchaseBuyingPrice
                      : purchaseQty * purchaseBuyingPrice
                  ).toLocaleString()}
                </span>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPurchaseModal(false)}
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
                      {t("suppliers_option_payable", { name: s.name, amount: s.balance || 0 })}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-stone-700">
                    {t("suppliers_label_payment_amount")}
                  </label>
                  {paymentSupId && (
                    <span className="text-[11px] font-semibold text-stone-500">
                      We Owe:{" "}
                      <span className={`font-bold ${(suppliers.find((s) => s.id === paymentSupId)?.balance || 0) > 0 ? "text-red-600" : "text-emerald-600"}`}>
                        Rs. {(suppliers.find((s) => s.id === paymentSupId)?.balance || 0).toLocaleString()}
                      </span>
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max={suppliers.find((s) => s.id === paymentSupId)?.balance || undefined}
                    placeholder="0"
                    value={paymentAmount || ""}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
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
                <p className="text-xs text-amber-700 font-bold">
                  {t("suppliers_history_balance", { amount: (showHistoryModal.balance || 0).toLocaleString() })}
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
                                t("suppliers_history_item", { name: i.productName, qty: i.qty, price: i.buyingPrice })
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
    </div>
  );
}
