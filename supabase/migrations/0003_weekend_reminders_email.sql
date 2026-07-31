-- TinySteps v3: weekend-specific reminder times + weekly email opt-out.

-- Optional different reminder time for Sat/Sun; null = same as weekdays.
alter table public.routines add column reminder_time_weekend time;

-- Weekly summary email preference (on by default, toggle in Settings).
alter table public.profiles add column weekly_email boolean not null default true;
