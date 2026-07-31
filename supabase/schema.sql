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
