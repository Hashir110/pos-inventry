"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createOnlineSale, queueOfflineSale } from "../../lib/services/sales";
import { subscribeProducts } from "../../lib/services/products";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../store/useLanguage";
import { Search, ShoppingCart, Trash2, X, Printer, ChevronUp, ChevronDown, Banknote, Landmark, HandCoins, Plus, Minus, RotateCcw, StickyNote } from "lucide-react";
// Is line ko code ke top par likhein:
import { toast } from 'react-toastify';
import { addCustomer, listCustomers } from '../../lib/services/customers';
import type { Customer, PaymentMethod, Product, SaleItem } from '../../types';

export default function POSPage() {
    const { currentUser, currentShop } = useStore(); // Shop Name k liye currentShop chahiye
    const { t } = useLanguage();
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash"); // Default "Cash" rakhte hain
    const [customerName, setCustomerName] = useState("");
    // Udhar sale ke liye customer list
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [customerId, setCustomerId] = useState("");
    const [showNewCustomer, setShowNewCustomer] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState("");
    const [newCustomerPhone, setNewCustomerPhone] = useState("");
    const [description, setDescription] = useState("");
    const [products, setProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<SaleItem[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [invoiceNumber, setInvoiceNumber] = useState("");
    const isOnline = useOnlineStatus();

    // Modals State
    const [showReceipt, setShowReceipt] = useState(false); // Receipt Modal State

    const [showMobileCart, setShowMobileCart] = useState(false);
    const [activeCategory, setActiveCategory] = useState("all");
    const [showNote, setShowNote] = useState(false);

    // 1. Products (Real-time Listener)
    useEffect(() => {
        if (!currentUser) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- listener shuru hone par loading dikhao
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
            console.error("Customers load nahi hue:", error);
        }
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser) return;
        let cancelled = false;
        listCustomers(currentUser.uid)
            .then(list => { if (!cancelled) setCustomers(list); })
            .catch(error => console.error("Customers load nahi hue:", error));
        return () => { cancelled = true; };
    }, [currentUser]);

    const handleSelectCustomer = (id: string) => {
        setCustomerId(id);
        setCustomerName(customers.find(c => c.id === id)?.name ?? "");
    };

    const handleAddCustomer = async () => {
        if (!currentUser || !newCustomerName.trim()) {
            toast.error("Customer ka naam likhein");
            return;
        }
        try {
            const created = await addCustomer(currentUser.uid, { name: newCustomerName, phone: newCustomerPhone });
            setCustomers(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
            setCustomerId(created.id);
            setCustomerName(created.name);
            setShowNewCustomer(false);
            setNewCustomerName("");
            setNewCustomerPhone("");
            toast.success("Customer add ho gaya");
        } catch (error) {
            console.error(error);
            toast.error("Customer add nahi hua (internet check karein)");
        }
    };

    // 2. Product Click
    const handleProductClick = (product: Product) => {
    // 1. Modal open karne wali logic ko bypass karo
    // setSelectedProduct(product); <-- Isko ab zaroorat nahi
    
    // 2. Direct addToCart function call karo with 1 quantity
    addToCart(product, 1);

    // 3. Optional: Agar user ko feedback dena hai toh console ya toast laga lo
    console.log(`${product.name} added to cart`);
};

    // 4. Add to Cart
    const addToCart = (product: Product, qty: number) => {
        const finalPrice = product.sellingPrice;

        // Functional update: tez clicks par stale cart ka masla nahi, aur state mutate nahi hoti
        setCart(prev => {
            const idx = prev.findIndex(item => item.id === product.id);
            if (idx !== -1) {
                return prev.map((item, i) => {
                    if (i !== idx) return item;
                    const newQty = item.qty + qty;
                    return { ...item, qty: newQty, total: Math.max(0, newQty * finalPrice - (item.discount || 0)) };
                });
            }
            return [...prev, {
                id: product.id,
                name: product.name,
                qty: qty,
                price: finalPrice,
                buyingPrice: product.buyingPrice,
                discount: 0, // Line par flat discount (Rs.)
                total: qty * finalPrice,
                type: product.unitType
            }];
        });
    };

    const removeFromCart = (index: number) => {
        const newCart = [...cart];
        newCart.splice(index, 1);
        setCart(newCart);
    };

    const grandTotal = cart.reduce((sum, item) => sum + item.total, 0);

    // // 5. STEP 1: Sirf Receipt Dikhao (DB Update mat karo abhi)
    // const handlePreviewReceipt = () => {
    //     if (cart.length === 0) return;
    //     setShowReceipt(true);
    // };

    // 6. STEP 2: Finalize Sale (Direct Action)
    const handleFinalizeSale = async () => {
        if (!currentUser) return;
        if (cart.some(item => !(item.qty > 0))) {
            return toast.error("Quantity 0 hai — theek karein ya item hata dein");
        }
        if (paymentMethod === "Udhar" && !customerId) {
            toast.error("Udhar ke liye customer select karein");
            return;
        }
        setCheckoutLoading(true);

        try {
            const meta = { customerName, description, paymentMethod, customerId: paymentMethod === "Udhar" ? customerId : undefined };
            const shortInvoiceNo = isOnline
                ? await createOnlineSale(currentUser.uid, cart, grandTotal, meta)
                : queueOfflineSale(currentUser.uid, cart, grandTotal, meta, products);

            if (!isOnline) {
                // Offline mein local stock bhi minus dikhao
                setProducts(prev => prev.map(p => {
                    const cartItem = cart.find(c => c.id === p.id);
                    return cartItem ? { ...p, stock: p.stock - cartItem.qty } : p;
                }));
            }
            // --- SUCCESS LOGIC ---
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

    // POS Page ke andar jahan functions hain
    // Discount line par FLAT hai (poori line ka Rs. minus, per-unit nahi)
    const handleDiscountChange = (index: number, discountValue: string) => {
        setCart(prev => prev.map((item, i) => {
            if (i !== index) return item;
            const lineGross = item.price * item.qty;
            // Discount negative ya line total se zyada nahi ho sakta
            const discount = Math.min(Math.max(parseFloat(discountValue) || 0, 0), lineGross);
            return { ...item, discount, total: lineGross - discount };
        }));
    };

    // Category tabs: products ki categories se (khali wale "Baqi" mein)
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

    // Naya order shuru: cart, customer aur note saaf
    const resetOrder = () => {
        setCart([]);
        setCustomerName("");
        setCustomerId("");
        setDescription("");
        setShowNote(false);
    };

    // Product card ke rang (naam se tay, taake har item ka apna rang rahe)
    const tints = [
        "bg-brand-100 text-brand-700",
        "bg-emerald-100 text-emerald-700",
        "bg-sky-100 text-sky-700",
        "bg-violet-100 text-violet-700",
        "bg-rose-100 text-rose-700",
        "bg-amber-100 text-amber-800",
    ];
    const tintFor = (name: string) => tints[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % tints.length];

    const updateQty = (index: number, newQty: string | number) => {
        setCart(prev => prev.map((item, i) => {
            if (i !== index) return item;
            // Weight items mein decimal (0.5 kg) allowed hai; qty 0 tak ja sakti hai, checkout par validate hoga
            let qty = parseFloat(String(newQty));
            if (isNaN(qty) || qty < 0) qty = 0;
            const lineGross = item.price * qty;
            const discount = Math.min(item.discount || 0, lineGross);
            return { ...item, qty, discount, total: lineGross - discount };
        }));
    };

    const handlePrint = () => {
    console.log("Print command initiated...");

    // Browser ke print event ko sunne ke liye
    const beforePrint = () => console.log("Preparing document for printing...");
    const afterPrint = () => {
        console.log("Print dialog closed or command sent.");
        // Note: Ye ye nahi batata ke print nikla ya nahi, sirf ye ke dialogue band ho gaya.
    };

    window.onbeforeprint = beforePrint;
    window.onafterprint = afterPrint;

    try {
        window.print();
    } catch (error) {
        console.error("Printer Error or Browser Blocked:", error);
    }
};
    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-96px)] lg:h-[calc(100vh-112px)] gap-4 relative">
            {/* Print Styles */}
            {/* Print Styles for Thermal Printer */}
            <style jsx global>{`
        @media print {
          /* Page setup for Thermal Printer */
          @page {
            size: 58mm auto; /* Width 58mm, Height automatic */
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            width: 58mm; /* Force body width */
          }
          
          /* Hide everything else */
          body * { visibility: hidden; }
          
          /* Show only receipt */
          #printable-receipt, #printable-receipt * { 
            visibility: visible; 
          }
          
          #printable-receipt {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            padding: 5px 0; /* Thora padding */
            margin: 0;
            background: white;
            color: black;
          }

          /* Hide Buttons in Print */
          .no-print { display: none !important; }
        }
      `}</style>

            {/* --- CENTER: PRODUCTS --- */}
            <div className="flex h-full min-w-0 flex-1 flex-col gap-4">

                {/* Top: title + search + reset */}
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

                {/* Category tabs */}
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

                {/* Products Grid */}
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
                                const unit = product.unitType === 'weight' ? 'kg' : 'pcs';

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

                                        {/* Picture ki jagah naam ka pehla harf */}
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
                                                <span className="ml-0.5 text-[11px] font-semibold text-stone-400">/{unit}</span>
                                            </span>
                                            <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular ${isOutOfStock
                                                ? 'bg-red-100 text-red-700'
                                                : isLow
                                                    ? 'bg-amber-100 text-amber-800'
                                                    : 'bg-stone-100 text-stone-600'
                                                }`}>
                                                {isOutOfStock ? 'Khatam' : `${product.stock} ${unit}`}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* --- MOBILE BOTTOM BAR (Visible only on Mobile) --- */}
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

            {/* --- RIGHT: ORDER LIST --- */}
            <div className={`
                fixed inset-0 z-40 flex h-full w-full flex-col bg-white transition-transform duration-300 ease-in-out
                lg:static lg:w-[400px] lg:shrink-0 lg:translate-y-0 lg:rounded-xl lg:border lg:border-stone-200 lg:shadow-card
                ${showMobileCart ? 'translate-y-0' : 'translate-y-full'}
            `}>

                {/* Header */}
                <div className="flex items-center justify-between border-b border-stone-200 p-4">
                    <div>
                        <h2 className="text-lg font-bold text-stone-900">{t("orderList")}</h2>
                        <p className="text-xs text-stone-500">{t("newBill")} • {cart.length} {t("items")}</p>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={resetOrder}
                            disabled={cart.length === 0}
                            className="rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                            title={t("reset")}
                        >
                            <Trash2 size={18} />
                        </button>
                        <button onClick={() => setShowMobileCart(false)} className="rounded-lg bg-stone-100 p-2 text-stone-600 lg:hidden">
                            <ChevronDown size={20} />
                        </button>
                    </div>
                </div>

                {/* Customer */}
                <div className="space-y-2 border-b border-stone-200 p-4">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-stone-400">{t("customer")}</label>
                    <div className="flex gap-2">
                        <select
                            value={customerId}
                            onChange={(e) => handleSelectCustomer(e.target.value)}
                            className="field flex-1 cursor-pointer"
                        >
                            <option value="">{t("walkInCustomer")}</option>
                            {customers.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.name} {c.balance > 0 ? `(${t("due")} Rs. ${Math.round(c.balance).toLocaleString()})` : ""}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={() => setShowNewCustomer(v => !v)}
                            className="btn-ghost !px-3"
                            title={t("newCustomer")}
                        >
                            <Plus size={18} />
                        </button>
                    </div>

                    {showNewCustomer && (
                        <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
                            <input
                                type="text"
                                placeholder={t("newCustomerName")}
                                value={newCustomerName}
                                onChange={(e) => setNewCustomerName(e.target.value)}
                                className="field !py-2"
                            />
                            <input
                                type="tel"
                                placeholder={t("phone")}
                                value={newCustomerPhone}
                                onChange={(e) => setNewCustomerPhone(e.target.value)}
                                className="field !py-2"
                            />
                            <div className="flex gap-2">
                                <button onClick={handleAddCustomer} className="btn-primary flex-1 !py-2">{t("save")}</button>
                                <button onClick={() => setShowNewCustomer(false)} className="btn-ghost flex-1 !py-2">{t("cancel")}</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto bg-stone-50/60 p-3">
                    {cart.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-stone-300">
                            <ShoppingCart size={40} />
                            <p className="text-sm font-semibold text-stone-400">{t("cartEmpty")}</p>
                            <p className="text-xs text-stone-400">{t("clickItemToAdd")}</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {cart.map((item, index) => (
                                <div key={item.id} className="rounded-lg border border-stone-200 bg-white p-3 shadow-card">
                                    <div className="flex items-start gap-3">
                                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-display text-base font-bold ${tintFor(item.name)}`}>
                                            {item.name.trim().charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-bold text-stone-900">{item.name}</p>
                                            <p className="text-xs text-stone-500">Rs. {item.price}/{item.type === 'weight' ? 'kg' : 'pc'}</p>
                                        </div>
                                        <button onClick={() => removeFromCart(index)} className="rounded-md p-1 text-stone-300 hover:bg-red-50 hover:text-red-500" title="Hatayein">
                                            <X size={16} />
                                        </button>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between gap-2">
                                        {/* Qty */}
                                        <div className="flex items-center rounded-lg border border-stone-200">
                                            <button
                                                onClick={() => updateQty(index, Math.round((item.qty - (item.type === 'weight' ? 0.5 : 1)) * 1000) / 1000)}
                                                className="p-2 text-stone-500 hover:text-brand-700"
                                            >
                                                <Minus size={14} />
                                            </button>
                                            <input
                                                type="number"
                                                className="tabular w-12 border-0 bg-transparent p-0 text-center text-sm font-bold outline-none"
                                                value={item.qty}
                                                onChange={(e) => updateQty(index, e.target.value)}
                                            />
                                            <button
                                                onClick={() => updateQty(index, Math.round((item.qty + (item.type === 'weight' ? 0.5 : 1)) * 1000) / 1000)}
                                                className="p-2 text-stone-500 hover:text-brand-700"
                                            >
                                                <Plus size={14} />
                                            </button>
                                        </div>

                                        {/* Discount */}
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-bold uppercase text-stone-400">Disc</span>
                                            <input
                                                type="number"
                                                placeholder="0"
                                                className="tabular w-16 rounded-md border border-stone-200 bg-stone-50 px-2 py-1.5 text-xs font-bold outline-none focus:border-brand-500"
                                                value={item.discount || ""}
                                                onChange={(e) => handleDiscountChange(index, e.target.value)}
                                            />
                                        </div>

                                        <p className="tabular min-w-[4.5rem] text-right font-display text-sm font-bold text-stone-900">
                                            Rs. {Math.round(item.total).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Summary + payment */}
                <div className="space-y-3 border-t border-stone-200 p-4">
                    {(() => {
                        const subTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
                        const totalDiscount = cart.reduce((s, i) => s + (i.discount || 0), 0);
                        return (
                            <div className="space-y-1.5 text-sm">
                                <div className="flex justify-between text-stone-500">
                                    <span>{t("subtotal")}</span>
                                    <span className="tabular font-semibold text-stone-700">Rs. {Math.round(subTotal).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-stone-500">
                                    <span>{t("discount")}</span>
                                    <span className={`tabular font-semibold ${totalDiscount > 0 ? 'text-emerald-600' : 'text-stone-700'}`}>
                                        {totalDiscount > 0 ? '− ' : ''}Rs. {Math.round(totalDiscount).toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between border-t border-dashed border-stone-300 pt-2.5">
                                    <span className="text-sm font-bold text-stone-900">{t("grandTotal")}</span>
                                    <span className="tabular font-display text-2xl font-bold text-stone-900">
                                        Rs. {Math.round(grandTotal).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Note */}
                    {showNote ? (
                        <textarea
                            placeholder={t("notePlaceholder")}
                            rows={2}
                            className="field resize-none"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    ) : (
                        <button onClick={() => setShowNote(true)} className="flex items-center gap-1.5 text-xs font-bold text-stone-500 hover:text-brand-700">
                            <StickyNote size={14} /> {t("addNote")}
                        </button>
                    )}

                    {/* Payment method */}
                    <div className="grid grid-cols-3 gap-2">
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
                                    className={`flex flex-col items-center gap-1 rounded-lg border-2 py-2.5 text-xs font-bold transition ${active
                                        ? opt.value === "Udhar"
                                            ? "border-amber-500 bg-amber-50 text-amber-800"
                                            : "border-brand-500 bg-brand-50 text-brand-800"
                                        : "border-stone-200 text-stone-500 hover:border-stone-300"
                                        }`}
                                >
                                    <Icon size={20} />
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>

                    {paymentMethod === "Udhar" && !customerId && (
                        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                            {t("selectCustomerForCredit")}
                        </p>
                    )}

                    <button
                        onClick={handleFinalizeSale}
                        disabled={cart.length === 0 || checkoutLoading}
                        className="btn-primary w-full !py-3.5 !text-base"
                    >
                        {checkoutLoading ? (
                            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                        ) : isOnline ? (
                            t("paymentTotal", { amount: Math.round(grandTotal).toLocaleString() })
                        ) : (
                            t("saveOffline")
                        )}
                    </button>
                </div>
            </div>
            {/* Receipt Modal */}
            {showReceipt && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] animate-in fade-in backdrop-blur-sm p-4">

                    {/* Printable Container */}
                    <div id="printable-receipt" className="bg-white p-4 rounded-xl w-full max-w-[300px] shadow-2xl relative text-black">

                        {/* Close Button */}
                        <button
                            onClick={() => { setShowReceipt(false); setCart([]); setCustomerName(""); setCustomerId(""); setDescription("") }}
                            className="absolute top-2 right-2 p-1 text-stone-400 no-print hover:text-stone-700"
                        >
                            <X size={20} />
                        </button>

                        {/* --- SLIP HEADER --- */}
                        <div className="text-center mb-3 border-b border-black pb-3">
                            <h2 className="text-xl font-bold uppercase text-black leading-tight">
                                {currentShop?.shopName || "My Shop"}
                            </h2>
                            {currentShop?.address && <p className="text-[10px] text-stone-800 mt-1">{currentShop.address}</p>}
                            {currentShop?.contact && <p className="text-[10px] font-bold text-stone-900">Ph: {currentShop.contact}</p>}

                            <div className="mt-2 text-[10px] text-stone-600 flex flex-col items-center">
                                <p>{new Date().toLocaleString()}</p>
                                <p className="font-bold text-black text-[12px] mt-1 tracking-wider">
                                    Inv #: {invoiceNumber}
                                </p>
                                {customerName && (
                                    <p className="font-bold text-black mt-1 uppercase border-b border-dashed border-stone-400 pb-1">
                                        Cust: {customerName}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* --- SLIP ITEMS --- */}
                        <div className="space-y-2 mb-3 text-xs max-h-60 overflow-auto text-black">
                            {cart.map((item, idx) => {
                                return (
                                    <div key={idx} className="flex justify-between items-start border-b border-dotted border-stone-400 pb-1.5">
                                        <div className="flex flex-col w-[60%]">
                                            <span className="font-semibold leading-tight">{item.name}</span>
                                            {item.discount > 0 && (
                                                <span className="text-[9px] text-stone-600 font-medium">
                                                    Disc: -Rs. {item.discount}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end w-[40%]">
                                            <span className="text-[10px]">{item.qty} x {item.price}</span>
                                            <span className="font-bold text-[11px] mt-0.5">{Math.round(item.total)}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* --- 💰 PROFESSIONAL TOTALS SECTION 💰 --- */}
                        {(() => {
                            let subTotal = 0;
                            let totalDiscount = 0;

                            cart.forEach(item => {
                                subTotal += (item.price * item.qty);
                                totalDiscount += (item.discount || 0);
                            });

                            const finalPayable = subTotal - totalDiscount;

                            return (
                                <div className="border-t border-black pt-2 mb-4 space-y-1">

                                    <div className="flex justify-between text-[11px] text-stone-700 font-semibold">
                                        <span>Subtotal:</span>
                                        <span>Rs. {Math.round(subTotal)}</span>
                                    </div>

                                    {totalDiscount > 0 && (
                                        <div className="flex justify-between text-[11px] font-bold text-stone-600 border-b border-dotted border-stone-400 pb-1">
                                            <span>Discount:</span>
                                            <span>- Rs. {Math.round(totalDiscount)}</span>
                                        </div>
                                    )}

                                    <div className="flex justify-between text-lg font-bold text-black border-t-2 border-black pt-1 mt-1">
                                        <span>Total:</span>
                                        <span>Rs. {Math.round(finalPayable)}</span>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* --- FOOTER MESSAGE --- */}
                        <div className="text-center text-[10px] text-black mb-4">
                            <div className="whitespace-pre-wrap leading-tight font-medium mb-2">
                                {currentShop?.receiptMessage || "Thank you for shopping!\nNo Return / Exchange"}
                            </div>
                            <div className="border-t border-dotted border-stone-400 pt-2 mt-2">
                                <p className="font-bold italic">Powered by H-H Partners</p>
                                <p>For Contact: 0314-1811181</p>
                            </div>
                        </div>

                        {/* --- BUTTONS --- */}
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