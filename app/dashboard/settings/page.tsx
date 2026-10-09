"use client";

import { useState, useEffect } from "react";
import { useStore } from "../../store/useStore";
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
    Lock
} from "lucide-react";
import PageHeader from "../../components/PageHeader";
// Is line ko code ke top par likhein:
import { toast } from 'react-toastify';
export default function SettingsPage() {
    const { currentUser, currentShop, setCurrentShop } = useStore();
    const [dashboardPass, setDashboardPass] = useState("");
    const [loading, setLoading] = useState(false);
    const [clearingData, setClearingData] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        shopName: "",
        contact: "",
        address: "",
        receiptMessage: "Thank you for shopping!",
        printerSize: "58mm" // 58mm or 80mm
    });

    useEffect(() => {
        const savedPass = localStorage.getItem("dashboardPass");
        // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage sirf client par mil sakta hai
        if (savedPass) setDashboardPass(savedPass);
    }, []);

    const handleSavePassword = () => {
        if (!dashboardPass.trim()) {
            return toast.error("Password cannot be empty!");
        }

        // Save to Local Storage
        setDashboardPass("")
        localStorage.setItem("dashboardPass", dashboardPass);
        toast.success("Privacy Password Updated! 🔒");
    };

    // 1. Load Data on Mount
    useEffect(() => {
        if (currentShop) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- store se form prefill
            setFormData({
                shopName: currentShop.shopName || "",
                contact: currentShop.contact || "",
                address: currentShop.address || "",
                receiptMessage: currentShop.receiptMessage || "Thank you for shopping! No Return.",
                printerSize: localStorage.getItem("printerSize") || "58mm"
            });
        }
    }, [currentShop]);

    // 2. Save Profile Handler
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

            // Update Local Storage for Printer
            localStorage.setItem("printerSize", formData.printerSize);

            // Update Global Store (Taake Sidebar mn naam update hojaye)
            setCurrentShop({
                ...currentShop!,
                shopName: formData.shopName,
                contact: formData.contact,
                address: formData.address,
                receiptMessage: formData.receiptMessage,
            });

            toast.success("Settings Saved Successfully!");
        } catch (error) {
            console.error(error);
            toast.error("Error saving settings");
        }
        setLoading(false);
    };

    // 3. Danger Zone: Clear Data Logic
    const handleClearData = async (collectionName: "products" | "sales") => {
        const confirmMsg = collectionName === "products"
            ? "Are you sure? All INVENTORY will be deleted!"
            : "Are you sure? All SALES HISTORY will be deleted!";

        if (!confirm(confirmMsg) || !currentUser) return;

        setClearingData(true);
        try {
            await clearCollection(currentUser.uid, collectionName);
            alert(`${collectionName === 'products' ? 'Inventory' : 'Sales History'} Cleared!`);
            window.location.reload(); // Refresh to reflect changes

        } catch (error) {
            console.error(error);
            alert("Failed to delete data");
        }
        setClearingData(false);
    };

    const sectionHead = (Icon: typeof Store, title: string, hint: string, tone = "bg-brand-100 text-brand-700") => (
        <div className="flex items-center gap-3 border-b border-stone-200 p-5">
            <div className={`rounded-xl p-2.5 ${tone}`}>
                <Icon size={20} />
            </div>
            <div>
                <h2 className="font-bold text-stone-900">{title}</h2>
                <p className="text-xs text-stone-500">{hint}</p>
            </div>
        </div>
    );

    const printerOption = (size: "58mm" | "80mm", title: string, hint: string, iconSize: number) => {
        const active = formData.printerSize === size;
        return (
            <button
                type="button"
                onClick={() => setFormData({ ...formData, printerSize: size })}
                className={`flex flex-1 items-center gap-4 rounded-xl border-2 p-4 text-left transition ${
                    active ? "border-brand-500 bg-brand-50" : "border-stone-200 hover:border-stone-300"
                }`}
            >
                <Receipt size={iconSize} className={active ? "text-brand-700" : "text-stone-400"} />
                <span>
                    <span className={`block font-bold ${active ? "text-brand-800" : "text-stone-800"}`}>{title}</span>
                    <span className="block text-xs text-stone-500">{hint}</span>
                </span>
            </button>
        );
    };

    return (
        <div className="mx-auto max-w-3xl pb-10">
            <PageHeader title="Settings" subtitle="Dukaan ki tafseel, security aur printer" />

            <div className="space-y-6">
                {/* --- SHOP PROFILE --- */}
                <form onSubmit={handleSaveProfile} className="card overflow-hidden">
                    {sectionHead(Store, "Shop Profile", "Yeh tafseel receipt par chhapti hai")}

                    <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-sm font-bold text-stone-700">Dukaan ka naam</label>
                            <input
                                type="text"
                                required
                                className="field"
                                value={formData.shopName}
                                onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="mb-1.5 flex items-center gap-2 text-sm font-bold text-stone-700">
                                <Phone size={14} /> Contact number
                            </label>
                            <input
                                type="text"
                                placeholder="0300-1234567"
                                className="field"
                                value={formData.contact}
                                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="mb-1.5 flex items-center gap-2 text-sm font-bold text-stone-700">
                                <MapPin size={14} /> Pata <span className="text-xs font-medium text-stone-400">(optional)</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Shop #1, Market Area..."
                                className="field"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="mb-1.5 flex items-center gap-2 text-sm font-bold text-stone-700">
                                <Receipt size={14} /> Receipt ke neeche ka paigham
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Receipt ke baghair return nahi hoga"
                                className="field"
                                value={formData.receiptMessage}
                                onChange={(e) => setFormData({ ...formData, receiptMessage: e.target.value })}
                            />
                            <p className="mt-1.5 text-xs text-stone-400">Har bill ke aakhir mein yeh likha aayega.</p>
                        </div>
                    </div>

                    <div className="flex justify-end border-t border-stone-200 bg-stone-50/60 p-4">
                        <button type="submit" disabled={loading} className="btn-primary">
                            {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            Save Changes
                        </button>
                    </div>
                </form>

                {/* --- SECURITY --- */}
                <div className="card overflow-hidden">
                    {sectionHead(Lock, "Dashboard Password", "Sales aur profit chhupane/dikhane ke liye", "bg-violet-100 text-violet-700")}
                    <div className="p-5">
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <input
                                type="password"
                                placeholder="Naya password ya PIN"
                                className="field flex-1"
                                value={dashboardPass}
                                onChange={(e) => setDashboardPass(e.target.value)}
                            />
                            <button type="button" onClick={handleSavePassword} className="btn-dark sm:w-32">
                                Save
                            </button>
                        </div>
                        <p className="mt-2 text-xs text-stone-400">
                            Yeh password sirf is device ke browser mein save hota hai.
                        </p>
                    </div>
                </div>

                {/* --- PRINTER --- */}
                <div className="card overflow-hidden">
                    {sectionHead(Printer, "Printer", "Receipt ka size", "bg-sky-100 text-sky-700")}
                    <div className="p-5">
                        <div className="flex flex-col gap-3 sm:flex-row">
                            {printerOption("58mm", "58mm (Chhota)", "Standard thermal", 24)}
                            {printerOption("80mm", "80mm (Bara)", "Wide thermal", 30)}
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button type="button" onClick={handleSaveProfile} className="btn-ghost !py-2">
                                Printer size save karein
                            </button>
                        </div>
                    </div>
                </div>

                {/* --- DANGER ZONE --- */}
                <div className="overflow-hidden rounded-2xl border border-red-200 bg-white">
                    {sectionHead(AlertTriangle, "Danger Zone", "Yeh kaam wapas nahi ho sakte", "bg-red-100 text-red-700")}
                    <div className="space-y-3 p-5">
                        {([
                            { key: "products", title: "Inventory saaf karein", hint: "Saare products hamesha ke liye delete", label: "Inventory Delete" },
                            { key: "sales", title: "Sales History saaf karein", hint: "Saare bills hamesha ke liye delete", label: "Sales Delete" },
                        ] as const).map((row) => (
                            <div key={row.key} className="flex flex-col gap-3 rounded-xl border border-red-100 bg-red-50/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h3 className="font-bold text-stone-900">{row.title}</h3>
                                    <p className="text-xs text-stone-500">{row.hint}</p>
                                </div>
                                <button
                                    onClick={() => handleClearData(row.key)}
                                    disabled={clearingData}
                                    className="btn border border-red-200 bg-white text-red-600 hover:bg-red-600 hover:text-white"
                                >
                                    <Trash2 size={16} /> {row.label}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}