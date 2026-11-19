"use client";

import React, { forwardRef } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  shortcut?: string;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  tabular?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      shortcut,
      icon,
      trailingIcon,
      tabular = false,
      className = "",
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-on-surface">
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full">
          {icon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-slate-400">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={`w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-on-surface placeholder:text-slate-400 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${
              icon ? "pl-10" : ""
            } ${shortcut || trailingIcon ? "pr-14" : ""} ${
              tabular || props.type === "number" ? "tabular" : ""
            } ${
              error
                ? "border-error focus:ring-error"
                : "border-slate-300 hover:border-slate-400"
            } ${className}`}
            {...props}
          />
          {(shortcut || trailingIcon) && (
            <div className="absolute right-2.5 flex items-center gap-1">
              {shortcut && (
                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                  {shortcut}
                </span>
              )}
              {trailingIcon && <span className="text-slate-400">{trailingIcon}</span>}
            </div>
          )}
        </div>
        {error && <p className="text-xs font-medium text-error">{error}</p>}
        {!error && hint && <p className="text-xs text-on-surface-variant">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
