import type { GameMode } from '@/types';

export const GAME = {
  TITLE: 'NEON PULSE',
  SUBTITLE: 'QUANTUM RUN',
  VERSION: '1.2.0',
  SAVE_VERSION: 3,
  TARGET_FPS: 60,
  MAX_DELTA: 1 / 30,
} as const;

export type UpgradeId = 'shardBoost' | 'phaseSync' | 'magnetField' | 'coreShield';

export const UPGRADES: Record<UpgradeId, {
  name: string;
  description: string;
  maxLevel: number;
  costBase: number;
  costScale: number;
  effectPerLevel: number;
  icon: string;
}> = {
  shardBoost: {
    name: 'Data Amplifier',
    description: '+12% shard points per level',
    maxLevel: 5,
    costBase: 40,
    costScale: 1.6,
    effectPerLevel: 0.12,
    icon: '💎',
  },
  phaseSync: {
    name: 'Phase Sync',
    description: '-10% phase cooldown per level',
    maxLevel: 5,
    costBase: 60,
    costScale: 1.7,
    effectPerLevel: 0.10,
    icon: '🌊',
  },
  magnetField: {
    name: 'Magnet Field',
    description: '+20% magnet range per level',
    maxLevel: 3,
    costBase: 80,
    costScale: 2.0,
    effectPerLevel: 0.20,
    icon: '🧲',
  },
  coreShield: {
    name: 'Core Shield',
    description: 'Start each run with a shield',
    maxLevel: 1,
    costBase: 200,
    costScale: 1,
    effectPerLevel: 1,
    icon: '🛡️',
  },
};

export const CREDITS = {
  PER_SHARD: 1,
  DAILY_BASE: 25,
  DAILY_STREAK_BONUS: 10,
  DAILY_STREAK_CAP: 7,
} as const;

export const LANES = {
  COUNT: 3,
  WIDTH_RATIO: 0.28,
  SWITCH_DURATION: 0.2,
} as const;

export const PLAYER = {
  RADIUS: 18,
  START_LANE: 1,
  PHASE_DURATION: 0.8,
  PHASE_COOLDOWN: 2.5,
  TRAIL_LENGTH: 12,
} as const;

export const SCROLL = {
  MIN_SPEED: 220,
  BASE_SPEED: 280,
  MAX_SPEED: 780,
  RAMP_DURATION: 120,
  PARALLAX_LAYERS: 3,
} as const;

export const SCORING = {
  SHARD_BASE: 10,
  COMBO_INCREMENT: 0.5,
  MAX_COMBO_MULTIPLIER: 10,
  COMBO_TIMEOUT: 2.0,
  PHASE_BONUS: 50,
  VAULT_BONUS: 500,
  NEAR_MISS_BONUS: 25,
} as const;

export const HYPE_COMBO_TIERS = [
  { combo: 5, title: 'NICE!', subtitle: 'Combo chain started', tier: 1 },
  { combo: 10, title: 'ON FIRE!', subtitle: 'Sync accelerating', tier: 2 },
  { combo: 15, title: 'UNSTOPPABLE!', subtitle: 'They cannot touch you', tier: 3 },
  { combo: 20, title: 'GOD MODE', subtitle: 'Maximum multiplier', tier: 4 },
  { combo: 30, title: 'QUANTUM FLOW', subtitle: 'Legendary sync', tier: 5 },
] as const;

export const DIFFICULTY = {
  SPAWN_INTERVAL_BASE: 1.2,
  SPAWN_INTERVAL_MIN: 0.35,
  SPAWN_RAMP_TIME: 120,
  PATTERN_UNLOCK_TIME: [0, 15, 30, 60, 90],
} as const;

export const POWERUP = {
  DURATION: {
    shield: 5,
    magnet: 6,
    overclock: 4,
    chronos: 3,
  } as Record<string, number>,
  SPAWN_CHANCE: 0.08,
  MAGNET_RANGE: 120,
  CHRONOS_FACTOR: 0.5,
  OVERCLOCK_MULTIPLIER: 2,
} as const;

/** Lane pickups — score boost bonus and bomb traps */
export const PICKUP = {
  SCORE_BOOST_DURATION: 10,
  SCORE_BOOST_MULTIPLIER: 2,
  BOMB_PENALTY: 100,
  BONUS_SPAWN_CHANCE: 0.07,
  TRAP_SPAWN_CHANCE: 0.045,
  MIN_SPAWN_TIME: 22,
} as const;

export const SYNC = {
  XP_PER_SHARD: 5,
  XP_PER_LEVEL: [0, 100, 250, 500, 800, 1200, 1700, 2300, 3000, 4000, 5000],
  UNLOCKS: [
    { level: 1, type: 'core', id: 'cyan', name: 'Cyan Core' },
    { level: 3, type: 'core', id: 'magenta', name: 'Magenta Core' },
    { level: 5, type: 'theme', id: 'matrix', name: 'Matrix Grid' },
    { level: 8, type: 'trail', id: 'gold', name: 'Gold Trail' },
    { level: 12, type: 'core', id: 'violet', name: 'Violet Core' },
    { level: 15, type: 'theme', id: 'inferno', name: 'Inferno Grid' },
    { level: 20, type: 'trail', id: 'glitch', name: 'Glitch Trail' },
    { level: 30, type: 'core', id: 'quantum', name: 'Quantum Core' },
  ],
} as const;

export const MODE_CONFIG: Record<GameMode, { label: string; description: string; timeLimit?: number; targetScore?: number }> = {
  endless: { label: 'ENDLESS', description: 'Survive as long as you can. No limits.' },
  timeAttack60: { label: 'TIME ATTACK', description: 'Maximum score in 60 seconds.', timeLimit: 60 },
  timeAttack120: { label: 'TIME ATTACK+', description: 'Maximum score in 120 seconds.', timeLimit: 120 },
  challenge: { label: 'CHALLENGE', description: 'Daily seeded run. Beat the target score.', targetScore: 5000 },
  practice: { label: 'PRACTICE', description: 'No death. Train your reflexes.' },
};

export const COLORS = {
  void: 0x0a0e1a,
  voidLight: 0x121829,
  cyan: 0x00f0ff,
  magenta: 0xff006e,
  violet: 0x8b5cf6,
  gold: 0xffd700,
  green: 0x00ff88,
  red: 0xff2244,
  white: 0xe8edf5,
  gridLine: 0x1a2744,
} as const;

export const CORE_COLORS: Record<string, number> = {
  cyan: COLORS.cyan,
  magenta: COLORS.magenta,
  violet: COLORS.violet,
  quantum: COLORS.gold,
  'grid-bound': 0x00f0ff,
};

export const STORAGE_KEY = 'neon-pulse-save-v3';

export const LEADERBOARD_SIZE = 10;
