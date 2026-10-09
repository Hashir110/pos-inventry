"use client";

import { Eye, EyeOff, type LucideIcon } from "lucide-react";

export interface StatCardProps {
    title: string;
    value: string | number;
    subtitle: string;
    icon: LucideIcon;
    theme: string; // styles mein na ho to blue fallback
    loading: boolean;
    isPrivate?: boolean;
    isVisible?: boolean;
    onToggle?: () => void;
}
export default function StatCard({ title, value, subtitle, icon: Icon, theme, loading, isPrivate, isVisible, onToggle }: StatCardProps) {
    // Card safed rehta hai, sirf icon chip ka rang theme ke hisaab se badalta hai
    const chips: Record<string, string> = {
        blue: "bg-brand-100 text-brand-700",
        green: "bg-emerald-100 text-emerald-700",
        emerald: "bg-emerald-100 text-emerald-700",
        red: "bg-red-100 text-red-700",
        orange: "bg-orange-100 text-orange-700",
        amber: "bg-amber-100 text-amber-700",
        purple: "bg-violet-100 text-violet-700",
        cyan: "bg-sky-100 text-sky-700",
    };
    const chip = chips[theme] ?? chips.blue;

    return (
        <div className="flex h-32 flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5 shadow-card transition-shadow hover:shadow-pop">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-stone-400">{title}</p>
                    {loading ? (
                        <div className="h-8 w-24 animate-pulse rounded bg-stone-200"></div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <h3 className="tabular truncate text-2xl font-extrabold tracking-tight text-stone-900">
                                {isPrivate && !isVisible ? "••••" : value}
                            </h3>
                            {isPrivate && (
                                <button onClick={onToggle} className="text-stone-400 hover:text-stone-700" title={isVisible ? "Chhupayein" : "Dikhayein"}>
                                    {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            )}
                        </div>
                    )}
                </div>
                <div className={`shrink-0 rounded-xl p-2.5 ${chip}`}>
                    <Icon size={20} />
                </div>
            </div>
            <p className="truncate text-xs font-medium text-stone-500">{subtitle}</p>
        </div>
    );
}