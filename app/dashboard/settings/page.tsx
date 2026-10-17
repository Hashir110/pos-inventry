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
    Receipt
} from "lucide-react";
import PageHeader from "../../components/PageHeader";
import { toast } from 'react-toastify';
import { useDialog } from "../../components/DialogProvider";

export default function SettingsPage() {
  const { confirm } = useDialog();
    const { currentUser, currentShop, setCurrentShop } = useStore();
    const { t } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [clearingData, setClearingData] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        shopName: "",
        contact: "",
        address: "",
        receiptMessage: "",
        printerSize: "58mm"
    });

    useEffect(() => {
        if (currentShop) {
            setFormData({
                shopName: currentShop.shopName || "",
                contact: currentShop.contact || "",
                address: currentShop.address || "",
                receiptMessage: currentShop.receiptMessage || "",
                printerSize: localStorage.getItem("printerSize") || "58mm"
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

            toast.success("Settings Saved Successfully!");
        } catch (error) {
            console.error(error);
            toast.error("Error saving settings");
        }
        setLoading(false);
    };

    const handleClearData = async (collectionName: "products" | "sales") => {
        const label = collectionName === "products" ? "Inventory" : "Sales History";
        if (!currentUser) return;
        const ok = await confirm({
            title: `Poori ${label} delete karein?`,
            message: `${label} ka saara data hamesha ke liye hat jayega aur wapis nahi aayega.`,
            confirmLabel: "Sab Delete Karo",
            tone: "danger",
            requireText: "DELETE",
        });
        if (!ok) return;

        setClearingData(true);
        try {
            await clearCollection(currentUser.uid, collectionName);
            toast.success(`${label} saaf ho gayi`);
            setTimeout(() => window.location.reload(), 900);

        } catch (error) {
            console.error(error);
            toast.error("Data delete nahi hua");
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
        <div className="pb-10">
            <PageHeader title={t("storeSettings")} subtitle={t("settingsSubtitle")} />

            <div className="space-y-6">
                {/* --- SHOP PROFILE --- */}
                <form onSubmit={handleSaveProfile} className="card overflow-hidden">
                    {sectionHead(Store, t("shopProfile"), t("receiptFooterMsgHint"))}

                    <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-sm font-bold text-stone-700">{t("shopNameLabel")}</label>
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
                                <Phone size={14} /> {t("contactNumber")}
                            </label>
                            <input
                                type="text"
                                placeholder="03xx-xxxxxxx"
                                className="field"
                                value={formData.contact}
                                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="mb-1.5 flex items-center gap-2 text-sm font-bold text-stone-700">
                                <MapPin size={14} /> {t("addressOptional")}
                            </label>
                            <input
                                type="text"
                                placeholder="Dukan ka address"
                                className="field"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="mb-1.5 flex items-center gap-2 text-sm font-bold text-stone-700">
                                <Receipt size={14} /> {t("receiptFooterMsg")}
                            </label>
                            <input
                                type="text"
                                placeholder="Slip ke neeche ka message (optional)"
                                className="field"
                                value={formData.receiptMessage}
                                onChange={(e) => setFormData({ ...formData, receiptMessage: e.target.value })}
                            />
                            <p className="mt-1.5 text-xs text-stone-400">{t("receiptFooterMsgHint")}</p>
                        </div>
                    </div>

                    <div className="flex justify-end border-t border-stone-200 bg-stone-50/60 p-4">
                        <button type="submit" disabled={loading} className="btn-primary">
                            {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            {t("saveChanges")}
                        </button>
                    </div>
                </form>

                {/* --- PRINTER --- */}
                <div className="card overflow-hidden">
                    {sectionHead(Printer, t("printer"), t("printerSize"), "bg-sky-100 text-sky-700")}
                    <div className="p-5">
                        <div className="flex flex-col gap-3 sm:flex-row">
                            {printerOption("58mm", t("printer58mm"), t("printer58mmHint"), 24)}
                            {printerOption("80mm", t("printer80mm"), t("printer80mmHint"), 30)}
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button type="button" onClick={handleSaveProfile} className="btn-ghost !py-2">
                                {t("savePrinterSize")}
                            </button>
                        </div>
                    </div>
                </div>

                {/* --- DANGER ZONE --- */}
                <div className="overflow-hidden rounded-2xl border border-red-200 bg-white">
                    {sectionHead(AlertTriangle, t("dangerZone"), t("dangerZoneHint"), "bg-red-100 text-red-700")}
                    <div className="space-y-3 p-5">
                        {([
                            { key: "products", title: t("clearInventoryTitle"), hint: t("clearInventoryHint"), label: t("deleteInventoryBtn") },
                            { key: "sales", title: t("clearSalesTitle"), hint: t("clearSalesHint"), label: t("deleteSalesBtn") },
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