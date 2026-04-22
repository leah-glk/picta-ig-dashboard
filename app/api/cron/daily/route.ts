import { NextResponse } from "next/server";
import { dailySync } from "@/lib/sync";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  // Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` when CRON_SECRET is set.
  if (env.CRON_SECRET) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  try {
    const stats = await dailySync();
    return NextResponse.json({ ok: true, stats });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
