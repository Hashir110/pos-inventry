"use client";

import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import { useStore } from "../../store/useStore";
import { Plus, Trash2, Edit, Search } from "lucide-react";
import Link from "next/link"; // Link use karenge navigate karne k liye

export default function InventoryList() {
  const { currentUser } = useStore();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // 1. Fetch Products
  const fetchProducts = async () => {
    if (!currentUser) return;
    try {
      const q = query(
        collection(db, "products"), 
        where("ownerId", "==", currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(items);
    } catch (error) {
      console.error("Error fetching inventory:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [currentUser]);

  // 2. Delete Logic
  const handleDelete = async (id) => {
    if(confirm("Are you sure you want to delete this item?")) {
        await deleteDoc(doc(db, "products", id));
        fetchProducts();
    }
  }

  // Search Filter
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-800">Product Inventory</h1>
            <p className="text-sm text-gray-500">Manage your stock levels and pricing</p>
        </div>
        
        {/* Add Product Button (Links to New Page) */}
        <Link 
            href="/dashboard/inventry/add" 
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition shadow-lg font-medium"
        >
            <Plus size={20} /> Add New Product
        </Link>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input 
                type="text" 
                placeholder="Search products..." 
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 font-bold text-gray-600">Product Name</th>
                <th className="p-4 font-bold text-gray-600">Type</th>
                <th className="p-4 font-bold text-gray-600">Price (Sell)</th>
                <th className="p-4 font-bold text-gray-600">Stock</th>
                <th className="p-4 font-bold text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                 <tr><td colSpan="5" className="p-8 text-center text-gray-500">Loading Inventory...</td></tr>
              ) : filteredProducts.length === 0 ? (
                 <tr><td colSpan="5" className="p-10 text-center text-gray-400">No products found.</td></tr>
              ) : (
                filteredProducts.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-50/50 transition">
                    <td className="p-4 font-semibold text-gray-800">{item.name}</td>
                    <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${item.unitType === 'weight' ? 'bg-orange-100 text-orange-700' : 'bg-indigo-100 text-indigo-700'}`}>
                            {item.unitType === 'weight' ? 'WEIGHT (KG)' : 'COUNT (PCS)'}
                        </span>
                    </td>
                    <td className="p-4 text-gray-700 font-medium">Rs. {item.sellingPrice}</td>
                    <td className="p-4">
                        <span className={`font-bold ${item.stock < 5 ? 'text-red-600' : 'text-green-600'}`}>
                            {item.stock} {item.unitType === 'weight' ? 'Kg' : 'Pcs'}
                        </span>
                    </td>
                    <td className="p-4 text-right flex justify-end gap-2">
                      
                      <Link 
                        href={`/dashboard/inventry/edit/${item.id}`}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                        title="Edit"
                      >
                        <Edit size={18} />
                      </Link>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}