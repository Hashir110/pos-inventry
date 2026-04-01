"use client";

import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, query, where, getDocs, deleteDoc, doc, orderBy, limit } from "firebase/firestore";
import { useStore } from "../../store/useStore";
import { Plus, Trash2, Edit, Search, Filter, Calendar, RotateCcw } from "lucide-react";
import Link from "next/link"; // Link use karenge navigate karne k liye

export default function InventoryList() {
  const { currentUser } = useStore();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // ... States define karein component ke start mein
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // 1. Fetch Products
  const fetchProducts = async (isFilter = false) => {
    if (!currentUser) return;
    setLoading(true);

    try {
      let startIso, endIso;

      // 1. Date Logic
      if (isFilter && startDate && endDate) {
        // User Selected Range
        const s = new Date(startDate); s.setHours(0, 0, 0, 0);
        const e = new Date(endDate); e.setHours(23, 59, 59, 999);
        startIso = s.toISOString();
        endIso = e.toISOString();
      } else {
        // Default: Current Month (Optimized Load)
        const now = new Date();
        const s = new Date(now.getFullYear(), now.getMonth(), 1);
        startIso = s.toISOString();
        endIso = new Date().toISOString();
      }

      // 2. Query Build
      // Note: Make sure aapke DB mein field ka naam 'createdAt' ya 'date' ho. Main 'createdAt' assume kar raha hun.
      const q = query(
        collection(db, "products"),
        where("ownerId", "==", currentUser.uid),
        orderBy("createdAt", "desc"), // Jo naya add hua wo sab se upar
        limit(15) // Default 15 items dikhaye ga
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
    if (confirm("Are you sure you want to delete this item?")) {
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
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-6">

        {/* Header Label for Filter Section */}
        <div className="mb-3">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <Filter size={16} /> Filter Inventory
          </h3>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-end justify-between">

          {/* Left Side: Date Inputs */}
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto flex-1">

            {/* Start Date */}
            <div className="w-full sm:w-48">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">From Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-300 focus:border-blue-500 outline-none transition shadow-sm"
                />
              </div>
            </div>

            {/* End Date */}
            <div className="w-full sm:w-48">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">To Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-300 focus:border-blue-500 outline-none transition shadow-sm"
                />
              </div>
            </div>

            {/* Action Buttons (Ab ye Inputs ke barabar ayenge) */}
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => fetchProducts(true)}
                className="h-[38px] bg-gray-900 text-white px-5 rounded-lg text-sm font-medium hover:bg-gray-800 transition shadow-sm flex items-center gap-2"
              >
                Apply
              </button>
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  fetchProducts(false);
                }}
                className="h-[38px] text-red-500 px-4 rounded-lg text-sm font-medium hover:bg-red-50 border border-red-100 transition flex items-center gap-2"
                title="Reset Filter"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>

          {/* Right Side: Search Bar (Aligned to right) */}
          <div className="w-full md:w-64 relative mt-4 md:mt-0">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
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