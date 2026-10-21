"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { auth } from "../lib/firebase";
import { syncPendingSales } from "../lib/services/sales";
import { syncPendingGatePasses } from "../lib/services/gatePasses";
import { syncPendingDayClosings } from "../lib/services/dailyClosing";
import { getTotalPendingCount } from "../lib/services/offlineStorage";
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
    Wallet,
    RotateCcw,
    Users,
    Receipt,
    PackagePlus,
    FileText,
    Truck,
    HandCoins,
    ClipboardCheck,
    X
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

    useEffect(() => {
        if (typeof window !== "undefined") {
            const unlocked = sessionStorage.getItem("eman_access_granted");
            if (!unlocked) {
                router.replace("/");
                return;
            }
        }

        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (!user) {
                router.push("/");
                return;
            }

            let shopData: Shop | null = null;
            try {
                shopData = await getUserShopProfile(user.uid);
            } catch (error) {
                console.error("Shop profile load failed:", error);
            }

            if (!shopData) {
                shopData = {
                    uid: user.uid,
                    email: user.email,
                    shopName: "Eman Traders",
                    businessType: "Wholesale",
                    currency: "PKR",
                    createdAt: new Date().toISOString(),
                };
            }

            setLoadError(false);
            setCurrentUser(user);
            setCurrentShop(shopData);
            setLoading(false);
        });

        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router]);

    useEffect(() => {
        const checkPending = () => {
            setPendingCount(getTotalPendingCount());
        };
        checkPending();
        const interval = setInterval(checkPending, 2000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) {
                setSidebarOpen(false);
            } else {
                setSidebarOpen(true);
            }
        };

        handleResize();

        window.addEventListener('resize', handleResize);

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleSync = async () => {
        if (syncingRef.current || getTotalPendingCount() === 0) return;
        syncingRef.current = true;
        setIsSyncing(true);

        try {
            let totalUploaded = 0;
            const uploadedSales = await syncPendingSales(() => setPendingCount(getTotalPendingCount()));
            totalUploaded += uploadedSales;

            const uploadedGatePasses = await syncPendingGatePasses(() => setPendingCount(getTotalPendingCount()));
            totalUploaded += uploadedGatePasses;

            const uploadedClosings = await syncPendingDayClosings(() => setPendingCount(getTotalPendingCount()));
            totalUploaded += uploadedClosings;

            if (totalUploaded > 0) {
                toast.success(t("shell_offlineSynced", { count: totalUploaded }));
            }
        } catch (error) {
            console.error("Sync Error:", error);
            toast.error(t("shell_syncFailed", { error: error instanceof Error ? error.message : String(error) }));
        } finally {
            setPendingCount(getTotalPendingCount());
            syncingRef.current = false;
            setIsSyncing(false);
        }
    };


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
    const handleLogout = async () => {
        if (typeof window !== "undefined") {
            sessionStorage.removeItem("eman_access_granted");
        }
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
                { name: t("shell_navGatePass"), href: "/dashboard/gate-pass", icon: FileText },
                { name: t("shell_navDailyClosing"), href: "/dashboard/daily-closing", icon: ClipboardCheck },
                { name: t("navReturns"), href: "/dashboard/returns", icon: RotateCcw },
                { name: t("navUdhar"), href: "/dashboard/udhar", icon: HandCoins },
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
            title: t("shell_sectionAccounts"),
            items: [
                { name: t("shell_navSuppliers"), href: "/dashboard/suppliers", icon: Truck },
                { name: t("navExpenses"), href: "/dashboard/expenses", icon: Wallet },
                { name: t("navDashboard"), href: "/dashboard", icon: LayoutDashboard },
                { name: t("navSettings"), href: "/dashboard/settings", icon: Settings },
            ],
        },
    ];

    const currentPage =
        navSections.flatMap((s) => s.items).find((i) => i.href === pathname)?.name ??
        (pathname.includes("/inventry/edit") ? t("navEditProduct") : t("navDashboard"));
    const shopInitial = (currentShop?.shopName || "S").trim().charAt(0).toUpperCase();

    return (
        <div className="flex h-screen bg-canvas">

            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-20 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <aside
                className={`
                    ${isSidebarOpen ? "translate-x-0 w-64" : "-translate-x-full w-64 md:translate-x-0 md:w-[76px]"}
                    transition-all duration-300 ease-in-out bg-white border-r border-stone-200 flex flex-col
                    fixed md:relative z-30 h-full shrink-0
                `}
            >
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
                                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${isSidebarOpen ? "" : "justify-center"
                                                } ${isActive
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

                <div className="p-3 border-t border-stone-200 shrink-0">
                    <div className={`flex items-center gap-3 rounded-xl bg-stone-50 p-2.5 ${isSidebarOpen ? "" : "justify-center"}`}>
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                            {shopInitial}
                        </div>
                        {isSidebarOpen && (
                            <>
                                <div className="min-w-0 flex-1">
                                    <p onClick={() => router.push("/dashboard/admin")} className="truncate text-sm font-bold text-stone-900">{currentShop?.shopName || t("shell_shop")}</p>
                                    <p className="truncate text-[11px] text-stone-500">{currentShop?.email || t("shell_owner")}</p>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    title={t("shell_signOut")}
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
                            title={t("shell_signOut")}
                            className="mt-2 flex w-full justify-center rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                            <LogOut size={18} />
                        </button>
                    )}
                </div>
            </aside>

            <div className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">

                <header className="h-16 bg-white border-b border-stone-200 px-4 md:px-6 flex items-center justify-between gap-3 shrink-0 z-10">
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            onClick={() => setSidebarOpen((open) => !open)}
                            className="rounded-lg p-2 text-stone-600 hover:bg-stone-100 transition"
                            title={t("shell_menu")}
                        >
                            <Menu size={20} />
                        </button>
                        <h2 className="truncate text-base font-bold text-stone-900">{currentPage}</h2>
                    </div>

                    <div className="flex items-center gap-2 md:gap-3">
                        <LanguageSwitcher />

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

                        <div className={`hidden sm:flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${isOnline ? "bg-emerald-50 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                            <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-amber-500"}`} />
                            {isOnline ? t("online") : t("offline")}
                        </div>

                    </div>
                </header>

                <main className="flex-1 overflow-auto p-4 md:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}