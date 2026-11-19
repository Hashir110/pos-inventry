// app/mocks/reports.ts
// TODO: connect logic with backend reporting service in next phase

export interface ReportMetric {
  title: string;
  urdu: string;
  value: string;
  subtext: string;
  change: string;
  positive: boolean;
  barPct: number;
}

export interface CategoryShare {
  name: string;
  sales: string;
  percentage: number;
  color: string;
}

export interface MonthlyTrendPoint {
  month: string;
  revenue: number;
  profit: number;
  expenses: number;
}

export const mockReportMetrics: ReportMetric[] = [
  {
    title: "Total Gross Sales",
    urdu: "مجموعی فروخت",
    value: "Rs. 3,842,500",
    subtext: "4,210 Invoices cleared",
    change: "+14.2%",
    positive: true,
    barPct: 84,
  },
  {
    title: "COGS (Stock Cost)",
    urdu: "خریداری لاگت",
    value: "Rs. 2,890,200",
    subtext: "75.2% of Turnover",
    change: "Margin 24.8%",
    positive: true,
    barPct: 75,
  },
  {
    title: "Gross Profit",
    urdu: "خام منافع",
    value: "Rs. 952,300",
    subtext: "Before Shop Expenses",
    change: "+18.6%",
    positive: true,
    barPct: 25,
  },
  {
    title: "Store Operating Expenses",
    urdu: "دکان کے متفرق اخراجات",
    value: "Rs. 184,500",
    subtext: "Utilities, Fuel, Salaries",
    change: "4.8% of Sales",
    positive: false,
    barPct: 19,
  },
  {
    title: "Net Realized Profit",
    urdu: "خالص منافع",
    value: "Rs. 767,800",
    subtext: "Pure Store Margin",
    change: "20.0% Net",
    positive: true,
    barPct: 80,
  },
  {
    title: "Khata Recovery Rate",
    urdu: "ادھار وصولی شرح",
    value: "Rs. 542,100",
    subtext: "88.4% of Issued Credit",
    change: "+6.5%",
    positive: true,
    barPct: 88,
  },
];

export const mockCategoryShares: CategoryShare[] = [
  { name: "Grocery & Staples", sales: "Rs. 1,420,000", percentage: 37, color: "bg-orange-600" },
  { name: "Dairy & Beverages", sales: "Rs. 890,500", percentage: 23, color: "bg-amber-500" },
  { name: "Snacks & Confectionery", sales: "Rs. 620,000", percentage: 16, color: "bg-emerald-600" },
  { name: "Household Cleaners", sales: "Rs. 480,000", percentage: 13, color: "bg-sky-600" },
  { name: "Personal Care", sales: "Rs. 432,000", percentage: 11, color: "bg-purple-600" },
];

export const mockTopPerformers = [
  { rank: 1, name: "Tapal Danedar Tea 400g", category: "Grocery", sold: "520 pcs", revenue: "Rs. 390,000", margin: "13.3%" },
  { rank: 2, name: "Dalda Cooking Oil 1L", category: "Grocery", sold: "410 pouches", revenue: "Rs. 237,800", margin: "10.5%" },
  { rank: 3, name: "Olper's Full Cream Milk 1L", category: "Dairy", sold: "780 packs", revenue: "Rs. 210,600", margin: "12.5%" },
  { rank: 4, name: "Shan Special Biryani Masala", category: "Spices", sold: "1,140 packs", revenue: "Rs. 136,800", margin: "20.8%" },
  { rank: 5, name: "National Tomato Ketchup 800g", category: "Condiments", sold: "280 pouches", revenue: "Rs. 126,000", margin: "15.6%" },
];
