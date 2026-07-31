-- Premium feature pack: extra reminders + second bell, streak revivals,
-- accountability partners.

-- ---------------------------------------------------------------------------
-- Extra reminder times (premium: up to 2) and the "second bell" —
-- a single repeat nudge ~30 min after the main reminder if not started.
-- ---------------------------------------------------------------------------
alter table public.routines add column reminder_times_extra time[] not null default '{}';
alter table public.routines add column second_bell boolean not null default false;

-- reminder_dispatches: dedupe per reminder slot, not just per day.
-- slot 0 = main time, 1..2 = extra times, 9 = second bell.
alter table public.reminder_dispatches add column slot smallint not null default 0;
alter table public.reminder_dispatches drop constraint reminder_dispatches_pkey;
alter table public.reminder_dispatches add primary key (routine_id, on_date, slot);

-- ---------------------------------------------------------------------------
-- Streak revivals (premium, once per calendar month per user).
-- ---------------------------------------------------------------------------
create table public.streak_revivals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  routine_id  uuid not null references public.routines (id) on delete cascade,
  revived_on  date not null,
  restored_to int  not null,
  created_at  timestamptz not null default now()
);
create index streak_revivals_user_idx on public.streak_revivals (user_id, revived_on);
alter table public.streak_revivals enable row level security;
create policy "own revivals" on public.streak_revivals
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.owns_routine(routine_id));

-- ---------------------------------------------------------------------------
-- Accountability partners (premium): invite by code, see only each
-- other's top current streak — never routines or details.
-- ---------------------------------------------------------------------------
create table public.partner_invites (
  code       text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.partner_invites enable row level security;
create policy "own invites" on public.partner_invites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.partnerships (
  a          uuid not null references auth.users (id) on delete cascade,
  b          uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a <> b)
);
create unique index partnerships_a_idx on public.partnerships (a);
create unique index partnerships_b_idx on public.partnerships (b);
alter table public.partnerships enable row level security;
create policy "own partnership" on public.partnerships
  for select using (auth.uid() = a or auth.uid() = b);
create policy "leave partnership" on public.partnerships
  for delete using (auth.uid() = a or auth.uid() = b);

-- Redeem an invite code: validates, links both users, burns the code.
create or replace function public.redeem_partner_code(invite_code text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  inviter uuid;
begin
  select user_id into inviter from public.partner_invites where code = invite_code;
  if inviter is null then return 'invalid_code'; end if;
  if inviter = auth.uid() then return 'own_code'; end if;
  if exists (select 1 from public.partnerships where a = auth.uid() or b = auth.uid())
     or exists (select 1 from public.partnerships where a = inviter or b = inviter) then
    return 'already_partnered';
  end if;
  insert into public.partnerships (a, b) values (inviter, auth.uid());
  delete from public.partner_invites where code = invite_code;
  return 'ok';
end;
$$;

-- The caller's partner, reduced to a name + their best current streak.
create or replace function public.partner_summary()
returns table (display_name text, top_streak int)
language sql
security definer set search_path = public
stable
as $$
  select p.display_name, coalesce(max(s.current_streak), 0)::int
  from public.partnerships pt
  join public.profiles p
    on p.id = case when pt.a = auth.uid() then pt.b else pt.a end
  left join public.streaks s on s.user_id = p.id
  where pt.a = auth.uid() or pt.b = auth.uid()
  group by p.display_name;
$$;
