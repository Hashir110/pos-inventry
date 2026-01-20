"use client";

import { useState, useEffect } from "react";
import { db } from "../../lib/firebase"; // Path check kr lein
import { collection, query, where, orderBy, getDocs, limit } from "firebase/firestore";
import { useStore } from "./../../store/useStore";
import { Eye, TrendingUp, ShoppingBag, X, Printer, DollarSign, EyeOff } from "lucide-react";
import { toast } from 'react-toastify';



export default function SalesHistoryPage() {
  const { currentUser } = useStore();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showRevenue, setShowRevenue] = useState(false);
  const [showProfit, setShowProfit] = useState(false);

  // Modal Control
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [passInput, setPassInput] = useState("");
  const [targetField, setTargetField] = useState(null);

  // Stats State
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalProfit: 0
  });

  const [selectedSale, setSelectedSale] = useState(null);

  useEffect(() => {
    const fetchSales = async () => {
      if (!currentUser) return;

      try {
        const q = query(
          collection(db, "sales"),
          where("ownerId", "==", currentUser.uid),
          orderBy("date", "desc"),
          limit(50)
        );

        const snapshot = await getDocs(q);

        const salesData = snapshot.docs.map(doc => {
          const data = doc.data();

          let orderProfit = 0;
          
          if (data.items) {
            data.items.forEach(item => {
              // --- FIX 1: Robust Number Conversion ---
              const buying = parseFloat(item.buyingPrice || 0);
              
              // --- FIX 2: Check both 'sellingPrice' AND 'price' ---
              const selling = parseFloat(item.sellingPrice || item.price || 0);
              
              const qty = parseFloat(item.qty || 0);
              const returnedQty = parseFloat(item.returnedQty || 0); // Agar return logic hai

              // Asal Qty (Sold - Returned)
              const actualQty = qty - returnedQty; 

              if (actualQty > 0) {
                  // Profit sirf un items ka jo abhi bhi customer ke paas hain
                  orderProfit += (selling - buying) * actualQty;
              }
            });
          }

          return {
            id: doc.id,
            ...data,
            profit: orderProfit // Ab ye NaN nahi hoga
          };
        });

        setSales(salesData);
        calculateStats(salesData);

      } catch (error) {
        console.error("Error fetching sales:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
}, [currentUser]);

  // --- UPDATED: Calculate Stats for ALL fetched data (Not just today) ---
 const calculateStats = (data) => {
    let revenue = 0;
    let orders = 0;
    let profit = 0;

    data.forEach(sale => {
      // --- FIX 3: Calculate Net Revenue (Total - Refund) ---
      const saleAmount = parseFloat(sale.totalAmount || 0);
      const refunded = parseFloat(sale.refundedAmount || 0); // Agar return system hai
      
      revenue += (saleAmount - refunded);
      
      // Profit ensure karo number hai
      profit += parseFloat(sale.profit || 0);
      
      orders += 1;
    });

    setStats({
      totalRevenue: revenue,
      totalOrders: orders,
      totalProfit: profit
    });
};

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const handleToggle = (field) => {
    // Agar pehle se khula hai toh band kardo (Direct hide)
    if (field === 'revenue' && showRevenue) return setShowRevenue(false);
    if (field === 'profit' && showProfit) return setShowProfit(false);

    // Agar hidden hai toh Modal kholo
    setTargetField(field);
    setPassInput("");
    setIsModalOpen(true);
  };

  const verifyPassword = (e) => {
    e.preventDefault();
    const savedPass = localStorage.getItem("dashboardPass");

    if (!savedPass) return toast.error("Settings mn password set karein!");

    if (passInput === savedPass) {
      if (targetField === 'revenue') setShowRevenue(true);
      if (targetField === 'profit') setShowProfit(true);
      setIsModalOpen(false);
      toast.success("Access Granted");
    } else {
      toast.error("Wrong Password!");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Sales History</h1>

      {/* --- STATS CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Revenue */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-l-4 border-l-blue-500">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500 mb-1">Total Sale (Recent)</p>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-bold text-blue-600">
                  {/* Logic: Show Amount OR Stars */}
                  {showRevenue
                    ? `Rs. ${Math.round(stats.totalRevenue).toLocaleString()}`
                    : "****"}
                </h3>

                {/* Toggle Button */}
                <button onClick={() => handleToggle('revenue')} className="text-gray-400 hover:text-blue-600">
                  {showRevenue ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="p-3 bg-blue-50 rounded-full text-blue-600">
              <TrendingUp size={24} />
            </div>
          </div>
        </div>

        {/* Total Profit */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-l-4 border-l-green-500">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500 mb-1">Total Profit (Recent)</p>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-bold text-green-600">
                  {/* Logic: Show Amount OR Stars */}
                  {showProfit
                    ? `Rs. ${Math.round(stats.totalProfit).toLocaleString()}`
                    : "****"}
                </h3>

                {/* Toggle Button */}
                <button onClick={() => handleToggle('profit')} className="text-gray-400 hover:text-green-600">
                  {showProfit ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="p-3 bg-green-50 rounded-full text-green-600">
              <DollarSign size={24} />
            </div>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-l-4 border-l-purple-500">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500">Total Orders</p>
              <h3 className="text-2xl font-bold text-gray-800">{stats.totalOrders}</h3>
            </div>
            <div className="p-3 bg-purple-50 rounded-full text-purple-600">
              <ShoppingBag size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* --- SALES TABLE --- */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 font-semibold text-gray-600">Date</th>
                <th className="p-4 font-semibold text-gray-600">Items</th>
                <th className="p-4 text-left font-semibold text-gray-600">
                  <div className="flex items-center gap-2">
                    Sale Amount
                    <button onClick={() => handleToggle('revenue')} className="text-gray-400 hover:text-blue-600">
                      {showRevenue ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </th>
                <th className="p-4 text-left font-semibold text-gray-600">
                  <div className="flex items-center gap-2">
                    Profit
                    <button onClick={() => handleToggle('profit')} className="text-gray-400 hover:text-green-600">
                      {showProfit ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </th>
                <th className="p-4 font-semibold text-gray-600 text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan="5" className="p-6 text-center">Loading Data...</td></tr>
              ) : sales.length === 0 ? (
                <tr><td colSpan="5" className="p-6 text-center text-gray-500">No records found.</td></tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50 transition">
                    <td className="p-4 text-gray-900">
                      {formatDate(sale.date)}
                    </td>
                    <td className="p-4">
                      {sale.items.length} items
                    </td>
                    {/* TOTAL AMOUNT CELL */}
                    <td className="p-4 font-bold text-gray-800">
                      {showRevenue
                        ? `Rs. ${Math.round(sale.totalAmount).toLocaleString()}`
                        : "****"
                      }
                    </td>

                    {/* PROFIT CELL */}
                    <td className="p-4 font-bold text-green-600">
                      {showProfit
                        ? `Rs. ${Math.round(sale.profit).toLocaleString()}`
                        : "****"
                      }
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedSale(sale)}
                        className="text-blue-600 hover:bg-blue-50 p-2 rounded-full transition"
                      >
                        <Eye size={20} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Table Footer Summary */}
            <tfoot className="bg-gray-100 font-bold text-gray-900 border-t-2 border-gray-300">
              <tr>
                <td className="p-4 text-right" colSpan="2">Total (Current List):</td>

                {/* TOTAL REVENUE FOOTER */}
                <td className="p-4">
                  {showRevenue
                    ? `Rs. ${Math.round(stats.totalRevenue || 0).toLocaleString()}`
                    : "****"
                  }
                </td>

                {/* TOTAL PROFIT FOOTER */}
                <td className="p-4 text-green-700">
                  {showProfit
                    ? `Rs. ${Math.round(stats.totalProfit || 0).toLocaleString()}`
                    : "****"
                  }
                </td>

                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedSale && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-in fade-in backdrop-blur-sm">
          <div className="bg-white rounded-xl w-[400px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Order Details</h3>
              <button onClick={() => setSelectedSale(null)} className="text-gray-500 hover:text-red-500"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-white">
              <div className="text-center mb-6">
                <p className="text-xs text-gray-400 uppercase tracking-widest">Receipt</p>
                <h2 className="text-2xl font-bold text-gray-800">Rs. {Math.round(selectedSale.totalAmount)}</h2>
                <p className="text-sm text-green-600 font-bold">Profit: Rs. {Math.round(selectedSale.profit)}</p>
                <p className="text-sm text-gray-500 mt-1">{formatDate(selectedSale.date)}</p>
              </div>
              <div className="space-y-3">
                {selectedSale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center border-b border-dashed border-gray-300 pb-2">
                    <div>
                      <p className="font-medium text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.qty} {item.type === 'weight' ? 'kg' : 'pcs'} x {item.price}</p>
                    </div>
                    <span className="font-semibold text-gray-700">{Math.round(item.total)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t bg-gray-50 flex gap-3">
              <button onClick={() => setSelectedSale(null)} className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex justify-center items-center gap-2">Close</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[99] backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm relative animate-in fade-in zoom-in duration-200">

            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-black"
            >
              <X size={20} />
            </button>

            <h3 className="text-lg font-bold mb-4 text-center">Security Check 🔒</h3>
            <p className="text-sm text-gray-500 mb-4 text-center">Enter password to view hidden amount.</p>

            <form onSubmit={verifyPassword}>
              <input
                type="password"
                autoFocus
                className="w-full p-3 border rounded-lg mb-4 text-center text-lg tracking-widest outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter Password"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
              />
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition"
              >
                Unlock
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}