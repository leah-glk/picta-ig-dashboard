# Picta Instagram Dashboard

Internal dashboard for `@pictaphotoapp` organic performance. Replaces copy-pasting from Meta Business Suite for monthly recaps.

- **Stack**: Next.js 16 (App Router) · Supabase Postgres · Vercel (hosting + cron) · Instagram Graph API
- **Timezone**: `America/New_York` for both cron fire time and month boundaries
- **Auth**: single shared password (signed cookie) — no per-user accounts

---

## Local setup

```bash
npm install
cp .env.example .env.local
# fill in all values (see below)
npm run dev
```

### Required env vars

| Var | Where it comes from |
| --- | --- |
| `IG_BUSINESS_ID` | Instagram Business Account ID (already known: `10153548375369014`) |
| `IG_ACCESS_TOKEN` | Long-lived token issued for the Meta app |
| `META_APP_ID` | Meta App ID (used for `/debug_token`) |
| `GRAPH_API_VERSION` | Default `v21.0` |
| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` |
| `SUPABASE_ANON_KEY` | Supabase → Settings → API → `anon` (optional, not currently used) |
| `DASHBOARD_PASSWORD` | The shared password staff type into `/login` |
| `SESSION_SECRET` | Any random 32+ char string. `openssl rand -hex 32` |
| `CRON_SECRET` | Any random 32+ char string. Vercel sends it as `Authorization: Bearer` |

---

## Database setup

1. Create a new Supabase project (free tier is fine). Pick **US East** for latency.
2. Open the **SQL editor** and paste the contents of `supabase/schema.sql`. Run it.
3. Copy the project URL + service role key into `.env.local` (locally) and into Vercel (for deploy).

The schema lives in [`supabase/schema.sql`](./supabase/schema.sql) and is the single source of truth. Safe to re-run — everything uses `IF NOT EXISTS`.

Tables are **namespaced by platform** (`instagram_posts`, `instagram_post_metrics`, `instagram_account_daily`, `instagram_story_imports`). When TikTok / Pinterest / YouTube get added later (Phase 2), each platform adds its own tables + data source under `lib/tiktok.ts` etc., and the UI components (`KpiCard`, `TrendChart`, `CompareTable`) stay platform-agnostic.

---

## One-time backfill (Jan 1, 2025 → now)

After the database is set up and env vars are in place:

```bash
# local (make sure .env.local is loaded)
curl -X POST http://localhost:3000/api/backfill \
  -H "Authorization: Bearer $CRON_SECRET"
```

Or hit the deployed endpoint with the same header. The backfill:

- Paginates through every media item via `/{ig-user-id}/media`
- Skips crossposts where Picta is a collaborator (not owner)
- Skips boosted/ads content
- Fetches per-media insights (impressions/views/reach/etc.)
- Captures today's followers + daily account reach + profile views

Expect ~1–3 minutes per 100 posts.

### Historical story import

The Instagram Graph API **does not** return story metrics after 24h. For history before launch, export from **Meta Business Suite → Content → Stories → Export CSV** and upload:

```bash
curl -X POST http://localhost:3000/api/import/stories \
  -H "Authorization: Bearer $CRON_SECRET" \
  -F "file=@stories-2025-01.csv"
```

Accepted column names (case-insensitive; any one from each group works):

- Date: `Publish time`, `Published`, `Publish Date`, `Date`, `Time`
- Views: `Views`, `Impressions`, `Story views`
- Reach: `Reach`, `Accounts reached`
- Replies *(optional)*: `Replies`, `Story replies`
- Shares *(optional)*: `Shares`, `Story shares`

You can run the import multiple times — each call inserts fresh rows. If you re-import the same month, dedupe via Supabase (`delete from story_imports where published_at >= … and published_at < …`) first.

---

## Daily sync (cron)

Vercel runs `GET /api/cron/daily` every day at `12:00 UTC` (= **07:00 ET winter / 08:00 EDT summer**). See [`vercel.json`](./vercel.json).

The daily sync:

- Re-pulls the last **7 days** of posts (so late-updating metrics like reel views stabilize)
- Upserts metrics
- Captures today's followers + daily account insights

### Running cron manually

```bash
curl https://YOUR-DOMAIN.vercel.app/api/cron/daily \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel → **Add New Project** → import the GitHub repo.
3. Project settings → **Environment Variables**: add every var from `.env.example`.
4. Deploy.
5. Vercel auto-registers the cron from `vercel.json`. Verify under **Settings → Cron Jobs**.
6. Hit `/api/backfill` once (see above) to seed the DB.
7. Open the dashboard URL → enter `DASHBOARD_PASSWORD`.

> **Vercel Pro is NOT required.** We use our own signed-cookie password gate instead of Vercel's password protection.

---

## Token refresh process

The Instagram Graph API access token is managed externally by Picta's social media manager (same token is shared with their tooling). When it expires:

1. Social manager issues a new long-lived token via the Meta App.
2. Update `IG_ACCESS_TOKEN` in **Vercel → Settings → Environment Variables**.
3. Redeploy (or let the next deploy pick it up).

**Best practice:** add a calendar reminder ~1 week before expiry to avoid missed cron runs.

---

## Metric definitions (per brief)

| Metric | Formula / source |
| --- | --- |
| Organic Reach | Sum of post `reach` + story `reach` (owner-posted only, organic) |
| Total Views | Reel views + story views + static impressions |
| Reel Views | `views` on reel insights |
| Story Views | Live-captured `views` + CSV-imported `views` |
| Static post "views" | `views` metric — unified across FEED/REELS/STORY since Graph API v21+ (replaces the deprecated `impressions` metric) |
| Engagement Rate | `(likes + comments + saves + shares) / total_views` — per brief; reposts not available via API |
| Followers delta | `followers_count` end-of-period minus start-of-period |
| Page Visits | Account-level `profile_views` (sum over range), fallback to per-post profile_visits |

### What's explicitly out-of-scope (v1)

- Paid/ads data
- Other platforms (TikTok, Pinterest, YouTube)
- Export buttons (recaps live in Google Slides)
- Individual logins
- Analysis commentary
- Alerts / notifications
- Multi-account support
- Reposts metric (not exposed by the API)

---

## Project layout

```
app/
  page.tsx                 ← main dashboard
  compare/page.tsx         ← comparison tab
  login/page.tsx           ← password gate
  api/
    cron/daily/route.ts    ← Vercel cron target
    backfill/route.ts      ← one-time backfill (auth: CRON_SECRET)
    import/stories/route.ts← Meta BS CSV importer (auth: CRON_SECRET)
components/                ← UI building blocks (Shell, KpiCard, TrendChart, TopPosts, CompareTable, pickers)
lib/
  env.ts                   ← env var loader (fails fast)
  ig.ts                    ← Instagram Graph API client
  sync.ts                  ← backfill + daily sync orchestration
  queries.ts               ← KPI aggregations from Supabase
  dates.ts                 ← month math in America/New_York
  auth.ts                  ← signed-cookie sessions
  format.ts                ← number / percent / delta formatters
proxy.ts                   ← Next.js 16 proxy (formerly middleware) — password gate
supabase/schema.sql        ← DB schema, run once in Supabase SQL editor
vercel.json                ← cron declaration
```
