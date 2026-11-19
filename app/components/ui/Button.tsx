"use client";

import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "ghost" | "tertiary";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  shortcut?: string;
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      icon,
      iconPosition = "left",
      shortcut,
      isLoading = false,
      fullWidth = false,
      disabled,
      className = "",
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-150 select-none active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100";

    const variantStyles: Record<ButtonVariant, string> = {
      primary: "bg-primary text-white hover:bg-primary-hover shadow-sm",
      secondary: "bg-surface-low text-on-surface hover:bg-surface-high border border-slate-200 shadow-sm",
      outline: "bg-transparent text-on-surface hover:bg-surface-low border border-slate-300",
      danger: "bg-error text-white hover:bg-error-hover shadow-sm",
      tertiary: "bg-tertiary text-white hover:bg-tertiary-hover shadow-sm",
      ghost: "bg-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-low",
    };

    const sizeStyles: Record<ButtonSize, string> = {
      sm: "h-8 px-3 text-xs gap-1.5",
      md: "h-10 px-4 text-sm gap-2",
      lg: "h-12 px-5 text-base gap-2.5",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${
          fullWidth ? "w-full" : ""
        } ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {!isLoading && icon && iconPosition === "left" && <span className="shrink-0">{icon}</span>}
        {children && <span>{children}</span>}
        {!isLoading && icon && iconPosition === "right" && <span className="shrink-0">{icon}</span>}
        {shortcut && (
          <span
            className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ml-1 ${
              variant === "primary" || variant === "danger" || variant === "tertiary"
                ? "bg-white/20 text-white"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            {shortcut}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
