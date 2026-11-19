"use client";

import React, { useEffect, useState } from "react";
import {
  Menu,
  Store,
  ChevronDown,
  Keyboard,
  Bell,
  RefreshCw,
  Monitor,
} from "lucide-react";
import type { Shop } from "../../types";
import { useLanguage } from "../../store/useLanguage";

export interface AppTopbarProps {
  onToggleSidebar: () => void;
  currentShop: Shop | null;
  isOnline: boolean;
  pendingCount?: number;
  isSyncing?: boolean;
  onSync?: () => void;
}

export function AppTopbar({
  onToggleSidebar,
  currentShop,
  isOnline,
  pendingCount = 0,
  isSyncing = false,
  onSync,
}: AppTopbarProps) {
  const { language, setLanguage, t } = useLanguage();
  const [timeString, setTimeString] = useState<string>("");
  const [dateString, setDateString] = useState<string>("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString("en-PK", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
      setDateString(
        now.toLocaleDateString("en-PK", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      );
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const shopName = currentShop?.shopName || "FreshMart (Main Branch)";
  const cashierName = currentShop?.shopName ? `${currentShop.shopName} (Cashier)` : "Hamza Malik";
  const shopInitial = (currentShop?.shopName || "A").trim().charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
      {/* Left: Hamburger + Branch Location + Online Status */}
      <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors lg:hidden shrink-0"
          aria-label="Toggle Navigation"
        >
          <Menu size={20} />
        </button>

        {/* Branch Location Badge */}
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shrink-0 max-w-[240px] sm:max-w-xs">
          <Store className="text-primary w-4 h-4 shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-semibold text-slate-400 uppercase leading-none">
              {t("shell_branchLocation")}
            </span>
            <span className="text-xs sm:text-sm font-bold text-on-surface truncate leading-tight mt-0.5">
              {shopName}
            </span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
        </div>

        {/* Live Online / Offline Status Pill */}
        <div
          className={`flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-bold uppercase tracking-wider shrink-0 ${
            isOnline
              ? "bg-emerald-50 border-emerald-200 text-tertiary"
              : "bg-red-50 border-red-200 text-error"
          }`}
        >
          <span className="relative flex h-2 w-2">
            {isOnline && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isOnline ? "bg-tertiary" : "bg-error"
              }`}
            />
          </span>
          <span className="text-[11px]">{isOnline ? t("online") : t("offline")}</span>
        </div>

        {/* Pending Sync Button (if any) */}
        {pendingCount > 0 && (
          <button
            type="button"
            onClick={onSync}
            disabled={!isOnline || isSyncing}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold hover:bg-amber-100 transition-colors disabled:opacity-50"
            title={t("syncNeeded")}
          >
            <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
            <span>
              {pendingCount} {t("syncNeeded")}
            </span>
          </button>
        )}

        {/* Counter Info (Desktop) */}
        <div className="hidden 2xl:flex items-center gap-1.5 text-xs text-slate-500">
          <Monitor size={14} className="text-slate-400" />
          <span>{t("shell_counterActive")}</span>
        </div>
      </div>

      {/* Right: Keyboard Shortcuts + Language Toggle + Clock + Notifications + Profile */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        {/* Quick Keyboard Shortcuts (Desktop) */}
        <div className="hidden xl:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600">
          <Keyboard size={14} className="text-primary shrink-0" />
          <span className="font-bold text-primary">F2</span>
          <span>{t("shell_scanBarcode")}</span>
          <span className="text-slate-300">|</span>
          <span className="font-bold text-primary">F4</span>
          <span>{t("shell_holdBill")}</span>
        </div>

        {/* Language Toggle (Segmented Pill) */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-full border border-slate-200">
          <button
            type="button"
            onClick={() => setLanguage("en")}
            className={`px-3 py-1 rounded-full text-xs transition-all ${
              language === "en"
                ? "bg-white text-on-surface font-bold shadow-xs"
                : "text-slate-500 hover:text-on-surface font-medium"
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLanguage("ur")}
            className={`px-3 py-1 rounded-full text-xs transition-all ${
              language === "ur"
                ? "bg-white text-on-surface font-bold shadow-xs font-urdu"
                : "text-slate-500 hover:text-on-surface font-medium font-urdu"
            }`}
          >
            اردو
          </button>
        </div>

        {/* Live PKT Clock */}
        {timeString && (
          <div className="hidden md:flex flex-col text-right tabular text-xs">
            <span className="font-bold text-on-surface leading-tight">
              {timeString} PKT
            </span>
            <span className="text-[10px] text-slate-400">{dateString}</span>
          </div>
        )}

        {/* Notifications */}
        <button
          type="button"
          className="relative p-2 rounded-full text-slate-500 hover:text-on-surface hover:bg-slate-100 transition-colors"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
        </button>

        {/* User Chip */}
        <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-xs text-slate-700">
            {shopInitial}
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-bold text-on-surface leading-tight truncate max-w-[120px]">
              {cashierName}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              {t("shell_cashier")}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default AppTopbar;
