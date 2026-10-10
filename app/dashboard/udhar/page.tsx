"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { History, Plus, Search, Users, Wallet, X } from "lucide-react";
import { toast } from "react-toastify";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../store/useLanguage";
import PageHeader from "../../components/PageHeader";
import {
  addCustomer,
  listCustomers,
  listPayments,
  receivePayment,
} from "../../lib/services/customers";
import type { Customer, CustomerPayment } from "../../types";

const formatMoney = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;
const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function UdharPage() {
  const { currentUser } = useStore();
  const { t } = useLanguage();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Naya customer form
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [adding, setAdding] = useState(false);

  // Payment modal
  const [payFor, setPayFor] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<CustomerPayment["method"]>("Cash");
  const [payNote, setPayNote] = useState("");
  const [paying, setPaying] = useState(false);

  // History modal
  const [historyFor, setHistoryFor] = useState<Customer | null>(null);
  const [history, setHistory] = useState<CustomerPayment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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

  const openPayment = (customer: Customer) => {
    setPayFor(customer);
    setPayAmount(String(customer.balance));
    setPayMethod("Cash");
    setPayNote("");
  };

  const [printPayment, setPrintPayment] = useState<{
    customerName: string;
    amount: number;
    method: string;
    note?: string;
    date: string;
  } | null>(null);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !payFor) return;
    setPaying(true);
    const amt = parseFloat(payAmount);
    try {
      await receivePayment(currentUser.uid, payFor.id, amt, payMethod, payNote);
      toast.success(`Rs. ${payAmount} wasool ho gaye`);
      
      setPrintPayment({
        customerName: payFor.name,
        amount: amt,
        method: payMethod,
        note: payNote,
        date: new Date().toISOString(),
      });

      setPayFor(null);
      fetchCustomers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payment save nahi hui");
    } finally {
      setPaying(false);
    }
  };

  const openHistory = async (customer: Customer) => {
    if (!currentUser) return;
    setHistoryFor(customer);
    setHistory([]);
    setHistoryLoading(true);
    try {
      setHistory(await listPayments(currentUser.uid, customer.id));
    } catch (error) {
      console.error(error);
      toast.error("History load nahi hui");
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={t("creditLedger")}
        subtitle={t("manageCustomerBalances")}
        actions={
          <>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">{t("totalReceivable")}</p>
              <p className="tabular text-lg font-extrabold text-stone-900">{formatMoney(totalOutstanding)}</p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white px-4 py-2 shadow-card">
              <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">{t("customersCount")}</p>
              <p className="tabular text-lg font-extrabold text-stone-900">{debtors}</p>
            </div>
          </>
        }
      />
      {/* Naya customer */}
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
            placeholder="e.g. Ali Bhai"
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
          className="px-6 py-2.5 bg-ink text-white rounded-lg hover:bg-ink-800 font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Plus size={18} /> {adding ? t("creating") : t("addCustomerBtn")}
        </button>
      </form>

      {/* List */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b bg-stone-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h3 className="font-bold text-stone-700 flex items-center gap-2">
            <Users size={18} /> {t("customersCount")} ({customers.length})
          </h3>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 text-stone-400" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search")}
              className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 border-b">
              <tr>
                <th className="p-4 font-semibold text-stone-600">{t("customerNameCol")}</th>
                <th className="p-4 font-semibold text-stone-600">{t("phoneCol")}</th>
                <th className="p-4 font-semibold text-stone-600">{t("balanceCol")}</th>
                <th className="p-4 font-semibold text-stone-600 text-right">{t("action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-stone-400">
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-stone-400">
                    Koi customer nahi mila.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50 transition">
                    <td className="p-4 font-semibold text-stone-800">{c.name}</td>
                    <td className="p-4 text-stone-500">{c.phone || "-"}</td>
                    <td className={`p-4 font-bold ${c.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {formatMoney(c.balance)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openHistory(c)}
                          className="p-2 text-stone-500 hover:bg-stone-100 rounded-lg"
                          title="Payment history"
                        >
                          <History size={18} />
                        </button>
                        <button
                          onClick={() => openPayment(c)}
                          disabled={c.balance <= 0}
                          className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-md hover:bg-emerald-200 text-xs font-bold flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Wallet size={14} /> Wasool
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment modal */}
      {payFor && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handlePay} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-stone-800">{payFor.name}</h3>
                <p className="text-sm text-stone-500">Baqi udhar: {formatMoney(payFor.balance)}</p>
              </div>
              <button type="button" onClick={() => setPayFor(null)} className="p-1 text-stone-400 hover:text-stone-700">
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-500 mb-1 block">Wasool hui raqam (Rs.)</label>
              <input
                type="number"
                required
                min="1"
                max={payFor.balance}
                step="0.01"
                autoFocus
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full p-3 border rounded-lg text-2xl font-bold text-center focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>

            <div className="flex gap-2">
              {(["Cash", "Bank Account"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPayMethod(m)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-bold ${
                    payMethod === m ? "bg-brand-50 border-brand-500 text-brand-700" : "bg-white text-stone-500"
                  }`}
                >
                  {m === "Cash" ? "Cash" : "Bank / Online"}
                </button>
              ))}
            </div>

            <input
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
              placeholder="Note (optional)"
              className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500"
            />

            <button
              type="submit"
              disabled={paying}
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold disabled:opacity-50"
            >
              {paying ? "Saving..." : "Wasooli Save Karein"}
            </button>
          </form>
        </div>
      )}

      {/* History modal */}
      {historyFor && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-stone-900 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold">{historyFor.name} — Wasooli History</h3>
              <button onClick={() => setHistoryFor(null)} className="hover:bg-ink-800 p-1 rounded-full">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto divide-y">
              {historyLoading ? (
                <p className="p-6 text-center text-stone-400">Loading...</p>
              ) : history.length === 0 ? (
                <p className="p-6 text-center text-stone-400">Abhi koi wasooli nahi hui.</p>
              ) : (
                history.map((p) => (
                  <div key={p.id} className="py-3 flex justify-between items-start gap-3">
                    <div>
                      <p className="text-sm font-semibold text-stone-800">{formatDate(p.date)}</p>
                      <p className="text-xs text-stone-500">
                        {p.method === "Cash" ? "Cash" : "Bank / Online"}
                        {p.note ? ` • ${p.note}` : ""}
                      </p>
                    </div>
                    <p className="font-bold text-emerald-600">+ {formatMoney(p.amount)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Wasooli Printable Receipt Modal */}
      {printPayment && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-pop w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-emerald-50">
              <h3 className="font-extrabold text-emerald-900 text-sm">
                Wasooli Receipt Voucher
              </h3>
              <button onClick={() => setPrintPayment(null)} className="rounded-lg p-1 text-stone-400 hover:bg-stone-200">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 text-center space-y-4" id="wasooli-receipt">
              <div className="border-b pb-3">
                <h2 className="font-black text-lg text-stone-900 uppercase tracking-wide">
                  WASOOLI RECEIPT
                </h2>
                <p className="text-xs text-stone-500 font-bold">
                  Date: {new Date(printPayment.date).toLocaleDateString()}
                </p>
              </div>

              <div className="space-y-2 text-left text-xs bg-stone-50 p-4 rounded-xl border border-stone-200">
                <p><span className="font-bold text-stone-500">Party Name:</span> <b className="text-stone-900 text-sm">{printPayment.customerName}</b></p>
                <p><span className="font-bold text-stone-500">Amount Received:</span> <b className="text-emerald-700 text-base">Rs. {printPayment.amount.toLocaleString()}</b></p>
                <p><span className="font-bold text-stone-500">Payment Mode:</span> <b className="text-stone-800">{printPayment.method}</b></p>
                {printPayment.note && <p><span className="font-bold text-stone-500">Note:</span> {printPayment.note}</p>}
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setPrintPayment(null)} className="btn-ghost flex-1 text-xs">
                  Close
                </button>
                <button onClick={() => window.print()} className="btn-primary flex-1 text-xs font-bold">
                  Print Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
