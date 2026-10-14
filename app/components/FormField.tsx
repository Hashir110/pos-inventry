import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export default function FormField({ label, required, hint, children, className = "" }: FormFieldProps) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-bold text-stone-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-stone-400">{hint}</p>}
    </div>
  );
}
