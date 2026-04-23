import { Shell } from "@/components/Shell";
import { KpiCard } from "@/components/KpiCard";
import { RangePicker } from "@/components/RangePicker";
import { TrendChart } from "@/components/TrendChart";
import { YearlyBarChart } from "@/components/YearlyBarChart";
import { TopPostsSection } from "@/components/TopPosts";
import { currentMonth, customRange, fmtMonthInput, monthRange } from "@/lib/dates";
import {
  getKpis,
  getMonthlyBars,
  getTopPosts,
  getTrend,
  getStoryDataAvailableFrom,
} from "@/lib/queries";
import { fmtNum, fmtPct } from "@/lib/format";

export const dynamic = "force-dynamic";

function rangeFromSearch(sp: { month?: string; from?: string; to?: string }) {
  if (sp.from && sp.to) return customRange(sp.from, sp.to);
  if (sp.month) {
    const [y, m] = sp.month.split("-").map(Number);
    if (y && m) return monthRange(y, m - 1);
  }
  return currentMonth();
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const range = rangeFromSearch(sp);

  const [kpis, trend, yearly, topStatics, topReels, storyFrom] = await Promise.all([
    getKpis(range),
    getTrend(range),
    getMonthlyBars(12),
    getTopPosts(range, "static", 4),
    getTopPosts(range, "reel", 2),
    getStoryDataAvailableFrom(),
  ]);

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
        <div>
          <div className="text-xs uppercase tracking-wider text-ink-500 font-medium">
            Performance
          </div>
          <h1 className="font-display text-5xl text-primary-800 leading-none mt-1">
            {range.label}
          </h1>
        </div>
        <RangePicker defaultMonth={fmtMonthInput(range.start)} />
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <KpiCard
          label="Total Followers"
          value={kpis.followers_end}
          tone="primary"
          big
          sublabel={
            kpis.followers_delta != null
              ? `${kpis.followers_delta >= 0 ? "+" : ""}${fmtNum(kpis.followers_delta)} this period`
              : "no data yet"
          }
        />
        <KpiCard label="Organic Reach" value={kpis.organic_reach} big tone="primary" />
        <KpiCard label="Total Views" value={kpis.total_views} big tone="primary" />
        <KpiCard
          label="Engagement Rate"
          value={fmtPct(kpis.engagement_rate, 2)}
          big
          tone="tertiary"
          sublabel="(likes + comments + saves + shares) / views"
        />
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <KpiCard label="Reels Posted" value={kpis.reels_posted} />
        <KpiCard label="Static Posts" value={kpis.static_posted} />
        <KpiCard label="Page Visits" value={kpis.page_visits} />
        <KpiCard label="Reel Views" value={kpis.reel_views} />
        <KpiCard label="Story Views" value={kpis.story_views} />
        <KpiCard label="Saves" value={kpis.saves} />
        <KpiCard label="Shares" value={kpis.shares} />
        <KpiCard label="Comments" value={kpis.comments} />
      </section>

      <section className="mb-10">
        <TrendChart data={trend} />
      </section>

      <section className="mb-10">
        <YearlyBarChart data={yearly} />
      </section>

      <section className="mb-16 rounded-2xl bg-white border border-ink-200/70 p-6 card">
        <div className="text-[11px] uppercase tracking-wider text-ink-500 font-medium mb-4">
          Content interactions
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-6">
          <Stat label="Likes" value={kpis.likes} />
          <Stat label="Comments" value={kpis.comments} />
          <Stat label="Shares" value={kpis.shares} />
          <Stat label="Replies" value={kpis.replies} />
          <Stat label="Saves" value={kpis.saves} />
          <Stat label="Profile Visits" value={kpis.profile_visits} />
        </div>
      </section>

      <TopPostsSection statics={topStatics} reels={topReels} />

      {storyFrom && (
        <p className="mt-12 text-xs text-ink-400 text-center">
          Story data available from {storyFrom}
        </p>
      )}
    </Shell>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div>
      <div className="text-xs text-ink-500">{label}</div>
      <div className="mt-1 font-display text-2xl num text-ink-900">{fmtNum(value)}</div>
    </div>
  );
}
