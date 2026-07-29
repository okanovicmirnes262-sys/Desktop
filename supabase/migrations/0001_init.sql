-- TinySteps initial schema
-- All tables are protected by RLS: a user can only touch their own rows.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user (auto-created by trigger below).
-- timezone is IANA (e.g. "Europe/Berlin") — streak "days" are user-local days.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone    text not null default 'UTC',
  theme       text not null default 'default', -- premium themes gated in app
  onboarded   boolean not null default false,  -- seed routines offered once
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- routines: a named routine ("Morning") with optional daily reminder.
-- schedule_days: which weekdays it's active, 0=Sunday..6=Saturday.
-- ---------------------------------------------------------------------------
create table public.routines (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 80),
  emoji          text not null default '✨',
  position       int  not null default 0,
  schedule_days  int[] not null default '{0,1,2,3,4,5,6}',
  reminder_time  time,                -- user-local wall-clock time; null = off
  timer_seconds  int check (timer_seconds between 10 and 21600),
  is_archived    boolean not null default false,
  created_at     timestamptz not null default now()
);
create index routines_user_idx on public.routines (user_id, is_archived, position);

-- ---------------------------------------------------------------------------
-- steps: ordered micro-steps inside a routine. Optional per-step timer.
-- ---------------------------------------------------------------------------
create table public.steps (
  id            uuid primary key default gen_random_uuid(),
  routine_id    uuid not null references public.routines (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 120),
  position      int  not null default 0,
  timer_seconds int check (timer_seconds between 10 and 21600),
  created_at    timestamptz not null default now()
);
create index steps_routine_idx on public.steps (routine_id, position);

-- ---------------------------------------------------------------------------
-- completions: one row = routine fully completed on a user-local date.
-- completed_on is computed client/server-side from the profile timezone.
-- ---------------------------------------------------------------------------
create table public.completions (
  id           uuid primary key default gen_random_uuid(),
  routine_id   uuid not null references public.routines (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  completed_on date not null,
  completed_at timestamptz not null default now(),
  unique (routine_id, completed_on)
);
create index completions_user_idx on public.completions (user_id, completed_on);

-- ---------------------------------------------------------------------------
-- streaks: cached per-routine streak state, maintained by app logic
-- (src/core/streak.ts — the single source of truth for the rules).
-- freeze_balance: banked freezes (max 3), freeze_progress: 0-6 completions
-- toward earning the next freeze (1 earned per 7 completions).
-- ---------------------------------------------------------------------------
create table public.streaks (
  routine_id        uuid primary key references public.routines (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  current_streak    int  not null default 0 check (current_streak >= 0),
  best_streak       int  not null default 0 check (best_streak >= 0),
  last_completed_on date,
  freeze_balance    int  not null default 0 check (freeze_balance between 0 and 3),
  freeze_progress   int  not null default 0 check (freeze_progress between 0 and 6),
  updated_at        timestamptz not null default now()
);
create index streaks_user_idx on public.streaks (user_id);

-- ---------------------------------------------------------------------------
-- freeze_events: audit log so freeze earn/spend is explicit and debuggable.
-- ---------------------------------------------------------------------------
create table public.freeze_events (
  id          uuid primary key default gen_random_uuid(),
  routine_id  uuid not null references public.routines (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('earned', 'consumed')),
  on_date     date not null,  -- day earned, or the missed day a freeze covered
  created_at  timestamptz not null default now()
);
create index freeze_events_routine_idx on public.freeze_events (routine_id, on_date);

-- ---------------------------------------------------------------------------
-- subscriptions: premium entitlement cache, written by payment provider
-- webhooks/verification (Whop today; RevenueCat later writes the same shape).
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  user_id                uuid primary key references auth.users (id) on delete cascade,
  provider               text not null default 'whop',
  provider_membership_id text,
  status                 text not null default 'none'
                         check (status in ('none', 'active', 'past_due', 'canceled')),
  plan                   text check (plan in ('monthly', 'yearly')),
  current_period_end     timestamptz,
  updated_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- push_subscriptions: Web Push endpoints, one row per browser/device.
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- reminder_dispatches: dedupe log so the cron dispatcher never sends the
-- same reminder twice for the same routine + local date.
-- ---------------------------------------------------------------------------
create table public.reminder_dispatches (
  routine_id uuid not null references public.routines (id) on delete cascade,
  on_date    date not null,
  sent_at    timestamptz not null default now(),
  primary key (routine_id, on_date)
);

-- ---------------------------------------------------------------------------
-- Auto-create a profile row when a user signs up.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security: users only see and modify their own data.
-- subscriptions and reminder_dispatches are written only by the service role
-- (webhooks / cron), so users get read-only access there.
-- ---------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.routines            enable row level security;
alter table public.steps               enable row level security;
alter table public.completions         enable row level security;
alter table public.streaks             enable row level security;
alter table public.freeze_events       enable row level security;
alter table public.subscriptions       enable row level security;
alter table public.push_subscriptions  enable row level security;
alter table public.reminder_dispatches enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own routines" on public.routines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own steps" on public.steps
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own completions" on public.completions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own streaks" on public.streaks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own freeze events" on public.freeze_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "read own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);

create policy "own push subscriptions" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- reminder_dispatches: no user policies — service role only.
