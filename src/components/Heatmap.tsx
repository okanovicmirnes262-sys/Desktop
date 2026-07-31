// 45-day heatmap: 15 columns of small rounded cells, filled = completed.
// Rendered server-side.

import type { LocalDate } from '@/core/types';

export interface DayCell {
  date: LocalDate;
  filled: boolean;
}

export function Heatmap({ cells }: { cells: DayCell[] }) {
  return (
    <div className="grid grid-cols-15 gap-1" aria-label="Last 45 days" style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))' }}>
      {cells.map((cell) => (
        <div
          key={cell.date}
          title={cell.date}
          className="aspect-square rounded-[5px]"
          style={{ background: cell.filled ? 'var(--primary)' : 'var(--chart-idle)' }}
        />
      ))}
    </div>
  );
}
