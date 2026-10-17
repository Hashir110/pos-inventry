"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Banknote, CheckCircle2, CreditCard, HandCoins, Loader2, Lock, Pencil, ReceiptText, Wallet } from "lucide-react";
import { toast } from "react-toastify";
import { useStore } from "../../store/useStore";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import StatCard from "../../components/StatCard";
import EditSaleModal from "../../components/EditSaleModal";
import ChooseCustomerModal from "../../components/ChooseCustomerModal";
import { useDialog } from "../../components/DialogProvider";
import SettlementPanel, { type SettleLine, type SettleMethod } from "../../components/SettlementPanel";
import { customerLabel, formatDate, formatMoney } from "../../lib/format";
import { saleNetAmount } from "../../lib/calc";
import { listSalesInRange, updateSalePayment } from "../../lib/services/sales";
import { listExpensesInRange } from "../../lib/services/expenses";
import { listCustomers, listAllPayments, receivePayment } from "../../lib/services/customers";
import { addSupplierPayment, listSuppliers, listSupplierPayments } from "../../lib/services/suppliers";
import { listDayClosings, saveDayClosing } from "../../lib/services/dailyClosing";
import type { Customer, CustomerPayment, DayClosing, Expense, PaymentMethod, Sale, Supplier, SupplierPayment } from "../../types";

type Kind = "amad" | "jamad";

interface MoneyRow {
  id: string;
  date: string;
  kind: Kind;
  party: string;
  details: string;
  amount: number;
}

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA");
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
const methodLabel = (m: string) => (m === "Cash" ? "Cash" : "Bank / Online");
const signed = (n: number) => `${n < 0 ? "− " : ""}${formatMoney(Math.abs(n))}`;

const PAYMENT_LABEL: Record<PaymentMethod, string> = { Cash: "Cash", "Bank Account": "Bank", Udhar: "Udhar" };
const PAYMENT_TONE: Record<PaymentMethod, string> = {
  Cash: "!border-emerald-200 !bg-emerald-50 !text-emerald-800",
  "Bank Account": "!border-sky-200 !bg-sky-50 !text-sky-800",
  Udhar: "!border-amber-200 !bg-amber-50 !text-amber-800",
};
const paymentOf = (sale: Sale): PaymentMethod => {
  const m = (sale.paymentMethod || "Cash").trim();
  return m === "Bank Account" || m === "Udhar" ? m : "Cash";
};
const dayRange = (day: string) => {
  const start = new Date(`${day}T00:00:00`);
  const end = new Date(`${day}T23:59:59.999`);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
};

const qtySummary = (sale: Sale) => {
  const bags = sale.items.filter((i) => i.type === "weight").reduce((s, i) => s + i.qty, 0);
  const kg = sale.items.filter((i) => i.type === "weight").reduce((s, i) => s + (i.totalWeight ?? i.qty * (i.weightPerBag || 25)), 0);
  const pcs = sale.items.filter((i) => i.type !== "weight").reduce((s, i) => s + i.qty, 0);
  return [bags ? `${bags} bags (${kg} kg)` : "", pcs ? `${pcs} pcs` : ""].filter(Boolean).join(" • ") || "—";
};

export default function DailyClosingPage() {
  const { currentUser } = useStore();
  const ownerId = currentUser?.uid ?? "";
  const { confirm } = useDialog();

  const [date, setDate] = useState(() => dayKey(new Date().toISOString()));
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);

  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [payments, setPayments] = useState<CustomerPayment[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [dayClosings, setDayClosings] = useState<DayClosing[]>([]);
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const [partyForSale, setPartyForSale] = useState<Sale | null>(null);

  const load = useCallback(async () => {
    if (!ownerId) return;
    const { startIso, endIso } = dayRange(date);
    const names = ["Sales", "Expenses", "Customers", "Suppliers", "Wasooli", "Supplier payments", "Closings (firestore rules deploy karein)"];
    const results = await Promise.allSettled([
      listSalesInRange(ownerId, startIso, endIso).then(setSales),
      listExpensesInRange(ownerId, startIso, endIso).then(setExpenses),
      listCustomers(ownerId).then(setCustomers),
      listSuppliers(ownerId).then(setSuppliers),
      listAllPayments(ownerId).then(setPayments),
      listSupplierPayments(ownerId).then(setSupplierPayments),
      listDayClosings(ownerId).then(setDayClosings),
    ]);
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(names[i], r.reason);
        toast.error(`${names[i]} load nahi hue`);
      }
    });
    setLoading(false);
  }, [ownerId, date]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const debtors = useMemo(() => customers.filter((c) => c.balance > 0), [customers]);
  const payables = useMemo(() => suppliers.filter((s) => s.balance > 0), [suppliers]);

  const dayPayments = useMemo(() => payments.filter((p) => dayKey(p.date) === date), [payments, date]);
  const daySupplierPayments = useMemo(() => supplierPayments.filter((p) => dayKey(p.date) === date), [supplierPayments, date]);

  const totals = useMemo(() => {
    const sumBy = (method: string) =>
      sales
        .filter((s) => (s.paymentMethod || "Cash").trim() === method)
        .reduce((sum, s) => sum + saleNetAmount(s), 0);
    const cash = sales.filter((s) => !["Bank Account", "Udhar"].includes((s.paymentMethod || "Cash").trim())).reduce((sum, s) => sum + saleNetAmount(s), 0);
    const bank = sumBy("Bank Account");
    const udhar = sumBy("Udhar");
    const amad = dayPayments.reduce((sum, p) => sum + p.amount, 0);
    const amadCash = dayPayments.filter((p) => p.method === "Cash").reduce((sum, p) => sum + p.amount, 0);
    const jamad = daySupplierPayments.reduce((sum, p) => sum + p.amount, 0);
    const jamadCash = daySupplierPayments.filter((p) => p.method === "Cash").reduce((sum, p) => sum + p.amount, 0);
    const expenseSum = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    return {
      salesTotal: cash + bank + udhar,
      cash,
      bank,
      udhar,
      amad,
      jamad,
      expenses: expenseSum,
      cashInHand: cash + amadCash - jamadCash - expenseSum,
    };
  }, [sales, dayPayments, daySupplierPayments, expenses]);

  const saved = useMemo(() => dayClosings.find((c) => c.date === date) ?? null, [dayClosings, date]);
  const changedAfterClose =
    !!saved &&
    (Math.abs(saved.salesTotal - totals.salesTotal) > 0.5 ||
      Math.abs(saved.amad - totals.amad) > 0.5 ||
      Math.abs(saved.jamad - totals.jamad) > 0.5 ||
      Math.abs(saved.expenses - totals.expenses) > 0.5);

  const handleClose = async () => {
    if (!ownerId) return;
    setClosing(true);
    try {
      const record = await saveDayClosing(ownerId, {
        date,
        invoiceCount: sales.length,
        salesTotal: totals.salesTotal,
        cash: totals.cash,
        bank: totals.bank,
        udhar: totals.udhar,
        amad: totals.amad,
        jamad: totals.jamad,
        expenses: totals.expenses,
        cashInHand: totals.cashInHand,
      });
      setDayClosings((prev) => [record, ...prev.filter((c) => c.date !== date)].sort((a, b) => b.date.localeCompare(a.date)));
      toast.success(saved ? "Closing update ho gayi" : "Closing ho gayi");
    } catch (error) {
      console.error(error);
      toast.error("Closing save nahi hui (firestore rules deploy karein)");
    } finally {
      setClosing(false);
    }
  };

  const applyPayment = async (sale: Sale, method: PaymentMethod, customer?: Customer) => {
    try {
      await updateSalePayment(sale.id, method, customer ? { id: customer.id, name: customer.name } : undefined);
      toast.success(`Payment ${PAYMENT_LABEL[method]} kar di`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payment badli nahi");
    }
  };

  const handlePaymentChange = async (sale: Sale, method: PaymentMethod) => {
    const current = paymentOf(sale);
    if (method === current) return;
    if (method === "Udhar" && !sale.customerId) {
      setPartyForSale(sale);
      return;
    }
    if (current === "Udhar") {
      const ok = await confirm({
        title: "Payment badlein?",
        message: `Ye bill ab ${PAYMENT_LABEL[method]} hoga aur ${customerLabel(sale.customerName)} ka ${formatMoney(saleNetAmount(sale))} udhar kam ho jayega.`,
        confirmLabel: "Haan, badlein",
        tone: "brand",
      });
      if (!ok) return;
    }
    await applyPayment(sale, method);
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
    await load();
    return failed === 0;
  };

  const handleJamad = async (lines: SettleLine[], method: SettleMethod, note: string) => {
    let failed = 0;
    for (const { party, amount } of lines) {
      try {
        await addSupplierPayment(ownerId, { supplierId: party.id, supplierName: party.name, amount, method, note });
      } catch (error) {
        failed++;
        toast.error(`${party.name}: ${error instanceof Error ? error.message : "save nahi hua"}`);
      }
    }
    if (failed < lines.length) toast.success(`${lines.length - failed} supplier ko payment save ho gayi`);
    await load();
    return failed === 0;
  };

  const moneyRows = useMemo<MoneyRow[]>(
    () =>
      [
        ...dayPayments.map((p) => ({
          id: `p-${p.id}`,
          date: p.date,
          kind: "amad" as Kind,
          party: p.customerName,
          details: `${methodLabel(p.method)}${p.note ? ` • ${p.note}` : ""}`,
          amount: p.amount,
        })),
        ...daySupplierPayments.map((p) => ({
          id: `s-${p.id}`,
          date: p.date,
          kind: "jamad" as Kind,
          party: p.supplierName,
          details: `${methodLabel(p.method)}${p.note ? ` • ${p.note}` : ""}`,
          amount: p.amount,
        })),
      ].sort((a, b) => b.date.localeCompare(a.date)),
    [dayPayments, daySupplierPayments]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Closing"
        subtitle="Din ki sales khud aati hain. Amad aur Jamad likho aur closing karo"
        actions={
          <>
            <input
              type="date"
              value={date}
              max={dayKey(new Date().toISOString())}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="field !w-44"
            />
            <button onClick={handleClose} disabled={closing || loading} className="btn-primary">
              {closing ? <Loader2 className="animate-spin" size={18} /> : <Lock size={16} />}
              {saved ? "Closing Update Karein" : "Closing Karein"}
            </button>
          </>
        }
      />

      {saved && (
        <div
          className={`flex flex-wrap items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold ${
            changedAfterClose ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          <CheckCircle2 size={18} />
          {changedAfterClose
            ? "Closing ke baad is din mein tabdeeli hui hai. Naya hisaab save karne ke liye Closing Update dabayein."
            : `Closing ho chuki hai (${formatDate(saved.closedAt)})`}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Sales" value={formatMoney(totals.salesTotal)} subtitle={`${sales.length} bills`} icon={ReceiptText} theme="blue" loading={loading} />
        <StatCard title="Cash" value={formatMoney(totals.cash)} subtitle="Cash sales" icon={Banknote} theme="green" loading={loading} />
        <StatCard title="Bank / Online" value={formatMoney(totals.bank)} subtitle="Bank sales" icon={CreditCard} theme="cyan" loading={loading} />
        <StatCard title="Udhar" value={formatMoney(totals.udhar)} subtitle="Udhar par diya" icon={HandCoins} theme="amber" loading={loading} />
        <StatCard title="Amad" value={formatMoney(totals.amad)} subtitle="Parties se wasooli" icon={ArrowDownLeft} theme="green" loading={loading} />
        <StatCard title="Jamad" value={formatMoney(totals.jamad)} subtitle="Suppliers ko diye" icon={ArrowUpRight} theme="red" loading={loading} />
        <StatCard title="Expenses" value={formatMoney(totals.expenses)} subtitle="Aaj ke kharche" icon={Wallet} theme="orange" loading={loading} />
        <StatCard title="Cash in Hand" value={signed(totals.cashInHand)} subtitle="Cash + Amad − Jamad − Expenses" icon={Wallet} theme="purple" loading={loading} />
      </div>

      <DataTable
        data={sales}
        rowKey={(s) => s.id}
        loading={loading}
        emptyText="Is din koi sale nahi hui."
        paginate={sales.length > 10}
        toolbarLeft={<h3 className="text-base font-bold text-stone-900">Sales ({sales.length})</h3>}
        columns={[
          { key: "time", header: "Time", className: "whitespace-nowrap", cell: (s) => <span className="text-stone-500">{timeOf(s.date)}</span> },
          { key: "inv", header: "Invoice", cell: (s) => <span className="font-mono text-xs font-bold text-brand-700">#{s.invoiceNo || "-"}</span> },
          { key: "cust", header: "Customer", cell: (s) => <span className="font-semibold text-stone-900">{customerLabel(s.customerName)}</span> },
          {
            key: "items",
            header: "Items",
            cell: (s) => (
              <>
                <p className="max-w-[260px] truncate text-stone-800">{s.items.map((i) => i.name).join(", ")}</p>
                <p className="text-xs text-stone-400">{qtySummary(s)}</p>
              </>
            ),
          },
          {
            key: "pay",
            header: "Payment",
            cell: (s) => {
              const current = paymentOf(s);
              return (
                <select
                  value={current}
                  onChange={(e) => handlePaymentChange(s, e.target.value as PaymentMethod)}
                  className={`field !w-28 !py-1.5 text-xs font-bold ${PAYMENT_TONE[current]}`}
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Account">Bank</option>
                  <option value="Udhar">Udhar</option>
                </select>
              );
            },
          },          { key: "amount", header: "Amount", align: "right", cell: (s) => <span className="tabular font-extrabold text-stone-900">{formatMoney(saleNetAmount(s))}</span> },
          {
            key: "edit",
            header: "",
            align: "right",
            cell: (s) => (
              <button
                onClick={() => setEditSale(s)}
                className="rounded-lg p-2 text-stone-500 transition hover:bg-brand-50 hover:text-brand-700"
                title="Bill edit karein"
              >
                <Pencil size={17} />
              </button>
            ),
          },
        ]}
      />

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
            notePlaceholder="Wajah (optional)"
            submitLabel="Payment Save"
            emptyText="Kisi supplier ka hisaab baqi nahi"
            onSubmit={handleJamad}
          />
        </div>
      </div>

      <DataTable
        data={moneyRows}
        rowKey={(r) => r.id}
        loading={loading}
        emptyText="Is din koi wasooli ya payment nahi hui."
        paginate={false}
        toolbarLeft={<h3 className="text-base font-bold text-stone-900">Amad aur Jamad ki entries ({moneyRows.length})</h3>}
        columns={[
          { key: "time", header: "Time", className: "whitespace-nowrap", cell: (r) => <span className="text-stone-500">{timeOf(r.date)}</span> },
          {
            key: "kind",
            header: "Type",
            cell: (r) => (
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${r.kind === "amad" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                {r.kind === "amad" ? "Amad" : "Jamad"}
              </span>
            ),
          },
          {
            key: "party",
            header: "Party",
            cell: (r) => (
              <>
                <p className="font-semibold text-stone-900">{r.party}</p>
                <p className="text-xs text-stone-500">{r.details}</p>
              </>
            ),
          },
          {
            key: "amount",
            header: "Amount",
            align: "right",
            cell: (r) => (
              <span className={`tabular font-extrabold ${r.kind === "amad" ? "text-emerald-600" : "text-red-600"}`}>
                {r.kind === "amad" ? "+ " : "− "}
                {formatMoney(r.amount)}
              </span>
            ),
          },
        ]}
      />

      <DataTable
        data={dayClosings}
        rowKey={(c) => c.id}
        loading={loading}
        emptyText="Abhi koi closing nahi hui."
        onRowClick={(c) => setDate(c.date)}
        rowClassName={(c) => (c.date === date ? "bg-brand-50/60" : "")}
        toolbarLeft={<h3 className="text-base font-bold text-stone-900">Closing History</h3>}
        columns={[
          {
            key: "date",
            header: "Date",
            className: "whitespace-nowrap",
            cell: (c) => <span className="font-semibold text-stone-800">{new Date(`${c.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>,
          },
          { key: "bills", header: "Bills", align: "right", cell: (c) => <span className="tabular">{c.invoiceCount}</span> },
          { key: "sales", header: "Sales", align: "right", cell: (c) => <span className="tabular font-bold">{formatMoney(c.salesTotal)}</span> },
          { key: "amad", header: "Amad", align: "right", cell: (c) => <span className="tabular text-emerald-600">{formatMoney(c.amad)}</span> },
          { key: "jamad", header: "Jamad", align: "right", cell: (c) => <span className="tabular text-red-600">{formatMoney(c.jamad)}</span> },
          { key: "exp", header: "Expenses", align: "right", cell: (c) => <span className="tabular">{formatMoney(c.expenses)}</span> },
          { key: "cih", header: "Cash in Hand", align: "right", cell: (c) => <span className="tabular font-extrabold text-stone-900">{signed(c.cashInHand)}</span> },
        ]}
      />

      <ChooseCustomerModal
        open={!!partyForSale}
        customers={customers}
        title="Kis party ke khate mein?"
        message="Ye bill Udhar karne ke liye party chunein"
        confirmLabel="Udhar Karein"
        onClose={() => setPartyForSale(null)}
        onPick={async (customer) => {
          if (partyForSale) await applyPayment(partyForSale, "Udhar", customer);
        }}
      />
      <EditSaleModal
        sale={editSale}
        onClose={() => setEditSale(null)}
        onSaved={(updated) => {
          setSales((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
          setEditSale(null);
          load();
        }}
      />
    </div>
  );
}
