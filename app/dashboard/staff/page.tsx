"use client";

// TODO: connect logic with backend staff and shift roster service in next phase

import { useState } from "react";
import {
  Users,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  UserCheck,
  Phone,
  ShieldCheck,
  Badge,
  DollarSign,
} from "lucide-react";
import { mockStaffMetrics, mockStaffList, type MockStaffMember } from "../../mocks/staff";
import { toast } from "react-toastify";

const money = (n: number) => `Rs. ${Math.round(n || 0).toLocaleString()}`;

export default function StaffShiftsPage() {
  const [staff, setStaff] = useState<MockStaffMember[]>(mockStaffList);
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = staff.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.assignedRegister.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* 1. TOP HEADER & ACTIONS */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Staff &amp; Shift Management
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Manage cashier shift assignments, on-duty attendance, float handover, and register role permissions.
          </p>
        </div>

        <button
          onClick={() => toast.info("Add new employee - TODO: connect logic")}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition-colors shadow-sm"
        >
          <Plus size={16} />
          <span>Add Staff Member</span>
        </button>
      </div>

      {/* 2. 4 SUMMARY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Staff</span>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{mockStaffMetrics.totalStaff} Employees</div>
            <div className="text-xs text-slate-500 mt-0.5">Across all branch shifts</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Currently On-Duty</span>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-700 tabular-nums">{mockStaffMetrics.activeOnDuty} Active</div>
            <div className="text-xs text-emerald-600 font-semibold mt-0.5">Clocked in right now</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Cash Registers</span>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{mockStaffMetrics.activeRegisters} Counters</div>
            <div className="text-xs text-slate-500 mt-0.5">Live till processing</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-orange-600">Current Shift Window</span>
          <div className="mt-3">
            <div className="text-lg font-bold text-slate-900 truncate">{mockStaffMetrics.activeShift}</div>
            <div className="text-xs text-slate-400 mt-0.5">08:00 AM - 04:00 PM</div>
          </div>
        </div>
      </div>

      {/* 3. STAFF DIRECTORY TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
        {/* Table Filters */}
        <div className="p-3.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search staff name or register..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200">
                <th className="py-2.5 px-4">Employee Name</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Assigned Shift</th>
                <th className="py-2.5 px-3">Register / Station</th>
                <th className="py-2.5 px-3 text-right">Drawer Float</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-900 block text-xs">{s.name}</span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Phone size={11} /> {s.phone}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-semibold text-slate-800">{s.role}</span>
                  </td>
                  <td className="py-3 px-3 text-slate-600">{s.shift}</td>
                  <td className="py-3 px-3 font-medium text-slate-700">{s.assignedRegister}</td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900 tabular-nums">
                    {s.startingFloat > 0 ? money(s.startingFloat) : "—"}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.status === "On-Duty"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => toast.info(`Editing shift for ${s.name} - TODO: connect logic`)}
                      className="text-orange-600 font-bold hover:underline"
                    >
                      Edit Shift
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
