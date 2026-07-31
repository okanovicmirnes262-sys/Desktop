// Template routines offered on first run (and one-tap "Use" rows).
// `icon` is an icon key from src/components/icons — no emoji.

export interface SeedStep {
  title: string;
  timerSeconds: number | null;
}

export interface SeedRoutine {
  name: string;
  icon: string;
  scheduleDays: number[];
  reminderTime: string | null;
  steps: SeedStep[];
}

export const SEED_ROUTINES: SeedRoutine[] = [
  {
    name: 'Morning',
    icon: 'sun',
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
    icon: 'moon',
    scheduleDays: [0, 1, 2, 3, 4, 5, 6],
    reminderTime: '21:30',
    steps: [
      { title: 'Put phone on charger — other room', timerSeconds: null },
      { title: 'Tomorrow’s clothes on the chair', timerSeconds: 180 },
      { title: 'Brush teeth', timerSeconds: 120 },
      { title: 'Lights down, screens off', timerSeconds: null },
    ],
  },
  {
    name: 'Move your body',
    icon: 'dumbbell',
    scheduleDays: [1, 3, 5],
    reminderTime: '17:00',
    steps: [
      { title: 'Change into comfy clothes', timerSeconds: null },
      { title: 'Stretch', timerSeconds: 120 },
      { title: 'Move — walk, dance, anything', timerSeconds: 600 },
      { title: 'Water + a deep breath', timerSeconds: null },
    ],
  },
];
