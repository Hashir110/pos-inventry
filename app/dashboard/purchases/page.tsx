"use client";

// TODO: connect logic with backend purchase order management service in next phase

import { useState } from "react";
import {
  ShoppingBag,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Truck,
  ArrowRight,
  Download,
  DollarSign,
  PackageCheck,
  FileSpreadsheet,
} from "lucide-react";
import { mockPurchasesMetrics, mockPurchaseOrders, type MockPurchaseOrder } from "../../mocks/purchases";
import { toast } from "react-toastify";

const money = (n: number) => `Rs. ${Math.round(n || 0).toLocaleString()}`;

export default function PurchasesPage() {
  const [orders, setOrders] = useState<MockPurchaseOrder[]>(mockPurchaseOrders);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredOrders = orders.filter((o) => {
    const match =
      o.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.vendorName.toLowerCase().includes(searchTerm.toLowerCase());
    if (!match) return false;

    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    return true;
  });

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

        <button
          onClick={() => toast.info("New PO generation modal - TODO: connect logic")}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition-colors shadow-sm"
        >
          <Plus size={16} />
          <span>Create Purchase Order</span>
        </button>
      </div>

      {/* 2. 4 SUMMARY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Month Purchases</span>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{mockPurchasesMetrics.totalPurchased}</div>
            <div className="text-xs text-slate-500 mt-0.5">Wholesale inventory intake</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Purchase Orders</span>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{mockPurchasesMetrics.activePOs} POs</div>
            <div className="text-xs text-slate-500 mt-0.5">Across authorized distributors</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Pending Deliveries</span>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-700 tabular-nums">{mockPurchasesMetrics.pendingDeliveries} Consignments</div>
            <div className="text-xs text-amber-700 font-semibold mt-0.5">En route to warehouse</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Payables Due</span>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-700 tabular-nums">{mockPurchasesMetrics.payablesDue}</div>
            <div className="text-xs text-rose-600 font-semibold mt-0.5">Pending settlement</div>
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
              <option value="Received">Received</option>
              <option value="Pending Delivery">Pending Delivery</option>
              <option value="Partially Received">Partially Received</option>
              <option value="Draft">Draft</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
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
                const isPaid = po.paidAmount >= po.totalAmount;
                return (
                  <tr key={po.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{po.poNumber}</td>
                    <td className="py-3 px-3 font-semibold text-slate-800">{po.vendorName}</td>
                    <td className="py-3 px-3 text-slate-500">{po.orderDate}</td>
                    <td className="py-3 px-3 text-slate-500">{po.deliveryDate}</td>
                    <td className="py-3 px-3 text-center font-bold text-slate-700">{po.itemsCount} SKUs</td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900 tabular-nums">
                      {money(po.totalAmount)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          po.status === "Received"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : po.status === "Pending Delivery"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {po.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => toast.info(`Viewing details for ${po.poNumber} - TODO: connect logic`)}
                        className="text-orange-600 font-bold hover:underline"
                      >
                        View Order
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
