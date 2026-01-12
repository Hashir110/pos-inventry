"use client";

import { useState, useEffect, use } from "react"; // 'use' import kiya Next.js 15+ k liye
import { db } from "../../../../lib/firebase"; 
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { Scale, Hash, ArrowLeft, Save, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
// Is line ko code ke top par likhein:
import { toast } from 'react-toastify';
export default function EditProductPage({ params }) {
  // --- FIX 1: Params ko safe tarike se unwrap karna ---
  // Agar aap Next.js 15 use kar rahay hain to `use(params)` chahiye, 
  // Agar purana hai to direct `params.id` chalega. 
  // Hum safe side rehne k liye ye logic lagayenge:
  const unwrappedParams = use(params); 
  const productId = unwrappedParams?.id;

  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: "",
    buyingPrice: "",
    sellingPrice: "",
    stock: "",
    unitType: "weight",
  });

  // 1. Fetch Existing Data
  useEffect(() => {
    const fetchData = async () => {
        // --- FIX 2: Safety Check ---
        // Agar ID undefined hai, to ruk jao (Crash nahi hoga)
        if (!productId) return; 

        try {
            console.log("Fetching Product ID:", productId); // Debugging Log

            const docRef = doc(db, "products", productId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                setFormData({
                    name: data.name,
                    buyingPrice: data.buyingPrice,
                    sellingPrice: data.sellingPrice,
                    stock: data.stock,
                    unitType: data.unitType
                });
            } else {
                toast.success("Product not found!");
                router.push("/dashboard/inventry");
            }
        } catch (error) {
            console.error("Fetch Error:", error);
        } finally {
            setLoading(false);
        }
    };

    fetchData();
  }, [productId, router]); // Dependency array mn productId zaroori hai

  // 2. Update Logic
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!productId) return alert("Error: Product ID missing");

    setSubmitting(true);
    
    try {
      const productRef = doc(db, "products", productId);
      
      await updateDoc(productRef, {
        name: formData.name,
        buyingPrice: parseFloat(formData.buyingPrice),
        sellingPrice: parseFloat(formData.sellingPrice),
        stock: parseFloat(formData.stock),
        unitType: formData.unitType,
        updatedAt: new Date().toISOString(),
      });

      toast.success("Product Updated Successfully!");
      router.push("/dashboard/inventry");

    } catch (error) {
      console.error(error);
      toast.error("Error: " + error.message);
    }
    setSubmitting(false);
  };

  if(loading) return (
      <div className="h-screen flex items-center justify-center gap-2 text-blue-600">
          <Loader2 className="animate-spin" /> Loading product...
      </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      
      {/* Back Button & Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="p-2 bg-white border rounded-full hover:bg-gray-50">
            <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
            <h1 className="text-2xl font-bold text-gray-800">Edit Product</h1>
            <p className="text-sm text-gray-500">Update inventory details</p>
        </div>
      </div>

      {/* Main Form */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Name */}
            <div className="col-span-2">
              <label className="text-sm font-semibold text-gray-700">Product Name</label>
              <input 
                type="text" required
                className="w-full mt-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. Rice / Panadol"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>

            {/* Unit Type */}
            <div className="col-span-2">
                <label className="text-sm font-semibold text-gray-700 mb-2 block">Item Unit Type</label>
                <div className="flex gap-4">
                    <button
                        type="button"
                        onClick={() => setFormData({...formData, unitType: 'weight'})}
                        className={`flex-1 p-4 rounded-xl border flex items-center justify-center gap-2 transition-all ${formData.unitType === 'weight' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold ring-2 ring-blue-200' : 'bg-gray-50 hover:bg-gray-100'}`}
                    >
                        <Scale size={24} /> 
                        <span>By Weight (KG)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setFormData({...formData, unitType: 'count'})}
                        className={`flex-1 p-4 rounded-xl border flex items-center justify-center gap-2 transition-all ${formData.unitType === 'count' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold ring-2 ring-blue-200' : 'bg-gray-50 hover:bg-gray-100'}`}
                    >
                        <Hash size={24} /> 
                        <span>By Quantity (PCS)</span>
                    </button>
                </div>
            </div>

            {/* Prices */}
            <div>
              <label className="text-sm font-semibold text-gray-700">Buying Price</label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-3 text-gray-500 font-bold">Rs.</span>
                <input 
                    type="number" required min="0" step="0.01"
                    className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                    value={formData.buyingPrice}
                    onChange={(e) => setFormData({...formData, buyingPrice: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Selling Price</label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-3 text-gray-500 font-bold">Rs.</span>
                <input 
                    type="number" required min="0" step="0.01"
                    className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({...formData, sellingPrice: e.target.value})}
                />
              </div>
            </div>

            {/* Stock */}
            <div className="col-span-2">
              <label className="text-sm font-semibold text-gray-700">
                Current Stock ({formData.unitType === 'weight' ? 'Kg' : 'Pieces'})
              </label>
              <input 
                type="number" required min="0" step="0.01"
                className="w-full mt-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.stock}
                onChange={(e) => setFormData({...formData, stock: e.target.value})}
              />
            </div>

            {/* Submit Button */}
            <div className="col-span-2 pt-4 border-t mt-2">
              <button 
                type="submit" 
                disabled={submitting}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-lg shadow-lg flex justify-center items-center gap-2"
              >
                {submitting ? <Loader2 className="animate-spin" /> : <Save />}
                Update Product
              </button>
            </div>
          </form>
      </div>
    </div>
  );
}