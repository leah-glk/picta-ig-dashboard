// Monthly KPI snapshots — freeze past-month numbers so they don't drift as
// Meta finalizes totals and individual posts keep accumulating views.

import { supabaseAdmin } from "./supabase";
import { monthRange, currentMonth, type DateRange } from "./dates";
import { computeKpis, type Kpis } from "./queries";

export type Snapshot = {
  month: string; // YYYY-MM-DD (first day)
  kpis: Kpis;
  frozen_at: string;
};

function monthKey(range: DateRange): string {
  return range.start.toISOString().slice(0, 10);
}

export async function loadSnapshot(range: DateRange): Promise<Kpis | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("instagram_monthly_snapshots")
    .select("kpis")
    .eq("month", monthKey(range))
    .maybeSingle();
  return (data?.kpis as Kpis | undefined) ?? null;
}

export async function getSnapshotMeta(
  range: DateRange,
): Promise<{ frozen_at: string } | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("instagram_monthly_snapshots")
    .select("frozen_at")
    .eq("month", monthKey(range))
    .maybeSingle();
  return data ?? null;
}

export async function snapshotMonth(year: number, monthIndex0: number): Promise<Kpis> {
  const range = monthRange(year, monthIndex0);
  const kpis = await computeKpis(range);
  const db = supabaseAdmin();
  await db
    .from("instagram_monthly_snapshots")
    .upsert(
      { month: monthKey(range), kpis, frozen_at: new Date().toISOString() },
      { onConflict: "month" },
    );
  return kpis;
}

/**
 * Snapshot every closed month (i.e. anything before the current month) for
 * which a snapshot doesn't already exist. Idempotent. Run once on rollout
 * and any time we want to backfill missing months.
 */
export async function snapshotMissingMonths(
  startYear: number,
  startMonthIndex0: number,
): Promise<{ taken: string[]; skipped: string[] }> {
  const db = supabaseAdmin();
  const { data: existing } = await db
    .from("instagram_monthly_snapshots")
    .select("month");
  const have = new Set((existing ?? []).map((r) => r.month as string));

  const curStart = currentMonth().start.getTime();
  const taken: string[] = [];
  const skipped: string[] = [];

  let y = startYear;
  let m = startMonthIndex0;
  while (true) {
    const range = monthRange(y, m);
    if (range.start.getTime() >= curStart) break; // stop at the current (in-progress) month
    const key = monthKey(range);
    if (have.has(key)) {
      skipped.push(key);
    } else {
      await snapshotMonth(y, m);
      taken.push(key);
    }
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return { taken, skipped };
}
