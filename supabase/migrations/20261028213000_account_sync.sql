-- pbtimer — optional account sync
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
-- It is idempotent, so re-running it is safe.
--
-- Security model
--   * Both tables are readable and writable only by their owner. The client
--     ships with the public "anon" key, so these policies are what stop one
--     account from touching another account's rows.
--   * `user_id` is never trusted from the client payload: the checks compare it
--     with auth.uid(), so a forged user_id is rejected by Postgres.
--   * Column constraints reject junk (absurd times, unknown penalties, huge
--     scrambles) even if a client is compromised.
--   * Solves are soft-deleted (`deleted_at`) so a deletion made on one device
--     propagates instead of letting another device re-upload the row.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- solves ----

create table if not exists public.solves (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  puzzle text not null,
  scramble text not null,
  ms integer not null,
  penalty text not null,
  solved_at timestamptz not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint solves_ms_range check (ms > 0 and ms <= 86400000),
  constraint solves_penalty check (penalty in ('ok', 'plus2', 'dnf')),
  constraint solves_puzzle_len check (char_length(puzzle) between 1 and 24),
  constraint solves_scramble_len check (char_length(scramble) between 1 and 600),
  constraint solves_solved_at_range check (solved_at between '2000-01-01' and '2100-01-01')
);

create index if not exists solves_user_recent on public.solves (user_id, solved_at desc);
create index if not exists solves_user_updated on public.solves (user_id, updated_at desc);

alter table public.solves enable row level security;
alter table public.solves force row level security;

drop policy if exists solves_select on public.solves;
drop policy if exists solves_insert on public.solves;
drop policy if exists solves_update on public.solves;
drop policy if exists solves_delete on public.solves;

create policy solves_select on public.solves
  for select to authenticated
  using (auth.uid() = user_id);

create policy solves_insert on public.solves
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy solves_update on public.solves
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy solves_delete on public.solves
  for delete to authenticated
  using (auth.uid() = user_id);

-- ----------------------------------------------------------- preferences ----
-- One row per account: the settings object plus the selected puzzle.

create table if not exists public.preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  puzzle text not null default '333',
  updated_at timestamptz not null default now(),
  constraint preferences_is_object check (jsonb_typeof(settings) = 'object'),
  constraint preferences_size check (pg_column_size(settings) < 8192),
  constraint preferences_puzzle_len check (char_length(puzzle) between 1 and 24)
);

alter table public.preferences enable row level security;
alter table public.preferences force row level security;

drop policy if exists preferences_select on public.preferences;
drop policy if exists preferences_insert on public.preferences;
drop policy if exists preferences_update on public.preferences;
drop policy if exists preferences_delete on public.preferences;

create policy preferences_select on public.preferences
  for select to authenticated
  using (auth.uid() = user_id);

create policy preferences_insert on public.preferences
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy preferences_update on public.preferences
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy preferences_delete on public.preferences
  for delete to authenticated
  using (auth.uid() = user_id);

-- The anonymous role has no business with either table; the signed-in role gets
-- the four verbs and RLS narrows them to its own rows.
revoke all on public.solves from anon;
revoke all on public.preferences from anon;
grant select, insert, update, delete on public.solves to authenticated;
grant select, insert, update, delete on public.preferences to authenticated;
