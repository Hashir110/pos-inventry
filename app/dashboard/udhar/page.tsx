"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { History, Plus, Search, Users, Wallet, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../store/useLanguage";
import Link from "next/link";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import SummaryBox from "../../components/SummaryBox";
import ReceivePaymentModal from "../../components/ReceivePaymentModal";
import { formatMoney } from "../../lib/format";
import { addCustomer, listCustomers } from "../../lib/services/customers";
import type { Customer } from "../../types";


export default function UdharPage() {
  const { currentUser } = useStore();
  const { t } = useLanguage();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [adding, setAdding] = useState(false);

  const [payFor, setPayFor] = useState<Customer | null>(null);

  const fetchCustomers = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      setCustomers(await listCustomers(currentUser.uid));
    } catch (error) {
      console.error(error);
      toast.error("Customers load nahi hue");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const totalOutstanding = useMemo(
    () => customers.reduce((sum, c) => sum + (c.balance || 0), 0),
    [customers]
  );
  const debtors = useMemo(() => customers.filter((c) => c.balance > 0).length, [customers]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return customers.filter(
      (c) => c.name.toLowerCase().includes(term) || (c.phone ?? "").includes(term)
    );
  }, [customers, search]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newName.trim()) return;
    setAdding(true);
    try {
      await addCustomer(currentUser.uid, { name: newName, phone: newPhone });
      setNewName("");
      setNewPhone("");
      toast.success("Customer add ho gaya");
      fetchCustomers();
    } catch (error) {
      console.error(error);
      toast.error("Customer add nahi hua (internet check karein)");
    } finally {
      setAdding(false);
    }
  };


  return (
    <div className="space-y-6">
      <PageHeader
        title={t("creditLedger")}
        subtitle={t("manageCustomerBalances")}
        actions={
          <>
            <SummaryBox label={t("totalReceivable")} value={formatMoney(totalOutstanding)} tone="amber" />
            <SummaryBox label={t("customersCount")} value={debtors} />
          </>
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
            placeholder="Party ka naam"
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
        emptyText="Koi customer nahi mila."
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
              <span className={`font-bold ${c.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>{formatMoney(c.balance)}</span>
            ),
          },
          {
            key: "actions",
            header: t("action"),
            align: "right",
            cell: (c) => (
              <div className="flex justify-end gap-2">
                <Link
                  href={`/dashboard/udhar/${c.id}`}
                  className="p-2 text-stone-500 hover:bg-stone-100 rounded-lg"
                  title={t("viewLedger")}
                >
                  <History size={18} />
                </Link>
                <button
                  onClick={() => setPayFor(c)}
                  disabled={c.balance <= 0}
                  className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-md hover:bg-emerald-200 text-xs font-bold flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Wallet size={14} /> Wasool
                </button>
              </div>
            ),
          },
        ]}
      />

      <ReceivePaymentModal customer={payFor} onClose={() => setPayFor(null)} onSuccess={fetchCustomers} />
    </div>
  );
}
