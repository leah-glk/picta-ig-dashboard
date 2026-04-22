-- Picta Dashboard — Supabase schema
-- Run in the Supabase SQL editor on a fresh project.
--
-- Tables are namespaced by platform so TikTok / Pinterest / YouTube can be
-- added later without schema changes to the Instagram tables.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Instagram: posts (one row per IG media — post / reel / story)
-- ---------------------------------------------------------------------------
create table if not exists public.instagram_posts (
  id               uuid primary key default gen_random_uuid(),
  ig_id            text not null unique,
  media_type       text not null check (media_type in ('IMAGE','CAROUSEL_ALBUM','VIDEO','REEL','STORY')),
  kind             text not null check (kind in ('static','reel','story')),
  published_at     timestamptz not null,
  caption          text,
  permalink        text,
  thumbnail_url    text,
  media_url        text,
  is_owner         boolean not null default true,
  is_boosted       boolean not null default false,
  raw              jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists instagram_posts_published_at_idx on public.instagram_posts (published_at desc);
create index if not exists instagram_posts_kind_idx on public.instagram_posts (kind);

-- ---------------------------------------------------------------------------
-- Instagram: per-post latest metrics (overwritten on each daily sync).
-- ---------------------------------------------------------------------------
create table if not exists public.instagram_post_metrics (
  post_id          uuid primary key references public.instagram_posts(id) on delete cascade,
  captured_at      timestamptz not null default now(),
  views            bigint not null default 0,
  reach            bigint not null default 0,
  likes            bigint not null default 0,
  comments         bigint not null default 0,
  shares           bigint not null default 0,
  saves            bigint not null default 0,
  reposts          bigint not null default 0,     -- not exposed by IG API, always 0
  profile_visits   bigint not null default 0,
  follows          bigint not null default 0,
  raw              jsonb
);

-- ---------------------------------------------------------------------------
-- Instagram: account-level daily snapshot.
-- ---------------------------------------------------------------------------
create table if not exists public.instagram_account_daily (
  date             date primary key,
  followers_count  bigint,
  page_visits      bigint,
  account_reach    bigint,
  account_views    bigint,
  raw              jsonb,
  captured_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Instagram: stories imported from Meta Business Suite CSV.
-- Individual stories aren't queryable post-24h via the Graph API.
-- ---------------------------------------------------------------------------
create table if not exists public.instagram_story_imports (
  id               uuid primary key default gen_random_uuid(),
  ig_id            text unique,                   -- "Post ID" from the CSV (dedupes on re-import)
  published_at     timestamptz not null,
  description      text,
  permalink        text,
  duration_sec     integer,
  views            bigint not null default 0,
  reach            bigint not null default 0,
  likes            bigint not null default 0,
  shares           bigint not null default 0,
  replies          bigint not null default 0,
  follows          bigint not null default 0,
  profile_visits   bigint not null default 0,
  link_clicks      bigint not null default 0,
  sticker_taps     bigint not null default 0,
  source           text not null default 'meta_business_suite_csv',
  raw              jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists instagram_story_imports_published_at_idx on public.instagram_story_imports (published_at desc);

-- ---------------------------------------------------------------------------
-- Sync log (platform-agnostic).
-- ---------------------------------------------------------------------------
create table if not exists public.sync_runs (
  id               uuid primary key default gen_random_uuid(),
  platform         text not null default 'instagram',
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  kind             text not null,                 -- 'daily' | 'backfill' | 'story_import'
  status           text not null default 'running',
  stats            jsonb,
  error            text
);

-- ---------------------------------------------------------------------------
-- Token status (platform-agnostic key/value).
-- Updated by sync jobs; read by the UI banner.
-- ---------------------------------------------------------------------------
create table if not exists public.token_status (
  platform         text primary key,
  expires_at       timestamptz,
  checked_at       timestamptz not null default now(),
  raw              jsonb
);
