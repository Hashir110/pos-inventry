"use client";
import { useState } from 'react';
import { toast } from 'react-toastify';
import type { Sale, SaleItem } from '../../types';
import { RotateCcw, Eye, FileText, Search, X, Loader2 } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import DataTable from "../../components/DataTable";
import { useStore } from '../../store/useStore';
import { findSaleByInvoice, getSaleById } from '../../lib/services/sales';
import { processReturn } from '../../lib/services/returns';

export default function ReturnsPage() {
    const [invoiceId, setInvoiceId] = useState('');
    const [isDesModalOpen, setIsDesModalOpen] = useState(false);
    const [selectedDescription, setSelectedDescription] = useState("");
    const [saleData, setSaleData] = useState<Sale | null>(null);
    const [loading, setLoading] = useState(false);
    const { currentUser } = useStore();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!invoiceId || !currentUser) return;

        setLoading(true);
        setSaleData(null);
        try {
            const sale = await findSaleByInvoice(currentUser.uid, invoiceId);
            if (sale) {
                setSaleData(sale);
                toast.success("Invoice Found!");
            } else {
                toast.error("Invoice not found!");
            }
        } catch (error) {
            console.error(error);
            toast.error("Error searching invoice");
        }
        setLoading(false);
    };

    const handleReturnItem = async (item: SaleItem, index: number) => {
        if (!saleData) return;
        const availableToReturn = item.qty - (item.returnedQty || 0);
        const qtyStr = prompt(`How many "${item.name}" to return? (Max: ${availableToReturn})`);
        if (!qtyStr) return;

        const returnQty = parseFloat(qtyStr);
        if (isNaN(returnQty) || returnQty <= 0) {
            toast.error("Invalid Quantity!");
        }
        if (returnQty > availableToReturn) {
            toast.error(`Error: Max limit is ${availableToReturn}`);
            return;
        }

        try {
            setLoading(true);
            await processReturn(saleData.id, index, item.id, returnQty);
            toast.success(`Returned ${returnQty} x ${item.name} Successfully!`);

            const updated = await getSaleById(saleData.id);
            if (updated) setSaleData(updated);
        } catch (error) {
            console.error("Return Error:", error);
            toast.error("Return Failed: " + (error instanceof Error ? error.message : "unknown error"));
        } finally {
            setLoading(false);
        }
    };
    return (
        <div className="mx-auto max-w-4xl">
            <PageHeader title="Returns" subtitle="Invoice number se bill dhoondein aur item wapas lein" />

            <form onSubmit={handleSearch} className="card mb-6 flex flex-col gap-3 p-4 sm:flex-row">
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <input
                        type="text"
                        placeholder="Invoice number (e.g. 000012)"
                        className="field pl-11"
                        value={invoiceId}
                        onChange={(e) => setInvoiceId(e.target.value)}
                    />
                </div>
                <button
                    disabled={loading}
                    className="btn-primary sm:w-40 flex items-center justify-center min-h-[42px]"
                >
                    {loading ? <Loader2 size={18} className="animate-spin text-white" /> : "Bill dhoondein"}
                </button>
            </form>

            {!saleData && (
                <div className="card flex flex-col items-center p-12 text-center text-stone-400">
                    <RotateCcw size={36} className="mb-3 text-stone-300" />
                    <p className="text-sm font-medium">Upar invoice number likh kar bill kholein</p>
                </div>
            )}

            {saleData && (
                <DataTable
                    data={saleData.items.map((item: SaleItem, index: number) => ({ item, index }))}
                    rowKey={(r) => String(r.index)}
                    paginate={false}
                    header={
                        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400">Invoice</p>
                                <p className="font-mono text-xl font-extrabold text-brand-700">#{saleData.invoiceNo}</p>
                                <p className="mt-1 text-sm text-stone-500">
                                    {saleData.customerName || "Walk-in"} • {saleData.paymentMethod || "Cash"}
                                </p>
                                {saleData.description && (
                                    <button
                                        onClick={() => {
                                            setSelectedDescription(saleData.description);
                                            setIsDesModalOpen(true);
                                        }}
                                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-200"
                                    >
                                        <Eye size={13} /> Note dekhein
                                    </button>
                                )}
                            </div>
                            <div className="sm:text-right">
                                <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400">Date</p>
                                <p className="font-semibold text-stone-800">{new Date(saleData.date).toLocaleDateString()}</p>
                                <p className="mt-1 text-sm text-stone-500">
                                    Total Rs. {Math.round(saleData.totalAmount).toLocaleString()}
                                    {(saleData.refundedAmount || 0) > 0 && (
                                        <span className="text-red-600"> • Refund Rs. {Math.round(saleData.refundedAmount || 0).toLocaleString()}</span>
                                    )}
                                </p>
                            </div>
                        </div>
                    }
                    columns={[
                        { key: "name", header: "Item", cell: ({ item }) => <span className="font-semibold text-stone-900">{item.name}</span> },
                        {
                            key: "qty",
                            header: "Qty (Bags)",
                            align: "center",
                            cell: ({ item }) => (
                                <span className="font-medium text-stone-800">
                                    {item.type === "weight" ? `${String(item.qty).padStart(2, "0")} Bags` : `${item.qty} pcs`}
                                </span>
                            ),
                        },
                        {
                            key: "weight",
                            header: "Total Weight",
                            align: "center",
                            cell: ({ item }) => {
                                const isWeight = item.type === "weight";
                                const weightVal = item.totalWeight ?? (isWeight ? item.qty * (item.weightPerBag || 25) : undefined);
                                return <span className="font-bold text-stone-900">{weightVal !== undefined ? `${weightVal} kg` : "—"}</span>;
                            },
                        },
                        { key: "price", header: "Price", align: "right", cell: ({ item }) => <span className="text-stone-600">Rs. {item.price}</span> },
                        {
                            key: "returned",
                            header: "Wapas",
                            align: "center",
                            cell: ({ item }) => {
                                const alreadyReturned = item.returnedQty || 0;
                                return (
                                    <span className="font-bold text-red-600">
                                        {alreadyReturned > 0 ? (item.type === "weight" ? `${alreadyReturned} kg` : alreadyReturned) : "—"}
                                    </span>
                                );
                            },
                        },
                        {
                            key: "action",
                            header: "Action",
                            align: "right",
                            cell: ({ item, index }) =>
                                item.qty - (item.returnedQty || 0) > 0 ? (
                                    <button
                                        onClick={() => handleReturnItem(item, index)}
                                        disabled={loading}
                                        className="btn-danger !px-3.5 !py-1.5 !text-xs"
                                    >
                                        Wapas lein
                                    </button>
                                ) : (
                                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-500">
                                        Poora wapas
                                    </span>
                                ),
                        },
                    ]}
                />
            )}

            {isDesModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-pop">
                        <div className="flex items-center justify-between border-b border-stone-200 p-4">
                            <h3 className="flex items-center gap-2 font-extrabold text-stone-900">
                                <FileText size={18} className="text-brand-600" />
                                Sale ka Note
                            </h3>
                            <button onClick={() => setIsDesModalOpen(false)} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-5">
                            <div className="max-h-[300px] min-h-[100px] overflow-y-auto rounded-xl border border-stone-200 bg-stone-50 p-4">
                                <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
                                    {selectedDescription || "Is sale par koi note nahi."}
                                </p>
                            </div>
                            <button onClick={() => setIsDesModalOpen(false)} className="btn-dark mt-5 w-full !py-3">
                                Band karein
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
