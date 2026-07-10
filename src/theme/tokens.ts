/**
 * PrimaPrompter design tokens — ported from the approved v1 wireframes.
 * Two worlds: a warm "studio" surface (library/editor/review/settings) and a
 * dark "through-the-lens" viewfinder (record/capture). One accent — tally amber.
 */

export const colors = {
  // studio (light) world
  paper: '#E7E4DC',
  paperCard: '#F3F1EB',
  ink: '#17181A',
  inkMuted: '#63646A',
  line: '#D6D2C7',

  // camera (dark) world
  stage: '#14161A',
  stage2: '#1D2025',
  camLine: '#363B43',

  // accents
  tally: '#E8930A', // primary / brand — the only accent
  tallyInk: '#231500', // text/icons on tally
  rec: '#FF3B30', // reserved for the record affordance only
  go: '#25B268', // keeper / confirm
  cue: '#39B7D6', // cue tags (v1: one cue color)
} as const;

export const fonts = {
  // iOS ships Futura; RN falls back to the system font where unavailable.
  display: 'Futura',
  mono: 'Menlo',
} as const;

export const radius = {
  card: 15,
  chip: 999,
  sheet: 22,
} as const;

export const space = (n: number) => n * 4;
