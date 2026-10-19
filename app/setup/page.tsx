"use client";

import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { createShopProfile, getUserShopProfile } from "../lib/authService";
import { auth } from "../lib/firebase";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import type { Shop } from "../types";
import { Loader2 } from "lucide-react";
import { toast } from 'react-toastify';
import { useLanguage } from "../store/useLanguage";

export default function SetupPage() {
  const { setCurrentShop } = useStore();
  const router = useRouter();
  const { t } = useLanguage();

  const [formData, setFormData] = useState({
    shopName: "",
    businessType: "Grocery"
  });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (u) {
        setUser(u);

        let existingShop: Shop | null;
        try {
          existingShop = await getUserShopProfile(u.uid);
        } catch (error) {
          console.error("Profile check failed:", error);
          router.replace("/dashboard");
          return;
        }

        if (existingShop) {
          if (existingShop.licenseExpiry) {
            const now = new Date();
            const expiry = new Date(existingShop.licenseExpiry);

            if (now > expiry) {
              toast.error(t("auth_trialEndedToast"));
              router.replace("/license-expired?type=trial");
              return;
            }
          }

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
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);
    try {
      const today = new Date();
      const expiryDate = new Date(today);
      expiryDate.setDate(expiryDate.getDate() + 30);

      const finalDataToSave = {
        ...formData,
        createdAt: today.toISOString(),
        licenseExpiry: expiryDate.toISOString()
      };

      const savedShop = await createShopProfile(user, finalDataToSave);
      setCurrentShop(savedShop);

      toast.success(t("auth_accountCreated"));
      router.push("/dashboard");

    } catch (error) {
      console.error(error);
      toast.error(t("auth_setupError", { message: error instanceof Error ? error.message : t("auth_setupFailed") }));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-50">
        <Loader2 className="h-10 w-10 animate-spin text-brand-600" />
        <span className="ml-2 text-stone-600">{t("auth_checkingProfile")}</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-card border border-stone-200">
        <h2 className="mb-2 text-2xl font-extrabold text-stone-900">{t("auth_setupTitle")}</h2>
        <p className="mb-6 text-sm text-stone-500">{t("auth_setupWelcome")}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">{t("auth_shopNameLabel")}</label>
            <input
              type="text"
              required
              className="field"
              value={formData.shopName}
              onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
              placeholder={t("auth_shopNamePlaceholder")}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">{t("auth_businessType")}</label>
            <select
              className="field cursor-pointer"
              value={formData.businessType}
              onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
            >
              <option value="Grocery">{t("auth_typeGrocery")}</option>
              <option value="Medical">{t("auth_typeMedical")}</option>
              <option value="Hardware">{t("auth_typeHardware")}</option>
              <option value="General">{t("auth_typeGeneral")}</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full !py-3 font-bold flex items-center justify-center min-h-[46px]"
          >
            {submitting ? <Loader2 className="animate-spin text-white" size={20} /> : t("auth_startShop")}
          </button>
        </form>
      </div>
    </div>
  );
}