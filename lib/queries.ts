import { supabaseAdmin } from "./supabase";
import type { DateRange } from "./dates";

export type Kpis = {
  reels_posted: number;
  static_posted: number;
  followers_end: number | null;
  followers_delta: number | null;
  page_visits: number;
  organic_reach: number;
  total_views: number;
  reel_views: number;
  story_views: number;
  saves: number;
  shares: number;
  likes: number;
  comments: number;
  replies: number;
  profile_visits: number;
  engagement_rate: number;
};

export type TopPost = {
  id: string;
  ig_id: string;
  kind: "static" | "reel";
  caption: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  published_at: string;
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagement_rate: number;
};

type PostRow = {
  id: string;
  ig_id: string;
  kind: "static" | "reel" | "story";
  caption: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  published_at: string;
  post_metrics:
    | {
        views: number;
        reach: number;
        likes: number;
        comments: number;
        shares: number;
        saves: number;
        reposts: number;
        profile_visits: number;
        follows: number;
      }
    | null;
};

async function fetchPostsInRange(range: DateRange): Promise<PostRow[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("posts")
    .select(
      "id, ig_id, kind, caption, permalink, thumbnail_url, published_at, post_metrics(views, reach, likes, comments, shares, saves, reposts, profile_visits, follows)",
    )
    .eq("is_owner", true)
    .eq("is_boosted", false)
    .gte("published_at", range.start.toISOString())
    .lt("published_at", range.end.toISOString())
    .order("published_at", { ascending: false });

  if (error) throw new Error(error.message);
  // Supabase returns the joined row as an array; normalize to object.
  return (data ?? []).map((r) => ({
    ...r,
    post_metrics: Array.isArray(r.post_metrics) ? r.post_metrics[0] ?? null : r.post_metrics,
  })) as PostRow[];
}

async function fetchStoryImports(range: DateRange) {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("story_imports")
    .select("published_at, views, reach, replies, shares")
    .gte("published_at", range.start.toISOString())
    .lt("published_at", range.end.toISOString());
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchAccountDaily(range: DateRange) {
  const db = supabaseAdmin();
  const startIso = range.start.toISOString().slice(0, 10);
  const endIso = new Date(range.end.getTime() - 1).toISOString().slice(0, 10);
  const { data, error } = await db
    .from("account_daily")
    .select("date, followers_count, page_visits, account_reach, account_views")
    .gte("date", startIso)
    .lte("date", endIso)
    .order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getKpis(range: DateRange): Promise<Kpis> {
  const [posts, stories, account] = await Promise.all([
    fetchPostsInRange(range),
    fetchStoryImports(range),
    fetchAccountDaily(range),
  ]);

  let reels_posted = 0;
  let static_posted = 0;
  let reel_views = 0;
  let static_views = 0;
  let post_reach = 0;
  let saves = 0;
  let shares = 0;
  let likes = 0;
  let comments = 0;
  let profile_visits = 0;
  let api_story_views = 0;
  let api_story_reach = 0;
  let api_story_shares = 0;

  for (const p of posts) {
    const m = p.post_metrics;
    if (!m) continue;
    if (p.kind === "reel") {
      reels_posted++;
      reel_views += m.views;
    } else if (p.kind === "static") {
      static_posted++;
      static_views += m.views;
    } else if (p.kind === "story") {
      api_story_views += m.views;
      api_story_reach += m.reach;
      api_story_shares += m.shares;
    }
    if (p.kind !== "story") post_reach += m.reach;
    saves += m.saves;
    shares += m.shares;
    likes += m.likes;
    comments += m.comments;
    profile_visits += m.profile_visits;
  }

  // Combine live-captured story metrics with CSV-imported history.
  let csv_story_views = 0;
  let csv_story_reach = 0;
  let csv_story_replies = 0;
  let csv_story_shares = 0;
  for (const s of stories) {
    csv_story_views += s.views;
    csv_story_reach += s.reach;
    csv_story_replies += s.replies;
    csv_story_shares += s.shares;
  }
  const story_views = api_story_views + csv_story_views;
  const story_reach = api_story_reach + csv_story_reach;
  const replies = csv_story_replies;
  shares += api_story_shares + csv_story_shares;

  const total_views = reel_views + static_views + story_views;
  const organic_reach = post_reach + story_reach;

  // Account-level page visits: prefer sum of daily values if we have them.
  const page_visits_acct = account.reduce((a, d) => a + (d.page_visits ?? 0), 0);
  const page_visits = page_visits_acct || profile_visits;

  // Followers: end-of-period value, and delta vs first day of period.
  const followersPoints = account.filter((d) => d.followers_count != null);
  const followers_end =
    followersPoints.length > 0 ? followersPoints[followersPoints.length - 1].followers_count : null;
  const followers_start = followersPoints.length > 0 ? followersPoints[0].followers_count : null;
  const followers_delta =
    followers_end != null && followers_start != null ? followers_end - followers_start : null;

  // Engagement rate per brief: (comments + likes + saves + shares + reposts) / total views.
  const interactions = likes + comments + saves + shares; // reposts not available
  const engagement_rate = total_views > 0 ? interactions / total_views : 0;

  return {
    reels_posted,
    static_posted,
    followers_end,
    followers_delta,
    page_visits,
    organic_reach,
    total_views,
    reel_views,
    story_views,
    saves,
    shares,
    likes,
    comments,
    replies,
    profile_visits,
    engagement_rate,
  };
}

export async function getTopPosts(range: DateRange, kind: "static" | "reel", limit: number) {
  const posts = await fetchPostsInRange(range);
  const filtered = posts
    .filter((p) => p.kind === kind && p.post_metrics)
    .map<TopPost>((p) => {
      const m = p.post_metrics!;
      const interactions = m.likes + m.comments + m.saves + m.shares;
      return {
        id: p.id,
        ig_id: p.ig_id,
        kind: p.kind as "static" | "reel",
        caption: p.caption,
        permalink: p.permalink,
        thumbnail_url: p.thumbnail_url,
        published_at: p.published_at,
        views: m.views,
        reach: m.reach,
        likes: m.likes,
        comments: m.comments,
        shares: m.shares,
        saves: m.saves,
        engagement_rate: m.views > 0 ? interactions / m.views : 0,
      };
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
  return filtered;
}

export async function getTrend(range: DateRange) {
  // Daily trend: total views per day, bucketed by day in ET.
  const posts = await fetchPostsInRange(range);
  const stories = await fetchStoryImports(range);
  const byDay: Record<string, { views: number; reach: number }> = {};

  function bucket(dateIso: string) {
    return dateIso.slice(0, 10);
  }
  for (const p of posts) {
    if (!p.post_metrics) continue;
    const d = bucket(p.published_at);
    byDay[d] ??= { views: 0, reach: 0 };
    byDay[d].views += p.post_metrics.views;
    byDay[d].reach += p.post_metrics.reach;
  }
  for (const s of stories) {
    const d = bucket(s.published_at);
    byDay[d] ??= { views: 0, reach: 0 };
    byDay[d].views += s.views;
    byDay[d].reach += s.reach;
  }
  return Object.entries(byDay)
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getTokenStatus(): Promise<{ expires_at: number | null }> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("sync_runs")
    .select("stats, started_at, status")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // We stash token expires_at in sync_runs.stats when the daily cron runs.
  const expires_at = (data?.stats as { token_expires_at?: number } | null)?.token_expires_at ?? null;
  return { expires_at };
}

export async function getStoryDataAvailableFrom(): Promise<string | null> {
  const db = supabaseAdmin();
  // Earliest date across story_imports and captured story posts.
  const [{ data: imports }, { data: live }] = await Promise.all([
    db.from("story_imports").select("published_at").order("published_at", { ascending: true }).limit(1),
    db
      .from("posts")
      .select("published_at")
      .eq("kind", "story")
      .order("published_at", { ascending: true })
      .limit(1),
  ]);
  const candidates = [imports?.[0]?.published_at, live?.[0]?.published_at].filter(Boolean) as string[];
  if (candidates.length === 0) return null;
  candidates.sort();
  return candidates[0].slice(0, 10);
}
