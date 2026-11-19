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
  AlertTriangle,
  CreditCard,
  MessageCircle,
  Phone,
  X,
} from "lucide-react";
import type { Shop } from "../types";
import { toast } from "react-toastify";
import { useLanguage } from "../store/useLanguage";
import { AppSidebar } from "../components/layout/AppSidebar";
import { AppTopbar } from "../components/layout/AppTopbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { currentShop, setCurrentUser, setCurrentShop } = useStore();
  const { t, language } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const isOnline = useOnlineStatus();
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncingRef = useRef(false);
  const autoSyncTried = useRef(false);

  const [licenseStatus, setLicenseStatus] = useState("active");
  const [daysOverdue, setDaysOverdue] = useState(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const isRtl = language === "ur";

  useEffect(() => {
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
        if (navigator.onLine) {
          setLoadError(true);
          return;
        }
      }
      if (!shopData) {
        if (navigator.onLine) {
          router.push("/setup");
          return;
        }
      }
      setLoadError(false);
      setCurrentUser(user);
      if (shopData) {
        setCurrentShop(shopData);
        checkLicense(shopData);
      }
      setLoading(false);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkLicense = (shop: Shop | null) => {
    if (!shop?.licenseExpiry) return;

    const expiryDate = new Date(shop.licenseExpiry);
    const today = new Date();

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
      setPendingCount(getTotalPendingCount());
    };
    checkPending();
    const interval = setInterval(checkPending, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSync = async () => {
    if (syncingRef.current || getTotalPendingCount() === 0) return;
    syncingRef.current = true;
    setIsSyncing(true);

    try {
      let totalUploaded = 0;
      const uploadedSales = await syncPendingSales(() => setPendingCount(getTotalPendingCount()));
      totalUploaded += uploadedSales;

      const uploadedGatePasses = await syncPendingGatePasses(() =>
        setPendingCount(getTotalPendingCount())
      );
      totalUploaded += uploadedGatePasses;

      const uploadedClosings = await syncPendingDayClosings(() =>
        setPendingCount(getTotalPendingCount())
      );
      totalUploaded += uploadedClosings;

      if (totalUploaded > 0) {
        toast.success(t("shell_offlineSynced", { count: totalUploaded }));
      }
    } catch (error) {
      console.error("Sync Error:", error);
      toast.error(
        t("shell_syncFailed", { error: error instanceof Error ? error.message : String(error) })
      );
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
    await auth.signOut();
    router.push("/");
  };

  if (loadError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-surface">
        <p className="text-lg font-bold text-on-surface">{t("shopDataLoadFailed")}</p>
        <p className="text-sm text-on-surface-variant">{t("checkInternetNotice")}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-primary px-5 py-2 font-bold text-white hover:bg-primary-hover shadow-sm"
        >
          {t("retry")}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface font-semibold text-slate-500">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>{t("loading")}</span>
        </div>
      </div>
    );
  }

  const licenseExpired = daysOverdue > 0;

  return (
    <div
      className={`min-h-screen bg-surface ${isRtl ? "rtl" : "ltr"}`}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* App Sidebar */}
      <AppSidebar
        isOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentShop={currentShop}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div
        className={`flex flex-col min-h-screen transition-all duration-200 ${
          isRtl ? "lg:mr-72" : "lg:ml-72"
        }`}
      >
        {/* License Warning Banner */}
        {licenseStatus === "warning" && (
          <div
            className={`${
              licenseExpired
                ? "bg-red-50 text-red-800 border-red-200"
                : "bg-amber-50 text-amber-900 border-amber-200"
            } border-b px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 z-20`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <AlertTriangle
                className={`h-5 w-5 shrink-0 ${
                  licenseExpired ? "text-red-600" : "text-amber-600"
                }`}
              />
              <p className="text-sm">
                <b>
                  {licenseExpired ? t("shell_licenseExpired") : t("shell_licenseExpiring")}
                </b>
                {daysOverdue < 0 && (
                  <span>{t("shell_licenseDaysLeft", { days: Math.abs(daysOverdue) })}</span>
                )}
                {daysOverdue === 0 && <span>{t("shell_licenseLastDay")}</span>}
                {daysOverdue > 0 && (
                  <span>{t("shell_licenseBlocked", { days: 2 - daysOverdue })}</span>
                )}
              </p>
            </div>
            <button
              onClick={() => setShowPaymentModal(true)}
              className="shrink-0 rounded-lg bg-white px-3.5 py-1.5 text-xs font-bold text-slate-800 border border-slate-300 hover:bg-slate-50 shadow-xs"
            >
              {t("shell_payNow")}
            </button>
          </div>
        )}

        {/* Topbar */}
        <AppTopbar
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          currentShop={currentShop}
          isOnline={isOnline}
          pendingCount={pendingCount}
          isSyncing={isSyncing}
          onSync={handleSync}
        />

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-surface">{children}</main>
      </div>

      {/* Subscription Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-start">
              <div>
                <h2 className="text-lg font-extrabold text-on-surface">
                  {t("shell_subscriptionPayment")}
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">{t("shell_contactAdmin")}</p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="bg-orange-100 p-2.5 rounded-xl text-primary">
                  <CreditCard size={22} />
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">
                    Easypaisa
                  </p>
                  <p className="text-lg font-extrabold text-on-surface tabular">
                    0309-0391673
                  </p>
                  <p className="text-xs text-slate-500">
                    {t("shell_accountTitle", { name: "Rizwan Ahmed" })}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-slate-500 mb-3 text-center">
                  {t("shell_sendScreenshot")}
                </p>
                <div className="flex gap-3">
                  <a
                    href="https://wa.me/923001234567"
                    target="_blank"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 shadow-sm"
                  >
                    <MessageCircle size={18} /> {t("whatsappSupport")}
                  </a>
                  <a
                    href="tel:03001234567"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50"
                  >
                    <Phone size={18} /> {t("callNow")}
                  </a>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-3 text-center border-t border-slate-100">
              <p className="text-xs text-slate-400">
                {t("shell_supportId", { id: currentShop?.uid ?? "" })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
