"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { History, Plus, RefreshCw, Search, Users, Wallet, ArrowUpRight, Loader2, Pencil, Trash2, X, AlertTriangle } from "lucide-react";
import { toast } from "react-toastify";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../store/useLanguage";
import Link from "next/link";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import SummaryBox from "../../components/SummaryBox";
import ReceivePaymentModal from "../../components/ReceivePaymentModal";
import CustomerWithdrawModal from "../../components/CustomerWithdrawModal";
import { formatMoney } from "../../lib/format";
import { addCustomer, listCustomers, updateCustomer, deleteCustomer } from "../../lib/services/customers";
import type { Customer } from "../../types";

export default function UdharPage() {
  const { currentUser } = useStore();
  const { t } = useLanguage();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [adding, setAdding] = useState(false);

  const [payFor, setPayFor] = useState<Customer | null>(null);
  const [withdrawFor, setWithdrawFor] = useState<Customer | null>(null);

  // Edit party state
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [updating, setUpdating] = useState(false);

  // Delete party state
  const [deleteCustomerTarget, setDeleteCustomerTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCustomers = useCallback(async (force = false) => {
    if (!currentUser) return;
    if (force) setRefreshing(true);
    try {
      setCustomers(await listCustomers(currentUser.uid, force));
      if (force) toast.success("Customers updated");
    } catch (error) {
      console.error(error);
      toast.error(t("credit_loadFailed"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser, t]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const totalOutstanding = useMemo(
    () => customers.reduce((sum, c) => sum + (c.balance || 0), 0),
    [customers]
  );
  const debtors = useMemo(() => customers.filter((c) => c.balance > 0).length, [customers]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = customers.filter(
      (c) => c.name.toLowerCase().includes(term) || (c.phone ?? "").includes(term)
    );
    return [...list].sort((a, b) => {
      const balA = a.balance ?? 0;
      const balB = b.balance ?? 0;
      if (balB !== balA) {
        return balB - balA;
      }
      return a.name.localeCompare(b.name);
    });
  }, [customers, search]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newName.trim()) return;
    setAdding(true);
    try {
      await addCustomer(currentUser.uid, { name: newName, phone: newPhone });
      setNewName("");
      setNewPhone("");
      toast.success(t("credit_addSuccess"));
      fetchCustomers();
    } catch (error) {
      console.error(error);
      toast.error(t("credit_addFailed"));
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (c: Customer) => {
    setEditingCustomer(c);
    setEditName(c.name);
    setEditPhone(c.phone || "");
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !editingCustomer || !editName.trim()) return;
    setUpdating(true);
    try {
      await updateCustomer(currentUser.uid, editingCustomer.id, {
        name: editName,
        phone: editPhone,
      });
      toast.success(t("credit_editSuccess"));
      setEditingCustomer(null);
      fetchCustomers();
    } catch (error) {
      console.error(error);
      toast.error(t("credit_editFailed"));
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!currentUser || !deleteCustomerTarget) return;
    setDeleting(true);
    try {
      await deleteCustomer(currentUser.uid, deleteCustomerTarget.id);
      toast.success(t("credit_deleteSuccess"));
      setDeleteCustomerTarget(null);
      fetchCustomers();
    } catch (error) {
      console.error(error);
      toast.error(t("credit_deleteFailed"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("creditLedger")}
        subtitle={t("manageCustomerBalances")}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchCustomers(true)}
              disabled={refreshing}
              className="btn-secondary flex items-center gap-1.5"
              title="Refresh from server"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <SummaryBox label={t("totalReceivable")} value={formatMoney(totalOutstanding)} tone="amber" isPrivate />
            <SummaryBox label={t("customersCount")} value={debtors} />
          </div>
        }
      />
      <form
        onSubmit={handleAdd}
        className="bg-white p-5 rounded-2xl shadow-card border border-stone-200 flex flex-col md:flex-row gap-3 md:items-end"
      >
        <div className="flex-1">
          <label className="text-xs font-semibold text-stone-500 mb-1 block">{t("customerNameCol")}</label>
          <input
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("credit_partyNamePlaceholder")}
            className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
          />
        </div>
        <div className="w-full md:w-52">
          <label className="text-xs font-semibold text-stone-500 mb-1 block">{t("phone")}</label>
          <input
            type="tel"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="03xx-xxxxxxx"
            className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={adding}
          className="min-w-[130px] px-6 py-2.5 bg-ink text-white rounded-lg hover:bg-ink-800 font-bold flex items-center justify-center gap-2 disabled:opacity-50 min-h-[42px]"
        >
          {adding ? (
            <Loader2 className="animate-spin text-white" size={18} />
          ) : (
            <>
              <Plus size={18} />
              <span>{t("addCustomerBtn")}</span>
            </>
          )}
        </button>
      </form>

      <DataTable
        data={filtered}
        rowKey={(c) => c.id}
        loading={loading}
        emptyText={t("credit_noCustomers")}
        toolbarLeft={
          <h3 className="font-bold text-stone-700 flex items-center gap-2">
            <Users size={18} /> {t("customersCount")} ({customers.length})
          </h3>
        }
        toolbarRight={
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search")}
              className="field pl-9"
            />
          </div>
        }
        columns={[
          {
            key: "name",
            header: t("customerNameCol"),
            cell: (c) => (
              <Link href={`/dashboard/udhar/${c.id}`} className="font-semibold text-stone-800 hover:text-brand-600 hover:underline">
                {c.name}
              </Link>
            ),
          },
          { key: "phone", header: t("phoneCol"), cell: (c) => <span className="text-stone-500">{c.phone || "-"}</span> },
          {
            key: "balance",
            header: t("balanceCol"),
            cell: (c) => (
              c.balance < 0 ? (
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full text-xs">
                  Advance: {formatMoney(Math.abs(c.balance))}
                </span>
              ) : (
                <span className={`font-bold ${c.balance > 0 ? "text-red-600" : "text-stone-500"}`}>{formatMoney(c.balance)}</span>
              )
            ),
          },
          {
            key: "actions",
            header: t("action"),
            align: "right",
            cell: (c) => (
              <div className="flex justify-end items-center gap-1.5">
                <Link
                  href={`/dashboard/udhar/${c.id}`}
                  className="p-2 text-stone-500 hover:bg-stone-100 rounded-lg transition"
                  title={t("viewLedger")}
                >
                  <History size={17} />
                </Link>
                <button
                  onClick={() => setPayFor(c)}
                  className="px-2.5 py-1.5 bg-emerald-100 text-emerald-700 rounded-md hover:bg-emerald-200 text-xs font-bold flex items-center gap-1"
                >
                  <Wallet size={14} /> {t("credit_collect")}
                </button>
                {Math.abs(c.balance || 0) > 0.001 && (
                  <button
                    onClick={() => setWithdrawFor(c)}
                    className="px-2.5 py-1.5 bg-amber-100 text-amber-800 rounded-md hover:bg-amber-200 text-xs font-bold flex items-center gap-1"
                    title={t("credit_withdrawTitle")}
                  >
                    <ArrowUpRight size={14} /> {t("credit_withdraw")}
                  </button>
                )}
                <button
                  onClick={() => startEdit(c)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  title={t("credit_editCustomer")}
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => setDeleteCustomerTarget(c)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  title={t("credit_deleteCustomer")}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ),
          },
        ]}
      />

      <ReceivePaymentModal customer={payFor} onClose={() => setPayFor(null)} onSuccess={fetchCustomers} />
      <CustomerWithdrawModal customer={withdrawFor} onClose={() => setWithdrawFor(null)} onSuccess={fetchCustomers} />

      {/* Edit Party Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4 bg-stone-50">
              <div className="flex items-center gap-2">
                <Pencil size={18} className="text-blue-600" />
                <h3 className="font-bold text-stone-900 text-base">
                  {t("credit_editCustomer")}
                </h3>
              </div>
              <button
                onClick={() => setEditingCustomer(null)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-200"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1 block">
                  {t("customerNameCol")} *
                </label>
                <input
                  required
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={t("credit_partyNamePlaceholder")}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-stone-900 font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1 block">
                  {t("phone")}
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="03xx-xxxxxxx"
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-stone-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="btn-ghost !py-2 text-xs"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={updating || !editName.trim()}
                  className="btn-primary !py-2 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {updating ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <span>{t("save")}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteCustomerTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="p-2.5 rounded-full bg-red-100">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-bold text-stone-900">
                {t("credit_deleteCustomer")}
              </h3>
            </div>

            <p className="text-sm text-stone-600 mb-2">
              {t("credit_deleteConfirm", { name: deleteCustomerTarget.name })}
            </p>

            {deleteCustomerTarget.balance > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 font-semibold mb-4">
                {t("credit_deleteBalanceWarning", {
                  balance: formatMoney(deleteCustomerTarget.balance),
                })}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setDeleteCustomerTarget(null)}
                disabled={deleting}
                className="btn-ghost !py-2 text-xs"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                {deleting ? (
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
