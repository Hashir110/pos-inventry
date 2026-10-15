"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createOnlineSale, queueOfflineSale } from "../../lib/services/sales";
import { subscribeProducts } from "../../lib/services/products";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../store/useLanguage";
import { Search, ShoppingCart, Trash2, X, Printer, ChevronUp, ChevronDown, Banknote, Landmark, HandCoins, Plus, Minus, RotateCcw, StickyNote, Loader2 } from "lucide-react";
import { toast } from 'react-toastify';
import { listCustomers } from '../../lib/services/customers';
import type { Customer, PaymentMethod, Product, SaleItem } from '../../types';
import CustomerSelect from '../../components/CustomerSelect';

export default function POSPage() {
    const { currentUser, currentShop } = useStore();
    const { t } = useLanguage();
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
    const [customerName, setCustomerName] = useState("");
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [customerId, setCustomerId] = useState("");
    const [description, setDescription] = useState("");
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

                    return {
                        ...item,
                        qty: newQty,
                        totalWeight: newTotalWeight,
                        total: lineTotal,
                    };
                });
            }
            return [...prev, {
                id: product.id,
                name: product.name,
                qty: bagsQty,
                weightPerBag: bagWeight,
                totalWeight: totalWeight,
                isManualWeight: false,
                price: finalPrice,
                buyingPrice: product.buyingPrice,
                total: lineGross,
                type: product.unitType,
            }];
        });
    };

    const removeFromCart = (index: number) => {
        const newCart = [...cart];
        newCart.splice(index, 1);
        setCart(newCart);
    };

    const grandTotal = cart.reduce((sum, item) => sum + item.total, 0);

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
            const meta = { customerName, description, paymentMethod, customerId: paymentMethod === "Udhar" ? customerId : undefined };
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
        setShowNote(false);
    };

    const tints = [
        "bg-brand-100 text-brand-700",
        "bg-emerald-100 text-emerald-700",
        "bg-sky-100 text-sky-700",
        "bg-violet-100 text-violet-700",
        "bg-rose-100 text-rose-700",
        "bg-amber-100 text-amber-800",
    ];
    const tintFor = (name: string) => tints[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % tints.length];

    const updateBagsQty = (index: number, newBagsQty: string | number) => {
        setCart(prev => prev.map((item, i) => {
            if (i !== index) return item;
            let qty = parseFloat(String(newBagsQty));
            if (isNaN(qty) || qty < 0) qty = 0;

            const isWeight = item.type === "weight";
            const bagWeight = item.weightPerBag || 25;
            const totalWeight = isWeight ? qty * bagWeight : undefined;
            const lineGross = isWeight ? ((totalWeight ?? 0) * item.price) : (qty * item.price);

            return {
                ...item,
                qty,
                totalWeight,
                isManualWeight: false,
                total: lineGross,
            };
        }));
    };

    const updateTotalWeight = (index: number, weightValue: string | number) => {
        setCart(prev => prev.map((item, i) => {
            if (i !== index) return item;
            let weight = parseFloat(String(weightValue));
            if (isNaN(weight) || weight < 0) weight = 0;

            const lineGross = weight * item.price;

            return {
                ...item,
                totalWeight: weight,
                isManualWeight: true,
                total: lineGross,
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

    const handlePrint = () => {
        try {
            window.print();
        } catch (error) {
            console.error("Printer Error:", error);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-96px)] lg:h-[calc(100vh-112px)] gap-4 relative">
            <style jsx global>{`
        @media print {
          @page {
            size: auto;
            margin: 2mm;
          }
          body {
            margin: 0;
            padding: 0;
          }
          body * { visibility: hidden; }
          #printable-receipt, #printable-receipt * { 
            visibility: visible; 
          }
          #printable-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 100% !important;
            padding: 4px;
            margin: 0;
            background: white;
            color: black;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

            <div className="flex h-full min-w-0 flex-1 flex-col gap-4">
                <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 sm:mr-auto">
                        <h1 className="text-lg font-bold text-stone-900">{t("products")}</h1>
                        <p className="text-xs text-stone-500">{t("clickToAdd")}</p>
                    </div>
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={17} />
                        <input
                            type="text"
                            placeholder={t("searchItemsPlaceholder")}
                            className="field pl-10"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={resetOrder}
                        disabled={cart.length === 0}
                        className="btn-ghost !py-2.5"
                        title={t("reset")}
                    >
                        <RotateCcw size={16} /> {t("reset")}
                    </button>
                </div>

                <div className="-mt-1 flex gap-2 overflow-x-auto pb-1">
                    {[{ key: "all", label: t("all") }, ...categories.map(c => ({ key: c, label: c }))].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveCategory(tab.key)}
                            className={`shrink-0 rounded-lg border px-4 py-2 text-sm font-bold transition ${activeCategory === tab.key
                                ? "border-brand-500 bg-brand-500 text-white shadow-sm"
                                : "border-stone-200 bg-white text-stone-600 hover:border-brand-300 hover:text-stone-900"
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto pb-24 lg:pb-2">
                    {loading ? (
                        <div className="flex h-full items-center justify-center font-medium text-stone-400">{t("loading")}</div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="card flex h-64 flex-col items-center justify-center gap-2 text-stone-400">
                            <Search size={36} className="opacity-30" />
                            <p className="text-sm font-medium">{t("noItemsFound")}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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
                                        className={`card relative flex flex-col gap-2 p-3 text-left transition-all ${isOutOfStock
                                            ? 'cursor-not-allowed opacity-60'
                                            : inCartQty > 0
                                                ? '!border-brand-500 ring-2 ring-brand-500/20 active:scale-[0.98]'
                                                : 'hover:border-brand-400 hover:shadow-pop active:scale-[0.98]'
                                            }`}
                                    >
                                        {inCartQty > 0 && (
                                            <span className="absolute right-2 top-2 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-500 px-1.5 text-xs font-bold text-white shadow">
                                                {inCartQty}
                                            </span>
                                        )}

                                        <div className={`flex h-20 items-center justify-center rounded-lg font-display text-3xl font-bold ${isOutOfStock ? 'bg-stone-100 text-stone-400' : tintFor(product.name)}`}>
                                            {product.name.trim().charAt(0).toUpperCase()}
                                        </div>

                                        <div className="min-w-0">
                                            <p className="truncate text-[11px] font-bold uppercase tracking-wider text-stone-400">
                                                {product.category?.trim() || "Baqi"}
                                            </p>
                                            <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-snug text-stone-900">
                                                {product.name}
                                            </h3>
                                        </div>

                                        <div className="mt-auto flex items-end justify-between gap-2">
                                            <span className="tabular font-display text-base font-bold text-brand-700">
                                                Rs {product.sellingPrice}
                                                <span className="ml-0.5 text-[11px] font-semibold text-stone-400">/{rateUnit}</span>
                                            </span>
                                            <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular ${isOutOfStock
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
                lg:static lg:w-[400px] lg:shrink-0 lg:translate-y-0 lg:rounded-xl lg:border lg:border-stone-200 lg:shadow-card
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

                <div className="space-y-1 border-b border-stone-200 px-3.5 py-2">
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

                <div className="flex-1 overflow-y-auto bg-stone-50/60 p-3">
                    {cart.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-stone-300">
                            <ShoppingCart size={40} />
                            <p className="text-sm font-semibold text-stone-400">{t("cartEmpty")}</p>
                            <p className="text-xs text-stone-400">{t("clickItemToAdd")}</p>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {cart.map((item, index) => {
                                const isWeight = item.type === "weight";
                                const currentWeight = item.totalWeight ?? (item.qty * (item.weightPerBag || 25));

                                return (
                                    <div key={item.id} className="rounded-xl border border-stone-200 bg-white p-3 shadow-card space-y-2.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-xs font-bold ${tintFor(item.name)}`}>
                                                    {item.name.trim().charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-bold text-stone-900">{item.name}</p>
                                                    <p className="text-[11px] font-semibold text-brand-700">
                                                        Rate: Rs. {item.price} / {isWeight ? "kg" : "pc"}
                                                        {isWeight && (
                                                            <span className="text-stone-400 font-normal ml-1">
                                                                (Rs. {Math.round(item.price * (item.weightPerBag || 25)).toLocaleString()} / Bag)
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                            <button onClick={() => removeFromCart(index)} className="rounded-md p-1 text-stone-300 hover:bg-red-50 hover:text-red-500" title="Hatayein">
                                                <X size={16} />
                                            </button>
                                        </div>

                                        <div className={`grid gap-2 pt-1 border-t border-stone-100 text-xs ${isWeight ? 'grid-cols-3' : 'grid-cols-2'}`}>
                                            <div>
                                                <label className="text-[10px] font-bold uppercase text-stone-400 block mb-0.5">
                                                    {isWeight ? "Bags (Qty)" : "Quantity"}
                                                </label>
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
                                                        className="tabular w-full border-0 bg-transparent p-0 text-center text-xs font-bold outline-none"
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
                                            </div>

                                            {isWeight && (
                                                <div>
                                                    <div className="flex justify-between items-center mb-0.5">
                                                        <label className="text-[10px] font-bold uppercase text-stone-400">Total Wt</label>
                                                        {item.isManualWeight && (
                                                            <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 rounded">Manual</span>
                                                        )}
                                                    </div>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            min="0"
                                                            className="tabular w-full rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-xs font-bold outline-none focus:border-brand-500 pr-6"
                                                            value={currentWeight}
                                                            onChange={(e) => updateTotalWeight(index, e.target.value)}
                                                            title="Wazan kam/zyada ho to yahan manual change karein"
                                                        />
                                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-stone-400 pointer-events-none">
                                                            kg
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            <div>
                                                <div className="flex justify-between items-center mb-0.5">
                                                    <label className="text-[10px] font-bold uppercase text-stone-500">
                                                        Rate/{isWeight ? "kg" : "pc"}
                                                    </label>
                                                    <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 rounded">Edit</span>
                                                </div>
                                                <div className="relative">
                                                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-stone-400 pointer-events-none">
                                                        Rs.
                                                    </span>
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        min="0"
                                                        className="tabular w-full rounded-lg border border-amber-300 bg-amber-50/40 hover:bg-white focus:bg-white pl-6 pr-1.5 py-1.5 text-xs font-bold outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                                                        value={item.price}
                                                        onChange={(e) => updatePrice(index, e.target.value)}
                                                        placeholder="Rate"
                                                        title="Customer ke mutabiq rate customize karein (e.g. 110 ya 115)"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-1 border-t border-dashed border-stone-200 text-xs">
                                            <span className="text-stone-400 text-[11px]">
                                                {isWeight
                                                    ? `${currentWeight} kg × Rs. ${item.price}`
                                                    : `${item.qty} × Rs. ${item.price}`}
                                            </span>
                                            <span className="tabular font-display text-sm font-extrabold text-stone-900">
                                                Rs. {Math.round(item.total).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="border-t border-stone-200 p-2.5 space-y-1.5 bg-white">
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

            {showReceipt && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] animate-in fade-in backdrop-blur-sm p-4">
                    <div id="printable-receipt" className="bg-white p-4 rounded-xl w-full max-w-[340px] shadow-2xl relative text-black">
                        <button
                            onClick={() => { setShowReceipt(false); setCart([]); setCustomerName(""); setCustomerId(""); setDescription(""); setInvoiceNumber(""); }}
                            className="absolute top-2 right-2 p-1 text-stone-400 no-print hover:text-stone-700"
                        >
                            <X size={20} />
                        </button>

                        <div className="text-center mb-3 border-b border-black pb-3">
                            <h2 className="text-xl font-bold uppercase text-black leading-tight">
                                {currentShop?.shopName || "My Shop"}
                            </h2>
                            {currentShop?.address && <p className="text-[10px] text-stone-800 mt-0.5">{currentShop.address}</p>}
                            {currentShop?.contact && <p className="text-[10px] font-bold text-stone-900">Ph: {currentShop.contact}</p>}

                            <div className="mt-2 text-[10px] text-stone-700 flex flex-col items-center">
                                <p>{new Date().toLocaleString()}</p>
                                <p className="font-bold text-black text-[12px] mt-1 tracking-wider">
                                    Inv #: {invoiceNumber}
                                </p>
                                {customerName && (
                                    <p className="font-bold text-black mt-1 uppercase border-b border-dashed border-stone-400 pb-0.5">
                                        Cust: {customerName}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="mb-3 overflow-x-auto text-black">
                            <table className="w-full text-left text-[11px] border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-black text-[10px] font-black uppercase">
                                        <th className="py-1 pr-1">Qty</th>
                                        <th className="py-1 px-1">Items</th>
                                        <th className="py-1 px-1 text-center">Total Weight</th>
                                        <th className="py-1 px-1 text-right">rate</th>
                                        <th className="py-1 pl-1 text-right">amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-200">
                                    {cart.map((item, idx) => {
                                        const qtyStr = `${item.qty} ${item.type === "weight" ? "Bags" : "pcs"}`;
                                        const isWeight = item.type === "weight";
                                        const weightVal = item.totalWeight ?? (item.qty * (item.weightPerBag || 25));
                                        const weightStr = isWeight ? `${weightVal}kg` : "—";

                                        return (
                                            <tr key={idx} className="align-top">
                                                <td className="py-1.5 pr-1 font-bold whitespace-nowrap">{qtyStr}</td>
                                                <td className="py-1.5 px-1 font-semibold leading-tight">{item.name}</td>
                                                <td className="py-1.5 px-1 text-center font-medium whitespace-nowrap">{weightStr}</td>
                                                <td className="py-1.5 px-1 text-right tabular">{item.price}</td>
                                                <td className="py-1.5 pl-1 text-right font-bold tabular">{Math.round(item.total).toLocaleString()}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="border-t-2 border-black pt-2 mb-4 space-y-1">
                            <div className="flex justify-between items-end">
                                <div className="text-right w-full">
                                    <p className="text-xs font-black uppercase tracking-wider text-black">Total Amount</p>
                                    <p className="text-2xl font-black text-black tabular">{Math.round(grandTotal).toLocaleString()}</p>
                                </div>
                            </div>

                            <div className="border-t border-dotted border-stone-400 pt-1.5 mt-2 text-[10px] space-y-0.5">
                                <div className="flex justify-between font-semibold text-stone-800">
                                    <span>Payment Mode:</span>
                                    <span className="font-bold uppercase text-black">{paymentMethod}</span>
                                </div>
                                {paymentMethod === "Udhar" && customerName && (
                                    <div className="bg-stone-100 border border-stone-300 p-1 rounded mt-1">
                                        <div className="flex justify-between font-bold text-black">
                                            <span>Khata (Party):</span>
                                            <span>{customerName}</span>
                                        </div>
                                        <p className="text-[9px] text-stone-600 mt-0.5">
                                            Bill amount party ke khate mein add ho chuka hai.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="text-center text-[10px] text-black mb-4">
                            <div className="whitespace-pre-wrap leading-tight font-medium mb-2">
                                {currentShop?.receiptMessage || "Thank you for shopping!\nNo Return / Exchange"}
                            </div>
                            <div className="border-t border-dotted border-stone-400 pt-2 mt-2">
                                <p className="font-bold italic">Powered by H-H Partners</p>
                                <p>For Contact: 0314-1811181</p>
                            </div>
                        </div>

                        <div id="receipt-modal" className="flex flex-col gap-2 no-print">
                            <button onClick={handlePrint} className="w-full py-3 bg-green-600 text-white rounded-lg font-bold flex justify-center items-center gap-2 hover:bg-green-700">
                                <Printer size={18} /> {t("printSlip")}
                            </button>
                            <button onClick={() => { setShowReceipt(false); setCart([]); setCustomerName(""); setCustomerId(""); setDescription(""); setInvoiceNumber(""); }} className="w-full py-3 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700">
                                {t("clearCart")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}