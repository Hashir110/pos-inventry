"use client";

// TODO: connect logic with backend dispatch & delivery service in next phase

import { useState } from "react";
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
} from "lucide-react";
import { mockDeliveryMetrics, mockDeliveriesList, type MockDelivery } from "../../mocks/deliveries";
import { toast } from "react-toastify";

const money = (n: number) => `Rs. ${Math.round(n || 0).toLocaleString()}`;

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<MockDelivery[]>(mockDeliveriesList);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = deliveries.filter((d) => {
    const match =
      d.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.trackingNo.toLowerCase().includes(searchTerm.toLowerCase());
    if (!match) return false;

    if (statusFilter !== "all" && d.deliveryStatus !== statusFilter) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* 1. TOP HEADER & ACTIONS */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Deliveries & Rider Dispatch
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Track customer home delivery orders, rider assignments, cash-on-delivery (COD) collections, and route status.
          </p>
        </div>

        <button
          onClick={() => toast.info("New delivery parcel assignment - TODO: connect logic")}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition-colors shadow-sm"
        >
          <Plus size={16} />
          <span>Dispatch New Order</span>
        </button>
      </div>

      {/* 2. 4 SUMMARY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active On Route</span>
          <div className="mt-3">
            <div className="text-2xl font-bold text-orange-600 tabular-nums">{mockDeliveryMetrics.activeDispatches} Parcels</div>
            <div className="text-xs text-slate-500 mt-0.5">With active delivery riders</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">COD Recovered Today</span>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-700 tabular-nums">{mockDeliveryMetrics.codCollectedToday}</div>
            <div className="text-xs text-emerald-600 font-semibold mt-0.5">Cash handed over at till</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Completed Deliveries</span>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{mockDeliveryMetrics.completedDeliveries} Orders</div>
            <div className="text-xs text-slate-500 mt-0.5">Delivered within 45 mins avg</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">On-Duty Riders</span>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{mockDeliveryMetrics.activeRiders} Fleet Riders</div>
            <div className="text-xs text-slate-500 mt-0.5">Counter 01 Dispatch Hub</div>
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
              placeholder="Search customer, invoice #, or tracking..."
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
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200">
                <th className="py-2.5 px-4">Tracking &amp; Invoice</th>
                <th className="py-2.5 px-3">Customer &amp; Phone</th>
                <th className="py-2.5 px-3">Destination Address</th>
                <th className="py-2.5 px-3">Assigned Rider</th>
                <th className="py-2.5 px-3 text-right">COD Due</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
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
                      <Phone size={11} /> {d.phone}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-600 flex items-center gap-1 max-w-xs truncate">
                    <MapPin size={12} className="shrink-0 text-slate-400" />
                    <span>{d.destination}</span>
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
                    <button
                      onClick={() => toast.info(`Marking delivered for ${d.trackingNo} - TODO: connect logic`)}
                      className="text-orange-600 font-bold hover:underline"
                    >
                      Update
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
