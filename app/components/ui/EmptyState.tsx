"use client";

import React from "react";
import { type LucideIcon, PackageOpen } from "lucide-react";

export interface EmptyStateProps {
  icon?: LucideIcon | React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = PackageOpen,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  const isLucideIcon = typeof Icon === "function" || (typeof Icon === "object" && Icon !== null && "render" in Icon);

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl border border-dashed border-slate-200 bg-white ${className}`}
    >
      <div className="w-12 h-12 rounded-xl bg-orange-50 text-primary flex items-center justify-center mb-3">
        {isLucideIcon ? React.createElement(Icon as LucideIcon, { size: 24 }) : (Icon as React.ReactNode)}
      </div>
      <h4 className="text-base font-bold text-on-surface">{title}</h4>
      {description && (
        <p className="text-xs text-on-surface-variant max-w-sm mt-1 mb-4">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export default EmptyState;
