"use client";

import { useEffect, useState, useMemo } from "react";
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
  DollarSign,
  RefreshCw,
  Loader2,
  X,
  Trash2,
  Edit2,
  KeyRound,
} from "lucide-react";
import { toast } from "react-toastify";
import { useStore } from "../../store/useStore";
import {
  listStaffMembers,
  addStaffMember,
  updateStaffMember,
  deleteStaffMember,
  calculateStaffMetrics,
  type StaffMember,
  type StaffRole,
  type StaffShift,
  type StaffStatus,
} from "../../lib/services/staff";

const money = (n: number) => `Rs. ${Math.round(n || 0).toLocaleString()}`;

export default function StaffShiftsPage() {
  const { currentUser, currentShop } = useStore();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState<StaffRole>("Cashier");
  const [formShift, setFormShift] = useState<StaffShift>("Morning");
  const [formPhone, setFormPhone] = useState("");
  const [formRegister, setFormRegister] = useState("Register #01");
  const [formFloat, setFormFloat] = useState("10000");
  const [formPin, setFormPin] = useState("0123");
  const [formStatus, setFormStatus] = useState<StaffStatus>("On-Duty");

  const loadData = async (isManual = false) => {
    if (!currentUser?.uid) return;
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await listStaffMembers(currentUser.uid);
      setStaff(data);
    } catch (error) {
      console.error("Failed to load staff list:", error);
      toast.error("Could not load staff directory from Firestore.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.uid]);

  const metrics = useMemo(() => calculateStaffMetrics(staff), [staff]);

  const filtered = useMemo(() => {
    return staff.filter(
      (s) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.assignedRegister.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [staff, searchTerm]);

  const handleOpenAddModal = (memberToEdit?: StaffMember) => {
    if (memberToEdit) {
      setEditingStaff(memberToEdit);
      setFormName(memberToEdit.name);
      setFormRole(memberToEdit.role);
      setFormShift(memberToEdit.shift);
      setFormPhone(memberToEdit.phone);
      setFormRegister(memberToEdit.assignedRegister);
      setFormFloat(String(memberToEdit.startingFloat || 0));
      setFormPin(memberToEdit.quickPin || "0123");
      setFormStatus(memberToEdit.status);
    } else {
      setEditingStaff(null);
      setFormName("");
      setFormRole("Cashier");
      setFormShift("Morning");
      setFormPhone("");
      setFormRegister(`Register #${staff.length + 1}`);
      setFormFloat("10000");
      setFormPin("0123");
      setFormStatus("On-Duty");
    }
    setShowAddModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.uid) return;

    if (!formName.trim()) {
      toast.warn("Please enter employee name.");
      return;
    }

    setSubmitting(true);
    try {
      if (editingStaff) {
        await updateStaffMember(editingStaff.id, {
          name: formName,
          role: formRole,
          shift: formShift,
          phone: formPhone,
          assignedRegister: formRegister,
          startingFloat: Number(formFloat) || 0,
          quickPin: formPin,
          status: formStatus,
        });
        toast.success(`Updated staff record for ${formName}`);
      } else {
        await addStaffMember(currentUser.uid, {
          name: formName,
          role: formRole,
          shift: formShift,
          phone: formPhone,
          assignedRegister: formRegister,
          startingFloat: Number(formFloat) || 0,
          quickPin: formPin,
          status: formStatus,
        });
        toast.success(`Added ${formName} to staff roster!`);
      }

      setShowAddModal(false);
      await loadData();
    } catch (error) {
      console.error("Failed to save staff:", error);
      toast.error("Could not save staff member.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (member: StaffMember) => {
    const nextStatus: StaffStatus =
      member.status === "On-Duty" ? "Off-Duty" : member.status === "Off-Duty" ? "On-Duty" : "Off-Duty";

    try {
      await updateStaffMember(member.id, { status: nextStatus });
      setStaff((prev) =>
        prev.map((s) => (s.id === member.id ? { ...s, status: nextStatus } : s))
      );
      toast.success(`${member.name} marked as ${nextStatus}`);
    } catch (error) {
      toast.error("Could not update status.");
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from staff roster?`)) return;
    try {
      await deleteStaffMember(id);
      setStaff((prev) => prev.filter((s) => s.id !== id));
      toast.success(`Removed ${name}`);
    } catch (error) {
      toast.error("Could not delete staff member.");
    }
  };

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
            onClick={() => handleOpenAddModal()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition-colors shadow-sm"
          >
            <Plus size={16} />
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>

      {/* 2. 4 SUMMARY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Staff</span>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">
              {metrics.totalStaff} Employees
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Across all branch shifts</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Currently On-Duty</span>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-700 tabular-nums">
              {metrics.activeOnDuty} Active
            </div>
            <div className="text-xs text-emerald-600 font-semibold mt-0.5">Clocked in right now</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Cash Registers</span>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">
              {metrics.activeRegisters} Counters
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Live till processing</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-orange-600">Current Shift Window</span>
          <div className="mt-3">
            <div className="text-lg font-bold text-slate-900 truncate">{metrics.activeShift}</div>
            <div className="text-xs text-slate-400 mt-0.5">Automated time detection</div>
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
              placeholder="Search staff name, role or register..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-orange-600 mb-2" />
              <span className="text-xs font-semibold text-slate-600">Loading staff records from Firestore...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center">
              <Users className="w-10 h-10 text-slate-300 mb-2" />
              <span className="text-xs font-semibold text-slate-600">No employees registered yet</span>
              <span className="text-[11px] text-slate-400 mt-0.5">Click "Add Staff Member" to register cashiers and shift staff</span>
            </div>
          ) : (
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
                {filtered.map((s) => {
                  const isOnDuty = s.status === "On-Duty";
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs">
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{s.name}</span>
                            <span className="text-[11px] text-slate-400">{s.phone || "No phone"}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 font-semibold text-slate-800">{s.role}</td>
                      <td className="py-3 px-3 text-slate-600">{s.shift}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-700">{s.assignedRegister}</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 tabular-nums">
                        {money(s.startingFloat)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(s)}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                            isOnDuty
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                          title="Click to toggle status"
                        >
                          {s.status}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenAddModal(s)}
                            className="p-1 text-slate-400 hover:text-orange-600 rounded"
                            title="Edit details"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteStaff(s.id, s.name)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            title="Delete staff"
                          >
                            <Trash2 size={14} />
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

      {/* ADD / EDIT STAFF MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="p-4 bg-orange-50 border-b border-orange-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="text-orange-600" size={18} />
                <h3 className="font-bold text-orange-950 text-sm">
                  {editingStaff ? "Edit Employee" : "Add Staff Member"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-5 flex flex-col gap-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Hamza Malik"
                  className="w-full bg-white border border-slate-200 py-2 px-3 rounded-lg text-slate-900 outline-none font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 py-2 px-2.5 rounded-lg text-slate-800 font-semibold outline-none"
                  >
                    <option value="Cashier">Cashier</option>
                    <option value="Branch Manager">Branch Manager</option>
                    <option value="Inventory Stocker">Inventory Stocker</option>
                    <option value="Rider">Rider</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Assigned Shift</label>
                  <select
                    value={formShift}
                    onChange={(e) => setFormShift(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 py-2 px-2.5 rounded-lg text-slate-800 font-semibold outline-none"
                  >
                    <option value="Morning">Morning Shift</option>
                    <option value="Evening">Evening Shift</option>
                    <option value="Full Day">Full Day</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="0300-1234567"
                    className="w-full bg-white border border-slate-200 py-2 px-3 rounded-lg text-slate-900 outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Register / Station</label>
                  <input
                    type="text"
                    value={formRegister}
                    onChange={(e) => setFormRegister(e.target.value)}
                    placeholder="Register #01"
                    className="w-full bg-white border border-slate-200 py-2 px-3 rounded-lg text-slate-900 outline-none font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Drawer Starting Float</label>
                  <input
                    type="number"
                    min="0"
                    value={formFloat}
                    onChange={(e) => setFormFloat(e.target.value)}
                    placeholder="10000"
                    className="w-full bg-white border border-slate-200 py-2 px-3 rounded-lg text-slate-900 outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Quick PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    value={formPin}
                    onChange={(e) => setFormPin(e.target.value)}
                    placeholder="0123"
                    className="w-full bg-white border border-slate-200 py-2 px-3 rounded-lg text-slate-900 outline-none font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Duty Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 py-2 px-2.5 rounded-lg text-slate-800 font-semibold outline-none"
                >
                  <option value="On-Duty">On-Duty (Active)</option>
                  <option value="Off-Duty">Off-Duty</option>
                  <option value="On-Break">On-Break</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingStaff ? "Update Employee" : "Save Employee"}</span>
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
