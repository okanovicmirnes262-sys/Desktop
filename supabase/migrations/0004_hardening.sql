-- Security & consistency hardening (defense in depth — the app layer
-- also verifies routine ownership before every write).

-- Child-table policies now require that the referenced routine belongs to
-- the caller, so a foreign routine id can never be written even if the
-- app-layer check were bypassed.
create or replace function public.owns_routine(rid uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (select 1 from public.routines r where r.id = rid and r.user_id = auth.uid());
$$;

drop policy "own completions" on public.completions;
create policy "own completions" on public.completions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.owns_routine(routine_id));

drop policy "own steps" on public.steps;
create policy "own steps" on public.steps
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.owns_routine(routine_id));

drop policy "own streaks" on public.streaks;
create policy "own streaks" on public.streaks
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.owns_routine(routine_id));

drop policy "own freeze events" on public.freeze_events;
create policy "own freeze events" on public.freeze_events
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.owns_routine(routine_id));

drop policy "own rest days" on public.rest_days;
create policy "own rest days" on public.rest_days
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.owns_routine(routine_id));

drop policy "own run progress" on public.run_progress;
create policy "own run progress" on public.run_progress
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.owns_routine(routine_id));

-- The emoji column stores lucide icon keys since the redesign.
alter table public.routines alter column emoji set default 'sparkles';
