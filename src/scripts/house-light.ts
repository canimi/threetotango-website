/**
 * Time of day: the house light follows the visitor's own clock, using the five light states of the
 * series' world bible (TTT_03 §5). Only a soft overlay changes; text and buttons keep their colours.
 */
export type HouseLight = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';

export function lightFor(hour: number): HouseLight {
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

if (typeof document !== 'undefined') {
  document.documentElement.dataset.light = lightFor(new Date().getHours());
}
