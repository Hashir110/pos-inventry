"use client";

import React from "react";

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
  footer?: React.ReactNode;
}

export function Card({
  title,
  subtitle,
  action,
  padding = "md",
  footer,
  children,
  className = "",
  ...props
}: CardProps) {
  const paddingStyles: Record<string, string> = {
    none: "p-0",
    sm: "p-3",
    md: "p-4 sm:p-5",
    lg: "p-6 sm:p-8",
  };

  const hasHeader = title || subtitle || action;

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden ${className}`}
      {...props}
    >
      {hasHeader && (
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-white">
          <div>
            {title && <h3 className="text-base font-bold text-on-surface">{title}</h3>}
            {subtitle && <p className="text-xs text-on-surface-variant mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0 ml-3">{action}</div>}
        </div>
      )}
      <div className={paddingStyles[padding]}>{children}</div>
      {footer && (
        <div className="border-t border-slate-100 px-5 py-3 bg-slate-50/50 flex items-center justify-between">
          {footer}
        </div>
      )}
    </div>
  );
}

export default Card;
