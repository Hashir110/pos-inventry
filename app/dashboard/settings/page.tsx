"use client";

import { useState, useEffect } from "react";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../store/useLanguage";
import { updateShopProfile } from "../../lib/services/shop";
import { clearCollection } from "../../lib/services/sales";
import {
  Save,
  Store,
  Printer,
  Trash2,
  Loader2,
  AlertTriangle,
  Phone,
  MapPin,
  Receipt,
  Globe,
  Sliders,
  CheckCircle2,
  Building,
  ShieldAlert,
} from "lucide-react";
import { toast } from "react-toastify";
import { useDialog } from "../../components/DialogProvider";

export default function SettingsPage() {
  const { confirm } = useDialog();
  const { currentUser, currentShop, setCurrentShop } = useStore();
  const { t, language, setLanguage } = useLanguage();
  const isRTL = language === "ur";

  const [loading, setLoading] = useState(false);
  const [clearingData, setClearingData] = useState(false);

  const [formData, setFormData] = useState({
    shopName: "",
    contact: "",
    address: "",
    receiptMessage: "",
    printerSize: "58mm",
  });

  useEffect(() => {
    if (currentShop) {
      setFormData({
        shopName: currentShop.shopName || "",
        contact: currentShop.contact || "",
        address: currentShop.address || "",
        receiptMessage: currentShop.receiptMessage || "",
        printerSize: localStorage.getItem("printerSize") || "58mm",
      });
    }
  }, [currentShop]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setLoading(true);

    try {
      const fields = {
        shopName: formData.shopName,
        contact: formData.contact,
        address: formData.address,
        receiptMessage: formData.receiptMessage,
      };
      await updateShopProfile(currentUser.uid, fields);
      localStorage.setItem("printerSize", formData.printerSize);

      setCurrentShop({
        ...currentShop!,
        shopName: formData.shopName,
        contact: formData.contact,
        address: formData.address,
        receiptMessage: formData.receiptMessage,
      });

      toast.success(t("settings_saved") || "Settings saved successfully");
    } catch (error) {
      console.error(error);
      toast.error(t("settings_saveError") || "Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  const handleClearData = async (collectionName: "products" | "sales") => {
    const label = collectionName === "products" ? "Inventory Catalog" : "Sales History";
    if (!currentUser) return;
    const ok = await confirm({
      title: `Purge ${label}`,
      message: `CAUTION: This will permanently delete all records in ${label}. This cannot be undone. Type DELETE to proceed:`,
      confirmLabel: "Permanently Delete",
      tone: "danger",
      requireText: "DELETE",
    });
    if (!ok) return;

    setClearingData(true);
    try {
      await clearCollection(currentUser.uid, collectionName);
      toast.success(`All ${label} records purged.`);
      setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      console.error(error);
      toast.error("Failed to purge collection");
    } finally {
      setClearingData(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-5xl">
      {/* 1. TOP HEADER */}
      <div className="flex flex-col">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {t("storeSettings") || "System Settings & Configuration"}
          </h1>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Configure shop identity, receipt header & footer, thermal printer width, and bilingual language preference.
        </p>
      </div>

      <form onSubmit={handleSaveProfile} className="flex flex-col gap-6">
        {/* SECTION 1: SHOP & BRANCH PROFILE */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center gap-2.5">
            <Store className="text-orange-600" size={18} />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Store Profile & Receipt Header</h2>
              <p className="text-[11px] text-slate-500">Printed on all customer thermal invoices and reports</p>
            </div>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Shop / Business Name *</label>
              <input
                type="text"
                required
                value={formData.shopName}
                onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                placeholder="e.g. FreshMart Superstore"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-900 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Official Contact Phone</label>
              <input
                type="text"
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                placeholder="e.g. 0300-1234567 / 042-35710000"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-900 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">Store Physical Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="e.g. Shop # 14-16, Commercial Market, Gulberg III, Lahore"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-900 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">
                Receipt Footer Custom Message / Return Policy
              </label>
              <textarea
                rows={2}
                value={formData.receiptMessage}
                onChange={(e) => setFormData({ ...formData, receiptMessage: e.target.value })}
                placeholder="e.g. شکریہ برائے تشریف آوری! خریدا ہوا مال 7 یوم میں رسید کے ساتھ تبدیل ہو سکتا ہے۔"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-900 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: THERMAL PRINTER HARDWARE CONFIGURATION */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center gap-2.5">
            <Printer className="text-orange-600" size={18} />
            <div>
              <h2 className="text-sm font-bold text-slate-900">POS Hardware & Thermal Printer Width</h2>
              <p className="text-[11px] text-slate-500">Configure standard paper roll dimensions for cashier slip printing</p>
            </div>
          </div>

          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <label
              className={`p-4 rounded-xl border-2 flex items-center gap-3.5 cursor-pointer transition-all ${
                formData.printerSize === "58mm"
                  ? "border-orange-500 bg-orange-50/50 shadow-xs"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="printerSize"
                checked={formData.printerSize === "58mm"}
                onChange={() => setFormData({ ...formData, printerSize: "58mm" })}
                className="accent-orange-600"
              />
              <div className="flex flex-col">
                <span className="font-bold text-slate-900 text-sm">58mm Thermal Roll (2-inch Standard)</span>
                <span className="text-slate-500 text-[11px]">Compact receipt printer suitable for mini counter till</span>
              </div>
            </label>

            <label
              className={`p-4 rounded-xl border-2 flex items-center gap-3.5 cursor-pointer transition-all ${
                formData.printerSize === "80mm"
                  ? "border-orange-500 bg-orange-50/50 shadow-xs"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="printerSize"
                checked={formData.printerSize === "80mm"}
                onChange={() => setFormData({ ...formData, printerSize: "80mm" })}
                className="accent-orange-600"
              />
              <div className="flex flex-col">
                <span className="font-bold text-slate-900 text-sm">80mm Thermal Roll (3-inch Standard)</span>
                <span className="text-slate-500 text-[11px]">Full width receipt with larger barcodes and Urdu details</span>
              </div>
            </label>
          </div>
        </div>

        {/* SECTION 3: SYSTEM LANGUAGE PREFERENCE */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center gap-2.5">
            <Globe className="text-orange-600" size={18} />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Language & Regional Format</h2>
              <p className="text-[11px] text-slate-500">Switch app user interface between English and Urdu (Nastaliq RTL)</p>
            </div>
          </div>

          <div className="p-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
                language === "en"
                  ? "bg-orange-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              English (Left-to-Right)
            </button>
            <button
              type="button"
              onClick={() => setLanguage("ur")}
              className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
                language === "ur"
                  ? "bg-orange-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              اردو (RTL)
            </button>
          </div>
        </div>

        {/* SAVE BUTTON */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>Save Settings</span>
          </button>
        </div>
      </form>

      {/* SECTION 4: DANGER ZONE */}
      <div className="bg-white rounded-xl border border-rose-200 shadow-xs overflow-hidden mt-2">
        <div className="p-4 bg-rose-50/70 border-b border-rose-200 flex items-center gap-2.5">
          <ShieldAlert className="text-rose-600" size={18} />
          <div>
            <h2 className="text-sm font-bold text-rose-900">Danger Zone</h2>
            <p className="text-[11px] text-rose-700">Irreversible actions that clear database collections</p>
          </div>
        </div>

        <div className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-xs">Purge All Sales Records</h3>
            <p className="text-[11px] text-slate-500">
              Permanently delete all past sales invoices. Used when resetting store after trial.
            </p>
          </div>
          <button
            type="button"
            disabled={clearingData}
            onClick={() => handleClearData("sales")}
            className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-xs shrink-0 disabled:opacity-50"
          >
            Purge Sales History
          </button>
        </div>

        <div className="p-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-xs">Purge Entire Inventory Catalog</h3>
            <p className="text-[11px] text-slate-500">
              Permanently delete all product SKUs and stock records.
            </p>
          </div>
          <button
            type="button"
            disabled={clearingData}
            onClick={() => handleClearData("products")}
            className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-xs shrink-0 disabled:opacity-50"
          >
            Purge Product Catalog
          </button>
        </div>
      </div>
    </div>
  );
}
