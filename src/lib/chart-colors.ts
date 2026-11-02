// Chosen against the dataviz skill's six checks (lightness band, chroma
// floor, CVD separation, normal-vision floor, contrast) in both light and
// dark mode. The values live in globals.css; re-run `validate_palette.js`
// before hand-picking replacements.

import type { SourceKey } from '@/lib/data-sources-context';
import type { MatchStatus } from '@/lib/reconciliation-engine';

export const SOURCE_COLORS: Record<SourceKey, string> = {
  dynamics: 'var(--data-dynamics)',
  prism: 'var(--data-prism)',
  bank: 'var(--data-bank)',
};

// Status is a fixed, reserved scale — never themed, never reused as "series
// N". Always ship paired with an icon + label (see match-status-badge.tsx);
// color is never the only carrier of meaning.
export const STATUS_COLORS: Record<MatchStatus, string> = {
  matched: 'var(--status-good)',
  timing: 'var(--status-warning)',
  mispost: 'var(--status-serious)',
  investigate: 'var(--status-critical)',
};
