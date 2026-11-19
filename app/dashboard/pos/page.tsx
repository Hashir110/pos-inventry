"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createOnlineSale, queueOfflineSale } from "../../lib/services/sales";
import { subscribeProducts } from "../../lib/services/products";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../store/useLanguage";
import { listCustomers } from "../../lib/services/customers";
import { listTransports } from "../../lib/services/transports";
import type { Customer, PaymentMethod, Product, SaleItem, Transport } from "../../types";
import { toast } from "react-toastify";
import CustomerSelect from "../../components/CustomerSelect";
import SaleReceipt from "../../components/SaleReceipt";
import AddTransportModal from "../../components/AddTransportModal";
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Barcode,
  ScanLine,
  UserPlus,
  CheckCircle2,
  Clock,
  Printer,
  X,
  CreditCard,
  Banknote,
  BookOpen,
  PauseCircle,
  RotateCcw,
  Receipt,
  Truck,
  Loader2,
  ChevronDown,
  Zap,
} from "lucide-react";

const OTHER_CATEGORY = "__other__";

interface HeldCart {
  id: string;
  time: string;
  customerName: string;
  customerId: string;
  items: SaleItem[];
  total: number;
}

export default function POSPage() {
  const { currentUser, currentShop } = useStore();
  const { t, language } = useLanguage();
  const isOnline = useOnlineStatus();
  const isRtl = language === "ur";

  // Data & Cart state
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transports, setTransports] = useState<Transport[]>([]);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
  const [showHeldModal, setShowHeldModal] = useState(false);

  // Filter & Search
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Transaction details
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [description, setDescription] = useState("");
  const [transport, setTransport] = useState("");
  const [extraCharges, setExtraCharges] = useState("");
  const [showTransportModal, setShowTransportModal] = useState(false);

  // Payment Modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [cashTendered, setCashTendered] = useState<string>("");

  // Loading & Receipts
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);

  // Real-time clock for POS header
  const [currentTime, setCurrentTime] = useState("");
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(
        new Date().toLocaleTimeString("en-PK", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // Subscribe to real-time products
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
        console.error("Real-time product fetch error:", error);
        setLoading(false);
      }
    );
  }, [currentUser]);

  // Load customers & transports
  const refreshCustomers = useCallback(async () => {
    if (!currentUser) return;
    try {
      setCustomers(await listCustomers(currentUser.uid));
    } catch (error) {
      console.error("Customers load error:", error);
    }
  }, [currentUser]);

  useEffect(() => {
    refreshCustomers();
  }, [refreshCustomers]);

  useEffect(() => {
    if (!currentUser) return;
    listTransports(currentUser.uid)
      .then((list) => setTransports(list))
      .catch((error) => console.error("Transports load error:", error));
  }, [currentUser]);

  // Customer selection
  const handleSelectCustomer = (customer: Customer | null) => {
    if (!customer) {
      setCustomerId("");
      setCustomerName("");
    } else {
      setCustomerId(customer.id);
      setCustomerName(customer.name);
    }
  };

  // Add product to cart
  const addToCart = (product: Product, bagsQty = 1) => {
    const finalPrice = product.sellingPrice;
    const isWeight = product.unitType === "weight";
    const bagWeight = 25;
    const totalWeight = isWeight ? bagsQty * bagWeight : undefined;
    const lineGross = isWeight ? totalWeight! * finalPrice : bagsQty * finalPrice;

    setCart((prev) => {
      const idx = prev.findIndex((item) => item.id === product.id);
      if (idx !== -1) {
        return prev.map((item, i) => {
          if (i !== idx) return item;
          const newQty = item.qty + bagsQty;
          const newTotalWeight = isWeight
            ? item.isManualWeight
              ? (item.totalWeight ?? 0) + bagsQty * bagWeight
              : newQty * bagWeight
            : undefined;
          const lineTotal = isWeight
            ? (newTotalWeight ?? 0) * finalPrice
            : newQty * finalPrice;

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

  // Update item quantity
  const updateQty = (index: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item, i) => {
          if (i !== index) return item;
          const newQty = Math.max(0, item.qty + delta);
          if (newQty === 0) return null;

          const isWeight = item.type === "weight";
          const bagWeight = item.weightPerBag || 25;
          const totalWeight = isWeight ? newQty * bagWeight : undefined;
          const lineTotal = isWeight ? totalWeight! * item.price : newQty * item.price;

          const updated: SaleItem = {
            ...item,
            qty: newQty,
            total: lineTotal,
          };
          if (totalWeight !== undefined) {
            updated.totalWeight = totalWeight;
          }
          return updated;
        })
        .filter(Boolean) as SaleItem[]
    );
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const resetOrder = () => {
    setCart([]);
    setCustomerName("");
    setCustomerId("");
    setDescription("");
    setTransport("");
    setExtraCharges("");
    setCashTendered("");
  };

  // Barcode / Scanner input handler
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = search.trim().toLowerCase();
    if (!query) return;

    // Check exact barcode match first
    const match = products.find(
      (p) =>
        p.id.toLowerCase() === query ||
        p.name.toLowerCase() === query ||
        (p.category && p.category.toLowerCase() === query)
    );

    if (match) {
      addToCart(match, 1);
      setSearch("");
      toast.success(`${match.name} added to bill`);
    } else if (filteredProducts.length === 1) {
      addToCart(filteredProducts[0], 1);
      setSearch("");
      toast.success(`${filteredProducts[0].name} added to bill`);
    }
  };

  // Calculations
  const itemsTotal = cart.reduce((sum, item) => sum + item.total, 0);
  const extra = Math.max(0, parseFloat(extraCharges) || 0);
  const grandTotal = itemsTotal + extra;
  const totalUnits = cart.reduce((sum, item) => sum + item.qty, 0);

  // Cash change calculation
  const tenderedNum = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, tenderedNum - grandTotal);

  // Hold Cart functionality (F6)
  const handleHoldCart = () => {
    if (cart.length === 0) {
      toast.error(t("pos_cart_empty_toast"));
      return;
    }
    const newHeld: HeldCart = {
      id: String(Date.now()).slice(-6),
      time: new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" }),
      customerName: customerName.trim() || "Walk-in Customer",
      customerId,
      items: [...cart],
      total: grandTotal,
    };
    setHeldCarts((prev) => [newHeld, ...prev]);
    resetOrder();
    toast.success(t("pos_hold_success"));
  };

  const handleRestoreHeld = (held: HeldCart) => {
    setCart(held.items);
    setCustomerName(held.customerName === "Walk-in Customer" ? "" : held.customerName);
    setCustomerId(held.customerId || "");
    setHeldCarts((prev) => prev.filter((h) => h.id !== held.id));
    setShowHeldModal(false);
    toast.success(t("pos_hold_restored"));
  };

  // Finalize Sale
  const handleFinalizeSale = async () => {
    if (!currentUser) return;
    if (cart.length === 0) {
      toast.error(t("pos_cart_empty_toast"));
      return;
    }
    if (cart.some((item) => !(item.qty > 0))) {
      toast.error(t("pos_qty_zero"));
      return;
    }
    if (paymentMethod === "Udhar" && !customerId) {
      toast.error(t("pos_select_party_credit"));
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
        setProducts((prev) =>
          prev.map((p) => {
            const cartItem = cart.find((c) => c.id === p.id);
            if (!cartItem) return p;
            return { ...p, stock: Math.max(0, p.stock - cartItem.qty) };
          })
        );
      }

      setInvoiceNumber(shortInvoiceNo);
      toast.success(t("pos_sale_success"));
      if (paymentMethod === "Udhar") refreshCustomers();

      setShowPaymentModal(false);
      setShowReceipt(true);
    } catch (error) {
      console.error(error);
      toast.error(
        t("pos_sale_failed", {
          reason:
            typeof error === "string"
              ? error
              : error instanceof Error
              ? error.message
              : t("pos_unknown_error"),
        })
      );
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Filter Categories & Products
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => {
      const cat = p.category?.trim() || OTHER_CATEGORY;
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = search.toLowerCase().trim();
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(term) || (p.category && p.category.toLowerCase().includes(term));
      const matchesCategory =
        activeCategory === "all" || (p.category?.trim() || OTHER_CATEGORY) === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, activeCategory]);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
      } else if (e.key === "F6") {
        e.preventDefault();
        handleHoldCart();
      } else if (e.key === "F9") {
        e.preventDefault();
        if (cart.length > 0) setShowPaymentModal(true);
      } else if (e.key === "Escape") {
        setShowPaymentModal(false);
        setShowHeldModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, grandTotal]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-surface select-none">
      {/* 1. Top Command & Action Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 shadow-xs shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary text-white rounded font-bold text-xs uppercase tracking-wider shadow-xs">
            <Zap size={14} />
            <span>{t("pos_high_speed")}</span>
          </div>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span className="font-bold text-on-surface">Counter 01</span>
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
            <span className="text-tertiary font-bold">FBR POS Synchronized</span>
            <span className="text-slate-400 hidden sm:inline">• Batch #PK-9812</span>
          </div>
        </div>

        {/* Quick Stat Pill Array */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 bg-slate-50 px-3 py-1 rounded border border-slate-200 text-xs">
            <span className="text-slate-400">Total Products</span>
            <span className="font-bold text-on-surface tabular">{products.length}</span>
          </div>

          <button
            type="button"
            onClick={() => setShowHeldModal(true)}
            className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 px-3 py-1 rounded border border-slate-200 text-xs text-slate-700 transition-colors"
          >
            <Clock size={13} className="text-slate-400" />
            <span>{t("pos_held_bills", { count: heldCarts.length })}</span>
          </button>

          {invoiceNumber && (
            <button
              type="button"
              onClick={() => setShowReceipt(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-orange-50 hover:bg-orange-100 text-primary border border-orange-200 rounded text-xs font-bold transition-colors"
            >
              <Printer size={13} />
              <span>Last Bill (#{invoiceNumber})</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Main POS Grid (Left 7 cols: Fast Discovery | Right 5 cols: Cart & Ledger) */}
      <div className="grid grid-cols-12 flex-1 overflow-hidden">
        {/* LEFT PANEL: Speed Search & Fast Product Catalog (7 cols) */}
        <section className="col-span-12 lg:col-span-7 flex flex-col bg-surface border-r border-slate-200 overflow-hidden">
          {/* Search Barcode & Live Scan Bar */}
          <div className="p-3.5 bg-white border-b border-slate-200 shadow-xs flex flex-col gap-2.5 shrink-0">
            <form onSubmit={handleBarcodeSubmit} className="relative flex items-center w-full">
              <ScanLine className="absolute left-3.5 text-primary w-5 h-5 pointer-events-none" />
              <input
                ref={barcodeInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("pos_scan_barcode_hint")}
                className="w-full pl-11 pr-24 py-2.5 bg-slate-50 text-on-surface rounded-lg text-sm placeholder:text-slate-400 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-inner"
              />
              <div className="absolute right-2.5 flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider">
                  F2
                </span>
                <button
                  type="submit"
                  className="p-1 rounded text-primary hover:bg-orange-50 transition-colors"
                  title="Scan & Add"
                >
                  <Barcode size={18} />
                </button>
              </div>
            </form>

            {/* Filter Pills with Live Product Count */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 whitespace-nowrap">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeCategory === "all"
                    ? "bg-primary text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:text-on-surface hover:bg-slate-200"
                }`}
              >
                <span>{t("pos_all_items")}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    activeCategory === "all" ? "bg-white/25 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {products.length}
                </span>
              </button>

              {categories.map(([cat, count]) => {
                const label = cat === OTHER_CATEGORY ? t("pos_category_other") : cat;
                const isSelected = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-primary text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:text-on-surface hover:bg-slate-200"
                    }`}
                  >
                    <span>{label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isSelected ? "bg-white/25 text-white" : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* High-Frequency Product Cards Grid */}
          <div className="flex-1 p-3 sm:p-4 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-xs font-semibold">{t("loading")}</span>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                <p className="text-sm font-bold text-slate-600">{t("pos_select_nothing_found")}</p>
                <p className="text-xs mt-1">Try another category or search keyword</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredProducts.map((p) => {
                  const isLow = (p.stock ?? 0) <= 5;
                  const isOut = (p.stock ?? 0) <= 0;
                  const unitLabel =
                    p.unitType === "weight"
                      ? t("pos_unit_bags")
                      : p.category || t("pos_unit_pcs");

                  return (
                    <div
                      key={p.id}
                      onClick={() => !isOut && addToCart(p, 1)}
                      className={`group relative flex flex-col justify-between p-3 rounded-xl bg-white border border-slate-200 shadow-xs hover:shadow-md transition-all duration-150 select-none ${
                        isOut ? "opacity-60 cursor-not-allowed" : "cursor-pointer active:scale-[0.98]"
                      }`}
                    >
                      {/* Top meta badges */}
                      <div className="flex items-start justify-between gap-1 mb-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isOut
                              ? "bg-slate-100 text-slate-500"
                              : isLow
                              ? "bg-red-50 text-error border border-red-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {isOut ? t("pos_out_of_stock") : `${p.stock} in stock`}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400 truncate max-w-[80px]">
                          {unitLabel}
                        </span>
                      </div>

                      {/* Product Visual Box */}
                      <div className="h-20 w-full rounded-lg mb-2 bg-slate-50 border border-slate-100 flex items-center justify-center relative overflow-hidden group-hover:bg-orange-50/40 transition-colors">
                        <span className="text-2xl font-black text-slate-300 group-hover:text-primary transition-colors">
                          {p.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="absolute top-1 left-1 bg-slate-900/80 text-white px-1.5 py-0.2 rounded text-[9px] font-bold tabular">
                          #{p.id.slice(-4).toUpperCase()}
                        </span>
                      </div>

                      {/* Info & Price */}
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-on-surface leading-tight truncate mb-0.5">
                          {p.name}
                        </h4>
                        <p className="text-[11px] text-slate-400 truncate mb-2">
                          {p.category || "General Grocery"}
                        </p>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                          <span className="text-sm font-extrabold text-primary tabular">
                            Rs. {p.sellingPrice.toLocaleString()}
                          </span>
                          <button
                            type="button"
                            disabled={isOut}
                            className="w-7 h-7 rounded-lg bg-orange-50 group-hover:bg-primary text-primary group-hover:text-white flex items-center justify-center transition-colors shadow-xs"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT PANEL: "Current Bill" Register & Checkout Ledger (5 cols) */}
        <section className="col-span-12 lg:col-span-5 flex flex-col bg-white shadow-lg lg:shadow-none z-10 overflow-hidden">
          {/* Cart Header & Customer Switcher */}
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col gap-2.5 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-on-surface tabular">
                  #INV-{invoiceNumber || "ACTIVE"}
                </span>
                <span className="px-2 py-0.5 rounded bg-orange-100 text-primary font-bold text-[10px] uppercase">
                  Counter 1
                </span>
              </div>
              <span className="text-xs text-slate-500 font-medium tabular">
                {currentTime || "Live"} • {cart.length} {t("items")}
              </span>
            </div>

            {/* Customer Khata Selector */}
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <CustomerSelect
                  customers={customers}
                  selectedCustomerId={customerId}
                  onSelectCustomer={handleSelectCustomer}
                  isUdhar={paymentMethod === "Udhar"}
                />
              </div>

              {/* Extra Transport / Delivery toggle */}
              <button
                type="button"
                onClick={() => setShowTransportModal(true)}
                className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors shrink-0 ${
                  transport
                    ? "bg-orange-50 text-primary border-orange-200"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                }`}
                title={t("pos_transport")}
              >
                <Truck size={16} />
              </button>
            </div>
          </div>

          {/* Scrollable Cart Ledger Table */}
          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-400">
                <ShoppingCart size={36} className="text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-600">{t("pos_cart_empty_toast")}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Scan a barcode or tap products on the left to add items
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wider z-10 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Item Details</th>
                    <th className="py-2 px-2 text-right">Rate</th>
                    <th className="py-2 px-2 text-center">Qty</th>
                    <th className="py-2 px-3 text-right">Total</th>
                    <th className="py-2 px-1 text-center" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {cart.map((item, index) => {
                    const isWeight = item.type === "weight";
                    return (
                      <tr key={`${item.id}-${index}`} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-on-surface leading-tight text-xs truncate max-w-[140px]">
                            {item.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {isWeight
                              ? `${item.totalWeight ?? item.qty * 25} kg`
                              : `${item.qty} pcs`}
                          </div>
                        </td>

                        <td className="py-2.5 px-2 text-right font-medium text-slate-600 tabular">
                          {item.price.toLocaleString()}
                        </td>

                        <td className="py-2.5 px-2 text-center">
                          <div className="inline-flex items-center justify-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                            <button
                              type="button"
                              onClick={() => updateQty(index, -1)}
                              className="w-5 h-5 flex items-center justify-center rounded text-slate-600 hover:bg-white transition-colors"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="w-7 text-center font-bold text-on-surface tabular">
                              {item.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQty(index, 1)}
                              className="w-5 h-5 flex items-center justify-center rounded text-slate-600 hover:bg-white transition-colors"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-right font-bold text-on-surface tabular">
                          Rs. {Math.round(item.total).toLocaleString()}
                        </td>

                        <td className="py-2.5 px-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeFromCart(index)}
                            className="p-1 text-slate-300 hover:text-error transition-colors"
                            title="Remove"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Ledger Summary Calculation Area */}
          <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col gap-2 shrink-0">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Subtotal ({cart.length} items, {totalUnits} units)</span>
              <span className="font-bold text-on-surface tabular">
                Rs. {Math.round(itemsTotal).toLocaleString()}
              </span>
            </div>

            {/* Extra charges field */}
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span>{t("pos_extra_charges")}</span>
                {transport && <span className="text-[10px] text-primary">({transport})</span>}
              </span>
              <div className="flex items-center gap-1">
                <span>+ Rs.</span>
                <input
                  type="number"
                  value={extraCharges}
                  onChange={(e) => setExtraCharges(e.target.value)}
                  placeholder="0"
                  className="w-16 px-1.5 py-0.5 rounded border border-slate-300 text-right text-xs font-bold text-on-surface tabular bg-white"
                />
              </div>
            </div>

            {/* High-Visibility Net Total Display */}
            <div className="mt-1 p-3 rounded-xl bg-secondary text-white flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  {t("pos_payable_net")}
                </span>
                <div className="text-[10px] text-slate-400">{t("pos_inc_levies")}</div>
              </div>
              <div className="text-right">
                <span className="text-2xl sm:text-3xl font-black text-primary-fixed tabular leading-none">
                  Rs. {Math.round(grandTotal).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Action Control Strip */}
            <div className="grid grid-cols-3 gap-2 mt-1">
              <button
                type="button"
                onClick={handleHoldCart}
                className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border border-slate-200 transition-colors"
              >
                <PauseCircle size={14} />
                <span>{t("pos_hold_bill")}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowHeldModal(true)}
                className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border border-slate-200 transition-colors"
              >
                <Clock size={14} />
                <span>{t("pos_held_bills", { count: heldCarts.length })}</span>
              </button>

              <button
                type="button"
                onClick={resetOrder}
                className="py-2 bg-red-50 hover:bg-red-100 text-error rounded-lg text-xs font-bold flex items-center justify-center gap-1 border border-red-200 transition-colors"
              >
                <RotateCcw size={14} />
                <span>{t("pos_void_cart")}</span>
              </button>
            </div>

            {/* Giant Checkout Payment Trigger CTA */}
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={() => setShowPaymentModal(true)}
              className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-bold text-base shadow-sm transition-all active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 tracking-wide"
            >
              <Banknote size={20} />
              <span>{t("pos_pay_cta", { total: Math.round(grandTotal).toLocaleString() })}</span>
            </button>
          </div>
        </section>
      </div>

      {/* 3. Keyboard Operational Command Strip (Bottom persistent) */}
      <div className="h-9 px-4 bg-secondary text-slate-300 flex items-center justify-between text-xs shrink-0 z-30">
        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1">
            <span className="bg-slate-800 text-primary-fixed px-1.5 py-0.2 rounded font-mono font-bold text-[10px]">
              F2
            </span>
            <span className="text-slate-400">Barcode</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="bg-slate-800 text-primary-fixed px-1.5 py-0.2 rounded font-mono font-bold text-[10px]">
              F4
            </span>
            <span className="text-slate-400">Customer</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="bg-slate-800 text-primary-fixed px-1.5 py-0.2 rounded font-mono font-bold text-[10px]">
              F6
            </span>
            <span className="text-slate-400">Hold Bill</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="bg-slate-800 text-primary-fixed px-1.5 py-0.2 rounded font-mono font-bold text-[10px]">
              F9
            </span>
            <span className="text-slate-400">Pay</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="bg-slate-800 text-primary-fixed px-1.5 py-0.2 rounded font-mono font-bold text-[10px]">
              ESC
            </span>
            <span className="text-slate-400">Close</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="w-2 h-2 rounded-full bg-tertiary" />
          <span className="text-tertiary font-bold text-[11px] hidden sm:inline">
            FBR Invoice Sync Active (Tier-1 POS #49102-LHR)
          </span>
        </div>
      </div>

      {/* MODAL 1: Speed Payment Collection Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in-0 zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center shadow-xs">
                  <Banknote size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-on-surface">
                    {t("pos_collect_payment")} • Rs. {Math.round(grandTotal).toLocaleString()}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {customerName.trim() || "Counter Sale"} • {cart.length} {t("items")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex flex-col gap-4">
              {/* Payment Method Tabs */}
              <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("Cash")}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    paymentMethod === "Cash"
                      ? "bg-white text-primary shadow-xs"
                      : "text-slate-600 hover:text-on-surface"
                  }`}
                >
                  <Banknote size={15} />
                  <span>{t("pos_pay_cash")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("Bank Account")}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    paymentMethod === "Bank Account"
                      ? "bg-white text-primary shadow-xs"
                      : "text-slate-600 hover:text-on-surface"
                  }`}
                >
                  <CreditCard size={15} />
                  <span>{t("pos_pay_bank")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("Udhar")}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    paymentMethod === "Udhar"
                      ? "bg-white text-primary shadow-xs"
                      : "text-slate-600 hover:text-on-surface"
                  }`}
                >
                  <BookOpen size={15} />
                  <span>{t("pos_pay_credit")}</span>
                </button>
              </div>

              {/* Warning if Udhar without customer */}
              {paymentMethod === "Udhar" && !customerId && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                  <span className="font-bold">⚠️ Warning:</span>
                  <span>{t("pos_select_party_credit")}</span>
                </div>
              )}

              {/* Quick Cash Tender suggestions (Only for Cash) */}
              {paymentMethod === "Cash" && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-slate-500">
                    {t("pos_tender_suggestion")}
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setCashTendered(String(Math.round(grandTotal)))}
                      className="py-2 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-on-surface tabular border border-slate-200 transition-colors"
                    >
                      Exact (Rs. {Math.round(grandTotal)})
                    </button>
                    {[500, 1000, 5000].map((step) => {
                      const rounded = Math.ceil(grandTotal / step) * step;
                      if (rounded <= grandTotal) return null;
                      return (
                        <button
                          key={step}
                          type="button"
                          onClick={() => setCashTendered(String(rounded))}
                          className="py-2 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-on-surface tabular border border-slate-200 transition-colors"
                        >
                          Rs. {rounded.toLocaleString()}
                        </button>
                      );
                    })}
                  </div>

                  {/* Cash Received & Change Return display */}
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-500">
                        {t("pos_cash_tendered")}
                      </label>
                      <input
                        type="number"
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value)}
                        placeholder={String(Math.round(grandTotal))}
                        className="px-3 py-2 rounded-lg border border-slate-300 text-base font-bold text-on-surface tabular focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-500">
                        {t("pos_change_due")}
                      </label>
                      <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-base font-extrabold text-tertiary tabular">
                        Rs. {Math.round(changeDue).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Complete & Checkout Button */}
              <button
                type="button"
                disabled={checkoutLoading || (paymentMethod === "Udhar" && !customerId)}
                onClick={handleFinalizeSale}
                className="w-full py-3.5 mt-2 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-base shadow-sm transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {checkoutLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>{t("pos_complete_print")} (F9)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Held Carts Drawer */}
      {showHeldModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-on-surface">
                Held Bills ({heldCarts.length})
              </h3>
              <button
                type="button"
                onClick={() => setShowHeldModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-80 flex flex-col gap-2">
              {heldCarts.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-6">No held bills.</p>
              ) : (
                heldCarts.map((h) => (
                  <div
                    key={h.id}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between hover:bg-white transition-colors"
                  >
                    <div>
                      <p className="text-xs font-bold text-on-surface">
                        #{h.id} • {h.customerName}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {h.time} • {h.items.length} items • Rs. {Math.round(h.total)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRestoreHeld(h)}
                      className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-xs"
                    >
                      Resume
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Transport / Delivery Modal */}
      <AddTransportModal
        open={showTransportModal}
        onClose={() => setShowTransportModal(false)}
        onSaved={(newT: Transport) => {
          setTransports((prev) => [...prev, newT]);
          setTransport(newT.name);
          setShowTransportModal(false);
        }}
      />

      {/* MODAL 4: Sale Receipt Thermal Print */}
      {showReceipt && (
        <SaleReceipt
          shop={currentShop}
          invoiceNo={invoiceNumber}
          date={new Date().toISOString()}
          customerName={customerName || "Counter Sale"}
          transport={transport}
          extraCharges={extra}
          items={cart}
          total={grandTotal}
          paymentMethod={paymentMethod}
          printLabel="Print Thermal Receipt"
          closeLabel="Done & Next Bill"
          onClose={() => {
            setShowReceipt(false);
            resetOrder();
          }}
        />
      )}
    </div>
  );
}
