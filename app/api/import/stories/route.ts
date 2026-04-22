import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 300;

// Accepts a CSV exported from Meta Business Suite (Content → Stories → Export).
// Column names vary by export locale; we match on a few common aliases.
//
// Required columns (any of these aliases):
//   date:    "Publish time" | "Published" | "Publish Date" | "Date"
//   views:   "Views" | "Impressions" | "Story views"
//   reach:   "Reach" | "Accounts reached"
//   replies: "Replies" | "Story replies"    (optional)
//   shares:  "Shares" | "Story shares"      (optional)

const ALIASES = {
  date: ["publish time", "published", "publish date", "date", "time"],
  views: ["views", "impressions", "story views"],
  reach: ["reach", "accounts reached"],
  replies: ["replies", "story replies"],
  shares: ["shares", "story shares"],
};

function pickCol(header: string[], aliases: string[]): number {
  const norm = header.map((h) => h.trim().toLowerCase());
  for (const a of aliases) {
    const i = norm.indexOf(a);
    if (i !== -1) return i;
  }
  return -1;
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
      // skip
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
  const header = rows[0];
  const iDate = pickCol(header, ALIASES.date);
  const iViews = pickCol(header, ALIASES.views);
  const iReach = pickCol(header, ALIASES.reach);
  const iReplies = pickCol(header, ALIASES.replies);
  const iShares = pickCol(header, ALIASES.shares);

  if (iDate === -1 || iViews === -1 || iReach === -1) {
    return NextResponse.json(
      {
        error: "missing required columns",
        need: ["date/publish time", "views/impressions", "reach"],
        got: header,
      },
      { status: 400 },
    );
  }

  const parseNum = (s: string | undefined) => {
    if (!s) return 0;
    const n = Number(s.replace(/[, ]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const parsed: Array<{
    published_at: string;
    views: number;
    reach: number;
    replies: number;
    shares: number;
    raw: Record<string, string>;
  }> = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rawDate = row[iDate]?.trim();
    if (!rawDate) continue;
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) continue;
    parsed.push({
      published_at: d.toISOString(),
      views: parseNum(row[iViews]),
      reach: parseNum(row[iReach]),
      replies: iReplies === -1 ? 0 : parseNum(row[iReplies]),
      shares: iShares === -1 ? 0 : parseNum(row[iShares]),
      raw: Object.fromEntries(header.map((h, i) => [h, row[i] ?? ""])),
    });
  }

  const db = supabaseAdmin();
  const { error } = await db.from("story_imports").insert(parsed);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, imported: parsed.length });
}
