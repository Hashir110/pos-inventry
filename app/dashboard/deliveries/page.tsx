"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Bike,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  DollarSign,
  Download,
  Receipt,
  User,
  RefreshCw,
  Loader2,
  X,
  Package,
} from "lucide-react";
import { toast } from "react-toastify";
import { useStore } from "../../store/useStore";
import {
  listDeliveries,
  createDeliveryOrder,
  updateDeliveryStatus,
  calculateDeliveryMetrics,
  type DeliveryRecord,
  type DeliveryStatus,
} from "../../lib/services/deliveries";
import { listStaffMembers, type StaffMember } from "../../lib/services/staff";

const money = (n: number) => `Rs. ${Math.round(n || 0).toLocaleString()}`;

export default function DeliveriesPage() {
  const { currentUser, currentShop } = useStore();
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Dispatch Modal
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [destination, setDestination] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [codAmount, setCodAmount] = useState("");
  const [riderName, setRiderName] = useState("");
  const [notes, setNotes] = useState("");

  const loadData = async (isManual = false) => {
    if (!currentUser?.uid) return;
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const [delData, staffData] = await Promise.all([
        listDeliveries(currentUser.uid),
        listStaffMembers(currentUser.uid),
      ]);
      setDeliveries(delData);
      setStaff(staffData);
      if (staffData.length > 0 && !riderName) {
        setRiderName(staffData[0].name);
      }
    } catch (error) {
      console.error("Failed to load deliveries:", error);
      toast.error("Could not load delivery dispatches from Firestore.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.uid]);

  const metrics = useMemo(() => calculateDeliveryMetrics(deliveries), [deliveries]);

  const filtered = useMemo(() => {
    return deliveries.filter((d) => {
      const match =
        d.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.trackingNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.riderName.toLowerCase().includes(searchTerm.toLowerCase());
      if (!match) return false;

      if (statusFilter !== "all" && d.deliveryStatus !== statusFilter) return false;
      return true;
    });
  }, [deliveries, searchTerm, statusFilter]);

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.uid) return;

    if (!custName.trim() || !destination.trim()) {
      toast.warn("Please provide customer name and delivery address.");
      return;
    }

    setSubmitting(true);
    try {
      await createDeliveryOrder(currentUser.uid, {
        customerName: custName,
        phone: custPhone,
        destination,
        invoiceNo: invoiceNo || `INV-${Math.floor(1000 + Math.random() * 9000)}`,
        riderName: riderName || "Fleet Rider",
        codAmount: Number(codAmount) || 0,
        notes,
      });

      toast.success("Delivery parcel dispatched to rider!");
      setShowDispatchModal(false);
      setCustName("");
      setCustPhone("");
      setDestination("");
      setInvoiceNo("");
      setCodAmount("");
      setNotes("");
      await loadData();
    } catch (error) {
      console.error("Failed to dispatch delivery:", error);
      toast.error("Could not dispatch delivery order.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (deliveryId: string, newStatus: DeliveryStatus) => {
    try {
      await updateDeliveryStatus(deliveryId, newStatus);
      setDeliveries((prev) =>
        prev.map((d) => (d.id === deliveryId ? { ...d, deliveryStatus: newStatus } : d))
      );
      toast.success(`Parcel status changed to ${newStatus}`);
    } catch (error) {
      toast.error("Could not update delivery status.");
    }
  };

  const handleExportCSV = () => {
    if (deliveries.length === 0) return;

    const rows: string[][] = [
      [`AsaanPOS - Deliveries & Rider Dispatch Log (${currentShop?.shopName || "Store"})`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      ["Tracking No", "Invoice No", "Customer Name", "Phone", "Destination", "Rider", "COD Amount", "Status", "Dispatched At"],
      ...deliveries.map((d) => [
        d.trackingNo,
        d.invoiceNo,
        d.customerName,
        d.phone,
        d.destination,
        d.riderName,
        `Rs. ${d.codAmount}`,
        d.deliveryStatus,
        d.dispatchedAt,
      ]),
    ];

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      rows.map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Deliveries_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Deliveries log exported as CSV");
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* 1. TOP HEADER & ACTIONS */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Deliveries &amp; Rider Dispatch
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Track customer home delivery orders, rider assignments, cash-on-delivery (COD) collections, and route status.
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
            disabled={deliveries.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
          >
            <Download size={14} className="text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setShowDispatchModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition-colors shadow-sm"
          >
            <Plus size={16} />
            <span>Dispatch New Order</span>
          </button>
        </div>
      </div>

      {/* 2. 4 SUMMARY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active On Route</span>
          <div className="mt-3">
            <div className="text-2xl font-bold text-orange-600 tabular-nums">
              {metrics.activeDispatches} Parcels
            </div>
            <div className="text-xs text-slate-500 mt-0.5">With active delivery riders</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">COD Recovered Today</span>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-700 tabular-nums">
              {money(metrics.codCollectedToday)}
            </div>
            <div className="text-xs text-emerald-600 font-semibold mt-0.5">Delivered cash collection</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Completed Deliveries</span>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">
              {metrics.completedDeliveries} Orders
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Successfully handed over</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Fleet Riders</span>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">
              {metrics.activeRiders} Riders
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Active delivery fleet</div>
          </div>
        </div>
      </div>

      {/* 3. DELIVERIES TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
        {/* Table Filters */}
        <div className="p-3.5 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search customer, address, or rider..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-1.5 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-orange-500 cursor-pointer"
            >
              <option value="all">All Delivery Statuses</option>
              <option value="Out for Delivery">Out for Delivery</option>
              <option value="Dispatched">Dispatched</option>
              <option value="Delivered">Delivered</option>
              <option value="Returned">Returned</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-orange-600 mb-2" />
              <span className="text-xs font-semibold text-slate-600">Loading deliveries from Firestore...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center">
              <Bike className="w-10 h-10 text-slate-300 mb-2" />
              <span className="text-xs font-semibold text-slate-600">No home delivery parcels dispatched</span>
              <span className="text-[11px] text-slate-400 mt-0.5">Click "Dispatch New Order" to assign a delivery rider</span>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200">
                  <th className="py-2.5 px-4">Tracking &amp; Invoice</th>
                  <th className="py-2.5 px-3">Customer &amp; Phone</th>
                  <th className="py-2.5 px-3">Destination Address</th>
                  <th className="py-2.5 px-3">Assigned Rider</th>
                  <th className="py-2.5 px-3 text-right">COD Due</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Update Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-slate-900 block">{d.trackingNo}</span>
                      <span className="text-[11px] text-orange-600 font-semibold">{d.invoiceNo}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-800 block">{d.customerName}</span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Phone size={11} /> {d.phone || "No phone"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 max-w-xs truncate">
                      <div className="flex items-center gap-1">
                        <MapPin size={12} className="shrink-0 text-slate-400" />
                        <span className="truncate">{d.destination}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-700 font-medium">
                      <span className="flex items-center gap-1">
                        <Bike size={13} className="text-orange-600" /> {d.riderName}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900 tabular-nums">
                      {money(d.codAmount)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          d.deliveryStatus === "Delivered"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : d.deliveryStatus === "Out for Delivery"
                            ? "bg-orange-50 text-orange-700 border border-orange-200"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {d.deliveryStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <select
                        value={d.deliveryStatus}
                        onChange={(e) => handleStatusChange(d.id, e.target.value as any)}
                        className="py-1 px-2 border border-slate-200 rounded font-bold text-[11px] bg-white cursor-pointer"
                      >
                        <option value="Out for Delivery">Out for Delivery</option>
                        <option value="Delivered">Delivered (Cash Collected)</option>
                        <option value="Dispatched">Dispatched</option>
                        <option value="Returned">Returned / Cancelled</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* DISPATCH NEW ORDER MODAL */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="p-4 bg-orange-50 border-b border-orange-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bike className="text-orange-600" size={18} />
                <h3 className="font-bold text-orange-950 text-sm">Dispatch Home Delivery Order</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDispatchSubmit} className="p-5 flex flex-col gap-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Customer Name *</label>
                  <input
                    type="text"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    placeholder="e.g. Mrs. Farooq"
                    className="w-full bg-white border border-slate-200 py-2 px-3 rounded-lg text-slate-900 outline-none font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Customer Phone</label>
                  <input
                    type="text"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    placeholder="0300-1234567"
                    className="w-full bg-white border border-slate-200 py-2 px-3 rounded-lg text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Delivery Address *</label>
                <textarea
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Street address, house #, area..."
                  rows={2}
                  className="w-full bg-white border border-slate-200 py-2 px-3 rounded-lg text-slate-900 outline-none font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Invoice / Receipt #</label>
                  <input
                    type="text"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    placeholder="INV-10892"
                    className="w-full bg-white border border-slate-200 py-2 px-3 rounded-lg text-slate-900 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">COD Amount (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    value={codAmount}
                    onChange={(e) => setCodAmount(e.target.value)}
                    placeholder="2500"
                    className="w-full bg-white border border-slate-200 py-2 px-3 rounded-lg text-slate-900 outline-none font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Assign Rider</label>
                {staff.length > 0 ? (
                  <select
                    value={riderName}
                    onChange={(e) => setRiderName(e.target.value)}
                    className="w-full bg-white border border-slate-200 py-2 px-2.5 rounded-lg text-slate-800 font-semibold outline-none"
                  >
                    {staff.map((s) => (
                      <option key={s.id} value={`${s.name} (${s.role})`}>
                        {s.name} - {s.role} ({s.status})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={riderName}
                    onChange={(e) => setRiderName(e.target.value)}
                    placeholder="e.g. Kashif Ali (Bike 02)"
                    className="w-full bg-white border border-slate-200 py-2 px-3 rounded-lg text-slate-900 outline-none font-semibold"
                  />
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Dispatch Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Call before arrival"
                  className="w-full bg-white border border-slate-200 py-2 px-3 rounded-lg text-slate-900 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Dispatching...</span>
                    </>
                  ) : (
                    <span>Dispatch Order</span>
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
