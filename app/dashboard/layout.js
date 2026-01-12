"use client";

import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { auth, db } from "../lib/firebase";
import { getUserShopProfile } from "../lib/authService";
import { useRouter, usePathname } from "next/navigation";
import { collection, doc, runTransaction, getDoc } from "firebase/firestore"; 
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Settings, 
  LogOut, 
  Menu,
  RefreshCw,
  Store,
  AlertTriangle,
  CreditCard,
  MessageCircle,
  Phone,
  X,
  Wallet
} from "lucide-react";
import Link from "next/link";
// Is line ko code ke top par likhein:
import { toast } from 'react-toastify';
export default function DashboardLayout({ children }) {
  const { currentShop, setCurrentUser, setCurrentShop } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const [licenseStatus, setLicenseStatus] = useState("active"); // 'active', 'warning', 'expired'
  const [daysOverdue, setDaysOverdue] = useState(0);

  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // 1. Session Restore Logic (Agar refresh karein toh data na urr jaye)
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.push("/"); // Login nahi hai toh bhaga do
        return;
      }

      let shopData = currentShop;

      // Agar Store khali hai (Refresh case), toh DB se wapis lao
      if (!shopData) {
        shopData = await getUserShopProfile(user.uid);
        if (shopData) {
            setCurrentUser(user);
            setCurrentShop(shopData);
        } else {
            router.push("/setup");
            return;
        }
      }
      setLoading(false);
      checkLicense(shopData);
    });

    return () => unsubscribe();
  }, [currentShop, router, setCurrentUser, setCurrentShop]);

  // --- FUNCTION: Check License Validity (Fixed) ---
  const checkLicense = (shop) => {
    if (!shop?.licenseExpiry) return; 

    // 1. Dates banao
    const expiryDate = new Date(shop.licenseExpiry);
    const today = new Date();

    // 2. TIME RESET KARO (Dono ko raat 12:00 AM par le ao)
    // Is se sirf tareekh compare hogi, waqt nahi.
    expiryDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    // 3. Difference Calculate karo
    const diffTime = today.getTime() - expiryDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 

    console.log(`License Check: Expiry ${shop.licenseExpiry}, Days Passed: ${diffDays}`); // Console mn check krna

    // --- LOGIC ---
    // Agar diffDays Negative hai (e.g. -5) matlab date abhi ani hai (Active)
    // Agar diffDays 0 hai matlab aaj last date hai (Active)
    
    if (diffDays > 3) {
        // 3 din se zyada hogaye -> BLOCK
        router.push("/license-expired"); 
    } else if (diffDays > 0) {
        // 1, 2, ya 3 din uper hogaye -> WARNING
        setLicenseStatus("warning");
        setDaysOverdue(diffDays);
    } else {
        // Sab theek hai
        setLicenseStatus("active");
    }
  };

  useEffect(() => {
    const checkPending = () => {
        const pending = JSON.parse(localStorage.getItem("pendingSales") || "[]");
        setPendingCount(pending.length);
    };
    checkPending(); // First run
    const interval = setInterval(checkPending, 2000); // Poll every 2 sec
    return () => clearInterval(interval);
  }, []);

  // 3. SYNC FUNCTION (Upload Offline Data)
  const handleSync = async () => {
    if(pendingCount === 0) return;
    setIsSyncing(true);

    const pending = JSON.parse(localStorage.getItem("pendingSales") || "[]");
    
    try {
        // Ek ek karke upload karo
        for (const order of pending) {
            // Note: Offline orders mn stock hum already UI mn minus kar chuke thay
            // lekin DB mn minus nahi hua tha. 
            // Isliye hum wahi same Transaction logic chalayenge jo POS mn tha.
            
            await runTransaction(db, async (transaction) => {
                // Stock Logic
                const reads = [];
                for (const item of order.items) {
                    const productRef = doc(db, "products", item.id);
                    const snapshot = await transaction.get(productRef);
                    reads.push({ snapshot, item });
                }

                const updates = [];
                for (const { snapshot, item } of reads) {
                    if (!snapshot.exists()) throw `Product ${item.name} not found`;
                    const currentStock = snapshot.data().stock;
                    // Stock Minus
                    updates.push({ ref: snapshot.ref, newStock: currentStock - item.qty });
                }

                updates.forEach((update) => {
                    transaction.update(update.ref, { stock: update.newStock });
                });

                // Save Sale
                const saleRef = doc(collection(db, "sales"));
                // Remove 'isOffline' flag before saving
                const { isOffline, ...cleanOrder } = order;
                transaction.set(saleRef, cleanOrder);
            });
        }

        // Success: Clear LocalStorage
        localStorage.setItem("pendingSales", "[]");
        setPendingCount(0);
        toast.success("All Data Synced Successfully!");
        
        // Refresh page to show updated stock
        window.location.reload();

    } catch (error) {
        console.error("Sync Error:", error);
        toast.error("Sync Failed: " + error.message);
    }
    setIsSyncing(false);
  };

  // Logout Function
  const handleLogout = async () => {
    await auth.signOut();
    router.push("/");
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading Shop...</div>;
  }

  // Navigation Links
  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Inventory", href: "/dashboard/inventry", icon: Package },
    { name: "Add Product", href: "/dashboard/inventry/add", icon: Package },
    { name: "POS (Sale)", href: "/dashboard/pos", icon: ShoppingCart },
    { name: "Expenses", href: "/dashboard/expenses", icon: Wallet },
    { name: "Sales History", href: "/dashboard/sales", icon: ShoppingCart }, 
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  return (
   <div className="flex h-screen bg-slate-50 font-sans">
      
      {/* --- SIDEBAR (Modern Dark Theme) --- */}
      <aside 
        className={`${isSidebarOpen ? "w-72" : "w-20"} transition-all duration-300 bg-slate-900 text-white flex flex-col shadow-xl z-20 hidden md:flex`}
      >
        {/* Brand Logo */}
        <div className="h-20 flex items-center px-6 border-b border-slate-800">
           <div className="flex items-center gap-3 overflow-hidden">
             <div className="bg-blue-600 p-2 rounded-lg shrink-0">
               <Store className="text-white" size={24} />
             </div>
             {isSidebarOpen && (
               <div>
                 <h1 className="font-bold text-lg leading-tight truncate w-40">{currentShop?.shopName || "Loading..."}</h1>
                 <p className="text-xs text-slate-400">POS System</p>
               </div>
             )}
           </div>
        </div>

        {/* Sync Status Alert */}
        {pendingCount > 0 && isSidebarOpen && (
            <div className="px-4 mt-6">
                <button 
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="w-full bg-orange-600/20 border border-orange-500/50 text-orange-400 px-4 py-3 rounded-xl flex items-center justify-between gap-2 hover:bg-orange-600/30 transition shadow-inner"
                >
                    <div className="flex items-center gap-2">
                        <RefreshCw size={18} className={isSyncing ? "animate-spin" : ""} />
                        <span className="text-sm font-medium">Sync Needed</span>
                    </div>
                    <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingCount}</span>
                </button>
            </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon size={22} className={isActive ? "text-white" : "group-hover:text-white text-slate-500"} />
                {isSidebarOpen && <span className="font-medium tracking-wide text-sm">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-4 w-full px-4 py-3 text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span className="font-medium text-sm">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 relative">

        {licenseStatus === "warning" && (
            <div className="bg-red-600 text-white px-4 py-3 shadow-md flex items-center justify-between animate-in slide-in-from-top z-40">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-full">
                        <AlertTriangle className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <p className="font-bold text-sm">License Expired!</p>
                        <p className="text-xs text-red-100">
                            Please pay pending dues. System will lock in <b>{4 - daysOverdue} days</b>.
                        </p>
                    </div>
                </div>
                {/* Button opens Modal */}
                <button 
                    onClick={() => setShowPaymentModal(true)}
                    className="bg-white text-red-600 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-red-50"
                >
                    Pay Now / Contact
                </button>
            </div>
        )}
        
        {/* Mobile Header (Only visible on small screens) */}
        <header className="h-16 bg-white border-b px-4 flex items-center justify-between md:hidden shrink-0 z-10">
            <span className="font-bold text-slate-800">{currentShop?.shopName}</span>
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 bg-slate-100 rounded-md">
                <Menu className="text-slate-600" />
            </button>
        </header>

        {/* Page Content Container */}
        <main className="flex-1 overflow-auto p-4 md:p-8">
            {children}
        </main>
      </div>

      {showPaymentModal && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                    <div className="bg-blue-600 p-6 text-white flex justify-between items-start">
                        <div>
                            <h2 className="text-xl font-bold">Subscription Payment</h2>
                            <p className="text-blue-100 text-sm mt-1">Contact Admin to renew license</p>
                        </div>
                        <button onClick={() => setShowPaymentModal(false)} className="bg-blue-500 hover:bg-blue-400 p-1 rounded-full"><X size={20} /></button>
                    </div>
                    
                    <div className="p-6 space-y-6">
                        {/* Account Details */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="bg-green-100 p-2 rounded-full text-green-600">
                                    <CreditCard size={24} />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-bold">Easypaisa / JazzCash</p>
                                    <p className="text-lg font-bold text-gray-800">0300-1234567</p>
                                    <p className="text-xs text-gray-400">Title: Hashir Shaikh</p>
                                </div>
                            </div>
                        </div>

                        {/* Contact Info */}
                        <div className="text-center">
                            <p className="text-sm text-gray-500 mb-4">Payment karne ke baad screenshot WhatsApp karein.</p>
                            
                            <div className="flex gap-3">
                                <a 
                                    href="https://wa.me/923001234567" // Apna number dalein
                                    target="_blank"
                                    className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition"
                                >
                                    <MessageCircle size={20} /> WhatsApp
                                </a>
                                <a 
                                    href="tel:03001234567" 
                                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition"
                                >
                                    <Phone size={20} /> Call Now
                                </a>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 text-center border-t">
                        <p className="text-xs text-gray-400">Support ID: {currentShop?.uid}</p>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}