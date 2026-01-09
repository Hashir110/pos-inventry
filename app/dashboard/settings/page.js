"use client";

import { useState, useEffect } from "react";
import { useStore } from "../../store/useStore";
import { db } from "../../lib/firebase";
import { doc, updateDoc, collection, getDocs, writeBatch, query, where } from "firebase/firestore";
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

export default function SettingsPage() {
  const { currentUser, currentShop, setCurrentShop } = useStore();
  
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

  // 1. Load Data on Mount
  useEffect(() => {
    if (currentShop) {
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
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    setLoading(true);

    try {
      // Update Firebase
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        shopName: formData.shopName,
        contact: formData.contact,
        address: formData.address,
        receiptMessage: formData.receiptMessage
      });

      // Update Local Storage for Printer
      localStorage.setItem("printerSize", formData.printerSize);

      // Update Global Store (Taake Sidebar mn naam update hojaye)
      setCurrentShop({ ...currentShop, ...formData });

      alert("Settings Saved Successfully!");
    } catch (error) {
      console.error(error);
      alert("Error saving settings");
    }
    setLoading(false);
  };

  // 3. Danger Zone: Clear Data Logic
  const handleClearData = async (collectionName) => {
    const confirmMsg = collectionName === "products" 
        ? "Are you sure? All INVENTORY will be deleted!" 
        : "Are you sure? All SALES HISTORY will be deleted!";

    if (!confirm(confirmMsg)) return;

    setClearingData(true);
    try {
        const q = query(collection(db, collectionName), where("ownerId", "==", currentUser.uid));
        const snapshot = await getDocs(q);
        
        // Batch Delete (Fast)
        const batch = writeBatch(db);
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        alert(`${collectionName === 'products' ? 'Inventory' : 'Sales History'} Cleared!`);
        window.location.reload(); // Refresh to reflect changes

    } catch (error) {
        console.error(error);
        alert("Failed to delete data");
    }
    setClearingData(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Settings</h1>
        <p className="text-sm text-gray-500">Manage your shop preferences and data</p>
      </div>

      {/* --- SECTION 1: SHOP PROFILE --- */}
      <form onSubmit={handleSaveProfile} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <Store size={20} />
            </div>
            <div>
                <h2 className="font-bold text-gray-800">Shop Profile</h2>
                <p className="text-xs text-gray-500">Details printed on your receipt</p>
            </div>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Shop Name */}
            <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Shop Name</label>
                <input 
                    type="text" required
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.shopName}
                    onChange={(e) => setFormData({...formData, shopName: e.target.value})}
                />
            </div>

            {/* Contact Number */}
            <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                    <Phone size={14} /> Contact Number
                </label>
                <input 
                    type="text"
                    placeholder="0300-1234567"
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.contact}
                    onChange={(e) => setFormData({...formData, contact: e.target.value})}
                />
            </div>

            {/* Address */}
            <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                    <MapPin size={14} /> Shop Address <span className="text-xs text-gray-400 font-normal">(Optional)</span>
                </label>
                <input 
                    type="text"
                    placeholder="Shop #1, Market Area..."
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                />
            </div>

            {/* Receipt Footer Message */}
            <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                    <Receipt size={14} /> Receipt Footer Message
                </label>
                <input 
                    type="text"
                    placeholder="e.g. No Return / Exchange without receipt"
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.receiptMessage}
                    onChange={(e) => setFormData({...formData, receiptMessage: e.target.value})}
                />
                <p className="text-xs text-gray-400 mt-1">This appears at the bottom of every bill.</p>
            </div>
        </div>
        
        {/* Save Button */}
        <div className="p-4 bg-gray-50 border-t flex justify-end">
            <button 
                type="submit" 
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-lg flex items-center gap-2 disabled:opacity-50 transition"
            >
                {loading ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                Save Changes
            </button>
        </div>
      </form>

      {/* --- SECTION 2: PRINTER SETTINGS --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                <Printer size={20} />
            </div>
            <div>
                <h2 className="font-bold text-gray-800">Printer Settings</h2>
                <p className="text-xs text-gray-500">Receipt size configuration</p>
            </div>
        </div>
        <div className="p-6">
            <div className="flex gap-4">
                <button 
                    onClick={() => setFormData({...formData, printerSize: "58mm"})}
                    className={`flex-1 p-4 border rounded-xl flex flex-col items-center justify-center gap-2 transition ${formData.printerSize === "58mm" ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500" : "hover:bg-gray-50"}`}
                >
                    <Receipt size={24} />
                    <span className="font-bold">58mm (Small)</span>
                    <span className="text-xs text-gray-400">Standard Thermal</span>
                </button>

                <button 
                    onClick={() => setFormData({...formData, printerSize: "80mm"})}
                    className={`flex-1 p-4 border rounded-xl flex flex-col items-center justify-center gap-2 transition ${formData.printerSize === "80mm" ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500" : "hover:bg-gray-50"}`}
                >
                    <Receipt size={32} />
                    <span className="font-bold">80mm (Large)</span>
                    <span className="text-xs text-gray-400">Wide Thermal</span>
                </button>
            </div>
            <div className="mt-4 flex justify-end">
                 <button onClick={handleSaveProfile} className="text-sm text-blue-600 hover:underline">Save Preference</button>
            </div>
        </div>
      </div>

      {/* --- SECTION 3: DANGER ZONE --- */}
      <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
        <div className="p-6 border-b border-red-100 bg-red-50/50 flex items-center gap-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                <AlertTriangle size={20} />
            </div>
            <div>
                <h2 className="font-bold text-red-800">Danger Zone</h2>
                <p className="text-xs text-red-500">Irreversible actions</p>
            </div>
        </div>
        <div className="p-6 space-y-4">
            
            <div className="flex items-center justify-between p-4 border border-red-100 rounded-lg bg-red-50/30">
                <div>
                    <h3 className="font-bold text-gray-800">Clear Inventory</h3>
                    <p className="text-xs text-gray-500">Delete all products permanently.</p>
                </div>
                <button 
                    onClick={() => handleClearData("products")}
                    disabled={clearingData}
                    className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition text-sm font-bold flex items-center gap-2"
                >
                    <Trash2 size={16} /> Delete Inventory
                </button>
            </div>

            <div className="flex items-center justify-between p-4 border border-red-100 rounded-lg bg-red-50/30">
                <div>
                    <h3 className="font-bold text-gray-800">Clear Sales History</h3>
                    <p className="text-xs text-gray-500">Delete all sales records permanently.</p>
                </div>
                <button 
                    onClick={() => handleClearData("sales")}
                    disabled={clearingData}
                    className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition text-sm font-bold flex items-center gap-2"
                >
                    <Trash2 size={16} /> Delete Sales
                </button>
            </div>

        </div>
      </div>

    </div>
  );
}