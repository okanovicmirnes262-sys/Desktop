# TinySteps 🐾

A habit & routine tracker built for ADHD brains. Routines are made of tiny
steps shown **one at a time**, timers are **visual** (a draining ring, not
just numbers), and streaks come with **streak freezes** so one bad day
doesn't erase your progress.

**Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · Supabase
(Postgres + Auth) · Web Push · Whop (payments)

## Features

- **Micro-step routines** — one step on screen, one big Done button,
  reorderable steps, skip without shame.
- **Visual timers** — a large shrinking ring attachable to any step or to a
  whole routine, for time blindness.
- **Forgiving streaks** — earn 1 streak freeze per 7 completions (bank up
  to 3); a freeze auto-covers a missed day instead of resetting you to
  zero. The rules live in one tested module: `src/core/streak.ts`.
- **Calm stats** — completion rate, current/best streak, calendar heatmap.
- **Firm reminders** — scheduled web push tied to routine times. Clear, on
  time, never guilt-trippy.
- **Freemium** — free: 3 routines, basic streaks & reminders. Premium
  (€5/month or €40/year via Whop): unlimited routines, themes, full stats,
  backup.

## Architecture notes

- `src/core/` is **pure, platform-agnostic business logic** (streaks,
  dates, stats, entitlements, payments abstraction). No DOM, no Next.js
  imports — it can be reused as-is in a future React Native/Capacitor app.
- Payments go through the `PaymentProvider` interface
  (`src/core/payments/provider.ts`). `WhopProvider` is the only
  implementation today; an `AppleProvider`/`GoogleProvider` (RevenueCat)
  can be added in `src/core/payments/index.ts` without touching feature
  code. **All** premium gating flows through `hasPremium()` in
  `src/core/entitlements.ts`.
- `src/lib/` is the web glue: Supabase clients, data access (`db.ts`),
  server actions, push sender.
- Postgres schema + RLS policies: `supabase/migrations/0001_init.sql`.

## Local setup

1. **Install deps**

   ```bash
   npm install
   ```

2. **Create a Supabase project** at [supabase.com](https://supabase.com),
   then apply the schema: open the SQL Editor and run the contents of
   `supabase/migrations/0001_init.sql` (or use the CLI:
   `supabase db push`).

3. **Enable auth providers** (Supabase Dashboard → Authentication →
   Providers): Email is on by default; for **Google**, create an OAuth
   client in Google Cloud Console and paste its ID/secret. Add
   `http://localhost:3000/auth/callback` (and later your production URL)
   to the provider's redirect allowlist.

4. **Generate VAPID keys** for web push:

   ```bash
   npx web-push generate-vapid-keys
   ```

5. **Configure env vars**

   ```bash
   cp .env.example .env.local
   ```

   Fill in every key — they're all documented in `.env.example`
   (Supabase URL/keys, Whop API key + plan IDs + webhook secret, VAPID
   keys, `CRON_SECRET`).

6. **Run**

   ```bash
   npm run dev
   ```

   New accounts are offered two seeded example routines (Morning &
   Wind-down) on first visit.

## Tests

Streak + streak-freeze logic is covered by unit tests:

```bash
npm test
```

## Whop setup

1. Create a product with two plans (monthly €5, yearly €40) in the
   [Whop dashboard](https://whop.com), and put the plan IDs in
   `NEXT_PUBLIC_WHOP_PLAN_ID_MONTHLY` / `_YEARLY`.
2. Create an API key → `WHOP_API_KEY`.
3. Add a webhook pointing at `https://<your-domain>/api/whop/webhook`
   for membership events, with its signing secret in
   `WHOP_WEBHOOK_SECRET`.

Premium unlocks two ways: the webhook (automatic) or the "I subscribed —
check my membership" button on `/app/upgrade` (on-demand verification by
email).

## Deploy (Vercel + Supabase)

1. Push this repo to GitHub and import it in
   [Vercel](https://vercel.com/new).
2. Add all env vars from `.env.example` in Vercel → Project → Settings →
   Environment Variables. Set `NEXT_PUBLIC_APP_URL` to your production
   URL.
3. `vercel.json` schedules the reminder cron (`/api/reminders/dispatch`)
   once a day — the maximum the Hobby plan allows (more frequent crons
   make Hobby deploys fail). Vercel sends `Authorization: Bearer
   $CRON_SECRET` automatically when `CRON_SECRET` is set.
   For on-time reminders, point an external cron (e.g. the free
   cron-job.org) at the endpoint every 5 minutes with the same Bearer
   header — or upgrade to Vercel Pro and set the schedule back to
   `*/5 * * * *`.
4. In Supabase → Authentication → URL Configuration, set the Site URL to
   your production URL and add `https://<your-domain>/auth/callback` to
   the redirect list.

## Roadmap hooks

- **Mobile:** wrap with Capacitor or reuse `src/core/` in React Native;
  swap `WhopProvider` for a RevenueCat-backed provider in
  `src/core/payments/index.ts`.
- **Persist partial runs:** add a `step_completions` table if half-done
  routines should survive device switches.
