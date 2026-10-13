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
