import { describe, expect, it } from 'vitest';
import {
  applyCompletion,
  initialStreakState,
  reconcile,
  COMPLETIONS_PER_FREEZE,
  MAX_FREEZES,
} from '../streak';
import type { StreakState } from '../types';

// Helper: fold a list of completion dates through the engine.
function run(dates: string[], start?: StreakState) {
  let state = start ?? initialStreakState('r1');
  const events = [];
  for (const d of dates) {
    const res = applyCompletion(state, d);
    state = res.state;
    events.push(...res.events);
  }
  return { state, events };
}

function stateWith(partial: Partial<StreakState>): StreakState {
  return { ...initialStreakState('r1'), ...partial };
}

describe('basic streak counting', () => {
  it('first completion starts a streak of 1', () => {
    const { state } = run(['2026-07-01']);
    expect(state.currentStreak).toBe(1);
    expect(state.bestStreak).toBe(1);
    expect(state.lastCompletedOn).toBe('2026-07-01');
  });

  it('consecutive days grow the streak', () => {
    const { state } = run(['2026-07-01', '2026-07-02', '2026-07-03']);
    expect(state.currentStreak).toBe(3);
    expect(state.bestStreak).toBe(3);
  });

  it('completing twice on the same day is idempotent', () => {
    const { state } = run(['2026-07-01', '2026-07-01']);
    expect(state.currentStreak).toBe(1);
    expect(state.freezeProgress).toBe(1); // progress counted once, not twice
  });

  it('crosses month boundaries', () => {
    const { state } = run(['2026-07-31', '2026-08-01']);
    expect(state.currentStreak).toBe(2);
  });

  it('a miss with no freezes resets to 1 on the next completion', () => {
    const { state } = run(['2026-07-01', '2026-07-02', '2026-07-04']);
    expect(state.currentStreak).toBe(1);
    expect(state.bestStreak).toBe(2); // best is preserved
  });
});

describe('streak freeze protection', () => {
  it('one missed day consumes one freeze and preserves the streak', () => {
    const start = stateWith({
      currentStreak: 5,
      bestStreak: 5,
      lastCompletedOn: '2026-07-05',
      freezeBalance: 2,
    });
    const { state, events } = applyCompletion(start, '2026-07-07'); // missed the 6th
    expect(state.currentStreak).toBe(6); // survived AND grew with today's completion
    expect(state.freezeBalance).toBe(1);
    expect(events).toContainEqual({ kind: 'consumed', onDate: '2026-07-06' });
  });

  it('the frozen day itself does not increment the streak', () => {
    const start = stateWith({
      currentStreak: 5,
      bestStreak: 5,
      lastCompletedOn: '2026-07-05',
      freezeBalance: 1,
    });
    const { state } = applyCompletion(start, '2026-07-07');
    // 5 (through Jul 5) + frozen Jul 6 (no growth) + completed Jul 7 (+1) = 6
    expect(state.currentStreak).toBe(6);
  });

  it('multiple missed days consume multiple freezes', () => {
    const start = stateWith({
      currentStreak: 10,
      bestStreak: 10,
      lastCompletedOn: '2026-07-05',
      freezeBalance: 3,
    });
    const { state, events } = applyCompletion(start, '2026-07-08'); // missed 6th + 7th
    expect(state.currentStreak).toBe(11);
    expect(state.freezeBalance).toBe(1);
    expect(events.filter((e) => e.kind === 'consumed')).toHaveLength(2);
  });

  it('breaks the streak when the gap exceeds the bank, wasting no freezes', () => {
    const start = stateWith({
      currentStreak: 10,
      bestStreak: 10,
      lastCompletedOn: '2026-07-05',
      freezeBalance: 1,
    });
    // Missed 6th, 7th, 8th — bank of 1 can't cover 3 missed days.
    const { state, events } = applyCompletion(start, '2026-07-09');
    expect(state.currentStreak).toBe(1); // reset, then today counts as 1
    expect(state.bestStreak).toBe(10);
    // Freeze covers the 6th, then the bank is empty at the 7th → break.
    expect(events.filter((e) => e.kind === 'consumed')).toHaveLength(1);
    expect(state.freezeBalance).toBe(0);
  });

  it('a broken streak resets earn progress but keeps nothing else hostage', () => {
    const start = stateWith({
      currentStreak: 3,
      bestStreak: 3,
      lastCompletedOn: '2026-07-01',
      freezeProgress: 5,
    });
    const { state } = applyCompletion(start, '2026-07-10');
    expect(state.freezeProgress).toBe(1); // reset to 0, then today's completion = 1
    expect(state.currentStreak).toBe(1);
  });
});

describe('reconcile (read-time catch-up, no completion)', () => {
  it('is a no-op when the streak is alive through yesterday', () => {
    const start = stateWith({ currentStreak: 4, lastCompletedOn: '2026-07-06' });
    const { state, events } = reconcile(start, '2026-07-07');
    expect(state).toEqual(start);
    expect(events).toHaveLength(0);
  });

  it('today being incomplete does not consume a freeze — the day is not over', () => {
    const start = stateWith({
      currentStreak: 4,
      lastCompletedOn: '2026-07-06',
      freezeBalance: 2,
    });
    const { state } = reconcile(start, '2026-07-07');
    expect(state.freezeBalance).toBe(2);
    expect(state.currentStreak).toBe(4);
  });

  it('consumes a freeze for a fully-elapsed missed day', () => {
    const start = stateWith({
      currentStreak: 4,
      lastCompletedOn: '2026-07-05',
      freezeBalance: 2,
    });
    const { state, events } = reconcile(start, '2026-07-07');
    expect(state.freezeBalance).toBe(1);
    expect(state.currentStreak).toBe(4); // alive, not grown
    expect(state.lastCompletedOn).toBe('2026-07-06'); // alive through frozen day
    expect(events).toEqual([{ kind: 'consumed', onDate: '2026-07-06' }]);
  });

  it('zeroes the streak when freezes run out', () => {
    const start = stateWith({
      currentStreak: 9,
      bestStreak: 9,
      lastCompletedOn: '2026-07-01',
      freezeBalance: 1,
    });
    const { state } = reconcile(start, '2026-07-10');
    expect(state.currentStreak).toBe(0);
    expect(state.bestStreak).toBe(9);
    expect(state.freezeBalance).toBe(0);
  });

  it('does nothing for a routine never completed', () => {
    const { state, events } = reconcile(initialStreakState('r1'), '2026-07-10');
    expect(state.currentStreak).toBe(0);
    expect(events).toHaveLength(0);
  });
});

describe('rest days (planned skips)', () => {
  it('a rest day bridges the gap without consuming a freeze', () => {
    const start = stateWith({
      currentStreak: 5,
      bestStreak: 5,
      lastCompletedOn: '2026-07-05',
      freezeBalance: 2,
    });
    const rest = new Set(['2026-07-06']);
    const { state, events } = applyCompletion(start, '2026-07-07', rest);
    expect(state.currentStreak).toBe(6); // survived and grew with today
    expect(state.freezeBalance).toBe(2); // untouched
    expect(events.filter((e) => e.kind === 'consumed')).toHaveLength(0);
  });

  it('rest day + freeze combine across a two-day gap', () => {
    const start = stateWith({
      currentStreak: 5,
      bestStreak: 5,
      lastCompletedOn: '2026-07-05',
      freezeBalance: 1,
    });
    const rest = new Set(['2026-07-06']); // rested the 6th, plain-missed the 7th
    const { state, events } = applyCompletion(start, '2026-07-08', rest);
    expect(state.currentStreak).toBe(6);
    expect(state.freezeBalance).toBe(0); // freeze covered the 7th
    expect(events).toContainEqual({ kind: 'consumed', onDate: '2026-07-07' });
  });

  it('a rest day alone does not grow the streak', () => {
    const start = stateWith({
      currentStreak: 5,
      bestStreak: 5,
      lastCompletedOn: '2026-07-05',
    });
    const { state } = reconcile(start, '2026-07-07', new Set(['2026-07-06']));
    expect(state.currentStreak).toBe(5);
    expect(state.lastCompletedOn).toBe('2026-07-06'); // alive through the rest day
  });

  it('without a rest day the same gap would need a freeze', () => {
    const start = stateWith({
      currentStreak: 5,
      bestStreak: 5,
      lastCompletedOn: '2026-07-05',
      freezeBalance: 0,
    });
    const { state } = applyCompletion(start, '2026-07-07'); // no rest, no freezes
    expect(state.currentStreak).toBe(1); // broke
  });
});

describe('earning freezes', () => {
  const week = [
    '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04',
    '2026-07-05', '2026-07-06', '2026-07-07',
  ];

  it(`earns 1 freeze per ${COMPLETIONS_PER_FREEZE} completions`, () => {
    const { state, events } = run(week);
    expect(state.freezeBalance).toBe(1);
    expect(state.freezeProgress).toBe(0);
    expect(events).toContainEqual({ kind: 'earned', onDate: '2026-07-07' });
  });

  it('progress below 7 earns nothing', () => {
    const { state } = run(week.slice(0, 6));
    expect(state.freezeBalance).toBe(0);
    expect(state.freezeProgress).toBe(6);
  });

  it(`caps the bank at ${MAX_FREEZES} and pauses progress while full`, () => {
    const start = stateWith({
      currentStreak: 20,
      bestStreak: 20,
      lastCompletedOn: '2026-06-30',
      freezeBalance: MAX_FREEZES,
      freezeProgress: 6,
    });
    const { state } = run(week, start);
    expect(state.freezeBalance).toBe(MAX_FREEZES);
    // Progress paused at 6 while full — nothing silently discarded.
    expect(state.freezeProgress).toBe(6);
  });

  it('resumes earning after a freeze is spent', () => {
    const start = stateWith({
      currentStreak: 7,
      bestStreak: 7,
      lastCompletedOn: '2026-07-07',
      freezeBalance: 1,
      freezeProgress: 0,
    });
    // Miss the 8th (freeze spent), then complete 7 days → earn again.
    const days = ['2026-07-09', '2026-07-10', '2026-07-11', '2026-07-12',
      '2026-07-13', '2026-07-14', '2026-07-15'];
    const { state, events } = run(days, start);
    expect(events).toContainEqual({ kind: 'consumed', onDate: '2026-07-08' });
    expect(events).toContainEqual({ kind: 'earned', onDate: '2026-07-15' });
    expect(state.freezeBalance).toBe(1);
    expect(state.currentStreak).toBe(14); // 7 + frozen day + 7 more
  });
});
