import { create } from "zustand";
import { translations, Language, TranslationKey } from "../lib/i18n/translations";

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const getInitialLanguage = (): Language => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("app_language") as Language;
    if (saved === "en" || saved === "ur") return saved;
  }
  return "en";
};

export const useLanguage = create<LanguageState>((set, get) => ({
  language: getInitialLanguage(),

  setLanguage: (lang) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("app_language", lang);
      document.documentElement.dir = lang === "ur" ? "rtl" : "ltr";
      document.documentElement.lang = lang;
    }
    set({ language: lang });
  },

  t: (key, params) => {
    const lang = get().language;
    let text: string = translations[lang]?.[key] || translations.en[key] || key;

    if (params) {
      Object.entries(params).forEach(([paramKey, paramVal]) => {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(paramVal));
      });
    }

    return text;
  },
}));
