// Stats computations — pure, portable, and deliberately simple.

import type { Completion, LocalDate, Routine } from './types';
import { addDays, daysBetween, weekdayOf } from './dates';

/** Completion rate over the trailing `windowDays`, counting only days the
 *  routine was actually scheduled. Returns 0–1, or null if never scheduled. */
export function completionRate(
  routine: Pick<Routine, 'scheduleDays'>,
  completions: Completion[],
  today: LocalDate,
  windowDays = 30,
): number | null {
  const done = new Set(completions.map((c) => c.completedOn));
  let scheduled = 0;
  let completed = 0;
  for (let i = 0; i < windowDays; i++) {
    const day = addDays(today, -i);
    if (!routine.scheduleDays.includes(weekdayOf(day))) continue;
    scheduled += 1;
    if (done.has(day)) completed += 1;
  }
  return scheduled === 0 ? null : completed / scheduled;
}

export interface HeatmapCell {
  date: LocalDate;
  /** 0 = not scheduled, 1 = scheduled but missed, 2 = completed. */
  level: 0 | 1 | 2;
  inFuture: boolean;
}

/** Calendar heatmap data: `weeks` full weeks ending with the current week,
 *  organised column-per-week like a contribution graph. */
export function heatmapData(
  routine: Pick<Routine, 'scheduleDays'>,
  completions: Completion[],
  today: LocalDate,
  weeks = 15,
): HeatmapCell[][] {
  const done = new Set(completions.map((c) => c.completedOn));
  // End the grid on the Saturday of the current week.
  const gridEnd = addDays(today, 6 - weekdayOf(today));
  const start = addDays(gridEnd, -(weeks * 7 - 1));
  const cols: HeatmapCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: HeatmapCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d);
      const inFuture = daysBetween(today, date) > 0;
      const scheduled = routine.scheduleDays.includes(weekdayOf(date));
      const level: HeatmapCell['level'] = done.has(date) ? 2 : scheduled ? 1 : 0;
      col.push({ date, level: inFuture ? (scheduled ? 1 : 0) : level, inFuture });
    }
    cols.push(col);
  }
  return cols;
}
