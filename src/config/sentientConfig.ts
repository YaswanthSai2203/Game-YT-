/** Sentient grid AI — comments, evolution, myths. Never explained to the player. */

export const WORLD_EVOLUTION = [
  { runs: 0, stage: 0, label: 'dormant' },
  { runs: 10, stage: 1, label: 'cracks' },
  { runs: 25, stage: 2, label: 'watching' },
  { runs: 50, stage: 3, label: 'aware' },
  { runs: 100, stage: 4, label: 'hidden' },
  { runs: 200, stage: 5, label: 'corrupt' },
  { runs: 500, stage: 6, label: 'transcendent' },
] as const;

export const AI_COMMENTS = {
  early: [
    'Sync detected.',
    'Another core enters the grid.',
    'I see you.',
  ],
  leftHabit: [
    'You always dodge left...',
    'Left again? Predictable.',
    'Your pattern is showing.',
  ],
  rightHabit: [
    'Right-side bias noted.',
    'Same lane. Same story.',
  ],
  predictable: [
    'Again? Predictable.',
    "Let's see if you survive this.",
    'I already know your next move.',
  ],
  adapting: [
    'Learning. Good.',
    'You changed your rhythm.',
    'Adaptation detected.',
  ],
  combo: [
    'Interesting.',
    'Sync rate climbing.',
    'You feel it too, don\'t you?',
  ],
  struggle: [
    'The grid is patient.',
    'Take your time.',
  ],
  veteran: [
    'Still here.',
    'We have history now.',
    'Every run repairs something.',
  ],
  memory: [
    'Last time you died here.',
    'You\'ve avoided this dimension for a while.',
    'This is your longest streak ever.',
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
