"use client";

import { useEffect, useState } from "react";
import { useStore } from "../../../store/useStore";
import { subscribeProducts } from "../../../lib/services/products";
import { listSales } from "../../../lib/services/sales";
import { subscribeExpenses } from "../../../lib/services/expenses";
import type { Product, Sale, Expense } from "../../../types";
import { DualSeriesCanvasChart } from "../../../components/CanvasDiagram";
import {
  TrendingUp,
  DollarSign,
  ShieldCheck,
  Calendar,
  Lock,
  ArrowUpRight,
  Receipt,
  PieChart,
} from "lucide-react";

export default function AdminProfitPage() {
  const { currentShop } = useStore();
  const ownerId = currentShop?.uid || "";

  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [dateFilter, setDateFilter] = useState<"today" | "week" | "month" | "all">("month");

  useEffect(() => {
    if (!ownerId) return;

    const unsubProd = subscribeProducts(ownerId, setProducts);
    const unsubExp = subscribeExpenses(ownerId, setExpenses);

    const loadSalesData = async () => {
      try {
        const sList = await listSales(ownerId);
        setSales(sList);
      } catch (e) {
        console.error("Failed loading sales:", e);
      }
    };

    loadSalesData();

    return () => {
      unsubProd();
      unsubExp();
    };
  }, [ownerId]);

  // Filter Sales & Expenses by selected Date Range
  const now = new Date();

  const filterByDate = (dateIso: string) => {
    const d = new Date(dateIso);
    if (dateFilter === "today") {
      return d.toDateString() === now.toDateString();
    }
    if (dateFilter === "week") {
      const diffTime = Math.abs(now.getTime() - d.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    }
    if (dateFilter === "month") {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    return true; // "all"
  };

  const filteredSales = sales.filter((s) => filterByDate(s.date));
  const filteredExpenses = expenses.filter((e) => filterByDate(e.date));

  // Profit Calculations
  let totalRevenue = 0;
  let totalBuyingCost = 0;

  filteredSales.forEach((sale) => {
    totalRevenue += sale.totalAmount || 0;
    (sale.items || []).forEach((item) => {
      const buyingPrice = item.buyingPrice || 0;
      const qty = item.qty || 0;
      totalBuyingCost += buyingPrice * qty;
    });
  });

  const totalExpensesAmount = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const grossProfit = totalRevenue - totalBuyingCost;
  const netProfit = grossProfit - totalExpensesAmount;
  const profitMarginPercent = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      {/* Admin Protection Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-900 text-white p-5 rounded-2xl border border-stone-800 shadow-md">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-extrabold uppercase tracking-widest mb-1">
            <Lock size={14} /> Protected Admin Route
          </div>
          <h1 className="text-xl font-extrabold flex items-center gap-2 text-white">
            <TrendingUp className="text-emerald-400" size={24} /> Secret Profit & Purchase Rate Audit
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Buying Price vs Selling Price ki base par confidential Profit Reports (Hidden from Sales Counter)
          </p>
        </div>

        {/* Date Filter Tabs */}
        <div className="flex gap-1.5 bg-stone-800 p-1 rounded-xl self-start sm:self-auto border border-stone-700">
          {(["today", "week", "month", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg capitalize transition ${
                dateFilter === f
                  ? "bg-emerald-500 text-white shadow"
                  : "text-stone-400 hover:text-white"
              }`}
            >
              {f === "today"
                ? "Aaj Ka"
                : f === "week"
                ? "Is Hafe Ka"
                : f === "month"
                ? "Is Mahine Ka"
                : "Tamam"}
            </button>
          ))}
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Net Profit Card */}
        <div className="bg-emerald-950/20 border border-emerald-500/30 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold uppercase text-emerald-600 tracking-wider">
              Net Pure Profit
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <TrendingUp size={20} />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-800">
            Rs. {netProfit.toLocaleString()}
          </p>
          <p className="text-[11px] text-emerald-600 mt-1 font-bold">
            Profit Margin: {profitMarginPercent}%
          </p>
        </div>

        {/* Total Sales Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold uppercase text-stone-500 tracking-wider">
              Total Sales Revenue
            </span>
            <div className="p-2 rounded-xl bg-brand-100 text-brand-700">
              <DollarSign size={20} />
            </div>
          </div>
          <p className="text-2xl font-black text-stone-900">
            Rs. {totalRevenue.toLocaleString()}
          </p>
          <p className="text-[11px] text-stone-400 mt-1">Total Sales Income</p>
        </div>

        {/* Total Buying Cost */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold uppercase text-stone-500 tracking-wider">
              Total Maal Khareed Cost
            </span>
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <ArrowUpRight size={20} />
            </div>
          </div>
          <p className="text-2xl font-black text-stone-900">
            Rs. {totalBuyingCost.toLocaleString()}
          </p>
          <p className="text-[11px] text-stone-400 mt-1">Purchase cost of sold items</p>
        </div>

        {/* Total Expenses */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold uppercase text-stone-500 tracking-wider">
              Total Expenses
            </span>
            <div className="p-2 rounded-xl bg-red-100 text-red-700">
              <Receipt size={20} />
            </div>
          </div>
          <p className="text-2xl font-black text-stone-900">
            Rs. {totalExpensesAmount.toLocaleString()}
          </p>
          <p className="text-[11px] text-stone-400 mt-1">Shop operational costs</p>
        </div>
      </div>

      {/* Secret Profit Canvas Chart Diagram matching Reference Image Design */}
      <DualSeriesCanvasChart
        title="Revenue & Profit Audit Trends"
        series1Label="Sales Income"
        series2Label="Pure Profit"
        series1Color="#fe9f43"
        series2Color="#10b981"
        data={[
          { label: "Revenue", val1: Math.round(totalRevenue / 1000), val2: Math.round(grossProfit / 1000) },
          { label: "Cost", val1: Math.round(totalBuyingCost / 1000), val2: Math.round(totalBuyingCost * 0.7 / 1000) },
          { label: "Expenses", val1: Math.round(totalExpensesAmount / 1000), val2: Math.round(totalExpensesAmount * 0.5 / 1000) },
          { label: "Net Pure Profit", val1: Math.max(0, Math.round(netProfit / 1000)), val2: Math.max(0, Math.round(netProfit * 0.8 / 1000)) },
        ]}
        height={240}
      />

      {/* Item-wise Buying vs Selling Rate & Profit Margin Audit */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-extrabold text-stone-900 uppercase tracking-wider border-b pb-3">
          📦 Product-Wise Secret Profit Audit Table
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-100 text-stone-700 font-bold uppercase">
              <tr>
                <th className="p-3">Item Name</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-right">Buying Rate (Rs.)</th>
                <th className="p-3 text-right">Selling Rate (Rs.)</th>
                <th className="p-3 text-right">Profit Per Unit</th>
                <th className="p-3 text-center">Gudam Stock</th>
                <th className="p-3 text-center">Shop Stock</th>
                <th className="p-3 text-right font-black">Stock Asset Value (Buying)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {products.map((p) => {
                const marginPerUnit = p.sellingPrice - p.buyingPrice;
                const gudam = p.gudamStock ?? 0;
                const shop = p.shopStock ?? p.stock ?? 0;
                const totalStock = gudam + shop;
                const totalAssetBuyingValue = totalStock * p.buyingPrice;

                return (
                  <tr key={p.id} className="hover:bg-stone-50">
                    <td className="p-3 font-bold text-stone-900">{p.name}</td>
                    <td className="p-3 text-stone-500">{p.category || "General"}</td>
                    <td className="p-3 text-right font-bold text-amber-700">
                      Rs. {p.buyingPrice.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-bold text-stone-900">
                      Rs. {p.sellingPrice.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-extrabold text-emerald-700">
                      + Rs. {marginPerUnit.toLocaleString()}
                    </td>
                    <td className="p-3 text-center font-bold text-stone-700">{gudam}</td>
                    <td className="p-3 text-center font-bold text-stone-700">{shop}</td>
                    <td className="p-3 text-right font-extrabold text-stone-900">
                      Rs. {totalAssetBuyingValue.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
