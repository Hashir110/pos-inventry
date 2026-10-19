interface SummaryBoxProps {
  label: string;
  value: string | number;
  tone?: "default" | "amber";
}

export default function SummaryBox({ label, value, tone = "default" }: SummaryBoxProps) {
  const styles =
    tone === "amber"
      ? "border-amber-200 bg-amber-50"
      : "border-stone-200 bg-white shadow-card";
  const labelColor = tone === "amber" ? "text-amber-700" : "text-stone-500";

  return (
    <div className={`rounded-xl border px-4 py-2 ${styles}`}>
      <p className={`text-[11px] font-bold uppercase tracking-wider ${labelColor}`}>{label}</p>
      <p className="tabular text-lg font-extrabold text-stone-900">{value}</p>
    </div>
  );
}
