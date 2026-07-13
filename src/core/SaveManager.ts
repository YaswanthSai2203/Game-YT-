import type { SaveData, GameSettings, RunStats, LeaderboardEntry } from '@/types';
import { STORAGE_KEY, GAME, LEADERBOARD_SIZE, SYNC } from '@/config/constants';
import { getTodayDateString, getWeekId, hashString } from '@/utils/math';
import { EventBus } from './EventBus';

function defaultSave(): SaveData {
  const today = getTodayDateString();
  return {
    version: GAME.SAVE_VERSION,
    profile: { name: 'Pilot', syncLevel: 1, syncXP: 0 },
    settings: {
      masterVolume: 0.7,
      sfxVolume: 0.8,
      musicVolume: 0.5,
      reducedMotion: false,
      highContrast: false,
      colorBlindMode: 'none',
      fontScale: 1.0,
      theme: 'dark',
      controlSensitivity: 1.0,
    },
    stats: {
      totalRuns: 0,
      totalShards: 0,
      totalScore: 0,
      bestCombo: 0,
      totalPlayTime: 0,
      phaseShiftsUsed: 0,
      powerupsCollected: 0,
    },
    highScores: { endless: 0, timeAttack60: 0, timeAttack120: 0, challenge: 0 },
    leaderboard: { endless: [], timeAttack60: [], timeAttack120: [], challenge: [] },
    achievements: {},
    unlocks: {
      cores: ['cyan'],
      trails: ['default'],
      themes: ['default'],
      selectedCore: 'cyan',
      selectedTrail: 'default',
      selectedTheme: 'default',
    },
    daily: {
      lastPlayedDate: today,
      streak: 0,
      completedToday: false,
      todaySeed: hashString(today),
      todayBest: 0,
    },
    weekly: {
      weekId: getWeekId(),
      completed: false,
      bestScore: 0,
      seed: hashString(getWeekId()),
    },
  };
}

export class SaveManager {
  private data: SaveData;
  private events: EventBus;

  constructor(events: EventBus) {
    this.events = events;
    this.data = this.load();
  }

  get save(): SaveData {
    return this.data;
  }

  get settings(): GameSettings {
    return this.data.settings;
  }

  load(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SaveData;
        if (parsed.version === GAME.SAVE_VERSION) {
          return { ...defaultSave(), ...parsed };
        }
      }
    } catch {
      console.warn('Save load failed, using defaults');
    }
    return defaultSave();
  }

  persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      console.warn('Save persist failed');
    }
  }

  updateSettings(partial: Partial<GameSettings>): void {
    this.data.settings = { ...this.data.settings, ...partial };
    this.persist();
    this.events.emit('settings:change', { settings: partial });
  }

  addSyncXP(amount: number): string[] {
    const unlocked: string[] = [];
    this.data.profile.syncXP += amount;
    while (
      this.data.profile.syncLevel < SYNC.XP_PER_LEVEL.length &&
      this.data.profile.syncXP >= SYNC.XP_PER_LEVEL[this.data.profile.syncLevel]
    ) {
      this.data.profile.syncLevel++;
      const unlock = SYNC.UNLOCKS.find((u) => u.level === this.data.profile.syncLevel);
      if (unlock) {
        const key = unlock.type === 'core' ? 'cores' : unlock.type === 'trail' ? 'trails' : 'themes';
        if (!this.data.unlocks[key].includes(unlock.id)) {
          this.data.unlocks[key].push(unlock.id);
          unlocked.push(unlock.name);
        }
      }
    }
    this.persist();
    return unlocked;
  }

  recordRun(stats: RunStats): { newHighScore: boolean; xpGained: number } {
    this.data.stats.totalRuns++;
    this.data.stats.totalShards += stats.shards;
    this.data.stats.totalScore += stats.score;
    this.data.stats.totalPlayTime += stats.timeAlive;
    this.data.stats.phaseShiftsUsed += stats.phaseShifts;
    this.data.stats.powerupsCollected += stats.powerups;
    if (stats.maxCombo > this.data.stats.bestCombo) {
      this.data.stats.bestCombo = stats.maxCombo;
    }

    const modeKey = stats.mode === 'timeAttack60' ? 'timeAttack60'
      : stats.mode === 'timeAttack120' ? 'timeAttack120'
      : stats.mode === 'challenge' ? 'challenge' : 'endless';

    const prevBest = this.data.highScores[modeKey as keyof typeof this.data.highScores];
    const newHighScore = stats.score > prevBest;
    if (newHighScore) {
      this.data.highScores[modeKey as keyof typeof this.data.highScores] = stats.score;
    }

    const entry: LeaderboardEntry = {
      score: stats.score,
      date: new Date().toISOString(),
      mode: stats.mode,
    };
    const board = this.data.leaderboard[modeKey] ?? [];
    board.push(entry);
    board.sort((a, b) => b.score - a.score);
    this.data.leaderboard[modeKey] = board.slice(0, LEADERBOARD_SIZE);

    const xpGained = stats.shards * SYNC.XP_PER_SHARD + Math.floor(stats.score / 100);
    this.addSyncXP(xpGained);

    const today = getTodayDateString();
    if (this.data.daily.lastPlayedDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().slice(0, 10);
      this.data.daily.streak = this.data.daily.lastPlayedDate === yStr
        ? this.data.daily.streak + 1 : 1;
      this.data.daily.lastPlayedDate = today;
      this.data.daily.completedToday = false;
      this.data.daily.todaySeed = hashString(today);
      this.data.daily.todayBest = 0;
    }
    if (stats.score > this.data.daily.todayBest) {
      this.data.daily.todayBest = stats.score;
    }

    const weekId = getWeekId();
    if (this.data.weekly.weekId !== weekId) {
      this.data.weekly = { weekId, completed: false, bestScore: 0, seed: hashString(weekId) };
    }
    if (stats.score > this.data.weekly.bestScore) {
      this.data.weekly.bestScore = stats.score;
    }

    this.persist();
    return { newHighScore, xpGained };
  }
}
