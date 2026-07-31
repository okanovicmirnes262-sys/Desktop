// Central icon registry. Routines store an icon key (in the legacy
// `emoji` column); older rows may still hold a literal emoji, so we map
// those to the nearest line icon. No emoji are rendered anywhere.

import { createElement } from 'react';
import {
  Bed,
  BookOpen,
  Brush,
  Coffee,
  Dumbbell,
  Moon,
  Pill,
  Sparkles,
  Sun,
  type LucideIcon,
} from 'lucide-react';

export const ROUTINE_ICONS: Record<string, LucideIcon> = {
  sun: Sun,
  moon: Moon,
  dumbbell: Dumbbell,
  book: BookOpen,
  pill: Pill,
  brush: Brush,
  bed: Bed,
  coffee: Coffee,
  sparkles: Sparkles,
};

/** Icon choices shown in the routine form, in display order. */
export const ICON_CHOICES = [
  'sun',
  'moon',
  'dumbbell',
  'book',
  'pill',
  'brush',
  'bed',
  'coffee',
  'sparkles',
] as const;

const LEGACY_EMOJI: Record<string, string> = {
  '🌅': 'sun',
  '🌙': 'moon',
  '💪': 'dumbbell',
  '📚': 'book',
  '💊': 'pill',
  '🧹': 'brush',
  '🧘': 'bed',
  '✨': 'sparkles',
};

export function routineIcon(value: string): LucideIcon {
  return ROUTINE_ICONS[value] ?? ROUTINE_ICONS[LEGACY_EMOJI[value] ?? ''] ?? Sparkles;
}

/** Renders a routine's icon from its stored key (or legacy emoji).
 *  Uses createElement so the (module-level, stable) component isn't
 *  mistaken for one defined during render. */
export function RoutineIcon({
  value,
  size = 19,
  strokeWidth = 2,
}: {
  value: string;
  size?: number;
  strokeWidth?: number;
}) {
  return createElement(routineIcon(value), { size, strokeWidth });
}
