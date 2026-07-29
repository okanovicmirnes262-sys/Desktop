// Two example ADHD-friendly routines offered to new users during onboarding.
// Pure data — the app layer persists these via Supabase.

export interface SeedStep {
  title: string;
  timerSeconds: number | null;
}

export interface SeedRoutine {
  name: string;
  emoji: string;
  scheduleDays: number[];
  reminderTime: string | null;
  steps: SeedStep[];
}

export const SEED_ROUTINES: SeedRoutine[] = [
  {
    name: 'Morning',
    emoji: '🌅',
    scheduleDays: [0, 1, 2, 3, 4, 5, 6],
    reminderTime: '08:00',
    steps: [
      { title: 'Feet on the floor', timerSeconds: null },
      { title: 'Drink a glass of water', timerSeconds: null },
      { title: 'Take meds', timerSeconds: null },
      { title: 'Get dressed', timerSeconds: 300 },
      { title: 'Fill water bottle', timerSeconds: null },
      { title: 'Put on shoes', timerSeconds: null },
    ],
  },
  {
    name: 'Wind-down',
    emoji: '🌙',
    scheduleDays: [0, 1, 2, 3, 4, 5, 6],
    reminderTime: '21:30',
    steps: [
      { title: 'Put phone on charger — other room', timerSeconds: null },
      { title: 'Tomorrow’s clothes on the chair', timerSeconds: 180 },
      { title: 'Brush teeth', timerSeconds: 120 },
      { title: 'Lights down, screens off', timerSeconds: null },
    ],
  },
];
