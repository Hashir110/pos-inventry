"use client";

import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { createShopProfile, getUserShopProfile } from "../lib/authService"; // getUserShopProfile import kiya
import { auth } from "../lib/firebase";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
// Is line ko code ke top par likhein:
import { toast } from 'react-toastify';
export default function SetupPage() {
  const { setCurrentShop } = useStore();
  const router = useRouter();

  const [formData, setFormData] = useState({
    shopName: "",
    businessType: "Grocery"
  });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true); // Loading state add ki
  const [user, setUser] = useState(null);

  // 1. Security Check (User + Existing Shop)
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (u) {
        setUser(u);

        // CHECK: Kya is bande ki shop pehle se hai?
        const existingShop = await getUserShopProfile(u.uid);

        if (existingShop) {
          // --- 🔥 EXPIRE CHECK (Agar koi direct /setup URL type karke aaye) ---
          if (existingShop.licenseExpiry) {
            const now = new Date();
            const expiry = new Date(existingShop.licenseExpiry);

            if (now > expiry) {
              toast.error("Aapka Trial khatam ho chuka hai!");
              router.replace("/expired?type=trial"); // Expired page par bhej do
              return;
            }
          }
          // -----------------------------------------------------------------

          // Agar shop hai aur trial bacha hai, toh Dashboard!
          setCurrentShop(existingShop);
          router.replace("/dashboard");
        } else {
          // Agar shop nahi hai, tabhi form dikhao
          setLoading(false);
        }
      } else {
        // Login hi nahi hai toh bahar nikalo
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);
    try {
      // --- 🔥 7 DAYS TRIAL LOGIC ---
      const today = new Date();
      const expiryDate = new Date(today);
      expiryDate.setDate(expiryDate.getDate() + 3); // 3 din add kiye

      // Form data mein dates mix karein
      const finalDataToSave = {
        ...formData,
        createdAt: today.toISOString(),
        licenseExpiry: expiryDate.toISOString() // Ye database mein save hoga
      };
      // -----------------------------

      // 1. Firebase mn save karo (Ab finalDataToSave bhejna hai)
      await createShopProfile(user, finalDataToSave);

      // 2. Store update karo
      setCurrentShop({ ...finalDataToSave, uid: user.uid });

      // 3. Dashboard bhejo
      toast.success("Account Created! 3-Day Free Trial Started 🎉");
      router.push("/dashboard");

    } catch (error) {
      console.error(error);
      toast.error("Error: " + error.message);
    } finally {
      setSubmitting(false); // Finally block use karna zyada behtar hai
    }
  };

  // Jab tak check chal raha hai, Loading dikhao
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Checking Profile...</span>
      </div>
    );
  }

  // Asli Form (Jo sirf New Users ko dikhega)
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
        <h2 className="mb-6 text-2xl font-bold text-gray-800">Shop Setup</h2>
        <p className="mb-4 text-sm text-gray-500">Welcome! Apni dukan setup karein.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Dukan ka Naam</label>
            <input
              type="text"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={formData.shopName}
              onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
              placeholder="e.g. Bismillah General Store"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Business Type</label>
            <select
              className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={formData.businessType}
              onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
            >
              <option value="Grocery">Grocery / Kiryana</option>
              <option value="Medical">Medical Store</option>
              <option value="Hardware">Hardware Store</option>
              <option value="General">General / Other</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            {submitting ? "Creating..." : "Start Shop"}
          </button>
        </form>
      </div>
    </div>
  );
}