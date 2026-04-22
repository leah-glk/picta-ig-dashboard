// Sync orchestration: pull posts + insights from IG and upsert to Supabase.

import { supabaseAdmin } from "./supabase";
import {
  classifyKind,
  fetchAccountDailyInsights,
  fetchFollowersCount,
  fetchMediaInsights,
  isOwnerPost,
  listAllMedia,
  pickView,
} from "./ig";
import { env } from "./env";

type SyncStats = {
  posts_seen: number;
  posts_upserted: number;
  metrics_upserted: number;
  skipped_collab: number;
  skipped_boosted: number;
  errors: number;
};

export async function syncRange(opts: { since?: Date; until?: Date; label: string }) {
  const db = supabaseAdmin();
  const stats: SyncStats = {
    posts_seen: 0,
    posts_upserted: 0,
    metrics_upserted: 0,
    skipped_collab: 0,
    skipped_boosted: 0,
    errors: 0,
  };

  const { data: run } = await db
    .from("sync_runs")
    .insert({ kind: opts.label })
    .select()
    .single();

  try {
    const sinceUnix = opts.since ? Math.floor(opts.since.getTime() / 1000) : undefined;
    const untilUnix = opts.until ? Math.floor(opts.until.getTime() / 1000) : undefined;

    for await (const media of listAllMedia({
      since: sinceUnix?.toString(),
      until: untilUnix?.toString(),
    })) {
      stats.posts_seen++;

      if (!isOwnerPost(media)) {
        stats.skipped_collab++;
        continue;
      }
      if ((media.boost_ads_list?.length ?? 0) > 0) {
        stats.skipped_boosted++;
        continue;
      }

      const kind = classifyKind(media);
      const post = {
        ig_id: media.id,
        media_type: media.media_product_type === "REELS" ? "REEL" : media.media_type,
        kind,
        published_at: media.timestamp,
        caption: media.caption ?? null,
        permalink: media.permalink ?? null,
        thumbnail_url: media.thumbnail_url ?? media.media_url ?? null,
        media_url: media.media_url ?? null,
        is_owner: true,
        is_boosted: false,
        raw: media as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      };

      const { data: upserted, error: upErr } = await db
        .from("posts")
        .upsert(post, { onConflict: "ig_id" })
        .select("id")
        .single();

      if (upErr || !upserted) {
        stats.errors++;
        continue;
      }
      stats.posts_upserted++;

      try {
        const insights = await fetchMediaInsights(media);
        const metricsRow = {
          post_id: upserted.id,
          captured_at: new Date().toISOString(),
          views: pickView(insights, kind),
          reach: insights.reach ?? 0,
          likes: insights.likes ?? 0,
          comments: insights.comments ?? 0,
          shares: insights.shares ?? 0,
          saves: insights.saved ?? 0,
          reposts: 0,
          profile_visits: insights.profile_visits ?? 0,
          follows: insights.follows ?? 0,
          raw: insights as unknown as Record<string, unknown>,
        };
        await db.from("post_metrics").upsert(metricsRow, { onConflict: "post_id" });
        stats.metrics_upserted++;
      } catch {
        stats.errors++;
      }
    }

    // Account-level snapshot (today's followers + daily insights for the range).
    await captureAccountSnapshot(opts.since, opts.until);

    await db
      .from("sync_runs")
      .update({ finished_at: new Date().toISOString(), status: "ok", stats })
      .eq("id", run?.id);

    return stats;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db
      .from("sync_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: "error",
        stats,
        error: msg,
      })
      .eq("id", run?.id);
    throw e;
  }
}

async function captureAccountSnapshot(since?: Date, until?: Date) {
  const db = supabaseAdmin();

  // Today's followers snapshot (always).
  const followers = await fetchFollowersCount().catch(() => null);
  if (followers !== null) {
    const today = new Date().toISOString().slice(0, 10);
    await db
      .from("account_daily")
      .upsert(
        { date: today, followers_count: followers, captured_at: new Date().toISOString() },
        { onConflict: "date" },
      );
  }

  // Daily reach + profile_views over the range (chunks of 30 days max).
  const rangeStart = since ?? new Date(new Date().setDate(new Date().getDate() - 1));
  const rangeEnd = until ?? new Date();

  let cursor = new Date(rangeStart);
  while (cursor < rangeEnd) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setDate(chunkEnd.getDate() + 29);
    const clampedEnd = chunkEnd > rangeEnd ? rangeEnd : chunkEnd;

    const daily = await fetchAccountDailyInsights(
      Math.floor(cursor.getTime() / 1000),
      Math.floor(clampedEnd.getTime() / 1000),
    );

    // Merge by date.
    const byDate: Record<string, Record<string, number>> = {};
    for (const [metric, rows] of Object.entries(daily)) {
      for (const r of rows) {
        byDate[r.date] ??= {};
        byDate[r.date][metric] = r.value;
      }
    }
    const rows = Object.entries(byDate).map(([date, m]) => ({
      date,
      account_reach: m.reach ?? null,
      page_visits: m.profile_views ?? null,
      account_views: m.views ?? null,
      captured_at: new Date().toISOString(),
    }));
    if (rows.length > 0) {
      await db.from("account_daily").upsert(rows, { onConflict: "date" });
    }
    cursor = new Date(clampedEnd);
    cursor.setDate(cursor.getDate() + 1);
  }
}

export async function backfill() {
  return syncRange({
    since: new Date(env.BACKFILL_START + "T00:00:00Z"),
    until: new Date(),
    label: "backfill",
  });
}

export async function dailySync() {
  // Re-sync the last 7 days so late-updating metrics get refreshed + catch
  // anything that slipped through yesterday.
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - 7);
  return syncRange({ since, until, label: "daily" });
}
