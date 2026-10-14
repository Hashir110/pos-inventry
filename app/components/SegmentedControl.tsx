"use client";

import type { ReactNode } from "react";

interface Option<T extends string> {
  value: T;
  label: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  tone?: "brand" | "emerald" | "amber";
}

const TONES = {
  brand: "border-brand-500 bg-brand-50 text-brand-700",
  emerald: "border-emerald-500 bg-emerald-50 text-emerald-700",
  amber: "border-amber-500 bg-amber-50 text-amber-800",
} as const;

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  tone = "brand",
}: SegmentedControlProps<T>) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
            value === o.value ? TONES[tone] : "border-stone-300 bg-white text-stone-500 hover:bg-stone-50"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
