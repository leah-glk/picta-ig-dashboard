// Thin wrapper around the Instagram Graph API (v21+).
// Docs: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/
//
// Metric model notes:
// - Reels / Videos: we treat `views` as `ig_reels_video_view_total_count` (or the
//   current supported reel view metric). Falls back to `plays` if unavailable.
// - Static images / carousels: `views` is `impressions` (per product decision —
//   "static posts use impressions as views").
// - Stories: views = `reach` on Stories in newer API versions; `impressions` was
//   deprecated. We record both when present.
// - `shares`, `saved`, `comments`, `likes`, `profile_visits`, `follows` all map
//   directly when returned by /{media-id}/insights.

import { env } from "./env";

const BASE = `https://graph.facebook.com/${env.GRAPH_API_VERSION}`;

type QueryParams = Record<string, string | number | undefined>;

async function graph<T>(path: string, params: QueryParams = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("access_token", env.IG_ACCESS_TOKEN);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), { cache: "no-store" });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Graph API non-JSON response (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const msg = (body as { error?: { message?: string } })?.error?.message ?? text;
    throw new Error(`Graph API ${res.status} on ${path}: ${msg}`);
  }
  return body as T;
}

export type IgMedia = {
  id: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_product_type?: "FEED" | "REELS" | "STORY" | "AD";
  caption?: string;
  permalink?: string;
  media_url?: string;
  thumbnail_url?: string;
  timestamp: string;
  owner?: { id: string };
  username?: string;
  boost_ads_list?: unknown[];
  is_shared_to_feed?: boolean;
};

export type IgInsightValue = { value: number };
export type IgInsight = {
  name: string;
  period: string;
  values: IgInsightValue[];
  title?: string;
  description?: string;
};

const FEED_FIELDS = [
  "id",
  "media_type",
  "media_product_type",
  "caption",
  "permalink",
  "media_url",
  "thumbnail_url",
  "timestamp",
  "owner{id,username}",
  "username",
  "is_shared_to_feed",
].join(",");

// --- Media discovery -------------------------------------------------------

export async function* listAllMedia(params: { since?: string; until?: string } = {}) {
  // Paginates through /{ig-user-id}/media. `since`/`until` are unix seconds.
  let next: string | undefined;
  let firstCall = true;
  while (firstCall || next) {
    const page: { data: IgMedia[]; paging?: { next?: string } } = next
      ? await fetchAbsolute(next)
      : await graph(`/${env.IG_BUSINESS_ID}/media`, {
          fields: FEED_FIELDS,
          limit: 100,
          since: params.since,
          until: params.until,
        });
    firstCall = false;
    for (const m of page.data) yield m;
    next = page.paging?.next;
  }
}

async function fetchAbsolute<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Graph API non-JSON response (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const msg = (body as { error?: { message?: string } })?.error?.message ?? text;
    throw new Error(`Graph API ${res.status}: ${msg}`);
  }
  return body as T;
}

// --- Media insights --------------------------------------------------------

// Metrics we try to pull per media. Not all apply to all media types — the API
// will error on unsupported metrics, so we request them in type-specific groups.
const METRICS_STATIC = [
  "impressions",
  "reach",
  "likes",
  "comments",
  "shares",
  "saved",
  "profile_visits",
  "follows",
  "total_interactions",
];

const METRICS_REEL = [
  "views",              // new unified reel view metric
  "reach",
  "likes",
  "comments",
  "shares",
  "saved",
  "total_interactions",
];

const METRICS_STORY = [
  "views",
  "reach",
  "replies",
  "shares",
  "total_interactions",
];

function metricsFor(media: IgMedia): string[] {
  if (media.media_product_type === "REELS") return METRICS_REEL;
  if (media.media_product_type === "STORY") return METRICS_STORY;
  return METRICS_STATIC;
}

export async function fetchMediaInsights(media: IgMedia) {
  const metrics = metricsFor(media);
  try {
    const res = await graph<{ data: IgInsight[] }>(`/${media.id}/insights`, {
      metric: metrics.join(","),
    });
    return indexInsights(res.data);
  } catch (e) {
    // Some metrics can be unavailable for older posts. Retry one-by-one and
    // swallow per-metric errors so we still capture what we can.
    const acc: Record<string, number> = {};
    for (const m of metrics) {
      try {
        const res = await graph<{ data: IgInsight[] }>(`/${media.id}/insights`, { metric: m });
        Object.assign(acc, indexInsights(res.data));
      } catch {
        /* ignore individual metric failures */
      }
    }
    if (Object.keys(acc).length === 0) throw e;
    return acc;
  }
}

function indexInsights(data: IgInsight[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of data) {
    out[i.name] = i.values?.[0]?.value ?? 0;
  }
  return out;
}

// --- Account-level ---------------------------------------------------------

export async function fetchFollowersCount(): Promise<number> {
  const res = await graph<{ followers_count: number; id: string }>(
    `/${env.IG_BUSINESS_ID}`,
    { fields: "followers_count" },
  );
  return res.followers_count;
}

export async function fetchAccountDailyInsights(sinceUnix: number, untilUnix: number) {
  // Account-level insights: reach, profile_views.
  // Metric availability has shifted; wrap each metric separately.
  const wanted = ["reach", "profile_views", "views"];
  const out: Record<string, { date: string; value: number }[]> = {};
  for (const metric of wanted) {
    try {
      const res = await graph<{
        data: { name: string; values: { value: number; end_time: string }[] }[];
      }>(`/${env.IG_BUSINESS_ID}/insights`, {
        metric,
        period: "day",
        metric_type: "total_value",
        since: sinceUnix,
        until: untilUnix,
      });
      for (const d of res.data) {
        out[d.name] = d.values.map((v) => ({ date: v.end_time.slice(0, 10), value: v.value }));
      }
    } catch {
      /* ignore */
    }
  }
  return out;
}

// --- Token introspection ---------------------------------------------------

export async function fetchTokenDebug(): Promise<{ expires_at: number | null }> {
  if (!env.META_APP_ID) return { expires_at: null };
  try {
    const res = await graph<{ data: { expires_at: number; is_valid: boolean } }>(
      "/debug_token",
      { input_token: env.IG_ACCESS_TOKEN },
    );
    return { expires_at: res.data.expires_at ?? null };
  } catch {
    return { expires_at: null };
  }
}

// --- Normalization ---------------------------------------------------------

export function classifyKind(media: IgMedia): "static" | "reel" | "story" {
  if (media.media_product_type === "REELS") return "reel";
  if (media.media_product_type === "STORY") return "story";
  return "static";
}

export function isOwnerPost(media: IgMedia): boolean {
  // When Picta is a collaborator (not the original poster), `owner.id` !== our
  // business ID. `is_shared_to_feed` also flags crossposts/collabs in some cases.
  if (!media.owner) return true; // assume owner if not exposed
  return media.owner.id === env.IG_BUSINESS_ID;
}

export function pickView(insights: Record<string, number>, kind: "static" | "reel" | "story"): number {
  if (kind === "static") return insights.impressions ?? insights.reach ?? 0;
  if (kind === "reel") return insights.views ?? insights.plays ?? 0;
  return insights.views ?? insights.reach ?? 0;
}
