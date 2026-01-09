"use client";

import { useState, useEffect } from "react";
import { db } from "../../lib/firebase"; // Path check kr lein
import { collection, query, where, orderBy, getDocs, limit } from "firebase/firestore";
import { useStore } from "./../../store/useStore";
import { Eye, TrendingUp, ShoppingBag, X, Printer, DollarSign } from "lucide-react";

export default function SalesHistoryPage() {
  const { currentUser } = useStore();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  
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
          limit(50) // Last 50 sales layega
        );

        const snapshot = await getDocs(q);
        
        // Data Process & Profit Calculation
        const salesData = snapshot.docs.map(doc => {
            const data = doc.data();
            
            let orderProfit = 0;
            if(data.items) {
                data.items.forEach(item => {
                    const buying = item.buyingPrice || 0; 
                    const selling = item.price;
                    const qty = item.qty;
                    // Profit Formula
                    orderProfit += (selling - buying) * qty;
                });
            }

            return { 
                id: doc.id, 
                ...data, 
                profit: orderProfit 
            };
        });
        
        setSales(salesData);
        calculateStats(salesData); // Stats function call kiya
        
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
       // Ab hum date check nahi kar rahe, jo list mn hai wo add hoga
       revenue += sale.totalAmount;
       profit += sale.profit;
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Sales History</h1>

      {/* --- STATS CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Revenue */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-l-4 border-l-blue-500">
            <div className="flex justify-between items-center">
                <div>
                    <p className="text-sm text-gray-500">Total Sale (Recent)</p>
                    <h3 className="text-2xl font-bold text-blue-600">Rs. {Math.round(stats.totalRevenue).toLocaleString()}</h3>
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
                    <p className="text-sm text-gray-500">Total Profit (Recent)</p>
                    <h3 className="text-2xl font-bold text-green-600">Rs. {Math.round(stats.totalProfit).toLocaleString()}</h3>
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
                <th className="p-4 font-semibold text-gray-600">Sale Amount</th>
                <th className="p-4 font-semibold text-gray-600 text-green-600">Profit</th>
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
                    <td className="p-4 font-bold text-gray-800">
                        Rs. {Math.round(sale.totalAmount).toLocaleString()}
                    </td>
                    <td className="p-4 font-bold text-green-600">
                        Rs. {Math.round(sale.profit).toLocaleString()}
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
            <tfoot className="bg-gray-100 font-bold text-gray-900">
                <tr>
                    <td className="p-4" colSpan="2">Total (Current List)</td>
                    <td className="p-4">Rs. {Math.round(stats.totalRevenue).toLocaleString()}</td>
                    <td className="p-4 text-green-700">Rs. {Math.round(stats.totalProfit).toLocaleString()}</td>
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
                            <div key={idx} className="flex justify-between items-center border-b border-dashed border-gray-100 pb-2">
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
                    <button onClick={() => window.print()} className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex justify-center items-center gap-2"><Printer size={16} /> Print</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}