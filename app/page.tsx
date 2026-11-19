"use client";

import { useCallback, useEffect, useState } from "react";
import { signInWithPopup, onAuthStateChanged, type User } from "firebase/auth";
import { getUserShopProfile } from "./lib/authService";
import { useStore } from "./store/useStore";
import { useRouter } from "next/navigation";
import {
  Boxes,
  CheckCircle2,
  Loader2,
  Receipt,
  Store,
  WifiOff,
  ShieldCheck,
  KeyRound,
  UserCheck,
  CreditCard,
  Lock,
  ArrowRight,
  Globe,
  Sparkles,
} from "lucide-react";
import { auth, googleProvider } from "./lib/firebase";
import { toast } from "react-toastify";
import { useLanguage } from "./store/useLanguage";

export default function LoginPage() {
  const router = useRouter();
  const { setCurrentUser, setCurrentShop } = useStore();
  const { t, language, setLanguage } = useLanguage();
  const [loading, setLoading] = useState(true);

  // Tab: "admin" (Google login) or "pin" (Cashier Quick PIN)
  const [authTab, setAuthTab] = useState<"admin" | "pin">("admin");
  const [selectedCashier, setSelectedCashier] = useState("Hamza Malik");
  const [pin, setPin] = useState("");
  const [floatAmount, setFloatAmount] = useState("15,000");

  const checkUserProfile = useCallback(
    async (user: User) => {
      setLoading(true);
      setCurrentUser(user);

      try {
        const shopProfile = await getUserShopProfile(user.uid);
        if (shopProfile) {
          setCurrentShop(shopProfile);
          router.push("/dashboard");
        } else {
          router.push("/setup");
        }
      } catch (error) {
        console.error("Profile check failed:", error);
        router.push("/dashboard");
      }
      setLoading(false);
    },
    [router, setCurrentUser, setCurrentShop]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        checkUserProfile(user);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [checkUserProfile]);

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      checkUserProfile(result.user);
    } catch (error) {
      console.error("Login Failed", error);
      toast.error(
        t("auth_loginFailed", {
          message: error instanceof Error ? error.message : t("auth_unknownError"),
        })
      );
    }
  };

  const handlePinSubmit = (enteredPin?: string) => {
    const checkPin = enteredPin ?? pin;
    if (checkPin.length < 4) {
      toast.warn("Please enter a 4-digit PIN");
      return;
    }
    const validPin = process.env.NEXT_PUBLIC_CASHIER_PIN || "0123";
    if (checkPin === validPin) {
      toast.success(`Welcome, ${selectedCashier}! Shift started with PKR ${floatAmount} float.`);
      router.push("/dashboard/pos");
    } else {
      toast.error("Invalid Security PIN! Please try again.");
      setPin("");
    }
  };

  const handleNumpad = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length === 4) {
        setTimeout(() => {
          handlePinSubmit(nextPin);
        }, 200);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
        <span className="ml-2 text-slate-600 font-medium">
          {t("auth_loadingSystem") || "Starting AsaanPOS Cloud Engine..."}
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-10 font-sans">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Brand Header Section */}
        <div className="p-6 sm:p-8 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-600 flex items-center justify-center shadow-md shadow-orange-600/20 text-white font-bold text-xl">
              <Store size={24} />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold tracking-tight text-slate-900">
                  Asaan<span className="text-orange-600">POS</span>
                </span>
                <span className="text-[10px] uppercase font-extrabold bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">
                  Retail Edition PK
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {language === "ur"
                  ? "پاکستان کا جدید ریٹیل و انوینٹری سسٹم"
                  : "Modern Retail & Inventory Engine for Pakistan"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Language Switcher */}
            <div className="flex items-center bg-slate-200 p-0.5 rounded-full text-xs font-semibold">
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`px-3 py-1 rounded-full transition-all ${
                  language === "en" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLanguage("ur")}
                className={`px-3 py-1 rounded-full transition-all ${
                  language === "ur" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                اردو
              </button>
            </div>
          </div>
        </div>

        {/* Tab Toggle: Cashier PIN vs Manager Admin */}
        <div className="p-4 bg-slate-50/50 border-b border-slate-200 flex justify-center">
          <div className="grid grid-cols-2 bg-slate-200 p-1 rounded-xl w-full max-w-md text-xs font-bold">
            <button
              type="button"
              onClick={() => setAuthTab("admin")}
              className={`py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                authTab === "admin"
                  ? "bg-white text-orange-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ShieldCheck size={16} />
              <span>Manager / Admin Google Login</span>
            </button>
            <button
              type="button"
              onClick={() => setAuthTab("pin")}
              className={`py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                authTab === "pin"
                  ? "bg-white text-orange-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <KeyRound size={16} />
              <span>{language === "ur" ? "فوری پن" : "Cashier Quick PIN"}</span>
            </button>
          </div>
        </div>

        {/* TAB 1: MANAGER / ADMIN GOOGLE LOGIN */}
        {authTab === "admin" && (
          <div className="p-8 sm:p-12 flex flex-col items-center text-center max-w-md mx-auto w-full">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mb-4">
              <ShieldCheck size={32} />
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
              {t("loginTitle") || "Welcome to AsaanPOS"}
            </h2>
            <p className="text-xs text-slate-500 mb-8 leading-relaxed">
              {t("loginSubtitle") || "Sign in with your Google account to access your store dashboard, inventory records, and POS terminal."}
            </p>

            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 hover:border-orange-500 p-3.5 rounded-xl transition-all shadow-sm hover:shadow-md py-3.5 text-slate-700 font-bold text-sm"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <span>{t("continueWithGoogle") || "Sign In With Google"}</span>
            </button>

            {/* Offline & Feature assurances */}
            <div className="mt-8 pt-6 border-t border-slate-100 w-full space-y-2 text-left">
              {[
                { icon: Boxes, label: "Real-time Multi-Warehouse Inventory" },
                { icon: Receipt, label: "Instant Thermal Slip & FBR e-Tax Ready" },
                { icon: WifiOff, label: "Autonomous Offline Till Support" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 text-xs font-semibold text-slate-700"
                >
                  <Icon className="text-orange-600 shrink-0" size={16} />
                  <span className="flex-1">{label}</span>
                  <CheckCircle2 className="text-emerald-600 shrink-0" size={14} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: CASHIER QUICK PIN */}
        {authTab === "pin" && (
          <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Left: Cashier Selection & Float */}
            <div className="flex flex-col gap-5">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Select On-Duty Cashier:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { name: "Hamza Malik", shift: "Morning", init: "HM" },
                    { name: "Bilal Raza", shift: "Evening", init: "BR" },
                    { name: "Ayesha Bibi", shift: "Relief", init: "AB" },
                  ].map((c) => {
                    const isSelected = selectedCashier === c.name;
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setSelectedCashier(c.name)}
                        className={`p-3 rounded-xl border flex flex-col items-center text-center transition-all ${
                          isSelected
                            ? "bg-orange-50 border-orange-500 text-orange-700 shadow-xs"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-full font-bold text-xs flex items-center justify-center mb-1.5 ${
                            isSelected ? "bg-orange-600 text-white" : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {c.init}
                        </div>
                        <span className="font-bold text-xs truncate max-w-full">{c.name}</span>
                        <span className="text-[10px] text-slate-400">{c.shift}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Starting Float */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1">
                <span className="text-xs font-bold text-slate-800">
                  {language === "ur" ? "افتتاحی کیش رقم" : "Starting Drawer Cash Float"}
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold text-slate-400">PKR</span>
                  <input
                    type="text"
                    value={floatAmount}
                    onChange={(e) => setFloatAmount(e.target.value)}
                    className="w-full py-1 px-2.5 font-bold text-sm bg-white border border-slate-200 rounded text-slate-900"
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  Initial float verified for till opening.
                </span>
              </div>
            </div>

            {/* Right: 4-digit PIN Pad */}
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-slate-700 mb-2">
                Enter 4-Digit Security PIN
              </span>

              {/* PIN Bubbles */}
              <div className="flex items-center gap-3 mb-5">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full border-2 transition-all ${
                      pin.length > idx
                        ? "bg-orange-600 border-orange-600 scale-110 shadow-xs"
                        : "border-slate-300 bg-white"
                    }`}
                  />
                ))}
              </div>

              {/* Numpad Grid */}
              <div className="grid grid-cols-3 gap-2.5 max-w-[220px] w-full">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "←"].map((btn) => (
                  <button
                    key={btn}
                    type="button"
                    onClick={() => {
                      if (btn === "C") setPin("");
                      else if (btn === "←") handleBackspace();
                      else handleNumpad(btn);
                    }}
                    className="h-12 rounded-xl bg-slate-50 hover:bg-orange-50 hover:text-orange-600 border border-slate-200 font-bold text-base text-slate-800 transition-colors shadow-xs active:scale-95"
                  >
                    {btn}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} AsaanPOS Cloud Retail Engine • All Rights Reserved
        </div>
      </div>
    </div>
  );
}
