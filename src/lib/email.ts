// Weekly summary email, sent via Resend's plain REST API (no SDK needed).
// Entirely optional: without RESEND_API_KEY the weekly route no-ops.

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? 'TinySteps <onboarding@resend.dev>',
      to: [to],
      subject,
      html,
    }),
  });
  return res.ok;
}

export interface WeeklyRow {
  name: string;
  done: number;
  scheduled: number;
  currentStreak: number;
}

/** Warm, short weekly summary. States facts, never guilts. */
export function weeklySummaryHtml(displayName: string | null, rows: WeeklyRow[], trend?: string | null): string {
  const items = rows
    .map(
      (r) => `
      <tr>
        <td style="padding:8px 12px;font-size:16px;">${r.name}</td>
        <td style="padding:8px 12px;font-size:16px;text-align:center;">${r.done}/${r.scheduled}</td>
        <td style="padding:8px 12px;font-size:16px;text-align:center;">${r.currentStreak}</td>
      </tr>`,
    )
    .join('');

  const totalDone = rows.reduce((n, r) => n + r.done, 0);

  return `
  <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f4f3ef;border-radius:24px;color:#191a1e;">
    <h1 style="font-size:22px;margin:0 0 4px;">Your week in tiny steps</h1>
    <p style="margin:0 0 16px;color:#5c5e66;">
      ${displayName ? `Hey ${displayName} — ` : ''}${totalDone} routine${totalDone === 1 ? '' : 's'} completed this week.
    </p>
    <table style="width:100%;background:#ffffff;border-radius:16px;border-collapse:separate;padding:8px;">
      <tr>
        <th style="padding:8px 12px;text-align:left;font-size:13px;color:#5c5e66;">Routine</th>
        <th style="padding:8px 12px;font-size:13px;color:#5c5e66;">Done</th>
        <th style="padding:8px 12px;font-size:13px;color:#5c5e66;">Streak</th>
      </tr>
      ${items}
    </table>
    ${trend ? `<p style="margin:16px 0 0;color:#2a2760;font-size:14px;font-weight:600;">${trend}</p>` : ''}
    <p style="margin:16px 0 0;color:#5c5e66;font-size:14px;">
      Next week starts fresh. One tiny step at a time.
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:#8a8c94;">
      You can turn this email off in TinySteps → Settings.
    </p>
  </div>`;
}
