"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  RotateCcw,
  ClipboardCheck,
  Package,
  Boxes,
  ShoppingBag,
  FileText,
  Users,
  Truck,
  UserCheck,
  Wallet,
  Bike,
  BarChart3,
  Settings,
  LogOut,
  X,
  Store,
} from "lucide-react";
import type { Shop } from "../../types";
import { useLanguage } from "../../store/useLanguage";

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  shortcut?: string;
  badge?: string;
  badgeVariant?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentShop: Shop | null;
  onLogout: () => void;
}

export function AppSidebar({ isOpen, onClose, currentShop, onLogout }: AppSidebarProps) {
  const pathname = usePathname();
  const { t, language } = useLanguage();

  const isRtl = language === "ur";

  const navigationGroups: NavGroup[] = [
    {
      title: t("shell_navOverview"),
      items: [
        {
          name: t("navDashboard"),
          href: "/dashboard",
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: t("shell_navSalesRegister"),
      items: [
        {
          name: t("shell_navPosRegister"),
          href: "/dashboard/pos",
          icon: ShoppingCart,
          shortcut: "F1",
        },
        {
          name: t("shell_navSalesHistory"),
          href: "/dashboard/sales",
          icon: Receipt,
        },
        {
          name: t("shell_navReturns"),
          href: "/dashboard/returns",
          icon: RotateCcw,
        },
        {
          name: t("shell_navDailyClosingZ"),
          href: "/dashboard/daily-closing",
          icon: ClipboardCheck,
        },
      ],
    },
    {
      title: t("shell_navStockWarehousing"),
      items: [
        {
          name: t("shell_navProductsCatalog"),
          href: "/dashboard/inventry",
          icon: Package,
        },
        {
          name: t("shell_navStockAudit"),
          href: "/dashboard/stock-audit",
          icon: Boxes,
        },
        {
          name: t("shell_navPurchasesOrders"),
          href: "/dashboard/purchases",
          icon: ShoppingBag,
        },
        {
          name: t("shell_navGatePass"),
          href: "/dashboard/gate-pass",
          icon: FileText,
        },
      ],
    },
    {
      title: t("shell_navStakeholders"),
      items: [
        {
          name: t("shell_navCustomersKhata"),
          href: "/dashboard/udhar",
          icon: Users,
          badge: t("shell_due"),
          badgeVariant: "emerald",
        },
        {
          name: t("shell_navSuppliers"),
          href: "/dashboard/suppliers",
          icon: Truck,
        },
        {
          name: t("shell_navStaffShifts"),
          href: "/dashboard/staff",
          icon: UserCheck,
        },
      ],
    },
    {
      title: t("shell_navAccountsSystem"),
      items: [
        {
          name: t("shell_navDailyExpenses"),
          href: "/dashboard/expenses",
          icon: Wallet,
        },
        {
          name: t("shell_navDeliveries"),
          href: "/dashboard/deliveries",
          icon: Bike,
        },
        {
          name: t("shell_navAnalyticsReports"),
          href: "/dashboard/reports",
          icon: BarChart3,
        },
        {
          name: t("shell_navSystemSettings"),
          href: "/dashboard/settings",
          icon: Settings,
        },
      ],
    },
  ];

  const cashierName = currentShop?.shopName ? `${currentShop.shopName} (Cashier)` : "Hamza Malik";
  const shopInitial = (currentShop?.shopName || "A").trim().charAt(0).toUpperCase();

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 z-50 flex flex-col justify-between w-72 bg-white border-r border-slate-200 shadow-sm transition-transform duration-200 ease-in-out ${
          isRtl ? "right-0 border-l border-r-0" : "left-0"
        } ${
          isOpen
            ? "translate-x-0"
            : isRtl
            ? "translate-x-full lg:translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Top Header: Brand Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-100 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-white font-black text-lg shadow-sm">
              <Store size={20} />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-tight text-on-surface leading-tight">
                AsaanPOS
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t("shell_retailEdition")}
              </span>
            </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        {/* Middle: Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          {navigationGroups.map((group, gIdx) => (
            <div key={`group-${gIdx}`} className="space-y-1">
              <div className="px-3 py-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {group.title}
                </span>
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      if (window.innerWidth < 1024) onClose();
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
                      isActive
                        ? "bg-primary text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-on-surface"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        size={18}
                        className={`shrink-0 ${
                          isActive ? "text-white" : "text-slate-500 group-hover:text-on-surface"
                        }`}
                      />
                      <span className="truncate">{item.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.shortcut && (
                        <span
                          className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-orange-100 text-primary"
                          }`}
                        >
                          {item.shortcut}
                        </span>
                      )}
                      {item.badge && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom: Cashier Profile & Shift Card */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-slate-700 shrink-0">
              {shopInitial}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-on-surface truncate">
                  {cashierName}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                  {t("shell_cashier")}
                </span>
              </div>
              <span className="text-xs text-slate-500 truncate">
                {t("shell_shift")}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-slate-400">
                {t("shell_drawerFloat")}
              </span>
              <span className="text-xs font-bold text-tertiary tabular">
                PKR 15,000
              </span>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-error bg-red-50 hover:bg-red-100 transition-colors"
            >
              <LogOut size={14} />
              <span>{t("shell_endShift")}</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export default AppSidebar;
