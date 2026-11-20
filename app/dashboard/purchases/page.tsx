"use client";

import { useEffect, useState, useMemo } from "react";
import {
  ShoppingBag,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Truck,
  ArrowRight,
  Download,
  DollarSign,
  PackageCheck,
  RefreshCw,
  Loader2,
  X,
  Trash2,
  Layers,
  Building2,
} from "lucide-react";
import { toast } from "react-toastify";
import { useStore } from "../../store/useStore";
import {
  listPurchaseOrders,
  createPurchaseOrder,
  markPOReceived,
  calculatePurchasesMetrics,
  type PurchaseOrder,
  type PurchaseOrderItem,
} from "../../lib/services/purchases";
import { listSuppliers } from "../../lib/services/suppliers";
import { listProducts } from "../../lib/services/products";
import type { Product, Supplier } from "../../types";

const money = (n: number) => `Rs. ${Math.round(n || 0).toLocaleString()}`;

export default function PurchasesPage() {
  const { currentUser, currentShop } = useStore();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // New PO Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [destination, setDestination] = useState<"shop" | "warehouse">("shop");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [poNotes, setPoNotes] = useState("");
  const [poItems, setPoItems] = useState<PurchaseOrderItem[]>([]);
  const [submittingPO, setSubmittingPO] = useState(false);

  // View Details Modal State
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);
  const [receivingPOId, setReceivingPOId] = useState<string | null>(null);

  const loadData = async (isManual = false) => {
    if (!currentUser?.uid) return;
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const [pos, supps, prods] = await Promise.all([
        listPurchaseOrders(currentUser.uid),
        listSuppliers(currentUser.uid),
        listProducts(currentUser.uid),
      ]);
      setOrders(pos);
      setSuppliers(supps);
      setProducts(prods);
      if (supps.length > 0 && !selectedSupplierId) {
        setSelectedSupplierId(supps[0].id);
      }
    } catch (error) {
      console.error("Failed to load purchases:", error);
      toast.error("Could not load purchase orders from Firestore.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.uid]);

  const metrics = useMemo(() => calculatePurchasesMetrics(orders, suppliers), [orders, suppliers]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const match =
        o.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.vendorName.toLowerCase().includes(searchTerm.toLowerCase());
      if (!match) return false;

      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      return true;
    });
  }, [orders, searchTerm, statusFilter]);

  const handleAddItemToPO = () => {
    const firstProd = products[0];
    setPoItems((prev) => [
      ...prev,
      {
        productId: firstProd?.id || "",
        name: firstProd?.name || "New Item",
        qty: 10,
        unitRate: firstProd?.buyingPrice || 100,
        total: 10 * (firstProd?.buyingPrice || 100),
      },
    ]);
  };

  const handleUpdatePOItem = (index: number, field: keyof PurchaseOrderItem, value: any) => {
    setPoItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[index], [field]: value };

      if (field === "productId") {
        const prod = products.find((p) => p.id === value);
        if (prod) {
          item.name = prod.name;
          item.unitRate = prod.buyingPrice || item.unitRate;
        }
      }

      item.total = Number(item.qty || 0) * Number(item.unitRate || 0);
      copy[index] = item;
      return copy;
    });
  };

  const handleRemovePOItem = (index: number) => {
    setPoItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreatePOSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.uid) return;

    if (!selectedSupplierId) {
      toast.warn("Please select a vendor / supplier.");
      return;
    }

    if (poItems.length === 0) {
      toast.warn("Please add at least 1 item to the purchase order.");
      return;
    }

    const supplier = suppliers.find((s) => s.id === selectedSupplierId);
    setSubmittingPO(true);

    try {
      await createPurchaseOrder(currentUser.uid, {
        supplierId: selectedSupplierId,
        vendorName: supplier?.name || "Wholesale Vendor",
        deliveryDate: deliveryDate || new Date().toISOString().split("T")[0],
        destination,
        items: poItems,
        notes: poNotes,
      });

      toast.success("Purchase Order created successfully!");
      setShowCreateModal(false);
      setPoItems([]);
      setPoNotes("");
      await loadData();
    } catch (error) {
      console.error("Failed to create PO:", error);
      toast.error("Could not create purchase order.");
    } finally {
      setSubmittingPO(false);
    }
  };

  const handleMarkReceived = async (po: PurchaseOrder) => {
    if (!currentUser?.uid) return;
    setReceivingPOId(po.id);

    try {
      await markPOReceived(currentUser.uid, po);
      toast.success(
        `Order ${po.poNumber} received! Stock updated and supplier ledger debited.`
      );
      if (viewingPO?.id === po.id) {
        setViewingPO(null);
      }
      await loadData();
    } catch (error) {
      console.error("Failed to mark PO as received:", error);
      toast.error("Could not update order status.");
    } finally {
      setReceivingPOId(null);
    }
  };

  const handleExportCSV = () => {
    if (orders.length === 0) return;

    const rows: string[][] = [
      [`AsaanPOS - Purchase Orders Log (${currentShop?.shopName || "Store"})`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      ["PO Number", "Vendor Name", "Order Date", "Delivery Date", "Items Count", "Total Amount", "Status", "Destination"],
      ...orders.map((o) => [
        o.poNumber,
        o.vendorName,
        o.orderDate,
        o.deliveryDate,
        String(o.items?.length || 0),
        `Rs. ${o.totalAmount}`,
        o.status,
        o.destination,
      ]),
    ];

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      rows.map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Purchase_Orders_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Purchase Orders log exported as CSV");
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* 1. TOP HEADER & ACTIONS */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Purchases & Vendor Orders (PO)
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Create vendor purchase orders, receive delivery consignments, and track inventory goods receipt notes (GRN).
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
            title="Reload from Firestore"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin text-orange-600" : "text-slate-500"} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={orders.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
          >
            <Download size={14} className="text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => {
              if (suppliers.length === 0) {
                toast.warn("Please add a supplier in Suppliers section first.");
                return;
              }
              if (poItems.length === 0) handleAddItemToPO();
              setShowCreateModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition-colors shadow-sm"
          >
            <Plus size={16} />
            <span>Create Purchase Order</span>
          </button>
        </div>
      </div>

      {/* 2. 4 SUMMARY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Purchases</span>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">
              {money(metrics.totalPurchased)}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Wholesale inventory intake</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Purchase Orders</span>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{metrics.activePOs} POs</div>
            <div className="text-xs text-slate-500 mt-0.5">Across authorized distributors</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Pending Deliveries</span>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-700 tabular-nums">{metrics.pendingDeliveries} Consignments</div>
            <div className="text-xs text-amber-700 font-semibold mt-0.5">Awaiting GRN receipt</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Payables Due</span>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-700 tabular-nums">{money(metrics.payablesDue)}</div>
            <div className="text-xs text-rose-600 font-semibold mt-0.5">Across vendor accounts</div>
          </div>
        </div>
      </div>

      {/* 3. ORDERS TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
        {/* Table Filters */}
        <div className="p-3.5 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search PO number or vendor..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-1.5 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-orange-500 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="Pending Delivery">Pending Delivery</option>
              <option value="Received">Received</option>
              <option value="Draft">Draft</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-orange-600 mb-2" />
              <span className="text-xs font-semibold text-slate-600">Loading orders from Firestore...</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center">
              <ShoppingBag className="w-10 h-10 text-slate-300 mb-2" />
              <span className="text-xs font-semibold text-slate-600">No purchase orders found</span>
              <span className="text-[11px] text-slate-400 mt-0.5">Click "Create Purchase Order" to start a new order</span>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200">
                  <th className="py-2.5 px-4">PO Number</th>
                  <th className="py-2.5 px-3">Vendor Name</th>
                  <th className="py-2.5 px-3">Order Date</th>
                  <th className="py-2.5 px-3">Delivery Date</th>
                  <th className="py-2.5 px-3 text-center">Items</th>
                  <th className="py-2.5 px-3 text-right">Total Amount</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((po) => {
                  const isReceived = po.status === "Received";
                  return (
                    <tr key={po.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{po.poNumber}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800">{po.vendorName}</td>
                      <td className="py-3 px-3 text-slate-500">{po.orderDate}</td>
                      <td className="py-3 px-3 text-slate-500">{po.deliveryDate}</td>
                      <td className="py-3 px-3 text-center font-bold text-slate-700">
                        {po.items?.length || 0} SKUs
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 tabular-nums">
                        {money(po.totalAmount)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isReceived
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {po.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isReceived && (
                            <button
                              onClick={() => handleMarkReceived(po)}
                              disabled={receivingPOId === po.id}
                              className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] border border-emerald-200 disabled:opacity-50"
                            >
                              {receivingPOId === po.id ? "Receiving..." : "Receive (GRN)"}
                            </button>
                          )}
                          <button
                            onClick={() => setViewingPO(po)}
                            className="text-orange-600 font-bold hover:underline"
                          >
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* CREATE PURCHASE ORDER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-4 bg-orange-50 border-b border-orange-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="text-orange-600" size={18} />
                <h3 className="font-bold text-orange-950 text-sm">Create New Purchase Order</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePOSubmit} className="p-5 flex flex-col gap-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Vendor Select */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Vendor / Supplier *</label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full bg-white border border-slate-200 py-2 px-2.5 rounded-lg font-semibold text-slate-800 outline-none"
                    required
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Destination */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Target Destination</label>
                  <select
                    value={destination}
                    onChange={(e) => setDestination(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 py-2 px-2.5 rounded-lg font-semibold text-slate-800 outline-none"
                  >
                    <option value="shop">Main Shop Register</option>
                    <option value="warehouse">Warehouse (Gudam)</option>
                  </select>
                </div>

                {/* Expected Delivery Date */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Expected Delivery</label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 py-1.5 px-2.5 rounded-lg text-slate-800 outline-none font-semibold"
                  />
                </div>
              </div>

              {/* Order Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden mt-1">
                <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-700">Order Items ({poItems.length})</span>
                  <button
                    type="button"
                    onClick={handleAddItemToPO}
                    className="px-2.5 py-1 rounded bg-orange-600 hover:bg-orange-700 text-white font-bold flex items-center gap-1 text-[11px]"
                  >
                    <Plus size={12} />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {poItems.map((item, idx) => (
                    <div key={idx} className="p-2.5 flex items-center gap-2">
                      <select
                        value={item.productId}
                        onChange={(e) => handleUpdatePOItem(idx, "productId", e.target.value)}
                        className="flex-1 bg-white border border-slate-200 py-1.5 px-2 rounded font-medium text-slate-800 text-xs"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">Qty:</span>
                        <input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={(e) => handleUpdatePOItem(idx, "qty", parseInt(e.target.value) || 1)}
                          className="w-14 py-1 px-1.5 border border-slate-200 rounded font-bold text-center"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">Rate:</span>
                        <input
                          type="number"
                          min="0"
                          value={item.unitRate}
                          onChange={(e) => handleUpdatePOItem(idx, "unitRate", parseFloat(e.target.value) || 0)}
                          className="w-20 py-1 px-1.5 border border-slate-200 rounded font-bold text-right"
                        />
                      </div>

                      <span className="w-20 text-right font-bold text-slate-900 tabular-nums">
                        {money(item.total)}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleRemovePOItem(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between font-bold">
                  <span className="text-slate-600">Total Purchase Value:</span>
                  <span className="text-base text-orange-600">
                    {money(poItems.reduce((acc, curr) => acc + curr.total, 0))}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Order Instructions / Notes</label>
                <input
                  type="text"
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  placeholder="e.g. Deliver before 12 PM, payment on receipt"
                  className="w-full bg-white border border-slate-200 py-2 px-3 rounded-lg text-slate-800 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submittingPO}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPO}
                  className="px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {submittingPO ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Creating Order...</span>
                    </>
                  ) : (
                    <span>Create &amp; Dispatch PO</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW ORDER DETAILS MODAL */}
      {viewingPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Purchase Order: {viewingPO.poNumber}</h3>
                <span className="text-[11px] text-slate-400">Vendor: {viewingPO.vendorName}</span>
              </div>
              <button
                type="button"
                onClick={() => setViewingPO(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3.5 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Order Date</span>
                  <span className="font-bold text-slate-900">{viewingPO.orderDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Expected Delivery</span>
                  <span className="font-bold text-slate-900">{viewingPO.deliveryDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Status</span>
                  <span className="font-bold text-emerald-700">{viewingPO.status}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Destination</span>
                  <span className="font-bold text-slate-900 capitalize">{viewingPO.destination}</span>
                </div>
              </div>

              {/* Items */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-2 bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                  Itemized Manifest
                </div>
                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {viewingPO.items?.map((item, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900 block">{item.name}</span>
                        <span className="text-[10px] text-slate-500">
                          {item.qty} units &times; {money(item.unitRate)}
                        </span>
                      </div>
                      <span className="font-bold text-slate-900 tabular-nums">{money(item.total)}</span>
                    </div>
                  ))}
                </div>
                <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between font-bold">
                  <span>Grand Total:</span>
                  <span className="text-orange-600 text-sm">{money(viewingPO.totalAmount)}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-2">
                {viewingPO.status !== "Received" && (
                  <button
                    type="button"
                    onClick={() => handleMarkReceived(viewingPO)}
                    disabled={receivingPOId === viewingPO.id}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <PackageCheck size={14} />
                    <span>Receive Consignment (GRN)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewingPO(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
