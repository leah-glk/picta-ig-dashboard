"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend as RcLegend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtNum } from "@/lib/format";

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function labelFor(ym: string) {
  const [, m] = ym.split("-").map(Number);
  return MONTH_ABBR[m - 1];
}

export function YearlyBarChart({
  data,
}: {
  data: { month: string; views: number; reach: number }[];
}) {
  const display = data.map((d) => ({ ...d, label: labelFor(d.month) }));
  return (
    <div className="rounded-2xl bg-white border border-ink-200/70 p-5 card">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-500 font-medium">
            {new Date().getFullYear()} year to date
          </div>
          <div className="font-display text-xl text-ink-900">Views &amp; reach by month</div>
        </div>
        <div className="flex gap-4 text-xs">
          <Swatch color="var(--color-primary-500)" label="Views" />
          <Swatch color="var(--color-tertiary-500)" label="Reach" />
        </div>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={display} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--color-ink-200)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--color-ink-500)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: "var(--color-ink-500)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(n: number) => fmtNum(n)}
              width={48}
            />
            <Tooltip
              cursor={{ fill: "var(--color-primary-50)" }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid var(--color-ink-200)",
                fontFamily: "var(--font-inter)",
                fontSize: 12,
              }}
              formatter={(v) => fmtNum(Number(v))}
            />
            <RcLegend wrapperStyle={{ display: "none" }} />
            <Bar dataKey="views" fill="var(--color-primary-500)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="reach" fill="var(--color-tertiary-500)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-ink-500">
      <span className="inline-block w-2.5 h-2.5 rounded-[3px]" style={{ background: color }} />
      {label}
    </span>
  );
}
