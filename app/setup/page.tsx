"use client";

import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { createShopProfile, getUserShopProfile } from "../lib/authService";
import { auth } from "../lib/firebase";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import type { Shop } from "../types";
import { ArrowRight, Building2, CheckCircle2, Loader2, MapPin, Phone, Sparkles, Store } from "lucide-react";
import { toast } from "react-toastify";
import { useLanguage } from "../store/useLanguage";
import LanguageSwitcher from "../components/LanguageSwitcher";

export default function SetupPage() {
  const { setCurrentShop } = useStore();
  const router = useRouter();
  const { t } = useLanguage();

  const [formData, setFormData] = useState({
    shopName: "",
    businessType: "Grocery",
    contact: "",
    address: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (u) {
        setUser(u);

        let existingShop: Shop | null = null;
        try {
          existingShop = await getUserShopProfile(u.uid);
        } catch (error) {
          console.error("Profile check failed:", error);
          router.replace("/dashboard");
          return;
        }

        if (existingShop) {
          setCurrentShop(existingShop);
          router.replace("/dashboard");
        } else {
          setLoading(false);
        }
      } else {
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, [router, setCurrentShop]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!formData.shopName.trim()) {
      toast.error("Please enter your shop name");
      return;
    }

    setSubmitting(true);
    try {
      const today = new Date();
      const finalDataToSave = {
        shopName: formData.shopName.trim(),
        businessType: formData.businessType,
        contact: formData.contact.trim() || undefined,
        address: formData.address.trim() || undefined,
        createdAt: today.toISOString(),
      };

      const savedShop = await createShopProfile(user, finalDataToSave);
      setCurrentShop(savedShop);

      toast.success(t("auth_accountCreated"));
      router.push("/dashboard");
    } catch (error) {
      console.error(error);
      toast.error(
        t("auth_setupError", {
          message: error instanceof Error ? error.message : t("auth_setupFailed"),
        })
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-50">
        <Loader2 className="h-10 w-10 animate-spin text-brand-600" />
        <span className="ml-3 text-stone-600 font-medium">{t("auth_checkingProfile")}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen overflow-x-hidden bg-stone-50/60 font-sans flex flex-col justify-between relative selection:bg-brand-500 selection:text-white">
      {/* Ambient background blur elements matching login */}
      <div className="pointer-events-none fixed top-[-10%] right-[-5%] w-96 h-96 bg-brand-200/40 rounded-full blur-3xl -z-10" />
      <div className="pointer-events-none fixed bottom-[-10%] left-[-5%] w-96 h-96 bg-brand-100/50 rounded-full blur-3xl -z-10" />

      {/* Top Navigation Bar */}
      <header className="w-full px-6 md:px-12 py-5 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <img src="/logoPos.png" alt="ASAAN POS" className="h-[46px] w-auto object-contain" />
        </div>
        <div>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Main Setup Card Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 z-10">
        <div className="w-full max-w-lg bg-white rounded-3xl p-7 md:p-10 shadow-xl border border-stone-200/80 transition-all">
          {/* Header Badge & Title */}
          <div className="flex items-start gap-4 mb-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 border border-brand-200/60 shadow-sm">
              <Store className="h-7 w-7" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-1.5">
                <Sparkles className="h-3 w-3" /> Quick 1-Minute Setup
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-stone-900 tracking-tight">
                {t("auth_setupTitle")}
              </h1>
              <p className="text-sm text-stone-500 mt-1 leading-relaxed">
                {t("auth_setupWelcome")}
              </p>
            </div>
          </div>

          {/* User Account Info Pill */}
          {user?.email && (
            <div className="flex items-center gap-2 mb-6 px-3.5 py-2 rounded-xl bg-stone-50 border border-stone-200/70 text-xs text-stone-600">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span className="truncate font-medium">Logged in as: <strong className="text-stone-800">{user.email}</strong></span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Shop Name */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                {t("auth_shopNameLabel")} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Store className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  required
                  autoFocus
                  className="field pl-10 h-11 text-stone-900 font-medium placeholder:font-normal placeholder:text-stone-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
                  value={formData.shopName}
                  onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                  placeholder={t("auth_shopNamePlaceholder")}
                />
              </div>
            </div>

            {/* Business Type */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                {t("auth_businessType")} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Building2 className="h-4 w-4" />
                </span>
                <select
                  className="field pl-10 h-11 cursor-pointer text-stone-800 font-medium bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
                  value={formData.businessType}
                  onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                >
                  <option value="Grocery">{t("auth_typeGrocery")}</option>
                  <option value="Wholesale">Wholesale / Distribution (تھوک ڈسٹری بیوشن)</option>
                  <option value="Medical">{t("auth_typeMedical")}</option>
                  <option value="Hardware">{t("auth_typeHardware")}</option>
                  <option value="General">{t("auth_typeGeneral")}</option>
                </select>
              </div>
            </div>

            {/* Contact / Phone (Optional) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-stone-700">Phone Number / رابطہ نمبر</label>
                <span className="text-[11px] text-stone-400 font-medium">Optional</span>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Phone className="h-4 w-4" />
                </span>
                <input
                  type="tel"
                  className="field pl-10 h-11 text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  placeholder="0300-1234567"
                />
              </div>
            </div>

            {/* Address (Optional) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-stone-700">Shop Address / دکان کا پتہ</label>
                <span className="text-[11px] text-stone-400 font-medium">Optional</span>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <MapPin className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  className="field pl-10 h-11 text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Market name, City"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full !py-3.5 text-base font-bold flex items-center justify-center gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all min-h-[48px]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin text-white h-5 w-5" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span>{t("auth_startShop")}</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-stone-400 z-10">
        &copy; {new Date().getFullYear()} ASAAN POS System. {t("rightsReserved")}
      </footer>
    </div>
  );
}