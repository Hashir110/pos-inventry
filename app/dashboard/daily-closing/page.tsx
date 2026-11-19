"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  CreditCard,
  HandCoins,
  Loader2,
  Lock,
  Pencil,
  ReceiptText,
  RefreshCw,
  Wallet,
  Calculator,
  Coins,
  Receipt,
  Calendar,
  Printer,
  X,
  History,
  QrCode,
  BookOpen,
  Store,
  DollarSign,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { toast } from "react-toastify";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../store/useLanguage";
import { tr } from "../../lib/i18n/translate";
import PageHeader from "../../components/PageHeader";
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

const dayRange = (day: string) => {
  const start = new Date(`${day}T00:00:00`);
  const end = new Date(`${day}T23:59:59.999`);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
};

const qtySummary = (sale: Sale) => {
  const bags = sale.items.filter((i) => i.type === "weight").reduce((s, i) => s + i.qty, 0);
  const kg = sale.items
    .filter((i) => i.type === "weight")
    .reduce((s, i) => s + (i.totalWeight ?? i.qty * (i.weightPerBag || 25)), 0);
  const pcs = sale.items.filter((i) => i.type !== "weight").reduce((s, i) => s + i.qty, 0);
  return [bags ? `${bags} bags (${kg} kg)` : "", pcs ? `${pcs} pcs` : ""].filter(Boolean).join(" • ") || "—";
};

export default function DailyClosingPage() {
  const { currentUser, currentShop } = useStore();
  const ownerId = currentUser?.uid ?? "";
  const { confirm } = useDialog();
  const { t, language } = useLanguage();
  const isRTL = language === "ur";

  const [date, setDate] = useState(() => dayKey(new Date().toISOString()));
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Core Data
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [payments, setPayments] = useState<CustomerPayment[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [dayClosings, setDayClosings] = useState<DayClosing[]>([]);

  // Modals & UI States
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const [partyForSale, setPartyForSale] = useState<Sale | null>(null);
  const [showZSlip, setShowZSlip] = useState(false);

  // Physical Denomination Counters
  const [floatAmount, setFloatAmount] = useState<number>(15000);
  const [denominations, setDenominations] = useState<{
    5000: number;
    1000: number;
    500: number;
    100: number;
    50: number;
    coins: number;
  }>({
    5000: 0,
    1000: 0,
    500: 0,
    100: 0,
    50: 0,
    coins: 0,
  });

  const load = useCallback(
    async (force = false) => {
      if (!ownerId) return;
      if (force) setRefreshing(true);
      const { startIso, endIso } = dayRange(date);

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
      if (force && isOnline) {
        toast.success("Closing data updated");
      }
      setLoading(false);
      setRefreshing(false);
    },
    [ownerId, date]
  );

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const debtors = useMemo(() => customers.filter((c) => c.balance > 0), [customers]);
  const payables = useMemo(() => suppliers.filter((s) => s.balance > 0), [suppliers]);

  const dayPayments = useMemo(() => payments.filter((p) => dayKey(p.date) === date), [payments, date]);
  const daySupplierPayments = useMemo(
    () => supplierPayments.filter((p) => dayKey(p.date) === date),
    [supplierPayments, date]
  );

  // Financial Totals Calculation
  const totals = useMemo(() => {
    const sumBy = (method: string) =>
      sales
        .filter((s) => (s.paymentMethod || "Cash").trim() === method)
        .reduce((sum, s) => sum + saleNetAmount(s), 0);
    const cash = sales
      .filter((s) => !["Bank Account", "Udhar"].includes((s.paymentMethod || "Cash").trim()))
      .reduce((sum, s) => sum + saleNetAmount(s), 0);
    const bank = sumBy("Bank Account");
    const udhar = sumBy("Udhar");

    const cashBillsCount = sales.filter((s) => !["Bank Account", "Udhar"].includes((s.paymentMethod || "Cash").trim())).length;
    const bankBillsCount = sales.filter((s) => (s.paymentMethod || "").trim() === "Bank Account").length;
    const udharBillsCount = sales.filter((s) => (s.paymentMethod || "").trim() === "Udhar").length;

    const amad = dayPayments.reduce((sum, p) => sum + p.amount, 0);
    const amadCash = dayPayments.filter((p) => p.method === "Cash").reduce((sum, p) => sum + p.amount, 0);
    const jamad = daySupplierPayments.reduce((sum, p) => sum + p.amount, 0);
    const jamadCash = daySupplierPayments.filter((p) => p.method === "Cash").reduce((sum, p) => sum + p.amount, 0);
    const expenseSum = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const totalRefunds = sales.reduce((sum, s) => sum + (s.refundedAmount || 0), 0);

    return {
      salesTotal: cash + bank + udhar,
      cash,
      cashBillsCount,
      bank,
      bankBillsCount,
      udhar,
      udharBillsCount,
      amad,
      amadCash,
      jamad,
      jamadCash,
      expenses: expenseSum,
      totalRefunds,
      cashInHand: cash + amadCash - jamadCash - expenseSum,
    };
  }, [sales, dayPayments, daySupplierPayments, expenses]);

  // Expected Cash including Starting Float
  const expectedTillCash = useMemo(() => {
    return floatAmount + totals.cashInHand;
  }, [floatAmount, totals.cashInHand]);

  // Counted Physical Cash Sum
  const countedPhysicalCash = useMemo(() => {
    return (
      denominations[5000] * 5000 +
      denominations[1000] * 1000 +
      denominations[500] * 500 +
      denominations[100] * 100 +
      denominations[50] * 50 +
      denominations.coins
    );
  }, [denominations]);

  const variance = countedPhysicalCash - expectedTillCash;

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
          ? t("closing_updated") || "Day closing updated"
          : t("closing_saved") || "Day closing recorded successfully"
      );
    } catch (error) {
      console.error(error);
      toast.error(t("closing_saveFailed") || "Failed to save closing");
    } finally {
      setClosing(false);
    }
  };

  const applyPayment = async (sale: Sale, method: PaymentMethod, customer?: Customer) => {
    try {
      await updateSalePayment(sale.id, method, customer ? { id: customer.id, name: customer.name } : undefined);
      toast.success(`Payment method updated to ${method}`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payment update failed");
    }
  };

  const handlePaymentChange = async (sale: Sale, method: PaymentMethod) => {
    const current = (sale.paymentMethod || "Cash").trim();
    if (method === current) return;
    if (method === "Udhar" && !sale.customerId) {
      setPartyForSale(sale);
      return;
    }
    if (current === "Udhar") {
      const ok = await confirm({
        title: "Change Payment Method",
        message: `Are you sure you want to change #${sale.invoiceNo} from Udhar to ${method}?`,
        confirmLabel: "Change Method",
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
        toast.error(`${party.name}: ${error instanceof Error ? error.message : "Failed"}`);
      }
    }
    if (failed < lines.length) toast.success(`Recorded collections for ${lines.length - failed} parties`);
    await load();
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
        toast.error(`${party.name}: ${error instanceof Error ? error.message : "Failed"}`);
      }
    }
    if (failed < lines.length) toast.success(`Recorded payouts for ${lines.length - failed} suppliers`);
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
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* 1. TOP HEADER & DATE PICKER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {t("closing_title") || "Daily Closing & Z-Report"}
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {t("closing_subtitle") || "End-of-day register balancing, cash drawer count, and FBR fiscal summary"}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
            title="Refresh from server"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin text-orange-600" : "text-slate-500"} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Date Selector */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-xs">
            <Calendar size={15} className="text-slate-400" />
            <input
              type="date"
              value={date}
              max={dayKey(new Date().toISOString())}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
            />
          </div>

          {/* Print Z-Report Slip Button */}
          <button
            onClick={() => setShowZSlip(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-800 text-sm font-bold hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Printer size={16} className="text-slate-500" />
            <span>Print Z-Report</span>
          </button>

          {/* Lock / Update Day Closing */}
          <button
            onClick={handleClose}
            disabled={closing || loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {closing ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
            <span>{saved ? t("closing_btnUpdate") || "Update Closing" : t("closing_btnClose") || "Save Day Closing"}</span>
          </button>
        </div>
      </div>

      {/* Status banner if already closed */}
      {saved && (
        <div
          className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-semibold ${
            changedAfterClose
              ? "bg-amber-50 border-amber-200 text-amber-800"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          <ShieldCheck size={18} />
          <span>
            {changedAfterClose
              ? "Transactions were modified after this day was closed. Click 'Update Closing' to re-sync."
              : `Day successfully balanced & locked on ${formatDate(saved.closedAt)}.`}
          </span>
        </div>
      )}

      {/* 2. 7 KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* Gross Sales */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Sales</span>
          <div className="mt-2">
            <div className="text-lg font-bold text-slate-900 tabular-nums">{formatMoney(totals.salesTotal)}</div>
            <div className="text-[11px] text-slate-500 font-medium">{sales.length} Bills</div>
          </div>
        </div>

        {/* Till Cash Inflow */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cash Sales</span>
          <div className="mt-2">
            <div className="text-lg font-bold text-emerald-700 tabular-nums">{formatMoney(totals.cash)}</div>
            <div className="text-[11px] text-slate-500 font-medium">{totals.cashBillsCount} Bills</div>
          </div>
        </div>

        {/* Digital / Bank */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Digital / QR</span>
          <div className="mt-2">
            <div className="text-lg font-bold text-sky-700 tabular-nums">{formatMoney(totals.bank)}</div>
            <div className="text-[11px] text-slate-500 font-medium">{totals.bankBillsCount} Transfers</div>
          </div>
        </div>

        {/* Khata / Udhaar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Khata (Udhaar)</span>
          <div className="mt-2">
            <div className="text-lg font-bold text-orange-600 tabular-nums">{formatMoney(totals.udhar)}</div>
            <div className="text-[11px] text-slate-500 font-medium">{totals.udharBillsCount} Slips</div>
          </div>
        </div>

        {/* Khata Recovery (Amad) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Khata Recovery</span>
          <div className="mt-2">
            <div className="text-lg font-bold text-emerald-700 tabular-nums">{formatMoney(totals.amad)}</div>
            <div className="text-[11px] text-emerald-600 font-semibold">{dayPayments.length} Recv.</div>
          </div>
        </div>

        {/* Refunds / Returns */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cash Refunds</span>
          <div className="mt-2">
            <div className="text-lg font-bold text-rose-600 tabular-nums">{formatMoney(totals.totalRefunds)}</div>
            <div className="text-[11px] text-slate-500 font-medium">Customer Returns</div>
          </div>
        </div>

        {/* Till Expenses */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Till Expenses</span>
          <div className="mt-2">
            <div className="text-lg font-bold text-rose-600 tabular-nums">{formatMoney(totals.expenses)}</div>
            <div className="text-[11px] text-slate-500 font-medium">{expenses.length} Vouchers</div>
          </div>
        </div>
      </div>

      {/* 3. THE GOLDEN TILL RECONCILIATION BOX */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Mathematical Till Audit Formula (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <Calculator className="text-orange-600" size={20} />
                <h2 className="text-base font-bold text-slate-900">Till Formula Audit</h2>
              </div>
              <span className="text-[11px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                A + B + C - D - E
              </span>
            </div>

            {/* Step-by-step Formula Breakdown */}
            <div className="flex flex-col divide-y divide-slate-100 text-xs">
              {/* Row A: Drawer Float */}
              <div className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px]">
                    A
                  </span>
                  <span className="text-slate-700 font-medium">Starting Drawer Float</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{formatMoney(floatAmount)}</span>
                </div>
              </div>

              {/* Row B: Cash Invoiced */}
              <div className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px]">
                    +
                  </span>
                  <span className="text-slate-700 font-medium">Total Cash Invoiced Today</span>
                </div>
                <span className="font-bold text-emerald-700">{formatMoney(totals.cash)}</span>
              </div>

              {/* Row C: Customer Khata Recovery */}
              <div className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px]">
                    +
                  </span>
                  <span className="text-slate-700 font-medium">Customer Khata Cash Recovered</span>
                </div>
                <span className="font-bold text-emerald-700">{formatMoney(totals.amadCash)}</span>
              </div>

              {/* Row D: Supplier Payouts */}
              <div className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-800 flex items-center justify-center font-bold text-[10px]">
                    -
                  </span>
                  <span className="text-slate-700 font-medium">Cash Paid to Suppliers</span>
                </div>
                <span className="font-bold text-rose-600">{formatMoney(totals.jamadCash)}</span>
              </div>

              {/* Row E: Daily Expenses */}
              <div className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-800 flex items-center justify-center font-bold text-[10px]">
                    -
                  </span>
                  <span className="text-slate-700 font-medium">Cash Paid for Store Expenses</span>
                </div>
                <span className="font-bold text-rose-600">{formatMoney(totals.expenses)}</span>
              </div>
            </div>
          </div>

          {/* Expected Cash in Till Result Box */}
          <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between shadow-xs">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Expected Cash in Till
              </span>
              <span className="text-xs text-slate-300">Net reconciliation target</span>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-orange-400 tabular-nums">
                {formatMoney(expectedTillCash)}
              </div>
              <span className="text-[10px] text-slate-400">PKR Exact Sum</span>
            </div>
          </div>
        </div>

        {/* Right Side: Physical Cash Denomination Breakdown Counter (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2">
              <div className="flex items-center gap-2">
                <Coins className="text-emerald-600" size={20} />
                <h2 className="text-base font-bold text-slate-900">Physical Cash Denomination Count</h2>
              </div>
              <span className="text-xs font-semibold text-slate-400">SBP Currency Notes</span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Count physical notes present in drawer before printing final settlement slip.
            </p>

            {/* Denomination Input Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* 5000 */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-800 w-12">Rs. 5000</span>
                <span className="text-slate-400">×</span>
                <input
                  type="number"
                  min="0"
                  value={denominations[5000] || ""}
                  onChange={(e) =>
                    setDenominations((prev) => ({ ...prev, 5000: Math.max(0, parseInt(e.target.value) || 0) }))
                  }
                  placeholder="0"
                  className="w-14 py-1 text-center font-bold bg-white border border-slate-300 rounded text-slate-900"
                />
                <span className="font-bold text-slate-800 tabular-nums w-16 text-right">
                  {formatMoney(denominations[5000] * 5000)}
                </span>
              </div>

              {/* 1000 */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-800 w-12">Rs. 1000</span>
                <span className="text-slate-400">×</span>
                <input
                  type="number"
                  min="0"
                  value={denominations[1000] || ""}
                  onChange={(e) =>
                    setDenominations((prev) => ({ ...prev, 1000: Math.max(0, parseInt(e.target.value) || 0) }))
                  }
                  placeholder="0"
                  className="w-14 py-1 text-center font-bold bg-white border border-slate-300 rounded text-slate-900"
                />
                <span className="font-bold text-slate-800 tabular-nums w-16 text-right">
                  {formatMoney(denominations[1000] * 1000)}
                </span>
              </div>

              {/* 500 */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-800 w-12">Rs. 500</span>
                <span className="text-slate-400">×</span>
                <input
                  type="number"
                  min="0"
                  value={denominations[500] || ""}
                  onChange={(e) =>
                    setDenominations((prev) => ({ ...prev, 500: Math.max(0, parseInt(e.target.value) || 0) }))
                  }
                  placeholder="0"
                  className="w-14 py-1 text-center font-bold bg-white border border-slate-300 rounded text-slate-900"
                />
                <span className="font-bold text-slate-800 tabular-nums w-16 text-right">
                  {formatMoney(denominations[500] * 500)}
                </span>
              </div>

              {/* 100 */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-800 w-12">Rs. 100</span>
                <span className="text-slate-400">×</span>
                <input
                  type="number"
                  min="0"
                  value={denominations[100] || ""}
                  onChange={(e) =>
                    setDenominations((prev) => ({ ...prev, 100: Math.max(0, parseInt(e.target.value) || 0) }))
                  }
                  placeholder="0"
                  className="w-14 py-1 text-center font-bold bg-white border border-slate-300 rounded text-slate-900"
                />
                <span className="font-bold text-slate-800 tabular-nums w-16 text-right">
                  {formatMoney(denominations[100] * 100)}
                </span>
              </div>

              {/* 50 */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-800 w-12">Rs. 50</span>
                <span className="text-slate-400">×</span>
                <input
                  type="number"
                  min="0"
                  value={denominations[50] || ""}
                  onChange={(e) =>
                    setDenominations((prev) => ({ ...prev, 50: Math.max(0, parseInt(e.target.value) || 0) }))
                  }
                  placeholder="0"
                  className="w-14 py-1 text-center font-bold bg-white border border-slate-300 rounded text-slate-900"
                />
                <span className="font-bold text-slate-800 tabular-nums w-16 text-right">
                  {formatMoney(denominations[50] * 50)}
                </span>
              </div>

              {/* Coins & Other */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-800 w-12">Coins</span>
                <span className="text-slate-400">+</span>
                <input
                  type="number"
                  min="0"
                  value={denominations.coins || ""}
                  onChange={(e) =>
                    setDenominations((prev) => ({ ...prev, coins: Math.max(0, parseInt(e.target.value) || 0) }))
                  }
                  placeholder="0"
                  className="w-14 py-1 text-center font-bold bg-white border border-slate-300 rounded text-slate-900"
                />
                <span className="font-bold text-slate-800 tabular-nums w-16 text-right">
                  {formatMoney(denominations.coins)}
                </span>
              </div>
            </div>
          </div>

          {/* Reconciliation Status Badge */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase text-slate-400">Total Counted Cash</span>
              <div className="text-xl font-bold text-slate-900 tabular-nums">
                {formatMoney(countedPhysicalCash)}
              </div>
            </div>

            <div
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-xs ${
                countedPhysicalCash === 0
                  ? "bg-slate-200 text-slate-700"
                  : variance === 0
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  : variance > 0
                  ? "bg-sky-100 text-sky-800 border border-sky-200"
                  : "bg-rose-100 text-rose-800 border border-rose-200"
              }`}
            >
              {variance === 0 && countedPhysicalCash > 0 ? (
                <>
                  <CheckCircle2 size={15} />
                  <span>Balanced / Exact Match ✓</span>
                </>
              ) : variance > 0 ? (
                <>
                  <TrendingUp size={15} />
                  <span>+ {formatMoney(variance)} (Cash Over)</span>
                </>
              ) : countedPhysicalCash > 0 ? (
                <>
                  <AlertCircle size={15} />
                  <span>- {formatMoney(Math.abs(variance))} (Cash Short)</span>
                </>
              ) : (
                <span>Not Yet Counted</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. SHIFT RECONCILIATION LEDGER & INVOICES */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="text-orange-600" size={18} />
            <h2 className="font-bold text-slate-900 text-sm">
              Today's Invoices Register ({sales.length} Bills)
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Click on payment method to re-assign tender
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200">
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Invoice #</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Items Sold</th>
                <th className="py-2.5 px-3">Payment Method</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3 text-right">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                    Loading invoices...
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                    No sales recorded for this date.
                  </td>
                </tr>
              ) : (
                sales.map((sale) => {
                  const method = (sale.paymentMethod || "Cash").trim();
                  return (
                    <tr key={sale.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 text-slate-500 font-medium">{timeOf(sale.date)}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        #{sale.invoiceNo || sale.id.slice(0, 8)}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {customerLabel(sale.customerName)}
                      </td>
                      <td className="py-2.5 px-3 max-w-[200px] truncate text-slate-600">
                        {sale.items.map((i) => i.name).join(", ")}
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          value={method}
                          onChange={(e) => handlePaymentChange(sale, e.target.value as PaymentMethod)}
                          className={`py-1 px-2 rounded-md font-bold text-[11px] border cursor-pointer ${
                            method === "Udhar"
                              ? "bg-orange-50 text-orange-700 border-orange-200"
                              : method === "Bank Account"
                              ? "bg-sky-50 text-sky-700 border-sky-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          <option value="Cash">Cash</option>
                          <option value="Bank Account">Bank / QR</option>
                          <option value="Udhar">Udhar (Credit)</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">
                        {formatMoney(saleNetAmount(sale))}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setEditSale(sale)}
                          className="p-1 rounded text-slate-400 hover:text-orange-600 hover:bg-slate-100"
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. KHATA COLLECTIONS (AMAD) & SUPPLIER PAYMENTS (JAMAD) SETTLEMENT PANELS */}
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-slate-900">Khata Collections & Supplier Settlements</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <SettlementPanel
            title="Khata Cash Collections"
            subtitle="Record cash recoveries from customer credit accounts"
            icon={<ArrowDownLeft size={18} />}
            tone="emerald"
            parties={debtors}
            capToBalance
            noteLabel="Note / Receipt #"
            notePlaceholder="Optional note"
            submitLabel="Save Recovery"
            emptyText="No customers with outstanding credit balance."
            onSubmit={handleAmad}
          />

          <SettlementPanel
            title="Supplier Cash Outlays"
            subtitle="Record payments made to wholesale suppliers from register"
            icon={<ArrowUpRight size={18} />}
            tone="amber"
            parties={payables}
            noteLabel="Reason / Voucher #"
            notePlaceholder="Reason for payment"
            submitLabel="Record Payment"
            emptyText="No suppliers with outstanding balance."
            onSubmit={handleJamad}
          />
        </div>
      </div>

      {/* 6. MODAL: EDIT SALE */}
      {editSale && (
        <EditSaleModal
          sale={editSale}
          onClose={() => setEditSale(null)}
          onSaved={() => {
            setEditSale(null);
            load();
          }}
        />
      )}

      {/* 7. MODAL: CHOOSE CUSTOMER FOR UDHAR */}
      {partyForSale && (
        <ChooseCustomerModal
          open={!!partyForSale}
          customers={customers}
          title="Select Customer for Credit"
          onClose={() => setPartyForSale(null)}
          onPick={async (c: Customer) => {
            const s = partyForSale;
            setPartyForSale(null);
            await applyPayment(s, "Udhar", c);
          }}
        />
      )}

      {/* 8. MODAL: THERMAL Z-REPORT PRINT PREVIEW */}
      {showZSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col font-mono text-xs">
            <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-800">Z-Report Slip Preview</span>
              <button
                type="button"
                onClick={() => setShowZSlip(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {/* Thermal Slip Content */}
            <div className="p-6 flex flex-col gap-3 text-slate-800 bg-white">
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <h3 className="text-base font-bold uppercase">{currentShop?.shopName || "AsaanPOS Store"}</h3>
                <p className="text-[10px] text-slate-500">{currentShop?.address || "Pakistan"}</p>
                <p className="text-[10px] text-slate-500">Contact: {currentShop?.contact || "—"}</p>
                <div className="mt-2 text-xs font-bold bg-slate-100 py-1 rounded">
                  *** DAILY CLOSING Z-REPORT ***
                </div>
              </div>

              <div className="flex justify-between text-[11px]">
                <span>Date: {date}</span>
                <span>Time: {new Date().toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>Register: #01</span>
                <span>Cashier: Admin</span>
              </div>

              <div className="border-t border-dashed border-slate-300 pt-2 flex flex-col gap-1">
                <div className="flex justify-between">
                  <span>Gross Sales:</span>
                  <span className="font-bold">{formatMoney(totals.salesTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cash Sales:</span>
                  <span>{formatMoney(totals.cash)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Digital / QR:</span>
                  <span>{formatMoney(totals.bank)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Credit (Udhaar):</span>
                  <span>{formatMoney(totals.udhar)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Khata Recovered:</span>
                  <span>+{formatMoney(totals.amadCash)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Supplier Paid:</span>
                  <span>-{formatMoney(totals.jamadCash)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Store Expenses:</span>
                  <span>-{formatMoney(totals.expenses)}</span>
                </div>
              </div>

              <div className="border-t-2 border-slate-800 pt-2 flex flex-col gap-1">
                <div className="flex justify-between font-bold text-sm">
                  <span>Expected Till Cash:</span>
                  <span>{formatMoney(expectedTillCash)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Actual Counted:</span>
                  <span>{formatMoney(countedPhysicalCash)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Till Variance:</span>
                  <span className={variance >= 0 ? "text-emerald-700" : "text-rose-600"}>
                    {variance >= 0 ? `+${formatMoney(variance)}` : formatMoney(variance)}
                  </span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-300 pt-4 text-center text-[10px] text-slate-400">
                Printed via AsaanPOS Retail Engine
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 font-sans">
              <button
                type="button"
                onClick={() => setShowZSlip(false)}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 flex items-center gap-1.5"
              >
                <Printer size={14} />
                <span>Print Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
