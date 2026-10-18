"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createOnlineSale, queueOfflineSale } from "../../lib/services/sales";
import { subscribeProducts } from "../../lib/services/products";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../store/useLanguage";
import { Search, ShoppingCart, Trash2, ChevronUp, ChevronDown, Banknote, Landmark, HandCoins, Plus, Minus, StickyNote, Loader2, Truck } from "lucide-react";
import { toast } from 'react-toastify';
import { listCustomers } from '../../lib/services/customers';
import type { Customer, PaymentMethod, Product, SaleItem, Transport } from '../../types';
import { listTransports } from '../../lib/services/transports';
import SearchSelect from '../../components/SearchSelect';
import AddTransportModal from '../../components/AddTransportModal';
import CustomerSelect from '../../components/CustomerSelect';
import SaleReceipt from '../../components/SaleReceipt';

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
    const [transports, setTransports] = useState<Transport[]>([]);
    const [showTransportModal, setShowTransportModal] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<SaleItem[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [invoiceNumber, setInvoiceNumber] = useState("");
    const isOnline = useOnlineStatus();

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
                return prev.map((item, i) => {
                    if (i !== idx) return item;
                    const newQty = item.qty + bagsQty;
                    const newTotalWeight = isWeight
                        ? (item.isManualWeight ? (item.totalWeight ?? 0) + (bagsQty * bagWeight) : newQty * bagWeight)
                        : undefined;
                    const lineTotal = isWeight ? ((newTotalWeight ?? 0) * finalPrice) : (newQty * finalPrice);

                    const updated: SaleItem = {
                        ...item,
                        qty: newQty,
                        total: lineTotal,
                    };
                    if (newTotalWeight !== undefined) {
                        updated.totalWeight = newTotalWeight;
                    } else {
                        delete updated.totalWeight;
                    }
                    return updated;
                });
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
    const grandTotal = itemsTotal + extra;

    const handleFinalizeSale = async () => {
        if (!currentUser) return;
        if (cart.length === 0) {
            return toast.error("Cart khali hai");
        }
        if (cart.some(item => !(item.qty > 0))) {
            return toast.error("Quantity 0 hai — theek karein ya item hata dein");
        }
        if (paymentMethod === "Udhar" && !customerId) {
            toast.error("Udhar ke liye party select karein!");
            return;
        }
        setCheckoutLoading(true);

        try {
            const meta = {
                customerName: customerName.trim() || "Counter Sale",
                description: description.trim(),
                transport: transport.trim(),
                extraCharges: extra,
                paymentMethod,
                ...(paymentMethod === "Udhar" && customerId ? { customerId } : {}),
            };
            const shortInvoiceNo = isOnline
                ? await createOnlineSale(currentUser.uid, cart, grandTotal, meta)
                : queueOfflineSale(currentUser.uid, cart, grandTotal, meta, products);

            if (!isOnline) {
                setProducts(prev => prev.map(p => {
                    const cartItem = cart.find(c => c.id === p.id);
                    if (!cartItem) return p;
                    const deduct = cartItem.qty;
                    return { ...p, stock: p.stock - deduct };
                }));
            }

            setInvoiceNumber(shortInvoiceNo);
            toast.success("Sale Successful!");
            if (paymentMethod === "Udhar") refreshCustomers();
            setShowReceipt(true);

        } catch (error) {
            console.error(error);
            toast.error("Failed: " + (typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error'));
        }
        setCheckoutLoading(false);
    };

    const categories = useMemo(() => {
        const set = new Set<string>();
        products.forEach(p => set.add(p.category?.trim() || "Baqi"));
        return [...set].sort((a, b) => a.localeCompare(b));
    }, [products]);

    const filteredProducts = useMemo(() => {
        const term = search.toLowerCase();
        return products.filter(p => {
            if (!p.name.toLowerCase().includes(term)) return false;
            return activeCategory === "all" || (p.category?.trim() || "Baqi") === activeCategory;
        });
    }, [products, search, activeCategory]);

    const resetOrder = () => {
        setCart([]);
        setCustomerName("");
        setCustomerId("");
        setDescription("");
        setTransport(""); setTransportId(""); setExtraCharges("");
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
                            placeholder={t("searchItemsPlaceholder")}
                            className="field pl-10"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {[{ key: "all", label: t("all") }, ...categories.map(c => ({ key: c, label: c }))].map(tab => (
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
                                const stockUnit = product.unitType === 'weight' ? 'Bags' : 'pcs';

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
                                                {isOutOfStock ? 'Khatam' : `${product.stock} ${stockUnit}`}
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
                    <p className="text-xs text-stone-500">{cart.length} Items</p>
                    <h3 className="tabular font-display text-xl font-bold text-stone-900">Rs. {Math.round(grandTotal).toLocaleString()}</h3>
                </div>
                <button onClick={() => setShowMobileCart(true)} className="btn-primary">
                    <ShoppingCart size={18} /> Bill dekhein
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
                    <div className="w-full max-w-[280px] space-y-1">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                                {paymentMethod === "Udhar" ? "Party / Khata (Udhar)" : t("customer")}
                            </label>
                            {paymentMethod === "Udhar" && !customerId && (
                                <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                                    Selection Zaroori
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

                    <div className="min-w-0 flex-1 space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Transport</label>
                        <div className="flex gap-2">
                            <div className="min-w-0 flex-1">
                                <SearchSelect
                                    options={transports.map((tr) => ({ id: tr.id, label: tr.name }))}
                                    value={transportId}
                                    onChange={(o) => { setTransportId(o?.id ?? ""); setTransport(o?.label ?? ""); }}
                                    placeholder="Transport select karein"
                                    searchPlaceholder="Transport search karein..."
                                    emptyText="Koi transport nahi, + se add karein"
                                    icon={<Truck size={16} />}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowTransportModal(true)}
                                className="flex shrink-0 items-center justify-center rounded-lg border border-brand-500 bg-brand-50 px-3 text-brand-700 transition hover:bg-brand-100"
                                title="Nayi transport company add karein"
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
                                <span>Product</span>
                                <span className="text-center">Bags</span>
                                <span className="text-center">Weight (kg)</span>
                                <span className="text-center">Rate</span>
                                <span className="text-right">Total</span>
                                <span />
                            </div>

                            {cart.map((item, index) => {
                                const isWeight = item.type === "weight";
                                const currentWeight = item.totalWeight ?? (item.qty * (item.weightPerBag || 25));

                                return (
                                    <div
                                        key={item.id}
                                        className="grid grid-cols-[minmax(0,1fr)_110px_90px_90px_100px_28px] items-center gap-3 border-b border-stone-100 px-3.5 py-2.5"
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
                                                title="Bori mein wazan kam/zyada ho to yahan badlein"
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
                                            title={isWeight ? "Rate per kg" : "Rate per piece"}
                                        />

                                        <span className="tabular text-right text-sm font-extrabold text-stone-900">
                                            {Math.round(item.total).toLocaleString()}
                                        </span>

                                        <button
                                            onClick={() => removeFromCart(index)}
                                            className="rounded-md p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                                            title="Hatayein"
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
                    <div className="flex items-center justify-between gap-3">
                        <label htmlFor="extra-charges" className="text-xs font-bold uppercase tracking-wider text-stone-500">
                            Extra Charges <span className="font-medium normal-case tracking-normal text-stone-400">(transport waghera)</span>
                        </label>
                        <div className="relative w-32">
                            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-stone-400">Rs.</span>
                            <input
                                id="extra-charges"
                                type="number"
                                min="0"
                                step="any"
                                value={extraCharges}
                                onChange={(e) => setExtraCharges(e.target.value)}
                                placeholder="0"
                                className="field !py-1.5 pl-8 text-right font-bold"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">{t("grandTotal")}</span>
                            {!showNote && (
                                <button
                                    onClick={() => setShowNote(true)}
                                    className="text-[10px] font-semibold text-stone-400 hover:text-brand-600 flex items-center gap-0.5"
                                >
                                    <StickyNote size={11} /> {t("addNote")}
                                </button>
                            )}
                        </div>
                        <span className="tabular font-display text-lg font-black text-brand-700">
                            Rs. {Math.round(grandTotal).toLocaleString()}
                        </span>
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

                    <div className="grid grid-cols-3 gap-1.5">
                        {([
                            { value: "Cash", label: t("cash"), icon: Banknote },
                            { value: "Bank Account", label: t("bankOnline"), icon: Landmark },
                            { value: "Udhar", label: t("udhar"), icon: HandCoins },
                        ] as { value: PaymentMethod; label: string; icon: typeof Banknote }[]).map(opt => {
                            const Icon = opt.icon;
                            const active = paymentMethod === opt.value;
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setPaymentMethod(opt.value)}
                                    className={`flex items-center justify-center gap-1 rounded-lg border py-1.5 px-1 text-[11px] font-bold transition ${active
                                        ? opt.value === "Udhar"
                                            ? "border-amber-500 bg-amber-50 text-amber-900 shadow-sm"
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

                    {paymentMethod === "Udhar" && !customerId && (
                        <p className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 text-center">
                            ⚠️ Party select karein
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
                    items={cart}
                    total={grandTotal}
                    paymentMethod={paymentMethod}
                    printLabel={t("printSlip")}
                    closeLabel={t("clearCart")}
                    onClose={() => { setShowReceipt(false); setCart([]); setCustomerName(""); setCustomerId(""); setDescription(""); setTransport(""); setTransportId(""); setExtraCharges(""); setInvoiceNumber(""); }}
                />
            )}
        </div>
    );
}