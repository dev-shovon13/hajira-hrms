/**
 * One colour per leave type, everywhere it appears (quota stitches, the HR
 * donut, the team calendar, admin swatches). The three everyday types get
 * hues that sit between the status threads and were validated together for
 * colour-blind separation in both themes; the rarer types share a neutral
 * slate thread (the donut groups them as "Other" in the same slate).
 * Types HR creates later fall back to the colour stored on the type.
 */
const EVERYDAY: Record<string, string> = {
  AL: 'var(--lt-al)',
  CL: 'var(--lt-cl)',
  SL: 'var(--lt-sl)',
};

export const OTHER_LEAVE_COLOR = 'var(--lt-other)';
const NEUTRAL_CODES = new Set(['ML', 'PL', 'UL']);

export const isEverydayLeave = (code: string) => code in EVERYDAY;

export function leaveColor(code: string | undefined, stored?: string | null) {
  if (code && EVERYDAY[code]) return EVERYDAY[code];
  if (code && NEUTRAL_CODES.has(code)) return OTHER_LEAVE_COLOR;
  return stored ?? OTHER_LEAVE_COLOR;
}
