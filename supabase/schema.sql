-- Run this in the Supabase SQL editor for your project to enable cloud saves.
-- One row per user; the entire serialized PlayerState lives in the `state` jsonb column.
-- `revision` mirrors the save's monotonic counter so clients can detect which
-- copy (local vs cloud) is newer; `updated_at` is always set server-side.

create table if not exists public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint saves_state_is_object check (jsonb_typeof(state) = 'object')
);

-- Upgrading an existing table from the v1 schema:
alter table public.saves add column if not exists revision bigint not null default 0;

alter table public.saves enable row level security;

-- Each user may only read/write their own save row.
create policy "Users can read their own save"
  on public.saves for select
  using (auth.uid() = user_id);

create policy "Users can insert their own save"
  on public.saves for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own save"
  on public.saves for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Server-authoritative timestamp: ignore whatever the client sent.
create or replace function public.saves_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists saves_set_updated_at on public.saves;
create trigger saves_set_updated_at
  before insert or update on public.saves
  for each row execute function public.saves_set_updated_at();

-- ---------------------------------------------------------------------------
-- Opt-in gameplay analytics.
--
-- Rows carry no identity beyond the user id the player already has: no device
-- id, no session id, no IP column, no free-text field. The client will only
-- write here when the player has turned "Share play data" on in Settings.
-- ---------------------------------------------------------------------------

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  constraint analytics_events_props_is_object check (jsonb_typeof(props) = 'object'),
  -- Only the events the client is written to emit; anything else is rejected
  -- at the database rather than trusted from a patched build.
  constraint analytics_events_known_name check (
    name in ('stage_attempt', 'purchase', 'achievement_claimed', 'offline_collected')
  )
);

create index if not exists analytics_events_name_occurred_idx
  on public.analytics_events (name, occurred_at);

alter table public.analytics_events enable row level security;

-- Append-only, and only for yourself. There is deliberately no update or
-- delete policy: a client that could rewrite history is worse than no data.
create policy "Users can insert their own analytics events"
  on public.analytics_events for insert
  with check (auth.uid() = user_id);

-- Players can read back exactly what was collected about them.
create policy "Users can read their own analytics events"
  on public.analytics_events for select
  using (auth.uid() = user_id);

-- Server-authoritative arrival time; occurred_at is the client's own clock and
-- should be treated as approximate.
create or replace function public.analytics_events_set_received_at()
returns trigger
language plpgsql
as $$
begin
  new.received_at := now();
  return new;
end;
$$;

drop trigger if exists analytics_events_set_received_at on public.analytics_events;
create trigger analytics_events_set_received_at
  before insert on public.analytics_events
  for each row execute function public.analytics_events_set_received_at();
