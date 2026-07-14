-- Run this in the Supabase SQL editor for your project to enable cloud saves.
-- One row per user; the entire serialized PlayerState lives in the `state` jsonb column.

create table if not exists public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

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
