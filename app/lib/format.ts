/** Rs. 5,850 */
export const formatMoney = (n: number): string => `Rs. ${Math.round(n).toLocaleString()}`;

/** Oct 13, 2026, 01:47 PM */
export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const belowThousand = (n: number): string => {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : ""));
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(" ");
};

/** 49700 -> "Forty Nine Thousand Seven Hundred Only" (Lakh / Crore hisaab) */
export const amountInWords = (amount: number): string => {
  let n = Math.round(Math.abs(amount));
  if (n === 0) return "Zero Only";
  const units: [number, string][] = [
    [10000000, "Crore"],
    [100000, "Lakh"],
    [1000, "Thousand"],
  ];
  const parts: string[] = [];
  for (const [size, name] of units) {
    if (n >= size) {
      parts.push(`${belowThousand(Math.floor(n / size))} ${name}`);
      n %= size;
    }
  }
  if (n > 0) parts.push(belowThousand(n));
  return `${parts.join(" ")} Only`;
};
export const COUNTER_SALE = "Counter Sale";

export const isCounterSale = (name?: string): boolean => {
  const n = (name ?? "").trim().toLowerCase();
  return n === "" || n === "walk-in" || n === "counter sale";
};

export const customerLabel = (name?: string): string => (isCounterSale(name) ? COUNTER_SALE : (name as string));