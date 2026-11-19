// Mocks for Dashboard UI - Phase: Redesign
// TODO: connect logic to dedicated analytics & supplier PO endpoints when backend APIs are implemented.

export interface HourlyDataPoint {
  time: string;
  sales: number;
  expenses: number;
}

export const mockHourlyDistribution: HourlyDataPoint[] = [
  { time: "9 AM", sales: 4200, expenses: 1200 },
  { time: "11 AM", sales: 8500, expenses: 1500 },
  { time: "1 PM", sales: 14200, expenses: 3100 },
  { time: "3 PM", sales: 11000, expenses: 2200 },
  { time: "5 PM", sales: 18400, expenses: 1800 },
  { time: "7 PM", sales: 22000, expenses: 1900 },
  { time: "8:30 PM", sales: 24500, expenses: 1400 }, // Peak
  { time: "10 PM", sales: 16500, expenses: 900 },
  { time: "11 PM", sales: 7800, expenses: 600 },
];

export interface MockTopSellingItem {
  id: string;
  name: string;
  unitsSold: number;
  revenue: number;
  tag: string;
}

export const mockTopSellingFallback: MockTopSellingItem[] = [
  { id: "1", name: "Tapal Danedar Tea 450g", unitsSold: 42, revenue: 31500, tag: "21.2% rev" },
  { id: "2", name: "Dalda Cooking Oil 5L Pouch", unitsSold: 18, revenue: 48600, tag: "32.7% rev" },
  { id: "3", name: "Olper's Milk 1L Pack", unitsSold: 85, revenue: 24650, tag: "High Velocity" },
  { id: "4", name: "National Basmati Rice 5kg", unitsSold: 14, revenue: 19600, tag: "Stable" },
  { id: "5", name: "Panadol 500mg Strip (10s)", unitsSold: 95, revenue: 4750, tag: "OTC Favorite" },
];

export interface MockLowStockItem {
  id: string;
  name: string;
  remaining: number;
  unit: string;
  minSafety: number;
}

export const mockLowStockFallback: MockLowStockItem[] = [
  { id: "1", name: "Rooh Afza 800ml Bottle", remaining: 3, unit: "bottles", minSafety: 20 },
  { id: "2", name: "Guard Super Basmati Rice 10kg", remaining: 2, unit: "bags", minSafety: 15 },
  { id: "3", name: "Shan Biryani Masala 50g", remaining: 5, unit: "packs", minSafety: 30 },
  { id: "4", name: "Ariel Washing Powder 1kg", remaining: 4, unit: "packs", minSafety: 25 },
];
