"use client";
import { Lock, Phone, Clock } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useLanguage } from "../store/useLanguage";

function ExpiredContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const type = searchParams.get("type");

  const isTrial = type === "trial";

  const title = isTrial ? t("auth_trialExpiredTitle") : t("auth_licenseExpiredTitle");

  const message = isTrial ? t("auth_trialExpiredMessage") : t("auth_licenseExpiredMessage");

  const Icon = isTrial ? Clock : Lock;
  const iconColor = isTrial ? "text-orange-600" : "text-red-600";
  const bgIconColor = isTrial ? "bg-orange-100" : "bg-red-100";
  const borderColor = isTrial ? "border-orange-200" : "border-red-200";

  return (
    <div className={`bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border ${borderColor}`}>
      <div className={`mx-auto ${bgIconColor} w-20 h-20 rounded-full flex items-center justify-center mb-6`}>
        <Icon className={`h-10 w-10 ${iconColor}`} />
      </div>

      <h1 className="text-2xl font-extrabold text-stone-900 mb-2">{title}</h1>
      <p className="text-stone-500 mb-6 leading-relaxed">
        {message}
      </p>

      <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
        <p className="text-sm text-stone-500 mb-2">{t("auth_contactSupport")}</p>
        <div className="flex items-center justify-center gap-2 text-xl font-bold text-brand-600 tracking-wide">
          <Phone size={20} />
          <span>0314-2811181</span>
        </div>
      </div>

      <button
        onClick={() => window.location.href = "/"}
        className="mt-6 text-sm text-stone-400 hover:text-stone-700 font-medium underline transition-colors"
      >
        {t("auth_logoutHome")}
      </button>
    </div>
  );
}

function LoadingFallback() {
  const { t } = useLanguage();
  return <div className="text-stone-500">{t("loading")}</div>;
}

export default function LicenseExpiredPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 p-4 text-center">
      <Suspense fallback={<LoadingFallback />}>
        <ExpiredContent />
      </Suspense>
    </div>
  );
}