-- CreatorKit initial schema. Safe to run more than once.
-- All access goes through the Next.js server with the secret key, so RLS is enabled
-- on every table with NO policies: the public/anon key can read or write nothing.

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  google_sub text not null unique,
  email text,
  name text,
  avatar_url text,
  refresh_token_enc text,
  plan_tier text not null default 'free' check (plan_tier in ('free', 'pro')),
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);

create table if not exists public.channels (
  id text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  handle text,
  thumbnail_url text,
  subscribers bigint,
  views bigint,
  video_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists channels_profile_id_idx on public.channels(profile_id);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  channel_id text not null references public.channels(id) on delete cascade,
  goal text not null check (goal in ('views', 'subscribers', 'monetize', 'shorts', 'search')),
  niche text,
  videos_per_week smallint not null default 1 check (videos_per_week between 1 and 14),
  format text not null default 'mixed' check (format in ('long', 'short', 'mixed')),
  plan jsonb not null,
  stats jsonb,
  created_at timestamptz not null default now()
);
create index if not exists plans_channel_created_idx on public.plans(channel_id, created_at desc);
create index if not exists plans_profile_id_idx on public.plans(profile_id);

create table if not exists public.channel_snapshots (
  channel_id text not null references public.channels(id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  subscribers bigint,
  views bigint,
  video_count integer,
  median_views_per_day numeric,
  uploads_per_week numeric,
  engagement_rate numeric,
  analytics jsonb,
  created_at timestamptz not null default now(),
  primary key (channel_id, day)
);

alter table public.profiles enable row level security;
alter table public.channels enable row level security;
alter table public.plans enable row level security;
alter table public.channel_snapshots enable row level security;
