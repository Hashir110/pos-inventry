"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/PageHeader";
import StatCard from "../../components/StatCard";
import DataTable from "../../components/DataTable";
import SaleReceipt from "../../components/SaleReceipt";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../store/useLanguage";
import {
  Landmark,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  RefreshCw,
  Wallet,
  Receipt,
  Eye,
  Pencil,
  Trash2,
  Copy,
  Check,
  X,
  Loader2,
  AlertTriangle,
  FileText,
  User,
} from "lucide-react";
import { toast } from "react-toastify";
import type { BankAccount, BankTransaction, Sale } from "../../types";
import {
  listBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  listBankTransactions,
  recordManualBankTransaction,
} from "../../lib/services/banks";
import { listRecentSales } from "../../lib/services/sales";
import { saleNetAmount } from "../../lib/calc";

const money = (n: number) => `Rs. ${Math.round(n || 0).toLocaleString()}`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function BankAccountsPage() {
  const { currentUser, currentShop } = useStore();
  const { t } = useLanguage();

  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Selected bank for detailed statement ledger view
  const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [txSearch, setTxSearch] = useState("");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [savingBank, setSavingBank] = useState(false);
  const [deleteConfirmBank, setDeleteConfirmBank] = useState<BankAccount | null>(null);
  const [deletingBank, setDeletingBank] = useState(false);

  // Manual Transaction Modal (Deposit / Withdrawal)
  const [showTxModal, setShowTxModal] = useState(false);
  const [txType, setTxType] = useState<"deposit" | "withdrawal">("deposit");
  const [txAmount, setTxAmount] = useState("");
  const [txDesc, setTxDesc] = useState("");
  const [savingTx, setSavingTx] = useState(false);

  // Invoice Slip Viewer Modal
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  // Bank Form State
  const [bankName, setBankName] = useState("");
  const [accountTitle, setAccountTitle] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [branchName, setBranchName] = useState("");
  const [initialBalance, setInitialBalance] = useState("");

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchBanks = async (force = false) => {
    if (!currentUser) return;
    if (force) setRefreshing(true);
    try {
      const data = await listBankAccounts(currentUser.uid, force);
      setBanks(data);
      if (selectedBank) {
        const updated = data.find((b) => b.id === selectedBank.id);
        if (updated) setSelectedBank(updated);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load bank accounts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBanks();
  }, [currentUser]);

  // Load transactions when a bank is selected
  const fetchTransactions = async (bankId: string, force = false) => {
    if (!currentUser) return;
    setLoadingTx(true);
    try {
      const data = await listBankTransactions(currentUser.uid, bankId, 200, force);
      setTransactions(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load transactions");
    } finally {
      setLoadingTx(false);
    }
  };

  useEffect(() => {
    if (selectedBank) {
      fetchTransactions(selectedBank.id);
    } else {
      setTransactions([]);
    }
  }, [selectedBank]);

  const totalBankBalance = useMemo(
    () => banks.reduce((sum, b) => sum + (b.currentBalance || 0), 0),
    [banks]
  );

  const handleOpenAdd = () => {
    setEditingBank(null);
    setBankName("");
    setAccountTitle(currentShop?.shopName || "Eman Traders");
    setAccountNumber("");
    setBranchName("");
    setInitialBalance("");
    setShowAddModal(true);
  };

  const handleOpenEdit = (bank: BankAccount) => {
    setEditingBank(bank);
    setBankName(bank.bankName);
    setAccountTitle(bank.accountTitle);
    setAccountNumber(bank.accountNumber);
    setBranchName(bank.branchName || "");
    setInitialBalance("");
    setShowAddModal(true);
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!bankName.trim() || !accountNumber.trim()) {
      toast.error("Please enter Bank Name and Account Number");
      return;
    }

    setSavingBank(true);
    try {
      if (editingBank) {
        await updateBankAccount(editingBank.id, currentUser.uid, {
          bankName: bankName.trim(),
          accountTitle: accountTitle.trim(),
          accountNumber: accountNumber.trim(),
          branchName: branchName.trim(),
        });
        toast.success("Bank account updated");
      } else {
        await createBankAccount(currentUser.uid, {
          bankName: bankName.trim(),
          accountTitle: accountTitle.trim(),
          accountNumber: accountNumber.trim(),
          branchName: branchName.trim(),
          initialBalance: parseFloat(initialBalance) || 0,
        });
        toast.success("Bank account added successfully");
      }
      setShowAddModal(false);
      fetchBanks(true);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to save bank account");
    } finally {
      setSavingBank(false);
    }
  };

  const handleDeleteBank = async () => {
    if (!currentUser || !deleteConfirmBank) return;
    setDeletingBank(true);
    try {
      await deleteBankAccount(deleteConfirmBank.id, currentUser.uid);
      if (selectedBank?.id === deleteConfirmBank.id) {
        setSelectedBank(null);
      }
      setDeleteConfirmBank(null);
      toast.success("Bank account deleted");
      fetchBanks(true);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete bank account");
    } finally {
      setDeletingBank(false);
    }
  };

  const handleManualTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedBank) return;
    const amt = parseFloat(txAmount);
    if (!amt || amt <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setSavingTx(true);
    try {
      await recordManualBankTransaction(
        currentUser.uid,
        selectedBank.id,
        txType,
        amt,
        txDesc
      );
      toast.success(
        txType === "deposit"
          ? "Deposit recorded successfully"
          : "Withdrawal recorded successfully"
      );
      setShowTxModal(false);
      setTxAmount("");
      setTxDesc("");
      fetchBanks(true);
      fetchTransactions(selectedBank.id, true);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setSavingTx(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.info("Account Number copied");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleViewInvoice = async (invoiceNo?: string, saleId?: string) => {
    if (!currentUser || (!invoiceNo && !saleId)) return;
    setLoadingReceipt(true);
    try {
      const sales = await listRecentSales(currentUser.uid, 100);
      const match = sales.find(
        (s) => (invoiceNo && s.invoiceNo === invoiceNo) || (saleId && s.id === saleId)
      );
      if (match) {
        setReceiptSale(match);
      } else {
        toast.error(`Invoice #${invoiceNo} details not found`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not load invoice slip");
    } finally {
      setLoadingReceipt(false);
    }
  };

  const visibleTransactions = useMemo(() => {
    const term = txSearch.trim().toLowerCase();
    if (!term) return transactions;
    return transactions.filter(
      (tx) =>
        (tx.invoiceNo && tx.invoiceNo.toLowerCase().includes(term)) ||
        (tx.customerName && tx.customerName.toLowerCase().includes(term)) ||
        (tx.description && tx.description.toLowerCase().includes(term))
    );
  }, [transactions, txSearch]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank Accounts & Online Ledgers"
        subtitle="Manage your bank accounts, track customer online payments and cash deposits"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchBanks(true);
                if (selectedBank) fetchTransactions(selectedBank.id, true);
              }}
              disabled={refreshing}
              className="btn-secondary flex items-center gap-1.5"
              title="Refresh"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button onClick={handleOpenAdd} className="btn-primary flex items-center gap-1.5">
              <Plus size={18} />
              <span>Add Bank Account</span>
            </button>
          </div>
        }
      />

      {/* Top Stat Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Bank Balance"
          value={money(totalBankBalance)}
          subtitle="Combined balance across all banks"
          icon={Landmark}
          theme="blue"
          loading={loading}
        />
        <StatCard
          title="Active Accounts"
          value={banks.length}
          subtitle="Registered bank accounts"
          icon={Wallet}
          theme="amber"
          loading={loading}
        />
        <StatCard
          title="Selected Ledger"
          value={selectedBank ? selectedBank.bankName : "All Banks"}
          subtitle={selectedBank ? money(selectedBank.currentBalance) : "Click a bank to view ledger"}
          icon={FileText}
          theme="blue"
          loading={loading}
        />
      </div>

      {/* Main View: Split or Bank Ledger */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Side: Banks List / Cards */}
        <div className={`space-y-4 ${selectedBank ? "lg:col-span-4" : "lg:col-span-12"}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-stone-900">Your Bank Accounts</h3>
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-bold text-stone-600">
              {banks.length} {banks.length === 1 ? "Bank" : "Banks"}
            </span>
          </div>

          {loading ? (
            <div className="flex h-40 items-center justify-center rounded-2xl bg-white p-6 shadow-sm">
              <Loader2 className="animate-spin text-brand-600" size={24} />
            </div>
          ) : banks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-white p-8 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <Landmark size={28} />
              </div>
              <h4 className="text-base font-bold text-stone-900">No Bank Accounts Added</h4>
              <p className="mt-1 max-w-sm text-xs text-stone-500">
                Add your Meezan, HBL, Allied Bank, or EasyPaisa/JazzCash accounts to receive customer payments on POS.
              </p>
              <button onClick={handleOpenAdd} className="btn-primary mt-4 text-xs">
                <Plus size={16} /> Add First Bank Account
              </button>
            </div>
          ) : (
            <div className={`grid gap-3 ${selectedBank ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
              {banks.map((bank) => {
                const isSelected = selectedBank?.id === bank.id;
                return (
                  <div
                    key={bank.id}
                    onClick={() => setSelectedBank(bank)}
                    className={`group relative cursor-pointer rounded-2xl border p-4 transition-all ${
                      isSelected
                        ? "border-brand-500 bg-brand-50/40 shadow-md ring-2 ring-brand-500/20"
                        : "border-stone-200 bg-white shadow-sm hover:border-brand-300 hover:shadow"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-black ${
                            isSelected
                              ? "bg-brand-600 text-white"
                              : "bg-stone-100 text-stone-700 group-hover:bg-brand-100 group-hover:text-brand-700"
                          }`}
                        >
                          <Landmark size={22} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-stone-900">{bank.bankName}</h4>
                          <p className="text-xs font-semibold text-stone-500">{bank.accountTitle}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(bank);
                          }}
                          className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                          title="Edit Bank"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmBank(bank);
                          }}
                          className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete Bank"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Account Number Box */}
                    <div className="mt-3.5 flex items-center justify-between rounded-lg bg-stone-50 px-3 py-1.5 border border-stone-100">
                      <span className="font-mono text-xs font-bold text-stone-700">
                        {bank.accountNumber}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(bank.accountNumber, bank.id);
                        }}
                        className="text-stone-400 hover:text-brand-600 transition"
                        title="Copy Account Number"
                      >
                        {copiedId === bank.id ? (
                          <Check size={14} className="text-emerald-600" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </div>

                    {/* Balance */}
                    <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                        Current Balance
                      </span>
                      <span className="font-display text-base font-black text-emerald-700">
                        {money(bank.currentBalance)}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-[11px] font-semibold text-stone-400">
                        {bank.branchName || "Branch"}
                      </span>
                      <span className="font-bold text-brand-600 hover:underline inline-flex items-center gap-1">
                        View Statement →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Bank Statement & Ledger View */}
        {selectedBank && (
          <div className="lg:col-span-8 space-y-4">
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 font-bold text-brand-700">
                    <Landmark size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-stone-900">{selectedBank.bankName}</h3>
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-100">
                        Active
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-stone-500">
                      {selectedBank.accountTitle} • A/C: {selectedBank.accountNumber}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setTxType("deposit");
                      setShowTxModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"
                  >
                    <ArrowDownLeft size={16} /> + Deposit Cash
                  </button>
                  <button
                    onClick={() => {
                      setTxType("withdrawal");
                      setShowTxModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 border border-red-200 hover:bg-red-100 transition"
                  >
                    <ArrowUpRight size={16} /> - Withdraw
                  </button>
                  <button
                    onClick={() => setSelectedBank(null)}
                    className="rounded-xl p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition"
                    title="Close Ledger"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Balance Bar */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-stone-50 p-4 border border-stone-100">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                    Ledger Available Balance
                  </span>
                  <p className="font-display text-2xl font-black text-stone-900 mt-0.5">
                    {money(selectedBank.currentBalance)}
                  </p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                    size={15}
                  />
                  <input
                    type="text"
                    value={txSearch}
                    onChange={(e) => setTxSearch(e.target.value)}
                    placeholder="Search by invoice or customer..."
                    className="field pl-8 !py-1.5 !text-xs"
                  />
                </div>
              </div>

              {/* Transactions Ledger Table */}
              <div className="mt-4">
                <DataTable
                  data={visibleTransactions}
                  rowKey={(tx) => tx.id}
                  loading={loadingTx}
                  emptyText="No transactions found for this bank account yet."
                  columns={[
                    {
                      key: "date",
                      header: "Date",
                      className: "whitespace-nowrap",
                      cell: (tx) => (
                        <span className="text-xs font-semibold text-stone-600">
                          {formatDate(tx.date)}
                        </span>
                      ),
                    },
                    {
                      key: "invoice",
                      header: "Invoice #",
                      cell: (tx) => {
                        if (!tx.invoiceNo) {
                          return <span className="text-xs text-stone-400">—</span>;
                        }
                        return (
                          <button
                            type="button"
                            onClick={() => handleViewInvoice(tx.invoiceNo, tx.saleId)}
                            className="inline-flex items-center gap-1 rounded bg-brand-50 px-2 py-0.5 font-mono text-xs font-bold text-brand-700 hover:bg-brand-100 hover:underline"
                            title="Click to view Bill Slip"
                          >
                            <Receipt size={12} />
                            #{tx.invoiceNo}
                          </button>
                        );
                      },
                    },
                    {
                      key: "customer",
                      header: "Customer / Detail",
                      cell: (tx) => (
                        <div>
                          <p className="text-xs font-bold text-stone-900">
                            {tx.customerName || tx.description || "Manual"}
                          </p>
                          {tx.customerName && tx.description && (
                            <p className="text-[10px] text-stone-400">{tx.description}</p>
                          )}
                        </div>
                      ),
                    },
                    {
                      key: "type",
                      header: "Type",
                      cell: (tx) => {
                        const isDeposit = tx.type === "deposit";
                        return (
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              isDeposit
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {isDeposit ? <ArrowDownLeft size={11} /> : <ArrowUpRight size={11} />}
                            {isDeposit ? "Received" : "Withdrawal"}
                          </span>
                        );
                      },
                    },
                    {
                      key: "amount",
                      header: "Amount",
                      align: "right",
                      cell: (tx) => {
                        const isDeposit = tx.type === "deposit";
                        return (
                          <span
                            className={`font-mono text-xs font-bold ${
                              isDeposit ? "text-emerald-700" : "text-red-600"
                            }`}
                          >
                            {isDeposit ? "+" : "-"} {money(tx.amount)}
                          </span>
                        );
                      },
                    },
                    {
                      key: "balanceAfter",
                      header: "Balance After",
                      align: "right",
                      cell: (tx) => (
                        <span className="font-mono text-xs font-semibold text-stone-700">
                          {tx.balanceAfter !== undefined ? money(tx.balanceAfter) : "—"}
                        </span>
                      ),
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Bank Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-stone-100">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                  <Landmark size={20} />
                </div>
                <h3 className="text-base font-bold text-stone-900">
                  {editingBank ? "Edit Bank Account" : "Add New Bank Account"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveBank} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-bold text-stone-700 block">Bank Name *</label>
                <input
                  type="text"
                  required
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. Meezan Bank, HBL, Allied Bank, EasyPaisa"
                  className="field mt-1 text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block">Account Title *</label>
                <input
                  type="text"
                  required
                  value={accountTitle}
                  onChange={(e) => setAccountTitle(e.target.value)}
                  placeholder="e.g. Eman Traders"
                  className="field mt-1 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block">Account Number / IBAN *</label>
                <input
                  type="text"
                  required
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g. 0291010482910291"
                  className="field mt-1 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block">Branch / City (Optional)</label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="e.g. Grain Market Branch"
                  className="field mt-1 text-xs"
                />
              </div>

              {!editingBank && (
                <div>
                  <label className="text-xs font-bold text-stone-700 block">
                    Opening / Initial Balance (Rs.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value)}
                    placeholder="0"
                    className="field mt-1 text-xs font-bold text-emerald-700"
                  />
                  <p className="mt-1 text-[10px] text-stone-400">
                    Existing bank balance if you are starting this account.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-stone-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={savingBank}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBank}
                  className="btn-primary min-w-[120px]"
                >
                  {savingBank ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : editingBank ? (
                    "Save Changes"
                  ) : (
                    "Add Account"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Deposit / Withdrawal Modal */}
      {showTxModal && selectedBank && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-stone-100">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold ${
                    txType === "deposit"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {txType === "deposit" ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    {txType === "deposit" ? "Deposit Cash to Bank" : "Withdraw from Bank"}
                  </h3>
                  <p className="text-xs font-semibold text-stone-500">{selectedBank.bankName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTxModal(false)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleManualTx} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-bold text-stone-700 block">Amount (Rs.) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  placeholder="e.g. 50000"
                  className="field mt-1 text-sm font-bold text-stone-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block">Description / Note</label>
                <input
                  type="text"
                  value={txDesc}
                  onChange={(e) => setTxDesc(e.target.value)}
                  placeholder="e.g. Cash deposited from shop, ATM withdrawal, etc."
                  className="field mt-1 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-stone-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTxModal(false)}
                  disabled={savingTx}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTx}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white transition ${
                    txType === "deposit"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {savingTx ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : txType === "deposit" ? (
                    "Record Deposit"
                  ) : (
                    "Record Withdrawal"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Bank Confirmation Modal */}
      {deleteConfirmBank && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-stone-100">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Delete {deleteConfirmBank.bankName}?
                </h3>
                <span className="text-xs font-semibold text-stone-500">
                  A/C: {deleteConfirmBank.accountNumber} • Balance: {money(deleteConfirmBank.currentBalance)}
                </span>
              </div>
            </div>

            <p className="text-xs text-stone-600 mb-6 bg-red-50 p-3 rounded-xl border border-red-100 leading-relaxed">
              Are you sure you want to delete this bank account? Existing historical transactions will remain in customer bills.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmBank(null)}
                disabled={deletingBank}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteBank}
                disabled={deletingBank}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
              >
                {deletingBank ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Receipt Modal (Triggered by clicking Invoice #) */}
      {receiptSale && (
        <SaleReceipt
          shop={currentShop}
          invoiceNo={receiptSale.invoiceNo}
          date={receiptSale.date}
          customerName={receiptSale.customerName}
          transport={receiptSale.transport}
          extraCharges={receiptSale.extraCharges}
          items={receiptSale.items}
          total={saleNetAmount(receiptSale)}
          paymentMethod={receiptSale.paymentMethod}
          printLabel="Print Slip"
          closeLabel="Close"
          onClose={() => setReceiptSale(null)}
        />
      )}
    </div>
  );
}
