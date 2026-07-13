import type { GameStats, WorldMemory } from '@/types';

export type GridMood = 'curious' | 'testing' | 'aggressive' | 'respectful';

export type RunThemeId =
  | 'standard'
  | 'first_contact'
  | 'trial_by_fire'
  | 'mercy_protocol'
  | 'hunter'
  | 'echo_run'
  | 'corruption'
  | 'recognition';

export type WeatherType = 'clear' | 'data_rain' | 'static_storm' | 'void_fog' | 'corruption_haze';

export const RUN_THEMES: Record<RunThemeId, {
  label: string;
  subtitle: string;
  mood: GridMood;
  weather: WeatherType;
  spawnMult: number;
  firewallMult: number;
  shardMult: number;
}> = {
  standard: {
    label: 'STANDARD SYNC',
    subtitle: 'The Grid observes in silence.',
    mood: 'curious',
    weather: 'clear',
    spawnMult: 1,
    firewallMult: 1,
    shardMult: 1,
  },
  first_contact: {
    label: 'FIRST CONTACT',
    subtitle: 'It knows you are new here.',
    mood: 'curious',
    weather: 'data_rain',
    spawnMult: 0.9,
    firewallMult: 0.75,
    shardMult: 1.2,
  },
  trial_by_fire: {
    label: 'TRIAL BY FIRE',
    subtitle: 'Prove you can adapt.',
    mood: 'testing',
    weather: 'static_storm',
    spawnMult: 0.85,
    firewallMult: 1.25,
    shardMult: 1,
  },
  mercy_protocol: {
    label: 'MERCY PROTOCOL',
    subtitle: 'The Grid eases off… for now.',
    mood: 'respectful',
    weather: 'void_fog',
    spawnMult: 1.1,
    firewallMult: 0.6,
    shardMult: 1.15,
  },
  hunter: {
    label: 'HUNTER RUN',
    subtitle: 'It has learned your patterns.',
    mood: 'aggressive',
    weather: 'static_storm',
    spawnMult: 0.8,
    firewallMult: 1.35,
    shardMult: 0.9,
  },
  echo_run: {
    label: 'ECHO RUN',
    subtitle: 'Your past self races beside you.',
    mood: 'testing',
    weather: 'data_rain',
    spawnMult: 1,
    firewallMult: 1,
    shardMult: 1,
  },
  corruption: {
    label: 'CORRUPTED LATTICE',
    subtitle: 'Reality is unstable.',
    mood: 'aggressive',
    weather: 'corruption_haze',
    spawnMult: 0.75,
    firewallMult: 1.2,
    shardMult: 1.3,
  },
  recognition: {
    label: 'RECOGNITION',
    subtitle: 'The Grid acknowledges mastery.',
    mood: 'respectful',
    weather: 'clear',
    spawnMult: 1,
    firewallMult: 0.85,
    shardMult: 1.25,
  },
};

export const MOOD_WHISPERS: Record<GridMood, string[]> = {
  curious: [
    'Interesting rhythm.',
    'I am still learning you.',
    'Show me something new.',
  ],
  testing: [
    'Let us see if you adapt.',
    'Pressure reveals truth.',
    'Again. Faster.',
  ],
  aggressive: [
    'Predictable.',
    'The lattice tightens.',
    'You cannot hide here.',
  ],
  respectful: [
    'You earned this pace.',
    'Synchronization noted.',
    'Continue. I am watching with interest.',
  ],
};

export const DIRECTOR = {
  WHISPER_INTERVAL: 38,
  MOOD_SHIFT_THRESHOLD: 0.35,
  SLOWMO_DURATION: 0.85,
  SLOWMO_SCALE: 0.32,
  GHOST_RECORD_INTERVAL: 0.12,
  GHOST_MAX_FRAMES: 800,
  GHOST_MIN_SCORE_RATIO: 0.72,
} as const;

/** Personalized title from long-term behavior — never pick manually. */
export function computePlayerTitle(mem: WorldMemory, stats: GameStats): string {
  if (mem.gridSyncComplete) return 'Lattice Bound';
  if (mem.mythsWitnessed.length >= 4) return 'Anomaly Witness';
  if (mem.impossibleSeen) return 'Null Survivor';
  if (mem.adaptiveUnlocked) return 'Pattern Breaker';
  if (mem.watcherDefeated) return 'Unwatched';
  if (mem.gridSync >= 75) return 'Grid Recognized';

  const total = mem.laneMovesLeft + mem.laneMovesRight;
  if (total >= 40) {
    const left = mem.laneMovesLeft / total;
    if (left > 0.68) return 'Leftbound Signal';
    if (left < 0.32) return 'Rightbound Signal';
  }

  if (stats.phaseShiftsUsed > stats.totalRuns * 8) return 'Phase Addict';
  if (stats.bestCombo >= 20) return 'Flow State';
  if (stats.totalRuns >= 100) return 'Persistent Node';
  if (stats.totalRuns >= 30) return 'Regular Sync';
  if (mem.longestRunSeconds >= 180) return 'Endurance Core';

  return mem.playerTitle || 'Pilot';
}
