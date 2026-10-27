-- Log of changes applied to YouTube through CreatorKit (for "impact of your changes"). Safe to run more than once.
create table if not exists public.change_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  channel_id text not null,
  video_id text,                                   -- null for channel-level changes
  kind text not null check (kind in ('video', 'channel', 'undo')),
  fields text[] not null default '{}',             -- e.g. {title,description,tags}
  previous jsonb,
  applied jsonb,
  created_at timestamptz not null default now()
);
create index if not exists change_log_profile_created_idx on public.change_log(profile_id, created_at desc);
alter table public.change_log enable row level security;
