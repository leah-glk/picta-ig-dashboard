import { NextResponse } from "next/server";
import { backfill } from "@/lib/sync";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 800;

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  const expected = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null;
  if (!expected || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const stats = await backfill();
    return NextResponse.json({ ok: true, stats });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
