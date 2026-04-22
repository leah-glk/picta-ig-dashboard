import { NextResponse } from "next/server";
import { syncRange } from "@/lib/sync";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 300;

// Chunked backfill endpoint — runs one month per call so it fits inside the
// 300s Hobby plan limit. Loop from the CLI to cover the full Jan 2025 → now range.
//
// Required auth: Authorization: Bearer <CRON_SECRET>
//
// Usage:
//   POST /api/backfill?month=2025-01     → backfills Jan 2025
//   POST /api/backfill?from=2025-01-01&to=2025-02-01  → custom range
//
// Open-ended calls are rejected so nothing tries to sync 16 months in one
// invocation and get killed by the function timeout.

function parseRange(url: URL): { since: Date; until: Date; label: string } | { error: string } {
  const month = url.searchParams.get("month");
  if (month) {
    const match = /^(\d{4})-(\d{2})$/.exec(month);
    if (!match) return { error: "month must be YYYY-MM" };
    const y = Number(match[1]);
    const m = Number(match[2]); // 1-12
    const since = new Date(Date.UTC(y, m - 1, 1));
    const until = new Date(Date.UTC(y, m, 1));
    return { since, until, label: `backfill:${month}` };
  }
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from && to) {
    const since = new Date(`${from}T00:00:00Z`);
    const until = new Date(`${to}T00:00:00Z`);
    if (isNaN(since.getTime()) || isNaN(until.getTime())) {
      return { error: "from/to must be YYYY-MM-DD" };
    }
    if (until.getTime() - since.getTime() > 45 * 86400 * 1000) {
      return { error: "range too large; use ≤45 days per call to fit 300s limit" };
    }
    return { since, until, label: `backfill:${from}..${to}` };
  }
  return {
    error:
      "Specify ?month=YYYY-MM or ?from=YYYY-MM-DD&to=YYYY-MM-DD. Open-ended backfill is disabled on Hobby plan (300s limit).",
  };
}

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  const expected = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null;
  if (!expected || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = parseRange(new URL(request.url));
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  try {
    const stats = await syncRange(parsed);
    return NextResponse.json({ ok: true, window: parsed.label, stats });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
