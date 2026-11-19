"use client";

import React from "react";

export type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral" | "primary";
export type BadgeSize = "sm" | "md";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

export function Badge({
  children,
  variant = "neutral",
  size = "md",
  dot = false,
  className = "",
  ...props
}: BadgeProps) {
  const variantStyles: Record<BadgeVariant, { bg: string; text: string; border: string; dot: string }> = {
    success: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
      dot: "bg-emerald-500",
    },
    warning: {
      bg: "bg-amber-50",
      text: "text-amber-800",
      border: "border-amber-200",
      dot: "bg-amber-500",
    },
    danger: {
      bg: "bg-red-50",
      text: "text-red-700",
      border: "border-red-200",
      dot: "bg-red-500",
    },
    info: {
      bg: "bg-sky-50",
      text: "text-sky-700",
      border: "border-sky-200",
      dot: "bg-sky-500",
    },
    neutral: {
      bg: "bg-slate-100",
      text: "text-slate-700",
      border: "border-slate-200",
      dot: "bg-slate-400",
    },
    primary: {
      bg: "bg-orange-50",
      text: "text-primary font-bold",
      border: "border-orange-200",
      dot: "bg-primary",
    },
  };

  const current = variantStyles[variant];

  const sizeStyles: Record<BadgeSize, string> = {
    sm: "text-[11px] px-2 py-0.5 font-semibold",
    md: "text-xs px-2.5 py-0.5 font-semibold",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${current.bg} ${current.text} ${current.border} ${sizeStyles[size]} tracking-wide ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${current.dot}`} />}
      <span>{children}</span>
    </span>
  );
}

export default Badge;
