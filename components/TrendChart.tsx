"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtNum } from "@/lib/format";

export function TrendChart({ data }: { data: { date: string; views: number; reach: number }[] }) {
  return (
    <div className="rounded-2xl bg-white border border-ink-200/70 p-5">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-500 font-medium">Daily performance</div>
          <div className="font-display text-xl text-ink-900">Views & reach</div>
        </div>
        <div className="flex gap-4 text-xs">
          <Legend color="var(--color-primary-500)" label="Views" />
          <Legend color="var(--color-tertiary-500)" label="Reach" />
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="fillViews" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary-500)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--color-primary-500)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillReach" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-tertiary-500)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--color-tertiary-500)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-ink-200)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "var(--color-ink-500)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(d: string) => d.slice(5)}
            />
            <YAxis
              tick={{ fill: "var(--color-ink-500)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(n: number) => fmtNum(n)}
              width={40}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid var(--color-ink-200)",
                fontFamily: "var(--font-inter)",
                fontSize: 12,
              }}
              formatter={(v) => fmtNum(Number(v))}
            />
            <Area
              type="monotone"
              dataKey="views"
              stroke="var(--color-primary-500)"
              strokeWidth={2}
              fill="url(#fillViews)"
            />
            <Area
              type="monotone"
              dataKey="reach"
              stroke="var(--color-tertiary-500)"
              strokeWidth={2}
              fill="url(#fillReach)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-ink-500">
      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
