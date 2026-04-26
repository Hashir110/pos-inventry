"use client";

import { useState } from "react";
import { db } from "../../../lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import { useStore } from "../../../store/useStore";
import { Scale, Hash, ArrowLeft, Save, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation"; // Router wapis jane k liye
// Is line ko code ke top par likhein:
import { toast } from 'react-toastify';
export default function AddProductPage() {
  const { currentUser } = useStore();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    buyingPrice: "",
    sellingPrice: "",
    stock: "",
    unitType: "weight",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return alert("User missing");

    setSubmitting(true);
    try {
      await addDoc(collection(db, "products"), {
        ownerId: currentUser.uid,
        name: formData.name,
        buyingPrice: parseFloat(formData.buyingPrice),
        sellingPrice: parseFloat(formData.sellingPrice),
        stock: parseFloat(formData.stock),
        unitType: formData.unitType,
        createdAt: new Date().toISOString(),
      });

      // Success!
      toast.success("Product Added Successfully!");
      router.push("/dashboard/inventry"); // Wapis List par jao

    } catch (error) {
      console.error(error);
      toast.error("Error: " + error.message);
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Back Button & Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="p-2 bg-white border rounded-full hover:bg-gray-50">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Add New Product</h1>
          <p className="text-sm text-gray-500">Fill details to add item to inventory</p>
        </div>
      </div>

      {/* Main Form */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Product Name */}
          <div className="col-span-2">
            <label className="text-sm font-semibold text-gray-700">Mobile Model Name</label>
            <input
              type="text" required
              className="w-full mt-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="e.g. iPhone 15 Pro Max / Samsung S24"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          {/* IMEI Number (Naya Field) */}
          <div className="col-span-2">
            <label className="text-sm font-semibold text-gray-700">IMEI Number / Serial No.</label>
            <input
              type="text"
              className="w-full mt-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter 15-digit IMEI"
              value={formData.imei}
              onChange={(e) => setFormData({ ...formData, imei: e.target.value })}
            />
          </div>

          {/* Prices Section */}
          <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Buying Price */}
            <div className="w-full">
              <label className="text-sm font-semibold text-gray-700">Buying Price</label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-3 text-gray-500 font-bold">Rs.</span>
                <input
                  type="number" required min="0"
                  className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={formData.buyingPrice}
                  onChange={(e) => setFormData({ ...formData, buyingPrice: e.target.value })}
                />
              </div>
            </div>

            {/* Selling Price */}
            <div className="w-full">
              <label className="text-sm font-semibold text-gray-700">Selling Price</label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-3 text-gray-500 font-bold">Rs.</span>
                <input
                  type="number" required min="0"
                  className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={formData.sellingPrice}
                  onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Stock (Pieces mein) */}
          <div className="col-span-2">
            <label className="text-sm font-semibold text-gray-700">
              Initial Stock (PCs)
            </label>
            <input
              type="number" required min="0"
              className="w-full mt-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="How many units?"
              value={formData.stock}
              onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
            />
          </div>

          {/* Submit Button */}
          <div className="col-span-2 pt-4 border-t mt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-lg flex justify-center items-center gap-2"
            >
              {submitting ? <Loader2 className="animate-spin" /> : <Save />}
              Save Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}