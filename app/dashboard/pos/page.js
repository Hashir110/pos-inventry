"use client";

import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, query, where, getDocs, doc, runTransaction, onSnapshot } from "firebase/firestore";
import { useStore } from "../../store/useStore";
import { Search, ShoppingCart, Trash2, Calculator, X, Loader2, Printer, Wifi, WifiOff, ChevronUp, ChevronDown } from "lucide-react";
// Is line ko code ke top par likhein:
import { toast } from 'react-toastify';

export default function POSPage() {
    const { currentUser, currentShop } = useStore(); // Shop Name k liye currentShop chahiye

    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [checkoutLoading, setCheckoutLoading] = useState(false);

    const [isOnline, setIsOnline] = useState(true);

    // Modals State
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [qtyInput, setQtyInput] = useState("");
    const [showReceipt, setShowReceipt] = useState(false); // Receipt Modal State

    const [showMobileCart, setShowMobileCart] = useState(false);

    // 1. Fetch Products (Real-time Listener)
    useEffect(() => {
        // Online/Offline Status Listeners
        setIsOnline(navigator.onLine);
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        let unsubscribe = () => { };

        if (currentUser) {
            setLoading(true);
            try {
                const q = query(
                    collection(db, "products"),
                    where("ownerId", "==", currentUser.uid)
                );

                // --- CHANGE: getDocs ki jagah onSnapshot (Live Data) ---
                unsubscribe = onSnapshot(q, (snapshot) => {
                    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    setProducts(items);
                    setLoading(false);
                }, (error) => {
                    console.log("Real-time fetch error:", error);
                    setLoading(false);
                });

            } catch (err) {
                console.log("Offline or Error fetching products");
                setLoading(false);
            }
        }

        // Cleanup function
        return () => {
            unsubscribe(); // Firebase listener band karo jab page choro
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [currentUser]);
    // 2. Product Click
    const handleProductClick = (product) => {
        setSelectedProduct(product);
        setQtyInput("");
    };

    // 3. Confirm Qty
    // 3. Confirm Quantity Logic (Updated)
    const handleConfirmQty = () => {
        const value = parseFloat(qtyInput);
        if (!value || value <= 0) return alert("Valid quantity enter karein");

        // Ab hum assume kar rahe hain ke value already KG mein hai (agar weight item hai)
        // Ya Pieces mein hai (agar count item hai)
        let finalQty = value;

        addToCart(selectedProduct, finalQty);
    };

    // 4. Add to Cart
    const addToCart = (product, qty) => {
        const finalPrice = product.sellingPrice;
        const existingItemIndex = cart.findIndex(item => item.id === product.id);

        if (existingItemIndex !== -1) {
            const newCart = [...cart];
            newCart[existingItemIndex].qty += qty;
            newCart[existingItemIndex].total = newCart[existingItemIndex].qty * finalPrice;
            setCart(newCart);
        } else {
            setCart([...cart, {
                id: product.id,
                name: product.name,
                qty: qty,
                price: finalPrice,
                buyingPrice: product.buyingPrice,
                total: qty * finalPrice,
                type: product.unitType
            }]);
        }
        setSelectedProduct(null);
    };

    const removeFromCart = (index) => {
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
        setCheckoutLoading(true);

        try {
            if (isOnline) {
                // --- ONLINE LOGIC (Firebase Transaction) ---
                await runTransaction(db, async (transaction) => {
                    // ... (Yahan apka purana Transaction Code ayega, same wesa hi) ...
                    // Main short kar raha hun taake confusion na ho

                    const reads = [];
                    for (const item of cart) {
                        const productRef = doc(db, "products", item.id);
                        const snapshot = await transaction.get(productRef);
                        reads.push({ snapshot, item });
                    }
                    const updates = [];
                    for (const { snapshot, item } of reads) {
                        if (!snapshot.exists()) throw `Error: ${item.name} not found!`;
                        const currentStock = snapshot.data().stock;
                        if (currentStock < item.qty) throw `Stock Low! ${item.name} only ${currentStock} left.`;
                        updates.push({ ref: snapshot.ref, newStock: currentStock - item.qty });
                    }
                    updates.forEach((update) => {
                        transaction.update(update.ref, { stock: update.newStock });
                    });
                    const saleRef = doc(collection(db, "sales"));
                    transaction.set(saleRef, {
                        productId: saleRef.id,
                        ownerId: currentUser.uid,
                        items: cart,
                        totalAmount: grandTotal,
                        date: new Date().toISOString()
                    });
                });

            } else {
                // --- OFFLINE LOGIC ---
                const offlineOrder = {
                    ownerId: currentUser.uid,
                    items: cart,
                    totalAmount: grandTotal,
                    date: new Date().toISOString(),
                    isOffline: true
                };
                const pendingSales = JSON.parse(localStorage.getItem("pendingSales") || "[]");
                pendingSales.push(offlineOrder);
                localStorage.setItem("pendingSales", JSON.stringify(pendingSales));

                const updatedProducts = products.map(p => {
                    const cartItem = cart.find(c => c.id === p.id);
                    if (cartItem) return { ...p, stock: p.stock - cartItem.qty };
                    return p;
                });
                setProducts(updatedProducts);
            }

            // --- SUCCESS LOGIC (Change Here) ---
            // Cart clear MAT karo abhi.
            // Sirf Receipt Modal kholo.
            toast.success("Sale Successful!");
            setShowReceipt(true);

        } catch (error) {
            console.error(error);
            toast.error("Failed: " + (typeof error === 'string' ? error : error.message));
        }
        setCheckoutLoading(false);
    };



    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] lg:h-[calc(100vh-100px)] gap-4 relative">
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

            {/* --- LEFT SIDE: PRODUCTS GRID --- */}
            <div className="flex-1 flex flex-col bg-slate-100/50 lg:rounded-2xl border-x lg:border border-slate-400 overflow-hidden h-full">

                {/* Header: Search & Status */}
                <div className="p-4 bg-white border-b border-slate-200 flex gap-3 items-center z-10">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search items..."
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-1 focus:ring-blue-500 transition-all outline-none font-medium text-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold ${isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
                        <span className="hidden sm:inline">{isOnline ? "Online" : "Offline"}</span>
                    </div>
                </div>

                {/* Products Grid (Responsive Columns) */}
                <div className="flex-1 overflow-y-auto p-3 pb-24 lg:pb-5"> {/* pb-24 added for mobile bottom bar space */}
                    {loading ? (
                        <div className="flex h-full items-center justify-center text-slate-400">Loading...</div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {filteredProducts.map((product) => (
                                <div
                                    key={product.id}
                                    onClick={() => handleProductClick(product)}
                                    className="group bg-white p-3 rounded-xl border border-slate-300/60 shadow-sm hover:shadow-md hover:bg-blue-50 active:scale-95 transition-all cursor-pointer flex flex-col justify-between h-28 relative overflow-hidden"
                                >
                                    <div>
                                        <h3 className="font-bold text-slate-700 text-sm leading-tight line-clamp-2">{product.name}</h3>
                                        <p className={`text-[10px] mt-1 font-medium ${product.stock < 5 ? 'text-rose-500' : 'text-slate-400'}`}>
                                            {product.stock} {product.unitType === 'weight' ? 'kg' : 'pcs'}
                                        </p>
                                    </div>
                                    <div className="mt-2 self-start">
                                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">
                                            Rs. {product.sellingPrice}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* --- MOBILE BOTTOM BAR (Visible only on Mobile) --- */}
            <div className="lg:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-300 p-4 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex justify-between items-center">
                <div onClick={() => setShowMobileCart(true)}>
                    <p className="text-xs text-slate-500">{cart.length} Items</p>
                    <h3 className="text-xl font-extrabold text-slate-800">Rs. {Math.round(grandTotal).toLocaleString()}</h3>
                </div>
                <button
                    onClick={() => setShowMobileCart(true)}
                    className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-600/30"
                >
                    <ShoppingCart size={20} /> View Bill
                    <ChevronUp size={16} />
                </button>
            </div>

            {/* --- RIGHT SIDE: CART PANEL (Responsive) --- */}
            {/* Desktop: Static Right Panel
          Mobile: Fixed Full Screen Overlay (Slide Up)
      */}
            <div className={`
          bg-white flex flex-col z-40 transition-transform duration-300 ease-in-out
          lg:w-[380px] lg:rounded-2xl lg:shadow-xl lg:border lg:border-slate-400 lg:static lg:translate-y-0
          fixed inset-0 w-full h-full 
          ${showMobileCart ? 'translate-y-0' : 'translate-y-full'}
      `}>

                {/* Cart Header */}
                <div className="p-5 border-b border-slate-200 bg-white lg:rounded-t-2xl flex justify-between items-center">
                    <div>
                        <h2 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                            Current Order
                        </h2>
                        <p className="text-xs text-slate-400">{cart.length} Items in cart</p>
                    </div>

                    {/* Close Button (Mobile Only) */}
                    <button
                        onClick={() => setShowMobileCart(false)}
                        className="lg:hidden p-2 bg-slate-100 rounded-full text-slate-600"
                    >
                        <ChevronDown size={24} />
                    </button>
                </div>

                {/* Cart Items List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                    {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-2">
                            <ShoppingCart size={48} className="opacity-20" />
                            <p className="text-sm font-medium">Empty Cart</p>
                        </div>
                    ) : (
                        cart.map((item, index) => (
                            <div key={index} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex-1">
                                    <p className="font-semibold text-slate-700 text-sm">{item.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-medium">
                                            {item.qty} {item.type === 'weight' ? 'kg' : 'pc'}
                                        </span>
                                        <span className="text-xs text-slate-400">x {item.price}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-slate-800">Rs. {Math.round(item.total)}</span>
                                    <button
                                        onClick={() => removeFromCart(index)}
                                        className="text-slate-300 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 p-2 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Cart Footer */}
                <div className="p-5 bg-white border-t border-slate-100 lg:rounded-b-2xl shadow-[0_-5px_20px_rgba(0,0,0,0.02)] pb-safe">
                    <div className="flex justify-between items-end mb-4">
                        <span className="text-slate-500 text-sm font-medium">Grand Total</span>
                        <span className="text-3xl font-extrabold text-slate-800">
                            Rs. {Math.round(grandTotal).toLocaleString()}
                        </span>
                    </div>

                    {/* Cart Footer */}
                    <div className="p-5 bg-white ...">
                        {/* ... Total ... */}

                        <button
                            onClick={handleFinalizeSale} // <--- CHANGE: Direct Finalize call
                            disabled={cart.length === 0 || checkoutLoading}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-600/30 disabled:opacity-50 transition-all active:scale-[0.98] flex justify-center items-center gap-2"
                        >
                            {checkoutLoading ? <Loader2 className="animate-spin" /> : (isOnline ? "Charge & Print" : "Save Offline")}
                        </button>
                    </div>
                </div>
            </div>

            {/* --- MODALS (Quantity & Receipt) --- */}
            {/* Same as your existing code, just ensure z-index is high (z-50) */}
            {/* Universal Quantity Modal */}
            {/* UNIVERSAL QUANTITY MODAL */}
            {selectedProduct && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] animate-in fade-in backdrop-blur-sm p-4">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">

                        {/* Header */}
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800">{selectedProduct.name}</h3>
                            <button onClick={() => setSelectedProduct(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Input Label & Field */}
                        <p className="text-sm text-gray-500 mb-2 font-medium">
                            {selectedProduct.unitType === 'weight' ? "Weight (KG):" : "Quantity (Pcs):"}
                        </p>
                        <div className="relative">
                            <input
                                type="number"
                                autoFocus
                                placeholder={selectedProduct.unitType === 'weight' ? "e.g. 0.5" : "e.g. 1"}
                                className="w-full p-3 border rounded-xl text-3xl font-bold text-center mb-5 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800"
                                value={qtyInput}
                                onChange={(e) => setQtyInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleConfirmQty()}
                            />
                        </div>

                        {/* --- QUICK ACTION BUTTONS (RESTORED) --- */}
                        <div className="grid grid-cols-4 gap-2 mb-6">
                            {selectedProduct.unitType === 'weight' ? (
                                // WEIGHT BUTTONS (250g, Half Kg, 1Kg, 5Kg)
                                <>
                                    <button onClick={() => setQtyInput("0.25")} className="p-2 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg hover:bg-orange-100 text-xs font-bold transition h-12">
                                        250g
                                    </button>
                                    <button onClick={() => setQtyInput("0.5")} className="p-2 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg hover:bg-orange-100 text-xs font-bold transition h-12">
                                        Half Kg
                                    </button>
                                    <button onClick={() => setQtyInput("1")} className="p-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 text-xs font-bold transition h-12">
                                        1 Kg
                                    </button>
                                    <button onClick={() => setQtyInput("5")} className="p-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 text-xs font-bold transition h-12">
                                        5 Kg
                                    </button>
                                </>
                            ) : (
                                // QUANTITY BUTTONS (1 Pc, 6 Pcs, 1 Dozen, 2 Dozen)
                                <>
                                    <button onClick={() => setQtyInput("1")} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 text-xs font-bold transition h-12">
                                        1 Pc
                                    </button>
                                    <button onClick={() => setQtyInput("6")} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 text-xs font-bold transition h-12">
                                        6 Pcs
                                    </button>
                                    <button onClick={() => setQtyInput("12")} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 text-xs font-bold transition h-12">
                                        1 Dozen
                                    </button>
                                    <button onClick={() => setQtyInput("24")} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 text-xs font-bold transition h-12">
                                        2 Dozen
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Add Button */}
                        <button
                            onClick={handleConfirmQty}
                            className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold text-lg hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition active:scale-[0.98]"
                        >
                            Add to Bill
                        </button>
                    </div>
                </div>
            )}

            {/* Receipt Modal */}
            {showReceipt && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] animate-in fade-in backdrop-blur-sm p-4">

                    {/* Printable Container */}
                    <div id="printable-receipt" className="bg-white p-4 rounded-xl w-full max-w-[300px] shadow-2xl relative text-black">

                        {/* Close Button (Hidden in Print) */}
                        <button
                            onClick={() => { setShowReceipt(false); setCart([]); }}
                            className="absolute top-2 right-2 p-1 text-gray-400 no-print"
                        >
                            <X size={20} />
                        </button>

                        {/* --- SLIP HEADER (Updated) --- */}
                        <div className="text-center mb-2 border-b border-black pb-2">
                            {/* 1. Shop Name */}
                            <h2 className="text-lg font-bold uppercase text-black leading-tight">
                                {currentShop?.shopName || "My Shop"}
                            </h2>

                            {/* 2. Address (Agar majood ho toh dikhao) */}
                            {currentShop?.address && (
                                <p className="text-[10px] text-gray-800 mt-1">
                                    Address: {currentShop.address}
                                </p>
                            )}

                            {/* 3. Contact Number */}
                            {currentShop?.contact && (
                                <p className="text-[10px] font-bold text-gray-900">
                                    Ph: {currentShop.contact}
                                </p>
                            )}

                            {/* 4. Date & Time */}
                            <p className="text-[9px] text-gray-600 mt-1">
                                {new Date().toLocaleString()}
                            </p>
                        </div>

                        {/* --- SLIP ITEMS (Same as before) --- */}
                        <div className="space-y-1 mb-2 text-xs max-h-60 overflow-auto text-black">
                            {cart.map((item, idx) => (
                                <div key={idx} className="flex justify-between border-b border-dotted border-gray-400 pb-1">
                                    <span className="truncate w-24 font-medium">{item.name}</span>
                                    <span className="text-[10px]">{item.qty} x {item.price}</span>
                                    <span className="font-bold">{Math.round(item.total)}</span>
                                </div>
                            ))}
                        </div>

                        {/* --- TOTALS --- */}
                        <div className="border-t border-black pt-2 mb-4">
                            <div className="flex justify-between text-lg font-bold text-black">
                                <span>Total:</span>
                                <span>Rs. {Math.round(grandTotal)}</span>
                            </div>
                        </div>

                        {/* --- FOOTER MESSAGE (Updated) --- */}
                        <div className="text-center text-[10px] text-black mb-4 whitespace-pre-wrap leading-tight">
                            {/* Agar User ne Custom Message set kiya hai wo dikhao, warna Default dikhao */}
                            {currentShop?.receiptMessage ? (
                                currentShop.receiptMessage
                            ) : (
                                <>
                                    Thank you for shopping!<br />
                                    No Return / Exchange
                                </>
                            )}
                            <p className="text-black my-1 whitespace-pre-wrap leading-tight">Powered by H-H Partners</p>
                            <p>For Contact US: 0314-1811181</p>
                        </div>

                        {/* --- BUTTONS (Hidden in Print) --- */}
                        <div className="flex flex-col gap-2 no-print">

                            {/* Print Button */}
                            <button
                                onClick={() => window.print()}
                                className="w-full py-3 bg-green-600 text-white rounded-lg font-bold flex justify-center items-center gap-2 hover:bg-green-700"
                            >
                                <Printer size={18} /> Print Slip
                            </button>

                            {/* New Order Button */}
                            <button
                                onClick={() => {
                                    setShowReceipt(false);
                                    setCart([]);
                                }}
                                className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
                            >
                                New Order (Clear Cart)
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}