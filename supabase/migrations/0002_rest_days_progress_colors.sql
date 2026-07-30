-- TinySteps v2 features: per-routine card colors, resumable runs,
-- and rest days (planned skips that protect the streak for free).

-- Card color chosen by the user; null = automatic rotation.
alter table public.routines add column color text
  check (color in ('sky', 'mint', 'blush', 'butter'));

-- ---------------------------------------------------------------------------
-- run_progress: where the user left off in today's run, one row per
-- routine. Lets a half-done routine resume after reload/device switch.
-- ---------------------------------------------------------------------------
create table public.run_progress (
  routine_id uuid primary key references public.routines (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  on_date    date not null,
  step_index int  not null default 0 check (step_index >= 0),
  updated_at timestamptz not null default now()
);
create index run_progress_user_idx on public.run_progress (user_id);

-- ---------------------------------------------------------------------------
-- rest_days: user-declared "taking today off" days. The streak engine
-- bridges these without consuming a freeze. Limited to 2 per month per
-- routine (enforced in the app layer).
-- ---------------------------------------------------------------------------
create table public.rest_days (
  routine_id uuid not null references public.routines (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  on_date    date not null,
  created_at timestamptz not null default now(),
  primary key (routine_id, on_date)
);
create index rest_days_user_idx on public.rest_days (user_id);

alter table public.run_progress enable row level security;
alter table public.rest_days    enable row level security;

create policy "own run progress" on public.run_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rest days" on public.rest_days
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
