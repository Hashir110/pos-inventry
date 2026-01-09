"use client";
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc, updateDoc, doc } from "firebase/firestore";
import { Scale, Hash, X } from "lucide-react";

export default function ProductForm({ currentUser, editingProduct, onClose, onComplete }) {
  const [submitting, setSubmitting] = useState(false);
  
  // Initial State
  const initialFormState = {
    name: "",
    buyingPrice: "",
    sellingPrice: "",
    stock: "",
    unitType: "weight",
  };
  const [formData, setFormData] = useState(initialFormState);

  // Agar Editing Mode hai, to data fill karo
  useEffect(() => {
    if (editingProduct) {
      setFormData({
        name: editingProduct.name,
        buyingPrice: editingProduct.buyingPrice,
        sellingPrice: editingProduct.sellingPrice,
        stock: editingProduct.stock,
        unitType: editingProduct.unitType
      });
    }
  }, [editingProduct]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    setSubmitting(true);

    try {
      const productData = {
        ownerId: currentUser.uid,
        name: formData.name,
        buyingPrice: parseFloat(formData.buyingPrice),
        sellingPrice: parseFloat(formData.sellingPrice),
        stock: parseFloat(formData.stock),
        unitType: formData.unitType,
        updatedAt: new Date().toISOString(),
      };

      if (editingProduct) {
        // --- UPDATE ---
        const productRef = doc(db, "products", editingProduct.id);
        await updateDoc(productRef, productData);
        alert("Product Updated!");
      } else {
        // --- CREATE ---
        await addDoc(collection(db, "products"), {
            ...productData,
            createdAt: new Date().toISOString()
        });
        alert("Product Added!");
      }
      
      onComplete(); // Parent ko batao ke kaam ho gaya (Refresh List)
      onClose();    // Form band karo

    } catch (error) {
      console.error(error);
      alert("Error saving product");
    }
    setSubmitting(false);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 animate-in fade-in zoom-in duration-300 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-blue-800">
            {editingProduct ? "Edit Product Details" : "New Product Details"}
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-red-500">
            <X size={24} />
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Name */}
        <div className="col-span-2">
          <label className="text-sm font-medium text-gray-700">Product Name</label>
          <input 
            type="text" required
            className="w-full mt-1 p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="e.g. Super Kernel Basmati Rice"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
          />
        </div>

        {/* Unit Type */}
        <div className="col-span-2">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Item Unit Type</label>
            <div className="flex gap-4">
                <button
                    type="button"
                    onClick={() => setFormData({...formData, unitType: 'weight'})}
                    className={`flex-1 p-3 rounded-lg border flex items-center justify-center gap-2 transition-all ${formData.unitType === 'weight' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold shadow-sm' : 'bg-white hover:bg-gray-50'}`}
                >
                    <Scale size={20} /> By Weight (kg)
                </button>
                <button
                    type="button"
                    onClick={() => setFormData({...formData, unitType: 'count'})}
                    className={`flex-1 p-3 rounded-lg border flex items-center justify-center gap-2 transition-all ${formData.unitType === 'count' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold shadow-sm' : 'bg-white hover:bg-gray-50'}`}
                >
                    <Hash size={20} /> By Quantity (Pcs)
                </button>
            </div>
        </div>

        {/* Prices */}
        <div>
          <label className="text-sm font-medium text-gray-700">Buying Price ({formData.unitType === 'weight' ? 'Per Kg' : 'Per Pc'})</label>
          <input 
            type="number" required min="0" step="0.01"
            className="w-full mt-1 p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            value={formData.buyingPrice}
            onChange={(e) => setFormData({...formData, buyingPrice: e.target.value})}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Selling Price ({formData.unitType === 'weight' ? 'Per Kg' : 'Per Pc'})</label>
          <input 
            type="number" required min="0" step="0.01"
            className="w-full mt-1 p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            value={formData.sellingPrice}
            onChange={(e) => setFormData({...formData, sellingPrice: e.target.value})}
          />
        </div>

        {/* Stock */}
        <div className="col-span-2">
          <label className="text-sm font-medium text-gray-700">Current Stock ({formData.unitType === 'weight' ? 'Total Kg' : 'Total Pieces'})</label>
          <input 
            type="number" required min="0" step="0.01"
            className="w-full mt-1 p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            value={formData.stock}
            onChange={(e) => setFormData({...formData, stock: e.target.value})}
          />
        </div>

        {/* Actions */}
        <div className="col-span-2 flex justify-end gap-3 mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md transition">Cancel</button>
          <button type="submit" disabled={submitting} className={`px-6 py-2 text-white rounded-md transition disabled:opacity-50 ${editingProduct ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'}`}>
            {submitting ? "Processing..." : (editingProduct ? "Update Product" : "Save Product")}
          </button>
        </div>
      </form>
    </div>
  );
}