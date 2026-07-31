import Link from "next/link";
import { Snowflake, Timer } from "lucide-react";

// Public landing page. Logged-in users are redirected to /app by middleware.
export default function LandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-[26px] py-12">
      <div
        className="rounded-card-lg p-8 text-white"
        style={{
          background:
            "radial-gradient(115% 75% at 50% 14%, #6f6be6 0%, #4a45b4 52%, #2b2860 100%)",
        }}
      >
        <h1 className="text-4xl font-extrabold tracking-[-0.01em]">TinySteps</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-white/80">
          Routines in tiny steps. One thing at a time. Streaks that forgive a
          bad day.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <div className="shadow-card rounded-card bg-card p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-surface-alt text-primary">
            <Timer size={19} strokeWidth={2} />
          </span>
          <p className="mt-3 text-sm font-semibold leading-snug">
            Visual timers for time blindness
          </p>
        </div>
        <div className="shadow-card rounded-card bg-card p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-surface-alt text-primary">
            <Snowflake size={19} strokeWidth={2} />
          </span>
          <p className="mt-3 text-sm font-semibold leading-snug">
            Streak freezes protect a missed day
          </p>
        </div>
      </div>

      <Link
        href="/login"
        className="mt-2 block rounded-[22px] bg-primary px-8 py-[18px] text-center text-[17px] font-bold text-on-primary transition-colors hover:bg-primary-hover"
      >
        Get started
      </Link>
      <p className="text-center text-xs text-ink-soft">
        Free for up to 3 routines. Premium €5/month or €40/year.
      </p>
    </main>
  );
}
