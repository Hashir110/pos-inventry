"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ClipboardCheck, Loader2, Truck, Users } from "lucide-react";
import { toast } from "react-toastify";
import { useStore } from "../../store/useStore";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import FormField from "../../components/FormField";
import SegmentedControl from "../../components/SegmentedControl";
import CustomerSelect from "../../components/CustomerSelect";
import SettlementPanel, { type SettleLine, type SettleMethod } from "../../components/SettlementPanel";
import { formatMoney } from "../../lib/format";
import { listCustomers, listAllPayments, receivePayment } from "../../lib/services/customers";
import { addSupplierPayment, listSuppliers, listSupplierPayments } from "../../lib/services/suppliers";
import { addClosingEntry, listClosings, nextEntryNo } from "../../lib/services/dailyClosing";
import type { Customer, CustomerPayment, DailyClosingEntry, Supplier, SupplierPayment } from "../../types";

type Kind = "cash" | "udhar" | "amad" | "jamad";

interface HistoryRow {
  id: string;
  date: string;
  kind: Kind;
  ref: string;
  title: string;
  details: string;
  amount: number;
}

const KIND_STYLE: Record<Kind, { label: string; badge: string; amount: string; sign: string }> = {
  cash: { label: "Cash", badge: "bg-brand-100 text-brand-700", amount: "text-stone-900", sign: "" },
  udhar: { label: "Udhar", badge: "bg-amber-100 text-amber-800", amount: "text-amber-700", sign: "" },
  amad: { label: "Amad", badge: "bg-emerald-100 text-emerald-700", amount: "text-emerald-600", sign: "+ " },
  jamad: { label: "Jamad", badge: "bg-red-100 text-red-700", amount: "text-red-600", sign: "− " },
};

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA");
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
const methodLabel = (m: string) => (m === "Cash" ? "Cash" : "Bank / Online");

const EMPTY_FORM = { itemName: "", qty: "", amount: "", note: "" };

export default function DailyClosingPage() {
  const { currentUser } = useStore();
  const ownerId = currentUser?.uid ?? "";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [closings, setClosings] = useState<DailyClosingEntry[]>([]);
  const [payments, setPayments] = useState<CustomerPayment[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const [type, setType] = useState<DailyClosingEntry["type"]>("Cash");
  const [customerId, setCustomerId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(() => dayKey(new Date().toISOString()));

  const loadAll = useCallback(async () => {
    if (!ownerId) return;
    const results = await Promise.allSettled([
      listCustomers(ownerId).then(setCustomers),
      listSuppliers(ownerId).then(setSuppliers),
      listClosings(ownerId).then(setClosings),
      listAllPayments(ownerId).then(setPayments),
      listSupplierPayments(ownerId).then(setSupplierPayments),
    ]);
    const names = ["Customers", "Suppliers", "Closing entries (firestore rules deploy karein)", "Payments", "Supplier payments"];
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(names[i], r.reason);
        toast.error(`${names[i]} load nahi hue`);
      }
    });
    setLoading(false);
  }, [ownerId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const entryNo = useMemo(() => nextEntryNo(closings), [closings]);
  const debtors = useMemo(() => customers.filter((c) => c.balance > 0), [customers]);
  const payables = useMemo(() => suppliers.filter((s) => s.balance > 0), [suppliers]);

  const handleEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerId) return;
    if (type === "Udhar" && !customerId) {
      toast.warn("Udhar ke liye party select karein");
      return;
    }
    setSaving(true);
    try {
      await addClosingEntry(ownerId, entryNo, {
        type,
        itemName: form.itemName,
        qty: parseFloat(form.qty),
        amount: parseFloat(form.amount),
        customerId: type === "Udhar" ? customerId : undefined,
        note: form.note,
      });
      toast.success(`${entryNo} save ho gayi`);
      setForm(EMPTY_FORM);
      setCustomerId("");
      await loadAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Entry save nahi hui");
    } finally {
      setSaving(false);
    }
  };

  const handleAmad = async (lines: SettleLine[], method: SettleMethod, note: string) => {
    let failed = 0;
    for (const { party, amount } of lines) {
      try {
        await receivePayment(ownerId, party.id, amount, method, note);
      } catch (error) {
        failed++;
        toast.error(`${party.name}: ${error instanceof Error ? error.message : "save nahi hua"}`);
      }
    }
    if (failed < lines.length) toast.success(`${lines.length - failed} party se wasooli save ho gayi`);
    await loadAll();
    return failed === 0;
  };

  const handleJamad = async (lines: SettleLine[], method: SettleMethod, note: string) => {
    let failed = 0;
    for (const { party, amount } of lines) {
      try {
        await addSupplierPayment(ownerId, {
          supplierId: party.id,
          supplierName: party.name,
          amount,
          method,
          note,
        });
      } catch (error) {
        failed++;
        toast.error(`${party.name}: ${error instanceof Error ? error.message : "save nahi hua"}`);
      }
    }
    if (failed < lines.length) toast.success(`${lines.length - failed} supplier ko payment save ho gayi`);
    await loadAll();
    return failed === 0;
  };

  const history = useMemo<HistoryRow[]>(() => {
    const rows: HistoryRow[] = [
      ...closings.map((c) => ({
        id: `c-${c.id}`,
        date: c.date,
        kind: (c.type === "Cash" ? "cash" : "udhar") as Kind,
        ref: c.entryNo,
        title: c.itemName,
        details: `Qty ${c.qty}${c.customerName ? ` • ${c.customerName}` : ""}${c.note ? ` • ${c.note}` : ""}`,
        amount: c.amount,
      })),
      ...payments.map((p) => ({
        id: `p-${p.id}`,
        date: p.date,
        kind: "amad" as Kind,
        ref: "Wasooli",
        title: p.customerName,
        details: `${methodLabel(p.method)}${p.note ? ` • ${p.note}` : ""}`,
        amount: p.amount,
      })),
      ...supplierPayments.map((p) => ({
        id: `s-${p.id}`,
        date: p.date,
        kind: "jamad" as Kind,
        ref: "Payment",
        title: p.supplierName,
        details: `${methodLabel(p.method)}${p.note ? ` • ${p.note}` : ""}`,
        amount: p.amount,
      })),
    ];
    return rows.filter((r) => dayKey(r.date) === date).sort((a, b) => b.date.localeCompare(a.date));
  }, [closings, payments, supplierPayments, date]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Closing"
        subtitle="Din ka hisaab: bikri, amad (wasooli) aur jamad (supplier ko payment)"
      />

      <form onSubmit={handleEntrySubmit} className="card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-stone-100 p-5">
          <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600">
            <ClipboardCheck size={20} />
          </span>
          <div>
            <h3 className="text-base font-bold text-stone-900">Closing Entry</h3>
            <p className="text-xs text-stone-500">Item ki entry Cash ya Udhar mein save karein</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-x-5 gap-y-4 p-5 md:grid-cols-2">
          <FormField label="Invoice No" hint="Khud-ba-khud banta hai, badla nahi ja sakta">
            <input value={entryNo} readOnly disabled className="field cursor-not-allowed !bg-stone-100 font-bold text-stone-500" />
          </FormField>

          <FormField label="Section" required>
            <SegmentedControl
              tone={type === "Cash" ? "brand" : "amber"}
              value={type}
              onChange={(v) => {
                setType(v);
                if (v === "Cash") setCustomerId("");
              }}
              options={[
                { value: "Cash", label: "Cash" },
                { value: "Udhar", label: "Udhar" },
              ]}
            />
          </FormField>

          {type === "Udhar" && (
            <FormField label="Party" required className="md:col-span-2">
              <CustomerSelect
                customers={customers}
                selectedCustomerId={customerId}
                onSelectCustomer={(c) => setCustomerId(c?.id ?? "")}
                isUdhar
              />
            </FormField>
          )}

          <FormField label="Item Name" required>
            <input
              required
              value={form.itemName}
              onChange={(e) => setForm({ ...form, itemName: e.target.value })}
              placeholder="e.g. Basmati Rice"
              className="field"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Qty" required>
              <input
                required
                type="number"
                min="0"
                step="any"
                value={form.qty}
                onChange={(e) => setForm({ ...form, qty: e.target.value })}
                placeholder="0"
                className="field font-bold"
              />
            </FormField>
            <FormField label="Amount (Rs.)" required>
              <input
                required
                type="number"
                min="0"
                step="any"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
                className="field font-bold"
              />
            </FormField>
          </div>

          <FormField label="Note" className="md:col-span-2">
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Optional"
              className="field"
            />
          </FormField>
        </div>

        <div className="flex justify-end border-t border-stone-100 bg-stone-50 px-5 py-4">
          <button type="submit" disabled={saving} className="btn-primary min-h-[44px] min-w-[160px]">
            {saving ? <Loader2 className="animate-spin text-white" size={18} /> : "Save Entry"}
          </button>
        </div>
      </form>

      <div>
        <h2 className="mb-3 text-lg font-extrabold text-stone-900">Amad &amp; Jamad</h2>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <SettlementPanel
            title="Amad (Wasooli)"
            subtitle="Jin parties par hamara udhar hai, unse aaye paise"
            icon={<ArrowDownLeft size={20} />}
            tone="emerald"
            parties={debtors}
            capToBalance
            noteLabel="Note"
            notePlaceholder="Optional"
            submitLabel="Wasooli Save"
            emptyText="Kisi party par udhar nahi hai"
            onSubmit={handleAmad}
          />
          <SettlementPanel
            title="Jamad (Supplier Payment)"
            subtitle="Jin suppliers se maal liya, unhein diye gaye paise"
            icon={<ArrowUpRight size={20} />}
            tone="amber"
            parties={payables}
            noteLabel="Kiu diye (Reason)"
            notePlaceholder="e.g. Maal ki payment, advance..."
            submitLabel="Payment Save"
            emptyText="Kisi supplier ka hisaab baqi nahi"
            onSubmit={handleJamad}
          />
        </div>
      </div>

      <DataTable
        data={history}
        rowKey={(r) => r.id}
        loading={loading}
        emptyText="Aaj ki koi entry nahi."
        toolbarLeft={
          <h3 className="flex items-center gap-2 text-base font-bold text-stone-900">
            History
          </h3>
        }
        toolbarRight={
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="field !w-44" />
        }
        columns={[
          { key: "time", header: "Time", className: "whitespace-nowrap", cell: (r) => <span className="text-stone-500">{timeOf(r.date)}</span> },
          {
            key: "kind",
            header: "Type",
            cell: (r) => (
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${KIND_STYLE[r.kind].badge}`}>
                {KIND_STYLE[r.kind].label}
              </span>
            ),
          },
          { key: "ref", header: "Ref", className: "whitespace-nowrap", cell: (r) => <span className="font-semibold text-stone-500">{r.ref}</span> },
          {
            key: "details",
            header: "Details",
            cell: (r) => (
              <>
                <p className="font-semibold text-stone-900">{r.title}</p>
                <p className="text-xs text-stone-500">{r.details}</p>
              </>
            ),
          },
          {
            key: "amount",
            header: "Amount",
            align: "right",
            className: "whitespace-nowrap",
            cell: (r) => (
              <span className={`tabular font-extrabold ${KIND_STYLE[r.kind].amount}`}>
                {KIND_STYLE[r.kind].sign}
                {formatMoney(r.amount)}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
