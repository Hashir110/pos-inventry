"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { auth } from "../lib/firebase";
import { getPendingSales, syncPendingSales } from "../lib/services/sales";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { getUserShopProfile } from "../lib/authService";
import { useRouter, usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    Settings,
    LogOut,
    Menu,
    RefreshCw,
    Store,
    AlertTriangle,
    CreditCard,
    MessageCircle,
    Phone,
    X,
    Wallet,
    RotateCcw,
    Users,
    Receipt,
    PackagePlus,
    FileText,
    Truck,
    TrendingUp,
    HandCoins
} from "lucide-react";
import Link from "next/link";
import type { Shop } from "../types";
import { toast } from 'react-toastify';
import { useLanguage } from "../store/useLanguage";
import LanguageSwitcher from "../components/LanguageSwitcher";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { currentShop, setCurrentUser, setCurrentShop } = useStore();
    const { t } = useLanguage();
    const router = useRouter();
    const pathname = usePathname();
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const isOnline = useOnlineStatus();
    const [isSidebarOpen, setSidebarOpen] = useState(true);

    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const syncingRef = useRef(false);
    const autoSyncTried = useRef(false);

    const [licenseStatus, setLicenseStatus] = useState("active"); // 'active', 'warning', 'expired'
    const [daysOverdue, setDaysOverdue] = useState(0);

    const [showPaymentModal, setShowPaymentModal] = useState(false);

    // 1. Session Restore Logic (Agar refresh karein toh data na urr jaye)
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (!user) {
                router.push("/"); // Login nahi hai toh bhaga do
                return;
            }

            // Hamesha DB se taza profile lo taake license renew hone par naya expiry mile
            // (store mein purani cached value se renew nazar nahi aata)
            let shopData: Shop | null;
            try {
                shopData = await getUserShopProfile(user.uid);
            } catch (error) {
                // Offline + cache khali, ya permission error: /setup par mat bhejo
                console.error("Shop profile load failed:", error);
                setLoadError(true);
                return;
            }
            if (!shopData) {
                router.push("/setup");
                return;
            }
            setLoadError(false);
            setCurrentUser(user);
            setCurrentShop(shopData);
            setLoading(false);
            checkLicense(shopData);
        });

        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- FUNCTION: Check License Validity ---
    // diffDays = aaj - expiry (din). Negative = expiry abhi aani hai.
    //   diffDays < -3        -> active
    //   -3 <= diffDays <= 1  -> warning banner (expiry qareeb ya grace period)
    //   diffDays >= 2        -> BLOCK (/license-expired)
    const checkLicense = (shop: Shop | null) => {
        if (!shop?.licenseExpiry) return;

        const expiryDate = new Date(shop.licenseExpiry);
        const today = new Date();

        // Time reset: sirf tareekh compare ho
        expiryDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        const diffDays = Math.round((today.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays >= 2) {
            router.push("/license-expired");
        } else if (diffDays >= -3) {
            setLicenseStatus("warning");
            setDaysOverdue(diffDays);
        } else {
            setLicenseStatus("active");
        }
    };

    useEffect(() => {
        const checkPending = () => {
            setPendingCount(getPendingSales().length);
        };
        checkPending(); // First run
        const interval = setInterval(checkPending, 2000); // Poll every 2 sec
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleResize = () => {
            // Agar screen choti (mobile/tablet) hai toh default menu BAND (false) rakho
            if (window.innerWidth < 768) {
                setSidebarOpen(false);
            } 
            // Agar screen bari (desktop/laptop) hai toh default menu KHULA (true) rakho
            else {
                setSidebarOpen(true);
            }
        };

        // 1. Page load hotay hi check karo
        handleResize();

        // 2. Jab bhi user inspect kare ya screen choti/bari kare, automatically adjust karo
        window.addEventListener('resize', handleResize);

        // Cleanup function
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 3. SYNC FUNCTION (Upload Offline Data)
    const handleSync = async () => {
        if (syncingRef.current || getPendingSales().length === 0) return;
        syncingRef.current = true;
        setIsSyncing(true);

        try {
            const uploaded = await syncPendingSales((remaining) => setPendingCount(remaining));
            if (uploaded > 0) toast.success(`${uploaded} offline sale(s) synced!`);
        } catch (error) {
            console.error("Sync Error:", error);
            toast.error("Sync Failed: " + (error instanceof Error ? error.message : String(error)));
        } finally {
            syncingRef.current = false;
            setIsSyncing(false);
        }
    };

    // Internet wapis aate hi khud sync (har offline->online transition par sirf ek koshish;
    // fail ho to sidebar ka Sync button se dobara try kar sakte hain)
    useEffect(() => {
        if (!isOnline) {
            autoSyncTried.current = false;
            return;
        }
        if (loading || autoSyncTried.current) return;
        autoSyncTried.current = true;
        handleSync();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOnline, loading]);
    // Logout Function
    const handleLogout = async () => {
        await auth.signOut();
        router.push("/");
    };

    if (loadError) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-lg font-bold text-stone-800">{t("shopDataLoadFailed")}</p>
                <p className="text-sm text-stone-500">
                    {t("checkInternetNotice")}
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="rounded-lg bg-brand-600 px-5 py-2 font-bold text-white hover:bg-brand-700"
                >
                    {t("retry")}
                </button>
            </div>
        );
    }
    if (loading) {
        return <div className="flex h-screen items-center justify-center">{t("loading")}</div>;
    }

    const navSections = [
        {
            title: t("navSales"),
            items: [
                { name: t("navPos"), href: "/dashboard/pos", icon: ShoppingCart },
                { name: t("navSalesHistory"), href: "/dashboard/sales", icon: Receipt },
                { name: "Gate Pass (Gudam)", href: "/dashboard/gate-pass", icon: FileText },
                { name: t("navReturns"), href: "/dashboard/returns", icon: RotateCcw },
                { name: t("navUdhar") + " / Wasooli", href: "/dashboard/udhar", icon: HandCoins },
            ],
        },
        {
            title: t("navStock"),
            items: [
                { name: t("navInventory"), href: "/dashboard/inventry", icon: Package },
                { name: t("navAddProduct"), href: "/dashboard/inventry/add", icon: PackagePlus },
            ],
        },
        {
            title: "Traders & Accounts",
            items: [
                { name: "Suppliers (Maal Udhar)", href: "/dashboard/suppliers", icon: Truck },
                { name: t("navExpenses"), href: "/dashboard/expenses", icon: Wallet },
                { name: t("navDashboard"), href: "/dashboard", icon: LayoutDashboard },
                { name: "Secret Profit Audit", href: "/dashboard/admin/profit", icon: TrendingUp },
                { name: t("navSettings"), href: "/dashboard/settings", icon: Settings },
            ],
        },
    ];

    const currentPage =
        navSections.flatMap((s) => s.items).find((i) => i.href === pathname)?.name ??
        (pathname.includes("/inventry/edit") ? t("navEditProduct") : t("navDashboard"));
    const shopInitial = (currentShop?.shopName || "S").trim().charAt(0).toUpperCase();
    const licenseExpired = daysOverdue > 0;

    return (
        <div className="flex h-screen bg-canvas">

            {/* --- MOBILE OVERLAY --- */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-20 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* --- SIDEBAR (light) --- */}
            <aside
                className={`
                    ${isSidebarOpen ? "translate-x-0 w-64" : "-translate-x-full w-64 md:translate-x-0 md:w-[76px]"}
                    transition-all duration-300 ease-in-out bg-white border-r border-stone-200 flex flex-col
                    fixed md:relative z-30 h-full shrink-0
                `}
            >
                {/* Brand */}
                <div className="h-16 flex items-center justify-between px-4 border-b border-stone-200 shrink-0">
                    <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden py-1">
                        <img
                            src="/logoPos.png"
                            alt="ASAAN POS"
                            className={`h-[48px] w-auto object-contain shrink-0 ${isSidebarOpen ? "max-w-[200px]" : "max-w-[44px] overflow-hidden"}`}
                        />
                    </Link>
                    <button
                        className="md:hidden text-stone-400 hover:text-stone-700"
                        onClick={() => setSidebarOpen(false)}
                    >
                        <X size={22} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 overflow-y-auto">
                    {navSections.map((section) => (
                        <div key={section.title} className="mb-5">
                            {isSidebarOpen ? (
                                <p className="px-3 mb-1.5 text-[11px] font-bold uppercase tracking-widest text-stone-400">
                                    {section.title}
                                </p>
                            ) : (
                                <div className="mx-3 mb-2 border-t border-stone-200" />
                            )}
                            <div className="space-y-0.5">
                                {section.items.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = pathname === item.href;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            title={item.name}
                                            onClick={() => {
                                                if (window.innerWidth < 768) setSidebarOpen(false);
                                            }}
                                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                                                isSidebarOpen ? "" : "justify-center"
                                            } ${
                                                isActive
                                                    ? "bg-brand-500 text-white shadow-sm"
                                                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                                            }`}
                                        >
                                            <Icon size={19} className="shrink-0" />
                                            {isSidebarOpen && <span>{item.name}</span>}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Footer: shop + logout */}
                <div className="p-3 border-t border-stone-200 shrink-0">
                    <div className={`flex items-center gap-3 rounded-xl bg-stone-50 p-2.5 ${isSidebarOpen ? "" : "justify-center"}`}>
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                            {shopInitial}
                        </div>
                        {isSidebarOpen && (
                            <>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-bold text-stone-900">{currentShop?.shopName || "Shop"}</p>
                                    <p className="truncate text-[11px] text-stone-500">{currentShop?.email || "Owner"}</p>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    title="Sign Out"
                                    className="shrink-0 rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                >
                                    <LogOut size={18} />
                                </button>
                            </>
                        )}
                    </div>
                    {!isSidebarOpen && (
                        <button
                            onClick={handleLogout}
                            title="Sign Out"
                            className="mt-2 flex w-full justify-center rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                            <LogOut size={18} />
                        </button>
                    )}
                </div>
            </aside>

            {/* --- MAIN --- */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">

                {/* License banner */}
                {licenseStatus === "warning" && (
                    <div className={`${licenseExpired ? "bg-red-50 text-red-800 border-red-200" : "bg-amber-50 text-amber-900 border-amber-200"} border-b px-4 py-2.5 flex items-center justify-between gap-3 shrink-0`}>
                        <div className="flex items-center gap-3 min-w-0">
                            <AlertTriangle className={`h-5 w-5 shrink-0 ${licenseExpired ? "text-red-600" : "text-amber-600"}`} />
                            <p className="text-sm">
                                <b>{licenseExpired ? "License expire ho chuka hai. " : "License jald expire hoga. "}</b>
                                {daysOverdue < 0 && <span>{Math.abs(daysOverdue)} din baqi hain, recharge karein.</span>}
                                {daysOverdue === 0 && <span>Aaj aakhri din hai, payment kar dein.</span>}
                                {daysOverdue > 0 && <span>System {2 - daysOverdue} din mein BLOCK ho jayega.</span>}
                            </p>
                        </div>
                        <button
                            onClick={() => setShowPaymentModal(true)}
                            className="shrink-0 rounded-lg bg-white px-3.5 py-1.5 text-xs font-bold text-stone-800 border border-stone-300 hover:bg-stone-50"
                        >
                            Pay Now / Contact
                        </button>
                    </div>
                )}

                {/* Top bar */}
                <header className="h-16 bg-white border-b border-stone-200 px-4 md:px-6 flex items-center justify-between gap-3 shrink-0 z-10">
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            onClick={() => setSidebarOpen((open) => !open)}
                            className="rounded-lg p-2 text-stone-600 hover:bg-stone-100 transition"
                            title="Menu"
                        >
                            <Menu size={20} />
                        </button>
                        <h2 className="truncate text-base font-bold text-stone-900">{currentPage}</h2>
                    </div>

                    <div className="flex items-center gap-2 md:gap-3">
                        {/* Language Switcher */}
                        <LanguageSwitcher />

                        {/* Sync (offline sales) */}
                        {pendingCount > 0 && (
                            <button
                                onClick={handleSync}
                                disabled={isSyncing}
                                className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 transition disabled:opacity-60"
                            >
                                <RefreshCw size={15} className={isSyncing ? "animate-spin" : ""} />
                                <span className="hidden sm:inline">{t("syncNeeded")}</span>
                                <span className="rounded-full bg-amber-500 px-1.5 text-white">{pendingCount}</span>
                            </button>
                        )}

                        {/* Online status */}
                        <div className={`hidden sm:flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${isOnline ? "bg-emerald-50 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                            <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-amber-500"}`} />
                            {isOnline ? t("online") : t("offline")}
                        </div>

                        {pathname !== "/dashboard/pos" && (
                            <Link href="/dashboard/pos" className="btn-primary !py-2">
                                <ShoppingCart size={16} /> <span className="hidden sm:inline">{t("newSale")}</span>
                            </Link>
                        )}
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-auto p-4 md:p-6">
                    {children}
                </main>
            </div>

            {showPaymentModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-pop w-full max-w-md overflow-hidden">
                        <div className="p-5 border-b border-stone-200 flex justify-between items-start">
                            <div>
                                <h2 className="text-lg font-extrabold text-stone-900">Subscription Payment</h2>
                                <p className="text-sm text-stone-500 mt-0.5">License renew karne ke liye admin se rabta karein</p>
                            </div>
                            <button onClick={() => setShowPaymentModal(false)} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"><X size={20} /></button>
                        </div>

                        <div className="p-5 space-y-5">
                            <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-xl border border-stone-200">
                                <div className="bg-brand-100 p-2.5 rounded-xl text-brand-700">
                                    <CreditCard size={22} />
                                </div>
                                <div>
                                    <p className="text-[11px] text-stone-500 uppercase font-bold tracking-wider">Easypaisa</p>
                                    <p className="text-lg font-extrabold text-stone-900">0309-0391673</p>
                                    <p className="text-xs text-stone-500">Title: Rizwan Ahmed</p>
                                </div>
                            </div>

                            <div>
                                <p className="text-sm text-stone-500 mb-3 text-center">Payment karne ke baad screenshot WhatsApp karein.</p>
                                <div className="flex gap-3">
                                    <a
                                        href="https://wa.me/923001234567"
                                        target="_blank"
                                        className="btn-primary flex-1 !py-3"
                                    >
                                        <MessageCircle size={18} /> WhatsApp
                                    </a>
                                    <a href="tel:03001234567" className="btn-ghost flex-1 !py-3">
                                        <Phone size={18} /> Call Now
                                    </a>
                                </div>
                            </div>
                        </div>

                        <div className="bg-stone-50 px-5 py-3 text-center border-t border-stone-200">
                            <p className="text-xs text-stone-400">Support ID: {currentShop?.uid}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}