"use client";

import { useCallback, useEffect, useState } from "react";
import { signInWithPopup, onAuthStateChanged, signOut, type User } from "firebase/auth";
import { getUserShopProfile } from "../app/lib/authService";
import { useStore } from "../app/store/useStore";
import { useRouter } from "next/navigation";
import {
  Boxes,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Receipt,
  ShieldCheck,
  WifiOff,
  ArrowRight,
} from "lucide-react";
import { auth, googleProvider } from "../app/lib/firebase";
import { toast } from "react-toastify";
import { useLanguage } from "./store/useLanguage";
import LanguageSwitcher from "./components/LanguageSwitcher";
import type { Shop } from "./types";

export default function LoginPage() {
  const router = useRouter();
  const { setCurrentUser, setCurrentShop } = useStore();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingUser, setExistingUser] = useState<User | null>(null);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const proceedToDashboard = useCallback(
    async (user: User) => {
      setLoading(true);
      setCurrentUser(user);

      try {
        const shopProfile = await getUserShopProfile(user.uid);
        if (shopProfile) {
          setCurrentShop(shopProfile);
        } else {
          const fallbackShop: Shop = {
            uid: user.uid,
            email: user.email,
            shopName: "Eman Traders",
            businessType: "Wholesale",
            currency: "PKR",
            createdAt: new Date().toISOString(),
          };
          setCurrentShop(fallbackShop);
        }
        router.push("/dashboard");
      } catch (error) {
        console.error("Profile check failed, using Eman Traders fallback:", error);
        const fallbackShop: Shop = {
          uid: user.uid,
          email: user.email,
          shopName: "Eman Traders",
          businessType: "Wholesale",
          currency: "PKR",
          createdAt: new Date().toISOString(),
        };
        setCurrentShop(fallbackShop);
        router.push("/dashboard");
      }
      setLoading(false);
    },
    [router, setCurrentUser, setCurrentShop]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const unlocked = typeof window !== "undefined" && sessionStorage.getItem("eman_access_granted") === "true";
        if (unlocked) {
          proceedToDashboard(user);
        } else {
          setExistingUser(user);
          setLoading(false);
        }
      } else {
        setExistingUser(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [proceedToDashboard]);

  const verifySystemPassword = async (pwd: string): Promise<boolean> => {
    if (!pwd.trim()) {
      toast.error("Please enter the system password");
      return false;
    }

    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("eman_access_granted", "true");
        }
        return true;
      } else {
        toast.error("Incorrect system password! Access denied.");
        return false;
      }
    } catch {
      toast.error("Server authentication failed. Please try again.");
      return false;
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      const isPasswordValid = await verifySystemPassword(password);
      if (!isPasswordValid) {
        setSubmitting(false);
        return;
      }

      // If user is already authenticated with Google in Firebase
      if (existingUser) {
        await proceedToDashboard(existingUser);
        return;
      }

      // Otherwise popup Google sign-in
      const result = await signInWithPopup(auth, googleProvider);
      await proceedToDashboard(result.user);
    } catch (error) {
      console.error("Login Failed", error);
      toast.error(
        t("auth_loginFailed", {
          message: error instanceof Error ? error.message : t("auth_unknownError"),
        })
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchAccount = async () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("eman_access_granted");
    }
    await signOut(auth);
    setExistingUser(null);
    setPassword("");
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-50">
        <Loader2 className="h-10 w-10 animate-spin text-brand-600" />
        <span className="ml-3 text-stone-600 font-medium">{t("auth_loadingSystem")}</span>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-white font-sans">
      <div className="h-full w-full flex flex-col md:flex-row">
        {/* Left Side: Login Form with Password Guard */}
        <div className="w-full md:w-1/2 h-full px-8 md:px-16 lg:px-24 py-8 flex flex-col justify-center bg-white relative overflow-y-auto">
          <div className="absolute top-6 left-6 md:left-16 lg:left-24 flex items-center gap-2">
            <img src="/logoPos.png" alt="ASAAN POS" className="h-[50px] w-auto object-contain" />
          </div>

          <div className="absolute top-6 right-6 md:right-16 lg:right-24">
            <LanguageSwitcher />
          </div>

          <div className="w-full max-w-md mx-auto md:mx-0 mt-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold mb-3">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
              <span>Password-Protected System</span>
            </div>

            <h1 className="text-3xl md:text-4xl font-extrabold text-stone-900 mb-2">
              {existingUser ? "Welcome Back!" : t("loginTitle")}
            </h1>

            <p className="text-stone-500 mb-6 leading-relaxed text-sm md:text-base">
              {existingUser
                ? "Enter your system password to unlock the dashboard."
                : "Enter the system password and sign in with Google to access Eman Traders POS."}
            </p>

            {existingUser && (
              <div className="mb-4 flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate text-stone-700">Account: <strong>{existingUser.email}</strong></span>
                </div>
                <button
                  type="button"
                  onClick={handleSwitchAccount}
                  className="text-brand-600 hover:text-brand-700 font-bold ml-2 shrink-0 hover:underline"
                >
                  Switch
                </button>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5 flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-stone-500" />
                  <span>System Password / پاس ورڈ</span>
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoFocus
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter security password..."
                    className="field pl-10 pr-10 h-12 text-stone-900 font-medium placeholder:font-normal placeholder:text-stone-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {existingUser ? (
                <button
                  type="submit"
                  disabled={submitting || !password.trim()}
                  className="btn-primary w-full !py-3.5 text-base font-bold flex items-center justify-center gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all min-h-[50px] disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin text-white h-5 w-5" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <span>Unlock Dashboard</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="group relative w-full flex items-center justify-center gap-3 bg-white border-2 border-stone-200 p-3.5 rounded-xl hover:border-brand-600 hover:bg-brand-50 transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 py-3.5 disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="animate-spin text-brand-600 h-5 w-5" />
                  ) : (
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
                  )}
                  <span className="font-bold text-stone-700 text-base group-hover:text-brand-700 transition-colors">
                    {submitting ? "Verifying & Signing In..." : "Verify & Continue with Google"}
                  </span>
                </button>
              )}
            </form>

            <div className="mt-8 pt-6 border-t border-stone-100 space-y-3">
              {[
                { icon: Boxes, label: t("featureInventory") },
                { icon: Receipt, label: t("featureBilling") },
                { icon: WifiOff, label: t("featureOffline") },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-xl bg-stone-50 px-4 py-3 text-sm font-medium text-stone-600 hover:bg-brand-50 transition-colors"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm text-brand-600">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="flex-1">{label}</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
              ))}
            </div>
          </div>

          <div className="absolute bottom-6 left-0 right-0 text-center text-xs text-stone-400">
            &copy; {new Date().getFullYear()} ASAAN POS System. {t("rightsReserved")}
          </div>
        </div>

        {/* Right Side: Hero Video and Title */}
        <div className="hidden md:flex w-1/2 h-full bg-ink relative items-center justify-center p-10 overflow-hidden">
          <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-brand-500 rounded-full opacity-50 blur-3xl" />
          <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-ink-700 rounded-full opacity-50 blur-3xl" />

          <div className="relative z-10 text-center text-white flex flex-col items-center">
            <video
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              aria-label={t("auth_heroAlt")}
              className="w-full max-w-[640px] max-h-[48vh] object-contain mb-8"
            >
              <source src="/login-hero.webm" type="video/webm" />
              <source src="/login-hero.mp4" type="video/mp4" />
            </video>

            <h2 className="text-3xl font-bold mb-3">{t("heroTitle")}</h2>
            <p className="text-brand-100 text-lg max-w-sm">{t("heroSubtitle")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
