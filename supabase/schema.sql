-- Picta IG Dashboard — Supabase schema
-- Run in the Supabase SQL editor on a fresh project.

create extension if not exists "pgcrypto";

-- Posts: one row per IG media (post / reel / story).
create table if not exists public.posts (
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

create index if not exists posts_published_at_idx on public.posts (published_at desc);
create index if not exists posts_kind_idx on public.posts (kind);

-- Per-post latest metrics (we overwrite on each daily sync).
create table if not exists public.post_metrics (
  post_id          uuid primary key references public.posts(id) on delete cascade,
  captured_at      timestamptz not null default now(),
  views            bigint not null default 0,           -- video_views (reels/stories) or impressions (statics)
  reach            bigint not null default 0,
  likes            bigint not null default 0,
  comments         bigint not null default 0,
  shares           bigint not null default 0,
  saves            bigint not null default 0,
  reposts          bigint not null default 0,
  profile_visits   bigint not null default 0,
  follows          bigint not null default 0,
  raw              jsonb
);

-- Account-level daily snapshot (followers, page visits, account reach).
create table if not exists public.account_daily (
  date             date primary key,
  followers_count  bigint,
  page_visits      bigint,
  account_reach    bigint,
  account_views    bigint,
  raw              jsonb,
  captured_at      timestamptz not null default now()
);

-- Stories imported from Meta Business Suite CSV (for historical pre-launch).
-- Individual stories aren't queryable post-24h via the Graph API, so we import them.
create table if not exists public.story_imports (
  id               uuid primary key default gen_random_uuid(),
  published_at     timestamptz not null,
  views            bigint not null default 0,
  reach            bigint not null default 0,
  replies          bigint not null default 0,
  shares           bigint not null default 0,
  source           text not null default 'meta_business_suite_csv',
  raw              jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists story_imports_published_at_idx on public.story_imports (published_at desc);

-- Sync log for observability.
create table if not exists public.sync_runs (
  id               uuid primary key default gen_random_uuid(),
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  kind             text not null,                       -- 'daily' | 'backfill' | 'story_import'
  status           text not null default 'running',     -- 'running' | 'ok' | 'error'
  stats            jsonb,
  error            text
);

-- Helper view: month-by-month post-level aggregates (America/New_York boundaries).
create or replace view public.posts_by_month as
select
  date_trunc('month', (published_at at time zone 'America/New_York'))::date as month_start,
  p.kind,
  count(*)                              as n_posts,
  coalesce(sum(m.views), 0)             as views,
  coalesce(sum(m.reach), 0)             as reach,
  coalesce(sum(m.likes), 0)             as likes,
  coalesce(sum(m.comments), 0)          as comments,
  coalesce(sum(m.shares), 0)            as shares,
  coalesce(sum(m.saves), 0)             as saves,
  coalesce(sum(m.reposts), 0)           as reposts,
  coalesce(sum(m.profile_visits), 0)    as profile_visits,
  coalesce(sum(m.follows), 0)           as follows
from public.posts p
left join public.post_metrics m on m.post_id = p.id
where p.is_owner = true and p.is_boosted = false
group by 1, 2;
