import { fmtDelta, fmtNum, fmtPct } from "@/lib/format";
import type { Kpis } from "@/lib/queries";

type Row = {
  label: string;
  key: keyof Kpis;
  kind?: "num" | "pct";
};

const ROWS: Row[] = [
  { label: "Total Followers", key: "followers_end" },
  { label: "Reels Posted", key: "reels_posted" },
  { label: "Static Posts", key: "static_posted" },
  { label: "Organic Reach", key: "organic_reach" },
  { label: "Total Views", key: "total_views" },
  { label: "Reel Views", key: "reel_views" },
  { label: "Story Views", key: "story_views" },
  { label: "Page Visits", key: "page_visits" },
  { label: "Saves", key: "saves" },
  { label: "Shares", key: "shares" },
  { label: "Likes", key: "likes" },
  { label: "Comments", key: "comments" },
  { label: "Profile Visits", key: "profile_visits" },
  { label: "Engagement Rate", key: "engagement_rate", kind: "pct" },
];

export function CompareTable({
  a,
  b,
  aLabel,
  bLabel,
}: {
  a: Kpis;
  b: Kpis;
  aLabel: string;
  bLabel: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-ink-200/70 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-ink-50 text-ink-500 text-xs uppercase tracking-wider">
          <tr>
            <th className="text-left font-medium px-5 py-3">Metric</th>
            <th className="text-right font-medium px-5 py-3">{aLabel}</th>
            <th className="text-right font-medium px-5 py-3">{bLabel}</th>
            <th className="text-right font-medium px-5 py-3">Δ</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => {
            const aVal = (a[row.key] ?? 0) as number;
            const bVal = (b[row.key] ?? 0) as number;
            const fmt = row.kind === "pct" ? fmtPct : fmtNum;
            const delta = fmtDelta(bVal, aVal);
            return (
              <tr key={row.key} className="border-t border-ink-100">
                <td className="px-5 py-3 text-ink-700">{row.label}</td>
                <td className="px-5 py-3 text-right num text-ink-800">{fmt(aVal)}</td>
                <td className="px-5 py-3 text-right num text-ink-900 font-medium">{fmt(bVal)}</td>
                <td className="px-5 py-3 text-right num">
                  {delta.zero ? (
                    <span className="text-ink-400">{delta.label}</span>
                  ) : delta.up ? (
                    <span className="font-medium text-success-700 bg-success-50 rounded-full px-2 py-0.5">
                      ↑ {delta.label}
                    </span>
                  ) : (
                    <span className="font-medium text-error-700 bg-error-50 rounded-full px-2 py-0.5">
                      ↓ {delta.label}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
