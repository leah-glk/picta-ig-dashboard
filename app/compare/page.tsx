import { Shell } from "@/components/Shell";
import { ComparePicker } from "@/components/ComparePicker";
import { CompareTable } from "@/components/CompareTable";
import {
  currentMonth,
  customRange,
  previousMonth,
  sameMonthLastYear,
  type DateRange,
} from "@/lib/dates";
import { getKpis } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Params = {
  preset?: "mom" | "yoy" | "custom";
  aFrom?: string;
  aTo?: string;
  bFrom?: string;
  bTo?: string;
};

function resolve(sp: Params): { a: DateRange; b: DateRange } {
  const preset = sp.preset ?? "mom";
  if (preset === "custom" && sp.aFrom && sp.aTo && sp.bFrom && sp.bTo) {
    return { a: customRange(sp.aFrom, sp.aTo), b: customRange(sp.bFrom, sp.bTo) };
  }
  const now = currentMonth();
  if (preset === "yoy") return { a: sameMonthLastYear(now), b: now };
  return { a: previousMonth(now), b: now };
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const { a, b } = resolve(sp);
  const [aKpis, bKpis] = await Promise.all([getKpis(a), getKpis(b)]);

  return (
    <Shell>
      <div className="mb-8">
        <div className="text-xs uppercase tracking-wider text-ink-500 font-medium">Compare</div>
        <h1 className="font-display text-5xl text-primary-800 leading-none mt-1">
          {a.label} <span className="text-ink-300">vs.</span> {b.label}
        </h1>
      </div>

      <div className="mb-8">
        <ComparePicker />
      </div>

      <CompareTable a={aKpis} b={bKpis} aLabel={a.label} bLabel={b.label} />

      <p className="mt-6 text-xs text-ink-400">
        Deltas compare {b.label} to {a.label}. Up arrows (orange) = higher in {b.label}; down arrows
        (red) = lower.
      </p>
    </Shell>
  );
}
