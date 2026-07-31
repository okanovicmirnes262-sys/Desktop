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
  /** Premium-library template (free users see it locked). */
  premium?: boolean;
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
  // ---- premium template library ------------------------------------------
  {
    name: 'Out the door',
    icon: 'coffee',
    premium: true,
    scheduleDays: [1, 2, 3, 4, 5],
    reminderTime: '07:45',
    steps: [
      { title: 'Keys, wallet, phone — pocket check', timerSeconds: null },
      { title: 'Water bottle in the bag', timerSeconds: null },
      { title: 'One look in the mirror', timerSeconds: null },
      { title: 'Shoes on, door locked', timerSeconds: null },
    ],
  },
  {
    name: 'Deep work sprint',
    icon: 'book',
    premium: true,
    scheduleDays: [1, 2, 3, 4, 5],
    reminderTime: '09:30',
    steps: [
      { title: 'Phone in another room', timerSeconds: null },
      { title: 'Write the ONE thing on paper', timerSeconds: 120 },
      { title: 'Work — just this one thing', timerSeconds: 1500 },
      { title: 'Stand up, water, stretch', timerSeconds: 180 },
    ],
  },
  {
    name: '10-minute reset',
    icon: 'brush',
    premium: true,
    scheduleDays: [0, 1, 2, 3, 4, 5, 6],
    reminderTime: null,
    steps: [
      { title: 'Trash into a bag', timerSeconds: 120 },
      { title: 'Dishes to the sink', timerSeconds: 120 },
      { title: 'Clothes to the chairdrobe… or hamper', timerSeconds: 180 },
      { title: 'One surface, fully clear', timerSeconds: 180 },
    ],
  },
  {
    name: 'Sunday reset',
    icon: 'sparkles',
    premium: true,
    scheduleDays: [0],
    reminderTime: '18:00',
    steps: [
      { title: 'Look at next week — just look', timerSeconds: 300 },
      { title: 'Pick the 3 things that matter', timerSeconds: 300 },
      { title: 'Prep one small thing for Monday', timerSeconds: 600 },
      { title: 'Close the week — you did enough', timerSeconds: null },
    ],
  },
  {
    name: 'Anti-doomscroll evening',
    icon: 'moon',
    premium: true,
    scheduleDays: [0, 1, 2, 3, 4, 5, 6],
    reminderTime: '20:30',
    steps: [
      { title: 'Phone on the charger — other room', timerSeconds: null },
      { title: 'Pick tonight: book, show, or bath', timerSeconds: null },
      { title: 'Actually start it', timerSeconds: 300 },
    ],
  },
  {
    name: 'Meds & meals check',
    icon: 'pill',
    premium: true,
    scheduleDays: [0, 1, 2, 3, 4, 5, 6],
    reminderTime: '12:30',
    steps: [
      { title: 'Meds taken? If not — now', timerSeconds: null },
      { title: 'Have you eaten? Something counts', timerSeconds: null },
      { title: 'Big glass of water', timerSeconds: null },
    ],
  },
  {
    name: 'Wind-down for busy brains',
    icon: 'bed',
    premium: true,
    scheduleDays: [0, 1, 2, 3, 4, 5, 6],
    reminderTime: '22:00',
    steps: [
      { title: 'Brain dump — everything on paper', timerSeconds: 300 },
      { title: 'Tomorrow needs only one thing. Pick it', timerSeconds: 120 },
      { title: 'Lights low, screens away', timerSeconds: null },
      { title: 'Bed. The rest can wait', timerSeconds: null },
    ],
  },
  {
    name: 'Body double warm-up',
    icon: 'dumbbell',
    premium: true,
    scheduleDays: [1, 2, 3, 4, 5],
    reminderTime: null,
    steps: [
      { title: 'Text a friend what you’re starting', timerSeconds: null },
      { title: 'Set the scene: water, snack, playlist', timerSeconds: 180 },
      { title: 'Start the smallest possible piece', timerSeconds: 600 },
    ],
  },
  {
    name: 'Laundry, actually finished',
    icon: 'brush',
    premium: true,
    scheduleDays: [6],
    reminderTime: '11:00',
    steps: [
      { title: 'Load in, machine on', timerSeconds: null },
      { title: 'When it beeps: straight to dry', timerSeconds: null },
      { title: 'Fold WITH a show on', timerSeconds: 900 },
      { title: 'Put away — the whole pile', timerSeconds: 300 },
    ],
  },
];

export const FREE_TEMPLATES = SEED_ROUTINES.filter((s) => !s.premium);
export const PREMIUM_TEMPLATES = SEED_ROUTINES.filter((s) => s.premium);
