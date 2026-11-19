"use client";

import React from "react";
import { Eye, EyeOff, type LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  theme?: "orange" | "green" | "blue" | "red" | "purple" | "amber" | "slate";
  loading?: boolean;
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  progress?: number; // 0 to 100
  isPrivate?: boolean;
  isVisible?: boolean;
  onToggle?: () => void;
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  theme = "orange",
  loading = false,
  trend,
  progress,
  isPrivate,
  isVisible,
  onToggle,
  className = "",
}: StatCardProps) {
  const themeStyles: Record<
    string,
    { iconBg: string; iconColor: string; barColor: string }
  > = {
    orange: {
      iconBg: "bg-orange-50",
      iconColor: "text-primary",
      barColor: "bg-primary",
    },
    green: {
      iconBg: "bg-emerald-50",
      iconColor: "text-tertiary",
      barColor: "bg-tertiary",
    },
    blue: {
      iconBg: "bg-sky-50",
      iconColor: "text-sky-600",
      barColor: "bg-sky-600",
    },
    red: {
      iconBg: "bg-red-50",
      iconColor: "text-error",
      barColor: "bg-error",
    },
    purple: {
      iconBg: "bg-purple-50",
      iconColor: "text-purple-600",
      barColor: "bg-purple-600",
    },
    amber: {
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
      barColor: "bg-amber-600",
    },
    slate: {
      iconBg: "bg-slate-100",
      iconColor: "text-slate-700",
      barColor: "bg-slate-700",
    },
  };

  const currentTheme = themeStyles[theme] || themeStyles.orange;

  return (
    <div
      className={`relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm transition-all duration-200 hover:shadow-md group ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {title}
          </span>
          {loading ? (
            <div className="h-8 w-28 animate-pulse rounded bg-slate-100 mt-1" />
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <span className="tabular truncate text-2xl font-bold tracking-tight text-on-surface">
                {isPrivate && !isVisible ? "••••••" : value}
              </span>
              {isPrivate && (
                <button
                  type="button"
                  onClick={onToggle}
                  className="text-slate-400 hover:text-slate-700 transition-colors"
                  title={isVisible ? "Hide" : "Show"}
                >
                  {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              )}
            </div>
          )}
        </div>
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${currentTheme.iconBg} ${currentTheme.iconColor}`}
        >
          <Icon size={22} />
        </div>
      </div>

      <div className="mt-4 pt-2 flex items-center justify-between text-xs">
        {trend ? (
          <span
            className={`inline-flex items-center gap-1 font-bold ${
              trend.isPositive ? "text-tertiary" : "text-error"
            }`}
          >
            {trend.isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {trend.value} {trend.label && <span className="font-normal text-slate-500">{trend.label}</span>}
          </span>
        ) : (
          <span className="text-slate-500">{subtitle}</span>
        )}
      </div>

      {progress !== undefined && (
        <div className="w-full bg-slate-100 h-1 rounded-full mt-2.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${currentTheme.barColor}`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default StatCard;
