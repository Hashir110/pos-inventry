"use client";

import { useLanguage } from "../store/useLanguage";
import { Globe } from "lucide-react";

export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { language, setLanguage } = useLanguage();

  return (
    <div className={`inline-flex items-center gap-1 rounded-xl bg-stone-100 p-1 border border-stone-200 ${className}`}>
      <button
        onClick={() => setLanguage("en")}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
          language === "en"
            ? "bg-white text-brand-600 shadow-sm border border-stone-200"
            : "text-stone-500 hover:text-stone-900"
        }`}
        title="Switch to English"
      >
        <span>English</span>
      </button>

      <button
        onClick={() => setLanguage("ur")}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
          language === "ur"
            ? "bg-white text-brand-600 shadow-sm border border-stone-200"
            : "text-stone-500 hover:text-stone-900"
        }`}
        title="اردو میں تبدیل کریں"
      >
        <span>اردو</span>
      </button>
    </div>
  );
}
