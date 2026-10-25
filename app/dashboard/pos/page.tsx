"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { createOnlineSale, queueOfflineSale } from "../../lib/services/sales";
import { subscribeProducts } from "../../lib/services/products";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../store/useLanguage";
import {
    Search,
    ShoppingCart,
    Trash2,
    ChevronUp,
    ChevronDown,
    Banknote,
    Landmark,
    HandCoins,
    Plus,
    Minus,
    StickyNote,
    Loader2,
    Truck,
    CreditCard,
} from "lucide-react";
import { toast } from 'react-toastify';
import { listCustomers } from '../../lib/services/customers';
import { listBankAccounts } from '../../lib/services/banks';
import type { BankAccount, Customer, PaymentMethod, Product, SaleItem, Transport } from '../../types';
import { listTransports } from '../../lib/services/transports';
import SearchSelect from '../../components/SearchSelect';
import AddTransportModal from '../../components/AddTransportModal';
import CustomerSelect from '../../components/CustomerSelect';
import SaleReceipt from '../../components/SaleReceipt';

const OTHER_CATEGORY = "__other__";

export default function POSPage() {
    const { currentUser, currentShop } = useStore();
    const { t } = useLanguage();
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
    const [customerName, setCustomerName] = useState("");
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [customerId, setCustomerId] = useState("");
    const [description, setDescription] = useState("");
    const [transport, setTransport] = useState("");
    const [transportId, setTransportId] = useState("");
    const [extraCharges, setExtraCharges] = useState("");
    const [advanceAmount, setAdvanceAmount] = useState("");
    const [transports, setTransports] = useState<Transport[]>([]);
    const [showTransportModal, setShowTransportModal] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<SaleItem[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [invoiceNumber, setInvoiceNumber] = useState("");
    const isOnline = useOnlineStatus();

    // Banks and Split Payment States
    const [banks, setBanks] = useState<BankAccount[]>([]);
    const [selectedBankId, setSelectedBankId] = useState("");
    const [cashAmountInput, setCashAmountInput] = useState("");
    const [bankAmountInput, setBankAmountInput] = useState("");
    const [lastSaleMeta, setLastSaleMeta] = useState<{
        cashAmount?: number;
        bankAmount?: number;
        bankName?: string;
        advanceAmount?: number;
    } | null>(null);

    const [showReceipt, setShowReceipt] = useState(false);
    const [showMobileCart, setShowMobileCart] = useState(false);
    const [activeCategory, setActiveCategory] = useState("all");
    const [showNote, setShowNote] = useState(false);

    useEffect(() => {
        if (!currentUser) return;
        setLoading(true);
        return subscribeProducts(
            currentUser.uid,
            (items) => {
                setProducts(items);
                setLoading(false);
            },
            (error) => {
                console.error("Real-time fetch error:", error);
                setLoading(false);
            }
        );
    }, [currentUser]);

    const refreshCustomers = useCallback(async () => {
        if (!currentUser) return;
        try {
            setCustomers(await listCustomers(currentUser.uid));
        } catch (error) {
            console.error("Customers load error:", error);
        }
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser) return;
        let cancelled = false;
        listCustomers(currentUser.uid)
            .then(list => { if (!cancelled) setCustomers(list); })
            .catch(error => console.error("Customers load error:", error));
        return () => { cancelled = true; };
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser) return;
        let cancelled = false;
        listTransports(currentUser.uid)
            .then(list => { if (!cancelled) setTransports(list); })
            .catch(error => console.error("Transports load error:", error));
        return () => { cancelled = true; };
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser) return;
        let cancelled = false;
        listBankAccounts(currentUser.uid)
            .then(list => {
                if (!cancelled) {
                    setBanks(list);
                    if (list.length > 0 && !selectedBankId) {
                        setSelectedBankId(list[0].id);
                    }
                }
            })
            .catch(error => console.error("Banks load error:", error));
        return () => { cancelled = true; };
    }, [currentUser]);

    const handleSelectCustomer = (customer: Customer | null) => {
        if (!customer) {
            setCustomerId("");
            setCustomerName("");
        } else {
            setCustomerId(customer.id);
            setCustomerName(customer.name);
        }
    };

    const handleProductClick = (product: Product) => {
        const inCart = cart.some((item) => item.id === product.id);
        if (inCart) {
            toast.info(t("pos_item_already_in_cart", { name: product.name }));
            const el = document.getElementById(`cart-item-${product.id}`);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "nearest" });
                el.classList.add("bg-brand-50");
                setTimeout(() => el.classList.remove("bg-brand-50"), 1200);
            }
            return;
        }
        addToCart(product, 1);
    };

    const addToCart = (product: Product, bagsQty = 1) => {
        const finalPrice = product.sellingPrice;
        const isWeight = product.unitType === "weight";
        const bagWeight = 25;
        const totalWeight = isWeight ? bagsQty * bagWeight : undefined;
        const lineGross = isWeight ? (totalWeight! * finalPrice) : (bagsQty * finalPrice);

        setCart(prev => {
            const idx = prev.findIndex(item => item.id === product.id);
            if (idx !== -1) {
                // Already in cart: do NOT increment qty on click
                return prev;
            }
            const newItem: SaleItem = {
                id: product.id,
                name: product.name,
                qty: bagsQty,
                weightPerBag: bagWeight,
                isManualWeight: false,
                price: finalPrice,
                buyingPrice: product.buyingPrice ?? 0,
                total: lineGross,
                type: product.unitType || "count",
            };
            if (totalWeight !== undefined) {
                newItem.totalWeight = totalWeight;
            }
            return [...prev, newItem];
        });
    };

    const removeFromCart = (index: number) => {
        const newCart = [...cart];
        newCart.splice(index, 1);
        setCart(newCart);
    };

    const itemsTotal = cart.reduce((sum, item) => sum + item.total, 0);
    const extra = Math.max(0, parseFloat(extraCharges) || 0);
    const advance = Math.max(0, parseFloat(advanceAmount) || 0);
    const grossTotal = itemsTotal + extra;
    const grandTotal = Math.max(0, grossTotal - advance);

    const handleFinalizeSale = async () => {
        if (!currentUser) return;
        if (cart.length === 0) {
            return toast.error(t("pos_cart_empty_toast"));
        }
        if (cart.some(item => !(item.qty > 0))) {
            return toast.error(t("pos_qty_zero"));
        }
        if (paymentMethod === "Udhar" && !customerId) {
            toast.error(t("pos_select_party_credit"));
            return;
        }

        const selectedBank = banks.find(b => b.id === selectedBankId);

        let calculatedCashAmount: number | undefined = undefined;
        let calculatedBankAmount: number | undefined = undefined;
        let chosenBankId: string | undefined = undefined;
        let chosenBankName: string | undefined = undefined;

        if (paymentMethod === "Cash") {
            calculatedCashAmount = grandTotal;
            calculatedBankAmount = 0;
        } else if (paymentMethod === "Bank Account") {
            if (banks.length === 0) {
                toast.error("Pehle Bank Accounts page me bank account add karein");
                return;
            }
            if (!selectedBank) {
                toast.error("Barah-e-karam bank muntakhib karein");
                return;
            }
            calculatedCashAmount = 0;
            calculatedBankAmount = grandTotal;
            chosenBankId = selectedBank.id;
            chosenBankName = selectedBank.bankName;
        } else if (paymentMethod === "Split") {
            if (banks.length === 0) {
                toast.error("Pehle Bank Accounts page me bank account add karein");
                return;
            }
            if (!selectedBank) {
                toast.error("Barah-e-karam bank muntakhib karein");
                return;
            }
            const cVal = Math.max(0, parseFloat(cashAmountInput) || 0);
            const bVal = Math.max(0, parseFloat(bankAmountInput) || 0);
            if (cVal <= 0 && bVal <= 0) {
                toast.error("Barah-e-karam cash ya bank ki raqam darj karein");
                return;
            }
            const remaining = grandTotal - (cVal + bVal);
            if (remaining > 0.01 && !customerId) {
                toast.error(t("pos_select_party_credit"));
                return;
            }
            calculatedCashAmount = cVal;
            calculatedBankAmount = bVal;
            chosenBankId = selectedBank.id;
            chosenBankName = selectedBank.bankName;
        } else if (paymentMethod === "Udhar") {
            calculatedCashAmount = 0;
            calculatedBankAmount = 0;
        }

        setCheckoutLoading(true);

        try {
            const meta = {
                customerName: customerName.trim() || "Counter Sale",
                description: description.trim(),
                transport: transport.trim(),
                extraCharges: extra,
                ...(advance > 0 ? { advanceAmount: advance } : {}),
                paymentMethod,
                ...(customerId ? { customerId } : {}),
                ...(calculatedCashAmount !== undefined ? { cashAmount: calculatedCashAmount } : {}),
                ...(calculatedBankAmount !== undefined ? { bankAmount: calculatedBankAmount } : {}),
                ...(chosenBankId ? { bankId: chosenBankId } : {}),
                ...(chosenBankName ? { bankName: chosenBankName } : {}),
            };

            const shortInvoiceNo = isOnline
                ? await createOnlineSale(currentUser.uid, cart, grossTotal, meta)
                : queueOfflineSale(currentUser.uid, cart, grossTotal, meta, products);

            if (!isOnline) {
                setProducts(prev => prev.map(p => {
                    const cartItem = cart.find(c => c.id === p.id);
                    if (!cartItem) return p;
                    const deduct = cartItem.qty;
                    return { ...p, stock: p.stock - deduct };
                }));
            }

            setLastSaleMeta({
                cashAmount: calculatedCashAmount,
                bankAmount: calculatedBankAmount,
                bankName: chosenBankName,
                advanceAmount: advance,
            });
            setInvoiceNumber(shortInvoiceNo);
            toast.success(t("pos_sale_success"));
            if (customerId) refreshCustomers();
            setShowReceipt(true);

        } catch (error) {
            console.error(error);
            toast.error(t("pos_sale_failed", { reason: typeof error === 'string' ? error : error instanceof Error ? error.message : t("pos_unknown_error") }));
        }
        setCheckoutLoading(false);
    };

    const categories = useMemo(() => {
        const set = new Set<string>();
        products.forEach(p => set.add(p.category?.trim() || OTHER_CATEGORY));
        return [...set].sort((a, b) => a.localeCompare(b));
    }, [products]);

    const filteredProducts = useMemo(() => {
        const term = search.toLowerCase();
        return products.filter(p => {
            if (!p.name.toLowerCase().includes(term)) return false;
            return activeCategory === "all" || (p.category?.trim() || OTHER_CATEGORY) === activeCategory;
        });
    }, [products, search, activeCategory]);

    const resetOrder = () => {
        setCart([]);
        setCustomerName("");
        setCustomerId("");
        setDescription("");
        setTransport(""); setTransportId(""); setExtraCharges(""); setAdvanceAmount("");
        setShowNote(false);
    };



    const updateBagsQty = (index: number, newBagsQty: string | number) => {
        setCart(prev => prev.map((item, i) => {
            if (i !== index) return item;
            let qty = parseFloat(String(newBagsQty));
            if (isNaN(qty) || qty < 0) qty = 0;

            const isWeight = item.type === "weight";
            const bagWeight = item.weightPerBag || 25;
            const totalWeight = isWeight ? qty * bagWeight : undefined;
            const lineGross = isWeight ? ((totalWeight ?? 0) * item.price) : (qty * item.price);

            const updated: SaleItem = {
                ...item,
                qty,
                isManualWeight: false,
                total: lineGross,
            };
            if (totalWeight !== undefined) {
                updated.totalWeight = totalWeight;
            } else {
                delete updated.totalWeight;
            }
            return updated;
        }));
    };

    const updateTotalWeight = (index: number, weightValue: string | number) => {
        setCart(prev => prev.map((item, i) => {
            if (i !== index) return item;
            let weight = parseFloat(String(weightValue));
            if (isNaN(weight) || weight < 0) weight = 0;

            return {
                ...item,
                totalWeight: weight,
                isManualWeight: true,
                total: weight * item.price,
            };
        }));
    };
    const updatePrice = (index: number, priceValue: string | number) => {
        setCart(prev => prev.map((item, i) => {
            if (i !== index) return item;
            let price = parseFloat(String(priceValue));
            if (isNaN(price) || price < 0) price = 0;

            const isWeight = item.type === "weight";
            const currentWeight = item.totalWeight ?? (item.qty * (item.weightPerBag || 25));
            const lineGross = isWeight ? (currentWeight * price) : (item.qty * price);

            return {
                ...item,
                price,
                sellingPrice: price,
                total: lineGross,
            };
        }));
    };

    return (
        <div className="flex flex-col lg:flex-row-reverse h-[calc(100vh-96px)] lg:h-[calc(100vh-112px)] gap-4 relative">
            <div className="card flex h-full min-w-0 flex-1 flex-col overflow-hidden lg:w-[380px] lg:flex-none xl:w-[420px]">
                <div className="space-y-3 border-b border-stone-100 p-3">
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={17} />
                        <input
                            type="text"
                            placeholder={t("pos_search_items")}
                            className="field pl-10"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {[{ key: "all", label: t("all") }, ...categories.map(c => ({ key: c, label: c === OTHER_CATEGORY ? t("pos_category_other") : c }))].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveCategory(tab.key)}
                                className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${activeCategory === tab.key
                                    ? "border-brand-500 bg-brand-500 text-white shadow-sm"
                                    : "border-stone-200 bg-white text-stone-600 hover:border-brand-300 hover:text-stone-900"
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 pb-24 lg:pb-3">
                    {loading ? (
                        <div className="flex h-full items-center justify-center font-medium text-stone-400">{t("loading")}</div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="flex h-64 flex-col items-center justify-center gap-2 text-stone-400">
                            <Search size={36} className="opacity-30" />
                            <p className="text-sm font-medium">{t("noItemsFound")}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-2">
                            {filteredProducts.map((product) => {
                                const isOutOfStock = product.stock <= 0;
                                const inCartQty = cart.find(c => c.id === product.id)?.qty ?? 0;
                                const isLow = !isOutOfStock && product.stock < 5;
                                const rateUnit = product.unitType === 'weight' ? 'kg' : 'pc';
                                const stockUnit = product.unitType === 'weight' ? t("pos_unit_bags") : t("pos_unit_pcs");

                                return (
                                    <button
                                        key={product.id}
                                        type="button"
                                        disabled={isOutOfStock}
                                        onClick={() => handleProductClick(product)}
                                        className={`relative flex flex-col gap-1 rounded-lg border bg-white p-2 text-left transition-all ${isOutOfStock
                                            ? 'cursor-not-allowed border-stone-200 opacity-60'
                                            : inCartQty > 0
                                                ? 'border-brand-500 ring-2 ring-brand-500/20 active:scale-[0.98]'
                                                : 'border-stone-200 hover:border-brand-400 hover:shadow-pop active:scale-[0.98]'
                                            }`}
                                    >
                                        {inCartQty > 0 && (
                                            <span className="absolute right-1 top-1 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white shadow">
                                                {inCartQty}
                                            </span>
                                        )}

                                        <h3 className="line-clamp-2 min-h-[2rem] pr-4 text-[11px] font-bold leading-tight text-stone-900">
                                            {product.name}
                                        </h3>

                                        <div className="mt-auto flex flex-col gap-1">
                                            <span className="tabular text-xs font-bold text-brand-700">
                                                Rs {product.sellingPrice}
                                                <span className="ml-0.5 text-[9px] font-semibold text-stone-400">/{rateUnit}</span>
                                            </span>
                                            <span className={`w-fit rounded px-1 py-0.5 text-[9px] font-bold tabular ${isOutOfStock
                                                ? 'bg-red-100 text-red-700'
                                                : isLow
                                                    ? 'bg-amber-100 text-amber-800'
                                                    : 'bg-stone-100 text-stone-600'
                                                }`}>
                                                {isOutOfStock ? t("pos_out_of_stock") : `${product.stock} ${stockUnit}`}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
            <div className="fixed bottom-0 left-0 z-30 flex w-full items-center justify-between border-t border-stone-200 bg-white p-4 shadow-pop lg:hidden">
                <div onClick={() => setShowMobileCart(true)}>
                    <p className="text-xs text-stone-500">{cart.length} {t("items")}</p>
                    <h3 className="tabular font-display text-xl font-bold text-stone-900">Rs. {Math.round(grandTotal).toLocaleString()}</h3>
                </div>
                <button onClick={() => setShowMobileCart(true)} className="btn-primary">
                    <ShoppingCart size={18} /> {t("pos_view_bill")}
                    <ChevronUp size={16} />
                </button>
            </div>

            <div className={`
                fixed inset-0 z-40 flex h-full w-full flex-col bg-white transition-transform duration-300 ease-in-out
                lg:static lg:min-w-0 lg:flex-1 lg:translate-y-0 lg:rounded-xl lg:border lg:border-stone-200 lg:shadow-card
                ${showMobileCart ? 'translate-y-0' : 'translate-y-full'}
            `}>

                <div className="flex items-center justify-between border-b border-stone-200 px-3.5 py-2.5">
                    <div>
                        <h2 className="text-base font-bold text-stone-900">{t("orderList")}</h2>
                        <p className="text-[11px] text-stone-500">{t("newBill")} • {cart.length} {t("items")}</p>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={resetOrder}
                            disabled={cart.length === 0}
                            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                            title={t("reset")}
                        >
                            <Trash2 size={16} />
                        </button>
                        <button onClick={() => setShowMobileCart(false)} className="rounded-lg bg-stone-100 p-1.5 text-stone-600 lg:hidden">
                            <ChevronDown size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex items-end gap-3 border-b border-stone-200 px-3.5 py-2">
                    <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                                {paymentMethod === "Udhar" ? t("pos_party_credit_label") : t("customer")}
                            </label>
                            {paymentMethod === "Udhar" && !customerId && (
                                <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                                    {t("pos_selection_required")}
                                </span>
                            )}
                        </div>

                        <CustomerSelect
                            customers={customers}
                            selectedCustomerId={customerId}
                            onSelectCustomer={handleSelectCustomer}
                            isUdhar={paymentMethod === "Udhar"}
                        />
                    </div>

                    <div className="w-full max-w-[280px] shrink-0 space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{t("pos_transport")}</label>
                        <div className="flex gap-2">
                            <div className="min-w-0 flex-1">
                                <SearchSelect
                                    options={transports.map((tr) => ({ id: tr.id, label: tr.name }))}
                                    value={transportId}
                                    onChange={(o) => { setTransportId(o?.id ?? ""); setTransport(o?.label ?? ""); }}
                                    placeholder={t("pos_select_transport_placeholder")}
                                    searchPlaceholder={t("pos_select_transport_search")}
                                    emptyText={t("pos_select_transport_empty")}
                                    icon={<Truck size={16} />}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowTransportModal(true)}
                                className="flex shrink-0 items-center justify-center rounded-lg border border-brand-500 bg-brand-50 px-3 text-brand-700 transition hover:bg-brand-100"
                                title={t("pos_select_transport_add_title")}
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {cart.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-stone-300">
                            <ShoppingCart size={40} />
                            <p className="text-sm font-semibold text-stone-400">{t("cartEmpty")}</p>
                            <p className="text-xs text-stone-400">{t("clickItemToAdd")}</p>
                        </div>
                    ) : (
                        <div className="min-w-[640px]">
                            <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_110px_90px_90px_100px_28px] items-center gap-3 border-b border-stone-200 bg-stone-100 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                                <span>{t("pos_col_product")}</span>
                                <span className="text-center">{t("pos_col_bags")}</span>
                                <span className="text-center">{t("pos_col_weight")}</span>
                                <span className="text-center">{t("pos_col_rate")}</span>
                                <span className="text-right">{t("total")}</span>
                                <span />
                            </div>

                            {cart.map((item, index) => {
                                const isWeight = item.type === "weight";
                                const currentWeight = item.totalWeight ?? (item.qty * (item.weightPerBag || 25));

                                return (
                                    <div
                                        key={item.id}
                                        id={`cart-item-${item.id}`}
                                        className="grid grid-cols-[minmax(0,1fr)_110px_90px_90px_100px_28px] items-center gap-3 border-b border-stone-100 px-3.5 py-2.5 transition-colors duration-300 rounded-lg"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-stone-900">{item.name}</p>
                                        </div>

                                        <div className="flex items-center rounded-lg border border-stone-200 bg-stone-50">
                                            <button
                                                type="button"
                                                onClick={() => updateBagsQty(index, Math.max(1, item.qty - 1))}
                                                className="p-1.5 text-stone-500 hover:text-brand-700"
                                            >
                                                <Minus size={13} />
                                            </button>
                                            <input
                                                type="number"
                                                min="1"
                                                className="tabular w-full border-0 bg-transparent p-0 text-center text-sm font-bold outline-none"
                                                value={item.qty}
                                                onChange={(e) => updateBagsQty(index, e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => updateBagsQty(index, item.qty + 1)}
                                                className="p-1.5 text-stone-500 hover:text-brand-700"
                                            >
                                                <Plus size={13} />
                                            </button>
                                        </div>

                                        {isWeight ? (
                                            <input
                                                type="number"
                                                step="any"
                                                min="0"
                                                className={`tabular w-full rounded-lg border px-2 py-1.5 text-center text-sm font-bold outline-none focus:border-brand-500 focus:bg-white ${item.isManualWeight ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-stone-50"}`}
                                                value={currentWeight}
                                                onChange={(e) => updateTotalWeight(index, e.target.value)}
                                                title={t("pos_weight_hint")}
                                            />
                                        ) : (
                                            <span className="text-center text-sm text-stone-300">—</span>
                                        )}

                                        <input
                                            type="number"
                                            step="any"
                                            min="0"
                                            className="tabular w-full rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-center text-sm font-bold outline-none focus:border-brand-500 focus:bg-white"
                                            value={item.price}
                                            onChange={(e) => updatePrice(index, e.target.value)}
                                            title={isWeight ? t("pos_rate_per_kg") : t("pos_rate_per_piece")}
                                        />

                                        <span className="tabular text-right text-sm font-extrabold text-stone-900">
                                            {Math.round(item.total).toLocaleString()}
                                        </span>

                                        <button
                                            onClick={() => removeFromCart(index)}
                                            className="rounded-md p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                                            title={t("pos_remove")}
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div className="border-t border-stone-200 p-2.5 space-y-1.5 bg-white">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label htmlFor="extra-charges" className="text-[11px] font-bold uppercase tracking-wider text-stone-500 flex items-center justify-between">
                                <span className="truncate">{t("pos_extra_charges")}</span>
                            </label>
                            <div className="relative mt-1">
                                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-stone-400">Rs.</span>
                                <input
                                    id="extra-charges"
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={extraCharges}
                                    onChange={(e) => setExtraCharges(e.target.value)}
                                    placeholder="0"
                                    className="field !py-1 pl-7 text-right font-bold text-xs"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="advance-amount" className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center justify-between">
                                <span className="truncate">{t("pos_advance_amount")}</span>
                            </label>
                            <div className="relative mt-1">
                                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-600">Rs.</span>
                                <input
                                    id="advance-amount"
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={advanceAmount}
                                    onChange={(e) => setAdvanceAmount(e.target.value)}
                                    placeholder="0"
                                    className="field !py-1 pl-7 text-right font-bold text-xs border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500/20 text-emerald-800"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                                {advance > 0 ? t("pos_receipt_net_payable") : t("grandTotal")}
                            </span>
                            {!showNote && (
                                <button
                                    onClick={() => setShowNote(true)}
                                    className="text-[10px] font-semibold text-stone-400 hover:text-brand-600 flex items-center gap-0.5"
                                >
                                    <StickyNote size={11} /> {t("addNote")}
                                </button>
                            )}
                        </div>
                        <div className="text-right">
                            {advance > 0 && (
                                <span className="block text-[10px] text-stone-400 line-through">
                                    Rs. {Math.round(grossTotal).toLocaleString()}
                                </span>
                            )}
                            <span className="tabular font-display text-lg font-black text-brand-700">
                                Rs. {Math.round(grandTotal).toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {showNote && (
                        <div className="relative">
                            <textarea
                                placeholder={t("notePlaceholder")}
                                rows={1}
                                className="field !py-1 !px-2.5 !text-xs resize-none"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                            <button
                                onClick={() => { setShowNote(false); setDescription(""); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-4 gap-1">
                        {([
                            { value: "Cash", label: t("pos_pay_cash"), icon: Banknote },
                            { value: "Bank Account", label: t("pos_pay_bank"), icon: Landmark },
                            { value: "Split", label: t("pos_pay_split"), icon: CreditCard },
                            { value: "Udhar", label: t("pos_pay_credit"), icon: HandCoins },
                        ] as { value: PaymentMethod; label: string; icon: typeof Banknote }[]).map(opt => {
                            const Icon = opt.icon;
                            const active = paymentMethod === opt.value;
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setPaymentMethod(opt.value)}
                                    className={`flex flex-col sm:flex-row items-center justify-center gap-1 rounded-lg border py-1.5 px-1 text-[11px] font-bold transition text-center ${active
                                        ? opt.value === "Udhar"
                                            ? "border-amber-500 bg-amber-50 text-amber-900 shadow-sm"
                                            : opt.value === "Split"
                                                ? "border-indigo-500 bg-indigo-50 text-indigo-900 shadow-sm"
                                                : "border-brand-500 bg-brand-50 text-brand-900 shadow-sm"
                                        : "border-stone-200 text-stone-600 hover:bg-stone-50"
                                        }`}
                                >
                                    <Icon size={14} className="shrink-0" />
                                    <span className="truncate">{opt.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {paymentMethod === "Bank Account" && (
                        <div className="rounded-lg border border-brand-200 bg-brand-50/50 p-2 space-y-1">
                            <div className="flex items-center justify-between">
                                <label className="text-[11px] font-bold text-brand-900 flex items-center gap-1">
                                    <Landmark size={13} /> {t("pos_select_bank")}
                                </label>
                                {banks.length === 0 ? (
                                    <Link href="/dashboard/banks" className="text-[10px] font-bold text-brand-700 underline">
                                        + Bank Add Karein
                                    </Link>
                                ) : null}
                            </div>
                            {banks.length > 0 ? (
                                <select
                                    value={selectedBankId}
                                    onChange={(e) => setSelectedBankId(e.target.value)}
                                    className="field !py-1 !text-xs font-semibold bg-white"
                                >
                                    {banks.map(b => (
                                        <option key={b.id} value={b.id}>
                                            {b.bankName} - {b.accountNumber} (Bal: Rs. {Math.round(b.currentBalance).toLocaleString()})
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <p className="text-[11px] text-amber-800 font-medium">
                                    ⚠️ Koi bank account mojood nahi. Pehle Bank Accounts page me bank add karein.
                                </p>
                            )}
                        </div>
                    )}

                    {paymentMethod === "Split" && (
                        <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-2 space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[11px] font-bold text-indigo-950 flex items-center gap-1">
                                    <Landmark size={13} /> {t("pos_select_bank")}
                                </label>
                                {banks.length === 0 && (
                                    <Link href="/dashboard/banks" className="text-[10px] font-bold text-indigo-700 underline">
                                        + Bank Add Karein
                                    </Link>
                                )}
                            </div>
                            {banks.length > 0 ? (
                                <select
                                    value={selectedBankId}
                                    onChange={(e) => setSelectedBankId(e.target.value)}
                                    className="field !py-1 !text-xs font-semibold bg-white"
                                >
                                    {banks.map(b => (
                                        <option key={b.id} value={b.id}>
                                            {b.bankName} - {b.accountNumber}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <p className="text-[11px] text-amber-800 font-medium">
                                    ⚠️ Koi bank account mojood nahi. Pehle Bank Accounts page me bank add karein.
                                </p>
                            )}

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-600 block mb-0.5">
                                        💵 {t("pos_cash_part")}
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={cashAmountInput}
                                        onChange={(e) => setCashAmountInput(e.target.value)}
                                        placeholder="0"
                                        className="field !py-1 !text-xs font-bold text-right"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-600 block mb-0.5">
                                        🏛️ {t("pos_bank_part")}
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={bankAmountInput}
                                        onChange={(e) => setBankAmountInput(e.target.value)}
                                        placeholder="0"
                                        className="field !py-1 !text-xs font-bold text-right"
                                    />
                                </div>
                            </div>

                            {(() => {
                                const cVal = parseFloat(cashAmountInput) || 0;
                                const bVal = parseFloat(bankAmountInput) || 0;
                                const paid = cVal + bVal;
                                const remainder = grandTotal - paid;
                                if (remainder > 0.01) {
                                    return (
                                        <div className="text-[10px] font-bold text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200">
                                            ⚠️ {t("pos_split_remainder_warning", { amount: Math.round(remainder).toLocaleString() })}
                                        </div>
                                    );
                                } else if (paid > grandTotal + 0.01) {
                                    return (
                                        <div className="text-[10px] font-semibold text-blue-800 bg-blue-50 p-1 rounded">
                                            Wapsi (Change): Rs. {Math.round(paid - grandTotal).toLocaleString()}
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </div>
                    )}

                    {paymentMethod === "Udhar" && !customerId && (
                        <p className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 text-center">
                            ⚠️ {t("pos_select_party_warning")}
                        </p>
                    )}

                    <button
                        onClick={handleFinalizeSale}
                        disabled={cart.length === 0 || checkoutLoading}
                        className="btn-primary w-full !py-2 !text-xs font-bold shadow-sm min-h-[36px] flex items-center justify-center"
                    >
                        {checkoutLoading ? (
                            <Loader2 className="animate-spin text-white" size={16} />
                        ) : isOnline ? (
                            t("paymentTotal", { amount: Math.round(grandTotal).toLocaleString() })
                        ) : (
                            t("saveOffline")
                        )}
                    </button>
                </div>
            </div>

            <AddTransportModal
                open={showTransportModal}
                onClose={() => setShowTransportModal(false)}
                onSaved={(created) => {
                    setTransports(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
                    setTransportId(created.id);
                    setTransport(created.name);
                }}
            />

            {showReceipt && (
                <SaleReceipt
                    shop={currentShop}
                    invoiceNo={invoiceNumber}
                    date={new Date().toISOString()}
                    customerName={customerName}
                    transport={transport}
                    extraCharges={extra}
                    advanceAmount={lastSaleMeta?.advanceAmount}
                    items={cart}
                    total={grandTotal}
                    paymentMethod={paymentMethod}
                    cashAmount={lastSaleMeta?.cashAmount}
                    bankAmount={lastSaleMeta?.bankAmount}
                    bankName={lastSaleMeta?.bankName}
                    printLabel={t("printSlip")}
                    closeLabel={t("clearCart")}
                    onClose={() => {
                        setShowReceipt(false);
                        setCart([]);
                        setCustomerName("");
                        setCustomerId("");
                        setDescription("");
                        setTransport("");
                        setTransportId("");
                        setExtraCharges("");
                        setAdvanceAmount("");
                        setCashAmountInput("");
                        setBankAmountInput("");
                        setInvoiceNumber("");
                        setLastSaleMeta(null);
                    }}
                />
            )}
        </div>
    );
}