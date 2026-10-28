import HiddenAmount from "./HiddenAmount";

interface SummaryBoxProps {
  label: string;
  value: string | number;
  tone?: "default" | "amber" | "emerald";
  isPrivate?: boolean;
}

export default function SummaryBox({ label, value, tone = "default", isPrivate = false }: SummaryBoxProps) {
  const styles =
    tone === "amber"
      ? "border-amber-200 bg-amber-50"
      : tone === "emerald"
      ? "border-emerald-200 bg-emerald-50"
      : "border-stone-200 bg-white shadow-card";
  const labelColor =
    tone === "amber"
      ? "text-amber-700"
      : tone === "emerald"
      ? "text-emerald-700"
      : "text-stone-500";

  return (
    <div className={`rounded-xl border px-4 py-2 ${styles}`}>
      <p className={`text-[11px] font-bold uppercase tracking-wider ${labelColor}`}>{label}</p>
      {isPrivate ? (
        <HiddenAmount value={String(value)} className="tabular text-lg font-extrabold text-stone-900" iconSize={15} />
      ) : (
        <p className="tabular text-lg font-extrabold text-stone-900">{value}</p>
      )}
    </div>
  );
}
