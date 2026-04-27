import { NextResponse } from "next/server";
import { fromZonedTime } from "date-fns-tz";
import { supabaseAdmin } from "@/lib/supabase";
import { env } from "@/lib/env";

// Meta Business Suite CSV "Publish time" has no timezone suffix. The export
// is rendered in the account's timezone (America/New_York for @pictaphotoapp),
// so we parse it as ET and convert to UTC ISO. Without this, end-of-day stories
// shift to wrong calendar days (~6% drift on monthly story view totals).
const CSV_TZ = "America/New_York";

function parseMetaCsvDate(raw: string): Date | null {
  // Meta emits e.g. "12/31/2025 10:59" — month/day/year H:MM.
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!m) {
    // Fallback to native parsing for any odd row.
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  const [, mm, dd, yyyy, hh, min] = m;
  const isoLocal = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")} ${hh.padStart(2, "0")}:${min}:00`;
  try {
    return fromZonedTime(isoLocal, CSV_TZ);
  } catch {
    return null;
  }
}

export const runtime = "nodejs";
export const maxDuration = 300;

// Meta Business Suite CSV importer.
// Exports from Business Suite vary slightly in column order between date
// ranges; we match by header name (case-insensitive).
//
// Columns we capture (case-insensitive, any alias):
//   Post ID, Publish time, Permalink, Description, Duration (sec),
//   Views, Reach, Likes, Shares, Replies, Follows, Profile visits,
//   Link clicks, Sticker taps
//
// Explicitly ignored per product decision: "Navigation" (unreliable metric).
// Rows with "Data comment" errors (no metrics computed) are skipped silently.

type Row = Record<string, string>;

const ALIASES: Record<string, string[]> = {
  ig_id:         ["post id", "id"],
  date:          ["publish time", "published", "publish date", "date", "time"],
  description:   ["description"],
  permalink:     ["permalink"],
  duration:      ["duration (sec)", "duration"],
  views:         ["views", "impressions", "story views"],
  reach:         ["reach", "accounts reached"],
  likes:         ["likes"],
  shares:        ["shares", "story shares"],
  replies:       ["replies", "story replies"],
  follows:       ["follows"],
  profile_visits:["profile visits"],
  link_clicks:   ["link clicks"],
  sticker_taps:  ["sticker taps"],
  data_comment:  ["data comment"],
  post_type:     ["post type"],
};

function headerMap(header: string[]): Record<string, number> {
  const norm = header.map((h) => h.trim().toLowerCase());
  const out: Record<string, number> = {};
  for (const [key, aliases] of Object.entries(ALIASES)) {
    for (const a of aliases) {
      const i = norm.indexOf(a);
      if (i !== -1) {
        out[key] = i;
        break;
      }
    }
  }
  return out;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      /* ignore */
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function num(s: string | undefined): number {
  if (!s) return 0;
  const n = Number(s.replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ct = request.headers.get("content-type") ?? "";
  let csvText = "";
  if (ct.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "no file" }, { status: 400 });
    }
    csvText = await file.text();
  } else {
    csvText = await request.text();
  }

  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return NextResponse.json({ error: "empty csv" }, { status: 400 });
  }

  const hmap = headerMap(rows[0]);
  if (hmap.date === undefined || hmap.views === undefined || hmap.reach === undefined) {
    return NextResponse.json(
      {
        error: "missing required columns",
        need: ["publish time", "views", "reach"],
        got: rows[0],
      },
      { status: 400 },
    );
  }

  const stats = { parsed: 0, skipped_error_rows: 0, skipped_no_date: 0 };
  const parsed: Array<{
    ig_id: string | null;
    published_at: string;
    description: string | null;
    permalink: string | null;
    duration_sec: number;
    views: number;
    reach: number;
    likes: number;
    shares: number;
    replies: number;
    follows: number;
    profile_visits: number;
    link_clicks: number;
    sticker_taps: number;
    source: string;
    raw: Row;
  }> = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const get = (key: string) =>
      hmap[key] !== undefined ? row[hmap[key]]?.trim() : undefined;

    // Meta sometimes emits error rows with no Post ID and a "Data comment" starting
    // with "An error occurred". Skip those silently.
    const dataComment = get("data_comment");
    if (dataComment && /error/i.test(dataComment) && !get("ig_id")) {
      stats.skipped_error_rows++;
      continue;
    }

    const rawDate = get("date");
    if (!rawDate) {
      stats.skipped_no_date++;
      continue;
    }
    const d = parseMetaCsvDate(rawDate);
    if (!d) {
      stats.skipped_no_date++;
      continue;
    }

    // Keep only IG story rows if Post type is present.
    const postType = get("post_type");
    if (postType && !/story/i.test(postType)) continue;

    parsed.push({
      ig_id: get("ig_id") || null,
      published_at: d.toISOString(),
      description: get("description") || null,
      permalink: get("permalink") || null,
      duration_sec: num(get("duration")),
      views: num(get("views")),
      reach: num(get("reach")),
      likes: num(get("likes")),
      shares: num(get("shares")),
      replies: num(get("replies")),
      follows: num(get("follows")),
      profile_visits: num(get("profile_visits")),
      link_clicks: num(get("link_clicks")),
      sticker_taps: num(get("sticker_taps")),
      source: "meta_business_suite_csv",
      raw: Object.fromEntries(rows[0].map((h, i) => [h, row[i] ?? ""])),
    });
    stats.parsed++;
  }

  const db = supabaseAdmin();
  // Dedupe on ig_id where present (re-importing the same CSV won't double-count).
  const withId = parsed.filter((p) => p.ig_id);
  const withoutId = parsed.filter((p) => !p.ig_id);

  let imported = 0;
  if (withId.length > 0) {
    const { error, count } = await db
      .from("instagram_story_imports")
      .upsert(withId, { onConflict: "ig_id", count: "exact" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    imported += count ?? withId.length;
  }
  if (withoutId.length > 0) {
    const { error, count } = await db
      .from("instagram_story_imports")
      .insert(withoutId, { count: "exact" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    imported += count ?? withoutId.length;
  }

  return NextResponse.json({ ok: true, imported, stats });
}
