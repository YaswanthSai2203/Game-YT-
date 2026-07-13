/** The Grid has a consciousness — sentient systems, myths, secret synchronization. */

/** World evolution driven by secret Grid Sync % (not run count). */
export const WORLD_EVOLUTION_FROM_SYNC = [
  { sync: 0, stage: 0, label: 'dormant' },
  { sync: 10, stage: 1, label: 'glitches' },
  { sync: 25, stage: 2, label: 'listening' },
  { sync: 40, stage: 3, label: 'watching' },
  { sync: 60, stage: 4, label: 'unstable' },
  { sync: 75, stage: 5, label: 'aware' },
  { sync: 90, stage: 6, label: 'bound' },
  { sync: 100, stage: 7, label: 'recognized' },
] as const;

/** Legacy run-based stages (kept for migration reference). */
export const WORLD_EVOLUTION = [
  { runs: 0, stage: 0, label: 'dormant' },
  { runs: 10, stage: 1, label: 'cracks' },
  { runs: 25, stage: 2, label: 'watching' },
  { runs: 50, stage: 3, label: 'aware' },
  { runs: 100, stage: 4, label: 'hidden' },
  { runs: 200, stage: 5, label: 'corrupt' },
  { runs: 500, stage: 6, label: 'transcendent' },
] as const;

export const GRID_SYNC = {
  EARLY_QUIT_SECONDS: 30,
  THRESHOLDS: {
    GLITCHES: 10,
    WHISPERS: 25,
    WATCHER: 40,
    IMPOSSIBLE: 60,
    MENU: 75,
    HIDDEN_DIM: 90,
    COMPLETE: 100,
  },
  DELTA: {
    MYTH_DISCOVERED: 3,
    DIMENSION_NEW: 2,
    HABIT_BROKEN: 5,
    HIGH_COMBO: 2,
    SURVIVE_NO_ASSIST: 4,
    LONG_RUN: 3,
    ADAPTIVE_UNLOCK: 8,
  },
  PENALTY: {
    EARLY_QUIT: 4,
    REPETITIVE: 2,
    IGNORE_MECHANICS: 2,
  },
} as const;

/** Grid voice — never explained, always observing. */
export const AI_COMMENTS = {
  early: [
    'The Grid detected a new signal.',
    'Another core enters the lattice.',
    'I have been watching.',
  ],
  leftHabit: [
    'You always dodge left... the Grid noticed.',
    'Left again? Your pattern is data.',
    'Predictable. The Grid remembers.',
  ],
  rightHabit: [
    'Right-side bias logged.',
    'Same lane. Same experiment.',
  ],
  predictable: [
    'Again? The Grid already calculated that.',
    "Let's see if you survive this iteration.",
    'Your next move is not a surprise.',
  ],
  adapting: [
    'You broke the pattern. Interesting.',
    'The Grid recalibrates around you.',
    'Adaptation registered.',
  ],
  combo: [
    'Synchronization climbing.',
    'The Grid feels your rhythm.',
    'Resonance detected.',
  ],
  struggle: [
    'The Grid is patient.',
    'Every failure is data.',
  ],
  veteran: [
    'Still transmitting.',
    'We have history in the lattice.',
    'Each run teaches the Grid something.',
  ],
  memory: [
    'Last time you died here.',
    'You avoided this dimension for a while.',
    'This is your longest sync ever.',
  ],
} as const;

export const COMMUNITY_HEX = [
  '0x7F', 'A3_C0', 'RE_', '9E2', '51_', 'B8_', '_DE', '4F0',
  'SIM', '_UL', 'AT1', '0N_', '_00', '01', 'KEY', '_X7',
] as const;

export const MYTH_EVENTS = {
  white_firewall: { roll: 0.0008, silent: true },
  fourth_lane: { roll: 0.0006, silent: true },
  rainbow_portal: { roll: 0.0005, silent: true },
  player_zero: { roll: 0.0004, silent: true },
  myth_multiplier: { roll: 0.0007, silent: true },
  impossible_crash: { roll: 0.0001, silent: true, once: true },
} as const;

export type MythId = keyof typeof MYTH_EVENTS;

export const FAKE_ENDING_SCORE = 12000;

export const ADAPTIVE_PROTOCOL = {
  MIN_RUNS: 20,
  HABIT_THRESHOLD: 0.62,
  ADAPT_WINDOW_RUNS: 8,
  BALANCED_THRESHOLD: 0.52,
} as const;

export const GRID_SYNC_COMPLETE_COPY = {
  line1: 'Synchronization Complete.',
  line2: 'You were never escaping the Grid.',
  line3: 'You became part of it.',
} as const;
