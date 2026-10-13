"use client";

import { useEffect, useState } from "react";
import { useStore } from "../../store/useStore";
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
        console.error("Failed loading supplier history:", e);
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
      toast.warn("Supplier ka naam enter karein");
      return;
    }
    try {
      setAddingSupplier(true);
      await addSupplier(ownerId, {
        name: newSupName,
        phone: newSupPhone,
        address: newSupAddress,
      });
      toast.success(`Supplier "${newSupName}" add ho gaya!`);
      setShowAddSupplierModal(false);
      setNewSupName("");
      setNewSupPhone("");
      setNewSupAddress("");
    } catch (err: any) {
      toast.error(err.message || "Failed to add supplier");
    } finally {
      setAddingSupplier(false);
    }
  };

  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseSupId) {
      toast.warn("Supplier select karein");
      return;
    }
    if (!purchaseProdId) {
      toast.warn("Product select karein");
      return;
    }
    const prod = products.find((p) => p.id === purchaseProdId);
    const sup = suppliers.find((s) => s.id === purchaseSupId);

    if (!prod || !sup) return;

    const totalBill = purchaseQty * purchaseBuyingPrice;

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

      toast.success(`Purchase bill recorded! Stock updated in ${purchaseDestination.toUpperCase()}`);
      setShowPurchaseModal(false);

      const pur = await listSupplierPurchases(ownerId);
      setPurchases(pur);

      setPurchaseSupId("");
      setPurchaseProdId("");
      setPurchaseQty(1);
      setPurchaseBuyingPrice(0);
      setPurchasePaidAmount(0);
    } catch (err: any) {
      toast.error(err.message || "Purchase entry failed");
    } finally {
      setSavingPurchase(false);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentSupId) {
      toast.warn("Supplier select karein");
      return;
    }
    if (paymentAmount <= 0) {
      toast.warn("Payment amount 0 se bari honi chahiye");
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

      toast.success(`Payment of Rs. ${paymentAmount} paid to ${sup.name}`);
      setShowPaymentModal(false);

      const pay = await listSupplierPayments(ownerId);
      setPayments(pay);

      setPaymentSupId("");
      setPaymentAmount(0);
      setPaymentNote("");
    } catch (err: any) {
      toast.error(err.message || "Payment entry failed");
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
            <Truck className="text-brand-600" size={24} /> Suppliers & Vendor Accounts
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Jin parties se maal khareedte hain unka ledger, purchase bills aur payouts maintain karein
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowAddSupplierModal(true)}
            className="btn-ghost text-xs font-bold flex items-center gap-1.5"
          >
            <UserPlus size={16} /> Naya Supplier
          </button>
          <button
            onClick={() => setShowPurchaseModal(true)}
            className="btn-primary text-xs font-bold flex items-center gap-1.5 !bg-amber-600 hover:!bg-amber-700"
          >
            <ArrowUpRight size={16} /> Maal Uthaya (Purchase)
          </button>
          <button
            onClick={() => setShowPaymentModal(true)}
            className="btn-primary text-xs font-bold flex items-center gap-1.5"
          >
            <ArrowDownLeft size={16} /> Payment Di (Payout)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-100 text-amber-700">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-xs text-stone-500 font-bold uppercase">Total Suppliers Payable</p>
            <p className="text-xl font-black text-amber-900">
              Rs. {totalSupplierPayable.toLocaleString()}
            </p>
            <p className="text-[11px] text-stone-400">Humne jin parties ke paise dene hain</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-brand-100 text-brand-700">
            <Building2 size={24} />
          </div>
          <div>
            <p className="text-xs text-stone-500 font-bold uppercase">Total Registered Suppliers</p>
            <p className="text-xl font-black text-stone-900">{suppliers.length}</p>
            <p className="text-[11px] text-stone-400">Active Vendor Accounts</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-100 text-emerald-700">
            <Package size={24} />
          </div>
          <div>
            <p className="text-xs text-stone-500 font-bold uppercase">Total Purchase Bills</p>
            <p className="text-xl font-black text-stone-900">{purchases.length}</p>
            <p className="text-[11px] text-stone-400">Recorded Stock Receipts</p>
          </div>
        </div>
      </div>

      <DataTable
        data={filteredSuppliers}
        rowKey={(s) => s.id}
        emptyText={<>Koi Supplier record nahi mila. &quot;Naya Supplier&quot; par click karke add karein.</>}
        toolbarLeft={
          <h2 className="text-sm font-bold text-stone-800 uppercase tracking-wider">Suppliers List & Balance</h2>
        }
        toolbarRight={
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Search Supplier Name / Phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-9 text-xs"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={14} />
          </div>
        }
        columns={[
          { key: "name", header: "Supplier Name", cell: (s) => <span className="font-extrabold text-stone-900">{s.name}</span> },
          { key: "phone", header: "Phone", cell: (s) => <span className="text-stone-600">{s.phone || "-"}</span> },
          { key: "address", header: "Address", cell: (s) => <span className="text-stone-500">{s.address || "-"}</span> },
          {
            key: "balance",
            header: "Humne Dene Hain (Balance)",
            align: "right",
            cell: (s) => <span className="font-black text-amber-700">Rs. {(s.balance || 0).toLocaleString()}</span>,
          },
          {
            key: "actions",
            header: "Actions",
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
                  + Purchase Bill
                </button>
                <button
                  onClick={() => {
                    setPaymentSupId(s.id);
                    setShowPaymentModal(true);
                  }}
                  className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 hover:bg-emerald-100"
                >
                  + Payment Di
                </button>
                <button
                  onClick={() => setShowHistoryModal(s)}
                  className="p-1 text-stone-500 hover:bg-stone-100 rounded"
                  title="View Ledger"
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
                <UserPlus size={18} className="text-brand-600" /> Naya Supplier Add Karein
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
                  Supplier / Mill Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Madina Rice Mill / Supplier B"
                  value={newSupName}
                  onChange={(e) => setNewSupName(e.target.value)}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  placeholder="0300-1234567"
                  value={newSupPhone}
                  onChange={(e) => setNewSupPhone(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Address</label>
                <input
                  type="text"
                  placeholder="City / Market Address"
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
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingSupplier}
                  className="btn-primary flex-1 text-xs font-bold min-h-[38px] flex items-center justify-center"
                >
                  {addingSupplier ? (
                    <Loader2 className="animate-spin text-white" size={16} />
                  ) : (
                    "Save Supplier"
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
                <ArrowUpRight size={18} className="text-amber-600" /> Maal Uthaya / Purchase Entry
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
                  Supplier Select Karein *
                </label>
                <select
                  value={purchaseSupId}
                  onChange={(e) => setPurchaseSupId(e.target.value)}
                  className="input-field"
                  required
                >
                  <option value="">-- Select Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Current Balance: Rs. {s.balance || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Item Select Karein *
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
                  <option value="">-- Select Item --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Buying Rate: Rs. {p.buyingPrice})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Quantity (Bags / KG) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={purchaseQty}
                    onChange={(e) => setPurchaseQty(Math.max(1, Number(e.target.value)))}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Buying Price per Unit *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={purchaseBuyingPrice}
                    onChange={(e) => setPurchaseBuyingPrice(Number(e.target.value))}
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Maal kahan Shift karein?
                  </label>
                  <select
                    value={purchaseDestination}
                    onChange={(e) =>
                      setPurchaseDestination(e.target.value as "gudam" | "shop")
                    }
                    className="input-field"
                  >
                    <option value="gudam">Gudam (Warehouse)</option>
                    <option value="shop">Dukan (Shop)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Advance Payment Di (Optional)
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

              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs flex justify-between font-bold">
                <span>Total Bill Amount:</span>
                <span className="text-amber-900 font-extrabold text-sm">
                  Rs. {(purchaseQty * purchaseBuyingPrice).toLocaleString()}
                </span>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPurchaseModal(false)}
                  className="btn-ghost flex-1 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPurchase}
                  className="btn-primary flex-1 text-xs font-bold !bg-amber-600 hover:!bg-amber-700 min-h-[38px] flex items-center justify-center"
                >
                  {savingPurchase ? (
                    <Loader2 className="animate-spin text-white" size={16} />
                  ) : (
                    "Save Purchase Entry"
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
                <ArrowDownLeft size={18} className="text-emerald-600" /> Supplier Ko Payment Di (Payout)
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
                  Supplier Select Karein *
                </label>
                <select
                  value={paymentSupId}
                  onChange={(e) => setPaymentSupId(e.target.value)}
                  className="input-field"
                  required
                >
                  <option value="">-- Select Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Current Payable: Rs. {s.balance || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Payment Amount (Rs.) *
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 50000"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="input-field text-lg font-bold text-emerald-800"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) =>
                      setPaymentMethod(e.target.value as "Cash" | "Bank Account")
                    }
                    className="input-field"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Account">Bank Account</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Note</label>
                  <input
                    type="text"
                    placeholder="Ref / Cheque No."
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
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPayment}
                  className="btn-primary flex-1 text-xs font-bold min-h-[38px] flex items-center justify-center"
                >
                  {savingPayment ? (
                    <Loader2 className="animate-spin text-white" size={16} />
                  ) : (
                    "Save Payment Entry"
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
                  {showHistoryModal.name} - Supplier Ledger History
                </h3>
                <p className="text-xs text-amber-700 font-bold">
                  Current Balance: Rs. {(showHistoryModal.balance || 0).toLocaleString()}
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
                  📦 Purchase Bills (Maal Uthaya History)
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
                            {pur.items.map((i) => `${i.productName} (${i.qty} units @ Rs. ${i.buyingPrice})`).join(", ")}
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
                  💵 Payments Made (Payout History)
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
                            Payment ({pay.method}) {pay.note ? `- ${pay.note}` : ""}
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
