// app/lib/services/analytics.ts
import { listSales, listSalesInRange } from "./sales";
import { listExpenses, listExpensesInRange } from "./expenses";
import { listProducts } from "./products";
import { listAllPayments } from "./customers";
import type { Sale, Expense, Product } from "../../types";
import { saleNetAmount } from "../calc";

export interface ReportMetricData {
  title: string;
  urdu: string;
  value: string;
  subtext: string;
  change: string;
  positive: boolean;
  barPct: number;
}

export interface CategoryShareData {
  name: string;
  sales: string;
  percentage: number;
  color: string;
}

export interface TopPerformerData {
  rank: number;
  name: string;
  category: string;
  sold: string;
  revenue: string;
  margin: string;
}

export interface AnalyticsSummary {
  metrics: ReportMetricData[];
  topPerformers: TopPerformerData[];
  categoryShares: CategoryShareData[];
  invoicesCleared: number;
}

export interface HourlyChartPoint {
  time: string;
  sales: number;
  expenses: number;
}

const CATEGORY_COLORS = [
  "bg-orange-600",
  "bg-amber-500",
  "bg-emerald-600",
  "bg-sky-600",
  "bg-purple-600",
  "bg-rose-500",
  "bg-indigo-600",
  "bg-teal-500",
];

export const getDateRangeBounds = (rangeKey: string): { start?: string; end?: string; label: string } => {
  const now = new Date();
  const formatYMD = (d: Date) => d.toISOString().split("T")[0];

  const todayStr = formatYMD(now);

  switch (rangeKey) {
    case "Today":
      return { start: todayStr, end: todayStr, label: "Today" };

    case "This Week": {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(now.setDate(diff));
      return { start: formatYMD(monday), end: todayStr, label: "This Week" };
    }

    case "This Month":
    case "This Month (Oct 2024)": {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: formatYMD(firstDay), end: todayStr, label: now.toLocaleString("en-US", { month: "short", year: "numeric" }) };
    }

    case "Last 30 Days": {
      const past30 = new Date();
      past30.setDate(past30.getDate() - 30);
      return { start: formatYMD(past30), end: todayStr, label: "Last 30 Days" };
    }

    case "This Fiscal Quarter": {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const qStart = new Date(now.getFullYear(), qMonth, 1);
      return { start: formatYMD(qStart), end: todayStr, label: "This Quarter" };
    }

    default:
      return { label: rangeKey };
  }
};

export const fetchAnalyticsReport = async (
  ownerId: string,
  timeRangeKey: string
): Promise<AnalyticsSummary> => {
  const { start, end } = getDateRangeBounds(timeRangeKey);

  // Fetch sales and expenses in parallel
  const [sales, expenses, products, payments] = await Promise.all([
    start && end ? listSalesInRange(ownerId, start, end) : listSales(ownerId),
    start && end ? listExpensesInRange(ownerId, start, end) : listExpenses(ownerId),
    listProducts(ownerId),
    listAllPayments(ownerId),
  ]);

  // Product price lookup map
  const productMap = new Map<string, Product>();
  products.forEach((p) => productMap.set(p.id, p));

  // 1. Calculate Gross Sales & COGS
  let totalGrossSales = 0;
  let totalCOGS = 0;
  let totalUdharIssued = 0;

  // Item-level velocity & revenue tracking
  const itemMap = new Map<
    string,
    { name: string; category: string; units: number; revenue: number; cost: number }
  >();

  // Category revenue tracking
  const catRevenueMap = new Map<string, number>();

  sales.forEach((sale) => {
    const net = saleNetAmount(sale);
    totalGrossSales += net;

    if (sale.paymentMethod === "Udhar") {
      totalUdharIssued += net;
    }

    (sale.items || []).forEach((item) => {
      const qty = Number(item.qty) || 1;
      const lineRev = Number(item.total) || qty * Number(item.price || 0);

      // COGS for this item: item.buyingPrice or lookup from product catalog
      const matchedProd = item.productId ? productMap.get(item.productId) : undefined;
      const unitBuying = Number(item.buyingPrice) || (matchedProd ? Number(matchedProd.buyingPrice) : 0) || Number(item.price || 0) * 0.75;
      const lineCost = qty * unitBuying;

      totalCOGS += lineCost;

      const itemKey = item.name.trim().toLowerCase();
      const existing = itemMap.get(itemKey);
      const cat = matchedProd?.category || "General";

      if (existing) {
        existing.units += qty;
        existing.revenue += lineRev;
        existing.cost += lineCost;
      } else {
        itemMap.set(itemKey, {
          name: item.name,
          category: cat,
          units: qty,
          revenue: lineRev,
          cost: lineCost,
        });
      }

      catRevenueMap.set(cat, (catRevenueMap.get(cat) || 0) + lineRev);
    });
  });

  // 2. Expenses
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // 3. Profits
  const grossProfit = Math.max(0, totalGrossSales - totalCOGS);
  const grossMarginPct = totalGrossSales > 0 ? (grossProfit / totalGrossSales) * 100 : 0;

  const netProfit = Math.max(0, grossProfit - totalExpenses);
  const netMarginPct = totalGrossSales > 0 ? (netProfit / totalGrossSales) * 100 : 0;

  // 4. Khata Recovery
  const totalRecovered = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const recoveryPct = totalUdharIssued > 0 ? Math.min(100, Math.round((totalRecovered / totalUdharIssued) * 100)) : 100;

  // Build Top Performers Table
  const sortedItems = Array.from(itemMap.values()).sort((a, b) => b.revenue - a.revenue);
  const topPerformers: TopPerformerData[] = sortedItems.slice(0, 5).map((item, idx) => {
    const marginVal = item.revenue > 0 ? Math.round(((item.revenue - item.cost) / item.revenue) * 100) : 0;
    return {
      rank: idx + 1,
      name: item.name,
      category: item.category,
      sold: `${item.units.toLocaleString()} pcs`,
      revenue: `Rs. ${Math.round(item.revenue).toLocaleString()}`,
      margin: `${marginVal}%`,
    };
  });

  // Build Category Distribution
  let colorIdx = 0;
  const categoryShares: CategoryShareData[] = Array.from(catRevenueMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([catName, catSales]) => {
      const pct = totalGrossSales > 0 ? Math.round((catSales / totalGrossSales) * 100) : 0;
      const color = CATEGORY_COLORS[colorIdx % CATEGORY_COLORS.length];
      colorIdx++;
      return {
        name: catName || "General",
        sales: `Rs. ${Math.round(catSales).toLocaleString()}`,
        percentage: pct,
        color,
      };
    });

  // Format 6 KPI Metric Cards
  const cogsPct = totalGrossSales > 0 ? Math.round((totalCOGS / totalGrossSales) * 100) : 0;
  const expPct = totalGrossSales > 0 ? ((totalExpenses / totalGrossSales) * 100).toFixed(1) : "0";

  const metrics: ReportMetricData[] = [
    {
      title: "Total Gross Sales",
      urdu: "مجموعی فروخت",
      value: `Rs. ${Math.round(totalGrossSales).toLocaleString()}`,
      subtext: `${sales.length.toLocaleString()} Invoices cleared`,
      change: `${sales.length} orders`,
      positive: true,
      barPct: Math.min(100, Math.max(10, Math.round(grossMarginPct))),
    },
    {
      title: "COGS (Stock Cost)",
      urdu: "خریداری لاگت",
      value: `Rs. ${Math.round(totalCOGS).toLocaleString()}`,
      subtext: `${cogsPct}% of Turnover`,
      change: `Margin ${Math.round(grossMarginPct)}%`,
      positive: true,
      barPct: Math.min(100, cogsPct),
    },
    {
      title: "Gross Profit",
      urdu: "خام منافع",
      value: `Rs. ${Math.round(grossProfit).toLocaleString()}`,
      subtext: "Before Shop Expenses",
      change: `${Math.round(grossMarginPct)}% Margin`,
      positive: true,
      barPct: Math.min(100, Math.max(15, Math.round(grossMarginPct))),
    },
    {
      title: "Store Operating Expenses",
      urdu: "دکان کے متفرق اخراجات",
      value: `Rs. ${Math.round(totalExpenses).toLocaleString()}`,
      subtext: `${expenses.length} Vouchers recorded`,
      change: `${expPct}% of Sales`,
      positive: false,
      barPct: Math.min(100, Math.max(5, Math.round(Number(expPct)))),
    },
    {
      title: "Net Realized Profit",
      urdu: "خالص منافع",
      value: `Rs. ${Math.round(netProfit).toLocaleString()}`,
      subtext: "Pure Store Margin",
      change: `${netMarginPct.toFixed(1)}% Net`,
      positive: true,
      barPct: Math.min(100, Math.max(10, Math.round(netMarginPct))),
    },
    {
      title: "Khata Recovery Rate",
      urdu: "ادھار وصولی شرح",
      value: `Rs. ${Math.round(totalRecovered).toLocaleString()}`,
      subtext: `Recovered against credit`,
      change: `${recoveryPct}% Rate`,
      positive: true,
      barPct: recoveryPct,
    },
  ];

  return {
    metrics,
    topPerformers,
    categoryShares,
    invoicesCleared: sales.length,
  };
};

/**
 * Live Hourly Sales Distribution
 * Aggregates today's invoices into 9 standard trading hour buckets
 */
export const aggregateHourlyDistribution = (
  todaySales: Sale[],
  todayExpenses: Expense[]
): HourlyChartPoint[] => {
  const buckets: { time: string; startHour: number; endHour: number }[] = [
    { time: "9 AM", startHour: 8, endHour: 10 },
    { time: "11 AM", startHour: 10, endHour: 12 },
    { time: "1 PM", startHour: 12, endHour: 14 },
    { time: "3 PM", startHour: 14, endHour: 16 },
    { time: "5 PM", startHour: 16, endHour: 18 },
    { time: "7 PM", startHour: 18, endHour: 20 },
    { time: "8:30 PM", startHour: 20, endHour: 21.5 },
    { time: "10 PM", startHour: 21.5, endHour: 23 },
    { time: "11 PM", startHour: 23, endHour: 24 },
  ];

  const result: HourlyChartPoint[] = buckets.map((b) => ({
    time: b.time,
    sales: 0,
    expenses: 0,
  }));

  const getHour = (dateStr: string): number => {
    try {
      const d = new Date(dateStr);
      return d.getHours() + d.getMinutes() / 60;
    } catch {
      return 12;
    }
  };

  todaySales.forEach((sale) => {
    const h = getHour(sale.date);
    const amount = saleNetAmount(sale);
    for (let i = 0; i < buckets.length; i++) {
      if (h >= buckets[i].startHour && h < buckets[i].endHour) {
        result[i].sales += amount;
        break;
      }
    }
  });

  todayExpenses.forEach((exp) => {
    const h = getHour(exp.date);
    const amount = Number(exp.amount) || 0;
    for (let i = 0; i < buckets.length; i++) {
      if (h >= buckets[i].startHour && h < buckets[i].endHour) {
        result[i].expenses += amount;
        break;
      }
    }
  });

  return result;
};
