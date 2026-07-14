import type { SaveData, GameSettings, RunStats, LeaderboardEntry, WorldMemory } from '@/types';
import { STORAGE_KEY, GAME, LEADERBOARD_SIZE, SYNC, CREDITS, WEEKLY } from '@/config/constants';
import { getTodayDateString, getWeekId, hashString } from '@/utils/math';
import { HUD_SKINS, MUSIC_PACKS, AI_PERSONALITIES } from '@/config/engagementConfig';
import { computePlayerTitle } from '@/config/directorConfig';
import { GridSyncSystem } from '@/systems/GridSyncSystem';
import { EventBus } from './EventBus';

const LEGACY_STORAGE_KEY = 'neon-pulse-save-v1';
const LEGACY_V2_KEY = 'neon-pulse-save-v2';
const LEGACY_V3_KEY = 'neon-pulse-save-v3';

function defaultWorldMemory(): WorldMemory {
  const hexIndex = hashString(navigator.userAgent + Date.now().toString()) % 16;
  return {
    firewallsDodged: 0,
    longestRunSeconds: 0,
    laneMovesLeft: 0,
    laneMovesRight: 0,
    recentLaneLeft: 0,
    recentLaneRight: 0,
    lastDeathDate: '',
    lastDeathSeconds: 0,
    lastDeathScore: 0,
    dimensionLastSeen: {},
    dimensionsEntered: [],
    mythsWitnessed: [],
    aiTrust: 0,
    gridSync: 0,
    gridSyncComplete: false,
    earlyQuits: 0,
    worldStage: 0,
    communityHexIndex: hexIndex,
    adaptiveUnlocked: false,
    behaviorAdapted: false,
    impossibleSeen: false,
    fakeEndingSeen: false,
    watcherDefeated: false,
    aiCommentsHeard: 0,
    runsSinceAdaptation: 0,
    playerTitle: 'Pilot',
    gridMood: 'curious',
    lastRunTheme: 'standard',
    riskProfile: 0,
    nearMissLifetime: 0,
    ghostReplay: null,
    practiceCalloutSeen: false,
    seenPickups: [],
  };
}

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
      gridLoreEnabled: false,
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
      hudSkins: ['default'],
      musicPacks: ['synthwave'],
      personalities: ['observer'],
      selectedCore: 'cyan',
      selectedTrail: 'default',
      selectedTheme: 'default',
      selectedHudSkin: 'default',
      selectedMusicPack: 'synthwave',
      selectedPersonality: 'observer',
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
    dataCredits: 0,
    upgrades: { shardBoost: 0, phaseSync: 0, magnetField: 0, coreShield: 0 },
    tutorialCompleted: false,
    lastDailyBonusDate: '',
    worldMemory: defaultWorldMemory(),
  };
}

function migrateSave(parsed: Partial<SaveData>): SaveData {
  const base = defaultSave();
  const merged = {
    ...base,
    ...parsed,
    version: GAME.SAVE_VERSION,
    dataCredits: parsed.dataCredits ?? 0,
    upgrades: parsed.upgrades ?? base.upgrades,
    tutorialCompleted: parsed.tutorialCompleted ?? false,
    lastDailyBonusDate: parsed.lastDailyBonusDate ?? '',
    worldMemory: { ...defaultWorldMemory(), ...parsed.worldMemory },
  };
  merged.worldMemory.worldStage = GridSyncSystem.computeWorldStage(merged.worldMemory.gridSync ?? 0);
  if (!merged.worldMemory.dimensionsEntered) merged.worldMemory.dimensionsEntered = [];
  if (merged.worldMemory.gridSync === undefined) merged.worldMemory.gridSync = 0;
  if (merged.worldMemory.gridSyncComplete === undefined) merged.worldMemory.gridSyncComplete = false;
  if (merged.worldMemory.earlyQuits === undefined) merged.worldMemory.earlyQuits = 0;
  if (!merged.worldMemory.playerTitle) merged.worldMemory.playerTitle = 'Pilot';
  if (!merged.worldMemory.gridMood) merged.worldMemory.gridMood = 'curious';
  if (!merged.worldMemory.lastRunTheme) merged.worldMemory.lastRunTheme = 'standard';
  if (merged.worldMemory.riskProfile === undefined) merged.worldMemory.riskProfile = 0;
  if (merged.worldMemory.nearMissLifetime === undefined) merged.worldMemory.nearMissLifetime = 0;
  if (merged.worldMemory.ghostReplay === undefined) merged.worldMemory.ghostReplay = null;
  if (merged.worldMemory.practiceCalloutSeen === undefined) merged.worldMemory.practiceCalloutSeen = false;
  if (!merged.worldMemory.seenPickups) merged.worldMemory.seenPickups = [];
  if (merged.settings.gridLoreEnabled === undefined) merged.settings.gridLoreEnabled = false;
  merged.unlocks = { ...base.unlocks, ...parsed.unlocks };
  if (!merged.unlocks.hudSkins) merged.unlocks.hudSkins = ['default'];
  if (!merged.unlocks.musicPacks) merged.unlocks.musicPacks = ['synthwave'];
  if (!merged.unlocks.personalities) merged.unlocks.personalities = ['observer'];
  if (!merged.unlocks.selectedHudSkin) merged.unlocks.selectedHudSkin = 'default';
  if (!merged.unlocks.selectedMusicPack) merged.unlocks.selectedMusicPack = 'synthwave';
  if (!merged.unlocks.selectedPersonality) merged.unlocks.selectedPersonality = 'observer';
  merged.worldMemory.playerTitle = computePlayerTitle(merged.worldMemory, merged.stats);
  return merged;
}

/** Estimate local rank percentile from score (for motivational game-over UI) */
export function estimateRankPercentile(score: number): number {
  if (score >= 25000) return 99;
  if (score >= 15000) return 95;
  if (score >= 10000) return 90;
  if (score >= 7500) return 80;
  if (score >= 5000) return 70;
  if (score >= 3000) return 55;
  if (score >= 1500) return 40;
  if (score >= 750) return 25;
  if (score >= 300) return 15;
  if (score >= 100) return 8;
  return 3;
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
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) raw = localStorage.getItem(LEGACY_V3_KEY);
      if (!raw) raw = localStorage.getItem(LEGACY_V2_KEY);
      if (!raw) {
        raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      }
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveData>;
        if (parsed.version === GAME.SAVE_VERSION) {
          return migrateSave(parsed);
        }
        if (parsed.version === 1 || parsed.version === 2 || !parsed.version) {
          return migrateSave(parsed);
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
      this.unlockEngagementByLevel(this.data.profile.syncLevel, unlocked);
    }
    this.persist();
    return unlocked;
  }

  markTutorialComplete(): void {
    this.data.tutorialCompleted = true;
    this.persist();
  }

  /** Returns bonus credits if claimable today, else 0 */
  claimDailyBonus(): number {
    const today = getTodayDateString();
    if (this.data.lastDailyBonusDate === today) return 0;

    const streakBonus = Math.min(this.data.daily.streak, CREDITS.DAILY_STREAK_CAP) * CREDITS.DAILY_STREAK_BONUS;
    const bonus = CREDITS.DAILY_BASE + streakBonus;
    this.data.dataCredits += bonus;
    this.data.lastDailyBonusDate = today;
    this.persist();
    return bonus;
  }

  canClaimDailyBonus(): boolean {
    return this.data.lastDailyBonusDate !== getTodayDateString();
  }

  addCredits(amount: number): void {
    this.data.dataCredits += amount;
    this.persist();
  }

  recordLaneMove(direction: number): void {
    const m = this.data.worldMemory;
    if (direction < 0) {
      m.laneMovesLeft++;
      m.recentLaneLeft++;
    } else if (direction > 0) {
      m.laneMovesRight++;
      m.recentLaneRight++;
    }
    const recentTotal = m.recentLaneLeft + m.recentLaneRight;
    if (recentTotal > 40) {
      m.recentLaneLeft = Math.floor(m.recentLaneLeft * 0.5);
      m.recentLaneRight = Math.floor(m.recentLaneRight * 0.5);
    }
    this.persist();
  }

  recordFirewallDodged(): void {
    this.data.worldMemory.firewallsDodged++;
    this.persist();
  }

  recordDimensionSeen(dimensionId: string): void {
    this.data.worldMemory.dimensionLastSeen[dimensionId] = new Date().toISOString();
    this.persist();
  }

  recordDeath(stats: RunStats): void {
    const m = this.data.worldMemory;
    m.lastDeathDate = new Date().toISOString();
    m.lastDeathSeconds = stats.timeAlive;
    m.lastDeathScore = stats.score;
    if (stats.timeAlive > m.longestRunSeconds) {
      m.longestRunSeconds = stats.timeAlive;
    }
    m.worldStage = GridSyncSystem.computeWorldStage(m.gridSync);
    this.persist();
  }

  markFakeEndingSeen(): void {
    this.data.worldMemory.fakeEndingSeen = true;
    this.persist();
  }

  markWatcherDefeated(): void {
    this.data.worldMemory.watcherDefeated = true;
    this.persist();
  }

  saveGhostReplay(recording: import('@/types').GhostRecording): void {
    this.data.worldMemory.ghostReplay = recording;
    this.persist();
  }

  recordNearMissLifetime(): void {
    this.data.worldMemory.nearMissLifetime++;
    this.persist();
  }

  markPickupSeen(pickupId: string): void {
    const seen = this.data.worldMemory.seenPickups;
    if (!seen.includes(pickupId)) {
      seen.push(pickupId);
      this.persist();
    }
  }

  markPracticeCalloutSeen(): void {
    if (!this.data.worldMemory.practiceCalloutSeen) {
      this.data.worldMemory.practiceCalloutSeen = true;
      this.persist();
    }
  }

  private unlockEngagementByLevel(level: number, unlocked: string[]): void {
    for (const s of HUD_SKINS) {
      if (s.unlockLevel && level >= s.unlockLevel && !this.data.unlocks.hudSkins.includes(s.id)) {
        this.data.unlocks.hudSkins.push(s.id);
        unlocked.push(s.name);
      }
    }
    for (const p of MUSIC_PACKS) {
      if (p.unlockLevel && level >= p.unlockLevel && !this.data.unlocks.musicPacks.includes(p.id)) {
        this.data.unlocks.musicPacks.push(p.id);
        unlocked.push(p.name);
      }
    }
    for (const p of AI_PERSONALITIES) {
      if (p.unlockLevel && level >= p.unlockLevel && !this.data.unlocks.personalities.includes(p.id)) {
        this.data.unlocks.personalities.push(p.id);
        unlocked.push(p.name);
      }
    }
  }

  hasUnlock(type: 'core' | 'trail' | 'theme' | 'hud' | 'music' | 'personality', id: string): boolean {
    if (id === 'default' || id === 'synthwave' || id === 'observer') return true;
    const key = type === 'core' ? 'cores'
      : type === 'trail' ? 'trails'
      : type === 'theme' ? 'themes'
      : type === 'hud' ? 'hudSkins'
      : type === 'music' ? 'musicPacks'
      : 'personalities';
    return this.data.unlocks[key].includes(id);
  }

  setCosmetic(type: 'core' | 'trail' | 'theme' | 'hud' | 'music' | 'personality', id: string): boolean {
    if (!this.hasUnlock(type, id)) return false;
    switch (type) {
      case 'core': this.data.unlocks.selectedCore = id; break;
      case 'trail': this.data.unlocks.selectedTrail = id; break;
      case 'theme': this.data.unlocks.selectedTheme = id; break;
      case 'hud': this.data.unlocks.selectedHudSkin = id; break;
      case 'music': this.data.unlocks.selectedMusicPack = id; break;
      case 'personality': this.data.unlocks.selectedPersonality = id; break;
    }
    this.persist();
    return true;
  }


  hasSeenPickup(pickupId: string): boolean {
    return this.data.worldMemory.seenPickups.includes(pickupId);
  }

  recordRun(stats: RunStats): { newHighScore: boolean; xpGained: number; creditsEarned: number; syncUnlocks: string[] } {
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
    const syncUnlocks = this.addSyncXP(xpGained);

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
    if (stats.mode === 'challenge' && stats.score >= 5000) {
      this.data.daily.completedToday = true;
    }

    const weekId = getWeekId();
    if (this.data.weekly.weekId !== weekId) {
      this.data.weekly = { weekId, completed: false, bestScore: 0, seed: hashString(weekId) };
    }
    if (stats.score > this.data.weekly.bestScore) {
      this.data.weekly.bestScore = stats.score;
    }
    if (stats.mode === 'weekly' && stats.score >= 7500 && !this.data.weekly.completed) {
      this.data.weekly.completed = true;
      this.data.dataCredits += WEEKLY.BONUS_CREDITS;
    }

    const creditsEarned = stats.creditsEarned ?? stats.shards * CREDITS.PER_SHARD;
    this.data.dataCredits += creditsEarned;

    this.data.worldMemory.worldStage = GridSyncSystem.computeWorldStage(this.data.worldMemory.gridSync);
    if (stats.timeAlive > this.data.worldMemory.longestRunSeconds) {
      this.data.worldMemory.longestRunSeconds = stats.timeAlive;
    }

    this.persist();
    return { newHighScore, xpGained, creditsEarned, syncUnlocks };
  }
}
