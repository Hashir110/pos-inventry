"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Banknote, CheckCircle2, CreditCard, HandCoins, Loader2, Lock, Pencil, ReceiptText, RefreshCw, Wallet } from "lucide-react";

import { toast } from "react-toastify";
import { useStore } from "../../store/useStore";

import { useLanguage } from "../../store/useLanguage";
import { tr } from "../../lib/i18n/translate";
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
  method: string;
  note: string;
  amount: number;
}

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA");
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
const methodLabel = (m: string) => (m === "Cash" ? tr("cash") : tr("bankOnline"));
const signed = (n: number) => `${n < 0 ? "− " : ""}${formatMoney(Math.abs(n))}`;

const paymentLabel = (m: PaymentMethod) => (m === "Cash" ? tr("cash") : m === "Bank Account" ? tr("closing_payBank") : tr("closing_credit"));
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
  return [bags ? tr("closing_bags", { bags, kg }) : "", pcs ? tr("closing_pcs", { pcs }) : ""].filter(Boolean).join(" • ") || "—";
};

export default function DailyClosingPage() {
  const { currentUser } = useStore();
  const ownerId = currentUser?.uid ?? "";
  const { confirm } = useDialog();
  const { t } = useLanguage();

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

  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force = false) => {
    if (!ownerId) return;
    if (force) setRefreshing(true);
    const { startIso, endIso } = dayRange(date);
    const names = [
      tr("closing_src_sales"),
      tr("expenses"),
      tr("closing_src_customers"),
      tr("closing_src_suppliers"),
      tr("closing_src_collections"),
      tr("closing_src_supplierPayments"),
      tr("closing_src_closings"),
    ];
    const results = await Promise.allSettled([
      listSalesInRange(ownerId, startIso, endIso, force).then(setSales),
      listExpensesInRange(ownerId, startIso, endIso, force).then(setExpenses),
      listCustomers(ownerId, force).then(setCustomers),
      listSuppliers(ownerId, force).then(setSuppliers),
      listAllPayments(ownerId).then(setPayments),
      listSupplierPayments(ownerId, force).then(setSupplierPayments),
      listDayClosings(ownerId, force).then(setDayClosings),
    ]);
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    results.forEach((r, i) => {
      if (r.status === "rejected" && isOnline) {
        console.error(names[i], r.reason);
        toast.error(tr("closing_loadFailed", { name: names[i] }));
      }
    });
    if (force && isOnline) {
      toast.success("Data refreshed");
    }

    setLoading(false);
    setRefreshing(false);
  }, [ownerId, date, t]);

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
      toast.success(
        (record as any).isOffline
          ? "Closing saved offline (will sync when internet is connected)"
          : saved
            ? t("closing_updated")
            : t("closing_saved")
      );
    } catch (error) {
      console.error(error);
      toast.error(t("closing_saveFailed"));
    } finally {
      setClosing(false);
    }
  };

  const applyPayment = async (sale: Sale, method: PaymentMethod, customer?: Customer) => {
    try {
      await updateSalePayment(sale.id, method, customer ? { id: customer.id, name: customer.name } : undefined);
      toast.success(t("closing_paymentChanged", { method: paymentLabel(method) }));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("closing_paymentFailed"));
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
        title: t("closing_changePayTitle"),
        message: t("closing_changePayMsg", {
          method: paymentLabel(method),
          customer: customerLabel(sale.customerName),
          amount: formatMoney(saleNetAmount(sale)),
        }),
        confirmLabel: t("closing_changePayConfirm"),
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
        toast.error(`${party.name}: ${error instanceof Error ? error.message : t("closing_saveItemFailed")}`);
      }
    }
    if (failed < lines.length) toast.success(t("closing_collectionSaved", { count: lines.length - failed }));
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
        toast.error(`${party.name}: ${error instanceof Error ? error.message : t("closing_saveItemFailed")}`);
      }
    }
    if (failed < lines.length) toast.success(t("closing_supplierSaved", { count: lines.length - failed }));
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
          method: p.method,
          note: p.note ?? "",
          amount: p.amount,
        })),
        ...daySupplierPayments.map((p) => ({
          id: `s-${p.id}`,
          date: p.date,
          kind: "jamad" as Kind,
          party: p.supplierName,
          method: p.method,
          note: p.note ?? "",
          amount: p.amount,
        })),
      ].sort((a, b) => b.date.localeCompare(a.date)),
    [dayPayments, daySupplierPayments]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("closing_title")}
        subtitle={t("closing_subtitle")}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="btn-secondary flex items-center gap-1.5"
              title="Refresh from server"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <input
              type="date"
              value={date}
              max={dayKey(new Date().toISOString())}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="field !w-44"
            />
            <button onClick={handleClose} disabled={closing || loading} className="btn-primary">
              {closing ? <Loader2 className="animate-spin" size={18} /> : <Lock size={16} />}
              {saved ? t("closing_btnUpdate") : t("closing_btnClose")}
            </button>
          </div>
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
            ? t("closing_changedAfter")
            : t("closing_closedOn", { date: formatDate(saved.closedAt) })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title={t("totalSales")} value={formatMoney(totals.salesTotal)} subtitle={t("closing_billsCount", { count: sales.length })} icon={ReceiptText} theme="blue" loading={loading} />
        <StatCard title={t("cash")} value={formatMoney(totals.cash)} subtitle={t("closing_cashSales")} icon={Banknote} theme="green" loading={loading} />
        <StatCard title={t("bankOnline")} value={formatMoney(totals.bank)} subtitle={t("closing_bankSales")} icon={CreditCard} theme="cyan" loading={loading} />
        <StatCard title={t("closing_credit")} value={formatMoney(totals.udhar)} subtitle={t("closing_creditGiven")} icon={HandCoins} theme="amber" loading={loading} />
        <StatCard title={t("closing_received")} value={formatMoney(totals.amad)} subtitle={t("closing_receivedHint")} icon={ArrowDownLeft} theme="green" loading={loading} />
        <StatCard title={t("closing_paidOut")} value={formatMoney(totals.jamad)} subtitle={t("closing_paidOutHint")} icon={ArrowUpRight} theme="red" loading={loading} />
        <StatCard title={t("expenses")} value={formatMoney(totals.expenses)} subtitle={t("closing_expensesToday")} icon={Wallet} theme="orange" loading={loading} />
        <StatCard title={t("closing_cashInHand")} value={signed(totals.cashInHand)} subtitle={t("closing_cashFormula")} icon={Wallet} theme="purple" loading={loading} />
      </div>

      <DataTable
        data={sales}
        rowKey={(s) => s.id}
        loading={loading}
        emptyText={t("closing_noSales")}
        paginate={sales.length > 10}
        toolbarLeft={<h3 className="text-base font-bold text-stone-900">{t("closing_salesHeading", { count: sales.length })}</h3>}
        columns={[
          { key: "time", header: t("closing_colTime"), className: "whitespace-nowrap", cell: (s) => <span className="text-stone-500">{timeOf(s.date)}</span> },
          { key: "inv", header: t("closing_colInvoice"), cell: (s) => <span className="font-mono text-xs font-bold text-brand-700">#{s.invoiceNo || "-"}</span> },
          { key: "cust", header: t("customer"), cell: (s) => <span className="font-semibold text-stone-900">{customerLabel(s.customerName)}</span> },
          {
            key: "items",
            header: t("items"),
            cell: (s) => (
              <>
                <p className="max-w-[260px] truncate text-stone-800">{s.items.map((i) => i.name).join(", ")}</p>
                <p className="text-xs text-stone-400">{qtySummary(s)}</p>
              </>
            ),
          },
          {
            key: "pay",
            header: t("closing_colPayment"),
            cell: (s) => {
              const current = paymentOf(s);
              return (
                <select
                  value={current}
                  onChange={(e) => handlePaymentChange(s, e.target.value as PaymentMethod)}
                  className={`field !w-28 !py-1.5 text-xs font-bold ${PAYMENT_TONE[current]}`}
                >
                  <option value="Cash">{paymentLabel("Cash")}</option>
                  <option value="Bank Account">{paymentLabel("Bank Account")}</option>
                  <option value="Udhar">{paymentLabel("Udhar")}</option>
                </select>
              );
            },
          },
          { key: "amount", header: t("amount"), align: "right", cell: (s) => <span className="tabular font-extrabold text-stone-900">{formatMoney(saleNetAmount(s))}</span> },
          {
            key: "edit",
            header: "",
            align: "right",
            cell: (s) => (
              <button
                onClick={() => setEditSale(s)}
                className="rounded-lg p-2 text-stone-500 transition hover:bg-brand-50 hover:text-brand-700"
                title={t("closing_editBill")}
              >
                <Pencil size={17} />
              </button>
            ),
          },
        ]}
      />

      <div>
        <h2 className="mb-3 text-lg font-extrabold text-stone-900">{t("closing_sectionTitle")}</h2>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <SettlementPanel
            title={t("closing_receivedTitle")}
            subtitle={t("closing_receivedSubtitle")}
            icon={<ArrowDownLeft size={20} />}
            tone="emerald"
            parties={debtors}
            capToBalance
            noteLabel={t("closing_note")}
            notePlaceholder={t("closing_optional")}
            submitLabel={t("closing_saveCollection")}
            emptyText={t("closing_noCreditParties")}
            onSubmit={handleAmad}
          />
          <SettlementPanel
            title={t("closing_paidTitle")}
            subtitle={t("closing_paidSubtitle")}
            icon={<ArrowUpRight size={20} />}
            tone="amber"
            parties={payables}
            noteLabel={t("closing_reasonLabel")}
            notePlaceholder={t("closing_reasonPlaceholder")}
            submitLabel={t("closing_savePayment")}
            emptyText={t("closing_noSupplierDue")}
            onSubmit={handleJamad}
          />
        </div>
      </div>

      <DataTable
        data={moneyRows}
        rowKey={(r) => r.id}
        loading={loading}
        emptyText={t("closing_noMoneyEntries")}
        paginate={false}
        toolbarLeft={<h3 className="text-base font-bold text-stone-900">{t("closing_entriesHeading", { count: moneyRows.length })}</h3>}
        columns={[
          { key: "time", header: t("closing_colTime"), className: "whitespace-nowrap", cell: (r) => <span className="text-stone-500">{timeOf(r.date)}</span> },
          {
            key: "kind",
            header: t("type"),
            cell: (r) => (
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${r.kind === "amad" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                {r.kind === "amad" ? t("closing_received") : t("closing_paidOut")}
              </span>
            ),
          },
          {
            key: "party",
            header: t("closing_colParty"),
            cell: (r) => (
              <>
                <p className="font-semibold text-stone-900">{r.party}</p>
                <p className="text-xs text-stone-500">{`${methodLabel(r.method)}${r.note ? ` • ${r.note}` : ""}`}</p>
              </>
            ),
          },
          {
            key: "amount",
            header: t("amount"),
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
        emptyText={t("closing_noClosings")}
        onRowClick={(c) => setDate(c.date)}
        rowClassName={(c) => (c.date === date ? "bg-brand-50/60" : "")}
        toolbarLeft={<h3 className="text-base font-bold text-stone-900">{t("closing_history")}</h3>}
        columns={[
          {
            key: "date",
            header: t("date"),
            className: "whitespace-nowrap",
            cell: (c) => (
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-stone-800">
                  {new Date(`${c.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                {(c.id.startsWith("local_") || (c as any).isOffline) && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                    Offline
                  </span>
                )}
              </div>
            ),
          },

          { key: "bills", header: t("closing_colBills"), align: "right", cell: (c) => <span className="tabular">{c.invoiceCount}</span> },
          { key: "sales", header: t("closing_colSales"), align: "right", cell: (c) => <span className="tabular font-bold">{formatMoney(c.salesTotal)}</span> },
          { key: "amad", header: t("closing_received"), align: "right", cell: (c) => <span className="tabular text-emerald-600">{formatMoney(c.amad)}</span> },
          { key: "jamad", header: t("closing_paidOut"), align: "right", cell: (c) => <span className="tabular text-red-600">{formatMoney(c.jamad)}</span> },
          { key: "exp", header: t("expenses"), align: "right", cell: (c) => <span className="tabular">{formatMoney(c.expenses)}</span> },
          { key: "cih", header: t("closing_cashInHand"), align: "right", cell: (c) => <span className="tabular font-extrabold text-stone-900">{signed(c.cashInHand)}</span> },
        ]}
      />

      <ChooseCustomerModal
        open={!!partyForSale}
        customers={customers}
        title={t("closing_chooseTitle")}
        message={t("closing_chooseMsg")}
        confirmLabel={t("closing_chooseConfirm")}
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
