"use client";

import React from "react";

export interface TabItem {
  id: string;
  label: string;
  badge?: string | number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  variant?: "pills" | "underline";
  className?: string;
}

export function Tabs({
  tabs,
  activeTab,
  onChange,
  variant = "pills",
  className = "",
}: TabsProps) {
  if (variant === "underline") {
    return (
      <div className={`flex border-b border-slate-200 gap-6 overflow-x-auto ${className}`}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-on-surface hover:border-slate-300"
              }`}
            >
              {tab.icon && <span>{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                    isActive ? "bg-orange-100 text-primary" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg overflow-x-auto ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
              isActive
                ? "bg-white text-on-surface shadow-xs font-bold"
                : "text-slate-600 hover:text-on-surface hover:bg-slate-200/60"
            }`}
          >
            {tab.icon && <span>{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive ? "bg-orange-100 text-primary" : "bg-slate-200 text-slate-600"
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
