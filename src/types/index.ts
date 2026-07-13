export type GameMode = 'endless' | 'timeAttack60' | 'timeAttack120' | 'challenge' | 'practice';

export type PowerupType = 'shield' | 'magnet' | 'overclock' | 'chronos';

export type ColorBlindMode = 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia';

export type ThemeMode = 'dark' | 'light';

export type SceneId =
  | 'boot'
  | 'splash'
  | 'menu'
  | 'game'
  | 'pause'
  | 'gameover'
  | 'settings'
  | 'achievements'
  | 'leaderboard'
  | 'daily';

export interface Vector2 {
  x: number;
  y: number;
}

export interface PlayerProfile {
  name: string;
  syncLevel: number;
  syncXP: number;
}

export interface GameSettings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  reducedMotion: boolean;
  highContrast: boolean;
  colorBlindMode: ColorBlindMode;
  fontScale: number;
  theme: ThemeMode;
  controlSensitivity: number;
}

export interface GameStats {
  totalRuns: number;
  totalShards: number;
  totalScore: number;
  bestCombo: number;
  totalPlayTime: number;
  phaseShiftsUsed: number;
  powerupsCollected: number;
}

export interface HighScores {
  endless: number;
  timeAttack60: number;
  timeAttack120: number;
  challenge: number;
}

export interface LeaderboardEntry {
  score: number;
  date: string;
  mode: GameMode;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  condition: (stats: GameStats, run: RunStats) => boolean;
  secret?: boolean;
}

export interface RunStats {
  score: number;
  shards: number;
  combo: number;
  maxCombo: number;
  distance: number;
  timeAlive: number;
  phaseShifts: number;
  powerups: number;
  nearMisses: number;
  mode: GameMode;
  creditsEarned?: number;
  rankPercentile?: number;
}

export interface Unlocks {
  cores: string[];
  trails: string[];
  themes: string[];
  selectedCore: string;
  selectedTrail: string;
  selectedTheme: string;
}

export interface DailyState {
  lastPlayedDate: string;
  streak: number;
  completedToday: boolean;
  todaySeed: number;
  todayBest: number;
}

export interface WeeklyState {
  weekId: string;
  completed: boolean;
  bestScore: number;
  seed: number;
}

export type UpgradeId = 'shardBoost' | 'phaseSync' | 'magnetField' | 'coreShield';

export interface UpgradeLevels {
  shardBoost: number;
  phaseSync: number;
  magnetField: number;
  coreShield: number;
}

export interface SaveData {
  version: number;
  profile: PlayerProfile;
  settings: GameSettings;
  stats: GameStats;
  highScores: HighScores;
  leaderboard: Record<string, LeaderboardEntry[]>;
  achievements: Record<string, { unlocked: boolean; unlockedAt?: string }>;
  unlocks: Unlocks;
  daily: DailyState;
  weekly: WeeklyState;
  dataCredits: number;
  upgrades: UpgradeLevels;
  tutorialCompleted: boolean;
  lastDailyBonusDate: string;
}

export interface GameConfig {
  mode: GameMode;
  seed?: number;
  timeLimit?: number;
  targetScore?: number;
}

export interface Entity {
  id: number;
  active: boolean;
  x: number;
  y: number;
  lane: number;
  width: number;
  height: number;
  type: string;
  update(dt: number): void;
  destroy(): void;
}

export interface AnalyticsEvent {
  name: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

export type EventMap = {
  'scene:change': { from: SceneId; to: SceneId };
  'player:move': { lane: number };
  'player:phase': { active: boolean };
  'shard:collect': { value: number; combo: number };
  'combo:update': { combo: number; multiplier: number };
  'combo:break': { previousCombo: number };
  'obstacle:hit': { type: string };
  'powerup:activate': { type: PowerupType };
  'powerup:expire': { type: PowerupType };
  'score:change': { score: number; delta: number };
  'game:over': { stats: RunStats };
  'game:start': { mode: GameMode };
  'achievement:unlock': { id: string; title: string };
  'settings:change': { settings: Partial<GameSettings> };
  'analytics:track': AnalyticsEvent;
  'ui:toast': { message: string; type?: string };
  'ui:flash': { color?: string; duration?: number };
  'ui:tutorial': { step: number };
  'milestone:reach': { label: string };
};
