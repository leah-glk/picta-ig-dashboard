import { fmtNum, fmtPct } from "@/lib/format";

export function KpiCard({
  label,
  value,
  sublabel,
  tone = "default",
  big = false,
}: {
  label: string;
  value: number | string | null | undefined;
  sublabel?: string;
  tone?: "default" | "primary" | "tertiary";
  big?: boolean;
}) {
  const valueStr =
    typeof value === "number"
      ? fmtNum(value)
      : value == null
        ? "—"
        : value;

  const valueColor =
    tone === "primary"
      ? "text-primary-700"
      : tone === "tertiary"
        ? "text-tertiary-600"
        : "text-ink-900";

  return (
    <div className="rounded-2xl bg-white border border-ink-200/70 p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
      <div className="text-[11px] uppercase tracking-wider text-ink-500 font-medium">{label}</div>
      <div
        className={`mt-2 font-display num ${valueColor} ${
          big ? "text-5xl" : "text-3xl"
        } leading-none`}
      >
        {valueStr}
      </div>
      {sublabel && <div className="mt-2 text-xs text-ink-500">{sublabel}</div>}
    </div>
  );
}

export function PctKpiCard({
  label,
  value,
  digits = 2,
}: {
  label: string;
  value: number | null | undefined;
  digits?: number;
}) {
  return (
    <KpiCard
      label={label}
      value={fmtPct(value, digits)}
      tone="tertiary"
    />
  );
}
