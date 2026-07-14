import type { GameMode, GameStats, WorldMemory } from '@/types';
import {
  DIRECTOR, RUN_THEMES, MOOD_WHISPERS,
  computePlayerTitle, type GridMood, type RunThemeId, type WeatherType,
} from '@/config/directorConfig';
import { GRID_SYNC } from '@/config/sentientConfig';
import { SaveManager } from '@/core/SaveManager';
import { EventBus } from '@/core/EventBus';

export interface RunPlan {
  theme: RunThemeId;
  mood: GridMood;
  weather: WeatherType;
  label: string;
  subtitle: string;
  useGhostReplay: boolean;
  spawnIntervalMult: number;
  firewallWeight: number;
  shardWeight: number;
  mythRollMult: number;
  fractureBoost: number;
}

export interface DirectorSpawnMods {
  spawnIntervalMult: number;
  firewallWeight: number;
  shardWeight: number;
  patternStyle?: 'mercy' | 'hunter' | 'training' | 'balanced';
}

export interface RunTelemetry {
  combo: number;
  score: number;
  timeAlive: number;
  nearDeath: boolean;
  nearMisses: number;
  flow: number;
  struggle: number;
  lane: number;
}

/** Hidden AI Director — shapes each run from long-term player memory. */
export class AIDirectorSystem {
  private events: EventBus;
  private save: SaveManager;
  private mood: GridMood = 'curious';
  private theme: RunThemeId = 'standard';
  private weather: WeatherType = 'clear';
  private whisperCooldown = 20;
  private clutchEscapes = 0;
  private riskChoices = 0;
  private safeChoices = 0;

  constructor(events: EventBus, save: SaveManager) {
    this.events = events;
    this.save = save;
  }

  planRun(mode: GameMode): RunPlan {
    const mem = this.save.save.worldMemory;
    const stats = this.save.save.stats;
    const theme = this.pickTheme(mem, stats, mode);
    const def = RUN_THEMES[theme];

    this.theme = theme;
    this.mood = def.mood;
    this.weather = def.weather;
    this.whisperCooldown = 12 + Math.random() * 18;
    this.clutchEscapes = 0;

    const useGhost = theme === 'echo_run' && !!mem.ghostReplay && mem.ghostReplay.mode === mode;

    mem.lastRunTheme = theme;
    mem.gridMood = this.mood;
    mem.runsSinceAdaptation = (mem.runsSinceAdaptation ?? 0) + 1;
    this.save.persist();

    return {
      theme,
      mood: this.mood,
      weather: def.weather,
      label: def.label,
      subtitle: def.subtitle,
      useGhostReplay: useGhost,
      spawnIntervalMult: def.spawnMult,
      firewallWeight: def.firewallMult,
      shardWeight: def.shardMult,
      mythRollMult: mem.gridSync >= GRID_SYNC.THRESHOLDS.IMPOSSIBLE ? 1.4 : 1,
      fractureBoost: mem.gridSync >= GRID_SYNC.THRESHOLDS.GLITCHES ? 1.2 : 1,
    };
  }

  emitRunStart(plan: RunPlan): void {
    this.events.emit('director:run_start', {
      theme: plan.theme,
      mood: plan.mood,
      label: plan.label,
      subtitle: plan.subtitle,
    });
  }

  update(dt: number, tel: RunTelemetry): void {
    this.updateMood(tel);
    this.whisperCooldown -= dt;

    const mem = this.save.save.worldMemory;
    if (this.whisperCooldown <= 0 && mem.gridSync >= GRID_SYNC.THRESHOLDS.WHISPERS) {
      this.whisper();
      this.whisperCooldown = DIRECTOR.WHISPER_INTERVAL + Math.random() * 25;
    }

    if (tel.struggle > 0.7 && tel.timeAlive > 30 && Math.random() < dt * 0.015) {
      this.events.emit('director:mercy_pulse', {});
    }
  }

  onNearMissClutch(): void {
    this.clutchEscapes++;
    if (this.clutchEscapes <= 3) {
      this.events.emit('director:slowmo', {
        duration: DIRECTOR.SLOWMO_DURATION,
        scale: DIRECTOR.SLOWMO_SCALE,
      });
      if (this.clutchEscapes === 1) {
        this.events.emit('ai:speak', { text: '…close.', tone: 'whisper' });
      }
    }
  }

  onRiskChoice(risky: boolean): void {
    if (risky) this.riskChoices++;
    else this.safeChoices++;
    const mem = this.save.save.worldMemory;
    mem.riskProfile = Math.max(-1, Math.min(1, mem.riskProfile + (risky ? 0.08 : -0.05)));
    this.save.persist();
  }

  finalizeRun(_score: number, _timeAlive: number, _mode: GameMode): void {
    const mem = this.save.save.worldMemory;
    mem.playerTitle = computePlayerTitle(mem, this.save.save.stats);
    mem.lastRunTheme = this.theme;
    mem.gridMood = this.mood;
    this.save.persist();
  }

  getSpawnModifiers(): DirectorSpawnMods {
    const def = RUN_THEMES[this.theme];
    const moodFw = this.mood === 'aggressive' ? 1.12 : this.mood === 'respectful' ? 0.88 : 1;
    const moodSpawn = this.mood === 'aggressive' ? 0.92 : this.mood === 'respectful' ? 1.06 : 1;
    const patternStyle = this.theme === 'mercy_protocol' ? 'mercy'
      : this.theme === 'hunter' ? 'hunter'
      : this.theme === 'first_contact' ? 'training'
      : 'balanced';
    return {
      spawnIntervalMult: def.spawnMult * moodSpawn,
      firewallWeight: def.firewallMult * moodFw,
      shardWeight: def.shardMult,
      patternStyle,
    };
  }

  getWeather(): WeatherType { return this.weather; }
  getMood(): GridMood { return this.mood; }
  getTheme(): RunThemeId { return this.theme; }

  private pickTheme(mem: WorldMemory, stats: GameStats, mode: GameMode): RunThemeId {
    if (mem.gridSyncComplete) return 'recognition';
    if (stats.totalRuns <= 2) return 'first_contact';
    if (mem.earlyQuits >= 3 && mem.lastDeathSeconds < 25) return 'mercy_protocol';
    if (mem.behaviorAdapted && mem.runsSinceAdaptation >= 5) return 'hunter';
    if (mem.ghostReplay && mem.ghostReplay.score > 1000 && mode === 'endless') return 'echo_run';
    if (mem.impossibleSeen || mem.mythsWitnessed.length >= 3) return 'corruption';
    if (mem.gridSync >= 50 && stats.bestCombo >= 15) return 'trial_by_fire';
    if (mem.longestRunSeconds >= 120) return 'recognition';
    return 'standard';
  }

  private updateMood(tel: RunTelemetry): void {
    const prev = this.mood;
    if (tel.combo >= 15 && tel.flow > 0.6) this.mood = 'respectful';
    else if (tel.struggle > 0.65 && tel.nearDeath) this.mood = 'aggressive';
    else if (tel.timeAlive > 45 && tel.combo >= 8) this.mood = 'testing';
    else if (this.save.save.stats.totalRuns < 10) this.mood = 'curious';

    if (prev !== this.mood) {
      this.save.save.worldMemory.gridMood = this.mood;
      this.events.emit('director:mood_shift', { mood: this.mood });
      this.events.emit('audio:mood', { mood: this.mood });
    }
  }

  private whisper(): void {
    const pool = MOOD_WHISPERS[this.mood];
    const text = pool[Math.floor(Math.random() * pool.length)];
    const tone = this.mood === 'aggressive' ? 'cold' : this.mood === 'respectful' ? 'warm' : 'whisper';
    this.events.emit('ai:speak', { text, tone });
  }
}
