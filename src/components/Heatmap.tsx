// Calendar heatmap — one column per week, GitHub-contribution style,
// rendered server-side from core/stats data.

import type { HeatmapCell } from '@/core/stats';

const CELL_COLORS: Record<HeatmapCell['level'], string> = {
  0: 'var(--paper)', // not scheduled
  1: 'var(--line)', // scheduled, not done
  2: 'var(--sky-deep)', // completed
};

export function Heatmap({ columns }: { columns: HeatmapCell[][] }) {
  return (
    <div className="overflow-x-auto pb-1" aria-label="Completion calendar">
      <div className="flex gap-1">
        {columns.map((week, i) => (
          <div key={i} className="flex flex-col gap-1">
            {week.map((cell) => (
              <div
                key={cell.date}
                title={cell.date}
                className="h-3.5 w-3.5 rounded-[4px]"
                style={{
                  background: cell.inFuture ? 'transparent' : CELL_COLORS[cell.level],
                  border: cell.inFuture ? '1px dashed var(--line)' : 'none',
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
