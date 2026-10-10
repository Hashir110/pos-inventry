"use client"; // Client side logic k liye zaroori hai

import { useCallback, useEffect, useState } from "react";
import { signInWithPopup, onAuthStateChanged, type User } from "firebase/auth";
import { getUserShopProfile } from "../app/lib/authService"; // Jo pichle step mn banaya tha
import { useStore } from "../app/store/useStore"; // Global state
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Store } from "lucide-react"; // Icons
import { auth, googleProvider } from "../app/lib/firebase";
import { toast } from 'react-toastify';
import { useLanguage } from "./store/useLanguage";
import LanguageSwitcher from "./components/LanguageSwitcher";

export default function LoginPage() {
  const router = useRouter();
  const { setCurrentUser, setCurrentShop } = useStore();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);

  // 1. Profile Check Logic
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
        // Offline/network error: dashboard khud cache se load karne ki koshish karega ya retry dikhayega
        console.error("Profile check failed:", error);
        router.push("/dashboard");
      }
      setLoading(false);
    },
    [router, setCurrentUser, setCurrentShop]
  );

  // 2. Check if user is already logged in
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
  // 3. Google Login Handler
  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      checkUserProfile(result.user);
    } catch (error) {
      console.error("Login Failed", error);
      toast.error("Login Failed: " + (error instanceof Error ? error.message : "unknown error"));
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-50">
        <Loader2 className="h-10 w-10 animate-spin text-brand-600" />
        <span className="ml-2 text-stone-600 font-medium">Loading System...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4 font-sans">
      
      {/* Main Card Container */}
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-5xl w-full flex flex-col md:flex-row min-h-[600px]">
        
        {/* --- LEFT SIDE: LOGIN FORM --- */}
        <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-white relative">
          
          {/* Logo / Brand Top Left & Language Switcher Top Right */}
          <div className="absolute top-6 left-6 flex items-center gap-2">
             <img src="/logoPos.png" alt="ASAAN POS" className="h-[50px] w-auto object-contain" />
          </div>

          <div className="absolute top-6 right-6">
             <LanguageSwitcher />
          </div>

          <div className="mt-12 md:mt-6">
            <h1 className="text-3xl md:text-4xl font-extrabold text-stone-900 mb-3 mt-8">
              {t("loginTitle")}
            </h1>
            
            <p className="text-stone-500 mb-6 leading-relaxed text-sm md:text-base">
              {t("loginSubtitle")}
            </p>

            {/* Login Button */}
            <button
              onClick={handleGoogleLogin}
              className="group relative w-full flex items-center justify-center gap-3 bg-white border-2 border-stone-200 p-3.5 rounded-xl hover:border-brand-600 hover:bg-brand-50 transition-all duration-300 shadow-sm hover:shadow-md"
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
              <span className="font-bold text-stone-700 text-base md:text-lg group-hover:text-brand-700 transition-colors">
                {t("continueWithGoogle")}
              </span>
            </button>

            {/* Features List */}
            <div className="mt-8 space-y-2.5">
                <div className="flex items-center gap-2 text-sm text-stone-500">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>{t("featureInventory")}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-stone-500">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>{t("featureBilling")}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-stone-500">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>{t("featureOffline")}</span>
                </div>
            </div>
          </div>
          
          <div className="mt-auto pt-6 text-center text-xs text-stone-400">
            &copy; {new Date().getFullYear()} ASAAN POS System. {t("rightsReserved")}
          </div>
        </div>

        {/* --- RIGHT SIDE: ILLUSTRATION --- */}
        <div className="hidden md:flex w-1/2 bg-ink relative items-center justify-center p-10 overflow-hidden">
            <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-brand-500 rounded-full opacity-50 blur-3xl"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-ink-700 rounded-full opacity-50 blur-3xl"></div>
            
            <div className="relative z-10 text-center text-white flex flex-col items-center">
                <img 
                    src="/login-image.png" 
                    alt="POS Dashboard 3D Character"
                    className="w-full max-w-[400px] object-contain mb-6 drop-shadow-2xl animate-in slide-in-from-right duration-700 hover:scale-105 transition-transform"
                />
                
                <h2 className="text-3xl font-bold mb-3">{t("heroTitle")}</h2>
                <p className="text-brand-100 text-lg max-w-sm">
                    {t("heroSubtitle")}
                </p>
            </div>
        </div>

      </div>
    </div>
  );
}
