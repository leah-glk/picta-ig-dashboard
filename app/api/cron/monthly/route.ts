import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { snapshotMonth, snapshotMissingMonths } from "@/lib/snapshots";
import { currentMonth, monthRange } from "@/lib/dates";
import { syncRange } from "@/lib/sync";

// Monthly KPI snapshot cron.
// Runs on the 1st of each month at 13:00 UTC (~8am ET / 9am EDT) — see vercel.json.
// Snapshots the calendar month that just ended, freezing its KPIs.
//
// Manual usage:
//   curl -X POST '/api/cron/monthly?backfill=2025-01' -H 'Authorization: Bearer $CRON_SECRET'
//     → snapshot every closed month from Jan 2025 forward that doesn't have one yet
//
//   curl '/api/cron/monthly' -H 'Authorization: Bearer $CRON_SECRET'
//     → snapshot the previous calendar month (cron's normal behavior)

export const runtime = "nodejs";
export const maxDuration = 300;

async function handle(request: Request) {
  const auth = request.headers.get("authorization");
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const backfill = searchParams.get("backfill"); // "YYYY-MM" — snapshot from this month forward

  if (backfill) {
    const m = backfill.match(/^(\d{4})-(\d{2})$/);
    if (!m) {
      return NextResponse.json({ error: "backfill must be YYYY-MM" }, { status: 400 });
    }
    const result = await snapshotMissingMonths(Number(m[1]), Number(m[2]) - 1);
    return NextResponse.json({ ok: true, mode: "backfill", ...result });
  }

  // Default: re-sync the previous calendar month (so view counts on older
  // posts are refreshed to their current values), then snapshot it.
  // Without this re-sync, posts that fell out of the daily cron's 7-day
  // window would have stale view counts at snapshot time.
  const now = currentMonth();
  const prev = new Date(now.start);
  prev.setUTCMonth(prev.getUTCMonth() - 1);
  const y = prev.getUTCFullYear();
  const m0 = prev.getUTCMonth();

  const range = monthRange(y, m0);
  const syncStats = await syncRange({
    since: range.start,
    until: range.end,
    label: `monthly-refresh:${y}-${String(m0 + 1).padStart(2, "0")}`,
  });

  const kpis = await snapshotMonth(y, m0);
  return NextResponse.json({
    ok: true,
    mode: "previous-month",
    month: `${y}-${String(m0 + 1).padStart(2, "0")}`,
    sync: syncStats,
    kpis,
  });
}

export const GET = handle;
export const POST = handle;
