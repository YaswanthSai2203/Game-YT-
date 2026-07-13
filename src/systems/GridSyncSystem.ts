import { GRID_SYNC, WORLD_EVOLUTION_FROM_SYNC } from '@/config/sentientConfig';
import { SaveManager } from '@/core/SaveManager';
import { EventBus } from '@/core/EventBus';
import type { RunStats } from '@/types';

export interface RunSyncContext {
  quitEarly?: boolean;
  assistReceived?: boolean;
  habitBrokenThisRun?: boolean;
  newMyths?: string[];
  newDimensions?: string[];
  phaseUsed?: boolean;
  repetitiveStrategy?: boolean;
}

/** Secret long-term meta: the Grid studying the player (0–100%). */
export class GridSyncSystem {
  private events: EventBus;
  private save: SaveManager;
  private runDimensions = new Set<string>();
  private runMyths = new Set<string>();
  private assistReceived = false;
  private phaseUsed = false;
  private maxCombo = 0;
  private habitBrokenThisRun = false;
  private repetitiveStrategy = false;
  private firstMoveStreak = 0;

  constructor(events: EventBus, save: SaveManager) {
    this.events = events;
    this.save = save;
  }

  get level(): number {
    return this.save.save.worldMemory.gridSync;
  }

  isComplete(): boolean {
    return this.save.save.worldMemory.gridSyncComplete;
  }

  meets(threshold: keyof typeof GRID_SYNC.THRESHOLDS): boolean {
    return this.level >= GRID_SYNC.THRESHOLDS[threshold];
  }

  getWorldStage(): number {
    let stage = 0;
    for (const e of WORLD_EVOLUTION_FROM_SYNC) {
      if (this.level >= e.sync) stage = e.stage;
    }
    return stage;
  }

  getMythRollMultiplier(): number {
    if (this.level >= GRID_SYNC.THRESHOLDS.IMPOSSIBLE) return 1.6;
    if (this.level >= GRID_SYNC.THRESHOLDS.GLITCHES) return 1.15;
    return 1;
  }

  resetRun(): void {
    this.runDimensions.clear();
    this.runMyths.clear();
    this.assistReceived = false;
    this.phaseUsed = false;
    this.maxCombo = 0;
    this.habitBrokenThisRun = false;
    this.repetitiveStrategy = false;
    this.firstMoveStreak = 0;
  }

  onAssistReceived(): void {
    this.assistReceived = true;
  }

  onPhaseUsed(): void {
    this.phaseUsed = true;
  }

  onCombo(combo: number): void {
    this.maxCombo = Math.max(this.maxCombo, combo);
  }

  onFirstMove(direction: number, sameAsLast: boolean): void {
    if (sameAsLast) this.firstMoveStreak++;
    else this.firstMoveStreak = 1;
    if (this.firstMoveStreak >= 4) this.repetitiveStrategy = true;
    void direction;
  }

  onHabitBroken(): void {
    this.habitBrokenThisRun = true;
  }

  onDimensionEntered(dimensionId: string): void {
    this.runDimensions.add(dimensionId);
    const mem = this.save.save.worldMemory;
    if (!mem.dimensionsEntered.includes(dimensionId)) {
      mem.dimensionsEntered.push(dimensionId);
      this.save.persist();
      this.addDelta(GRID_SYNC.DELTA.DIMENSION_NEW, 'dimension');
    }
  }

  onMythWitnessed(mythId: string): void {
    this.runMyths.add(mythId);
    this.addDelta(GRID_SYNC.DELTA.MYTH_DISCOVERED, 'myth');
  }

  onAdaptiveUnlocked(): void {
    this.addDelta(GRID_SYNC.DELTA.ADAPTIVE_UNLOCK, 'adapt');
    this.habitBrokenThisRun = true;
  }

  onQuitEarly(timeAlive: number): void {
    if (timeAlive >= GRID_SYNC.EARLY_QUIT_SECONDS) return;
    this.subtractDelta(GRID_SYNC.PENALTY.EARLY_QUIT, 'early_quit');
    const mem = this.save.save.worldMemory;
    mem.earlyQuits = (mem.earlyQuits ?? 0) + 1;
    this.save.persist();
  }

  finalizeRun(stats: RunStats, context: RunSyncContext = {}): boolean {
    let gained = 0;

    if (stats.maxCombo >= 15) gained += GRID_SYNC.DELTA.HIGH_COMBO * 2;
    else if (stats.maxCombo >= 10) gained += GRID_SYNC.DELTA.HIGH_COMBO;

    if (stats.timeAlive >= 90 && !this.assistReceived && !context.assistReceived) {
      gained += GRID_SYNC.DELTA.SURVIVE_NO_ASSIST;
    }
    if (stats.timeAlive >= 120) gained += GRID_SYNC.DELTA.LONG_RUN;

    if (this.habitBrokenThisRun || context.habitBrokenThisRun) {
      gained += GRID_SYNC.DELTA.HABIT_BROKEN;
    }

    if (this.repetitiveStrategy || context.repetitiveStrategy) {
      this.subtractDelta(GRID_SYNC.PENALTY.REPETITIVE, 'repetitive');
    }

    if (stats.timeAlive >= 60 && !this.phaseUsed && stats.mode !== 'practice') {
      this.subtractDelta(GRID_SYNC.PENALTY.IGNORE_MECHANICS, 'ignore_phase');
    }

    if (context.quitEarly) {
      this.onQuitEarly(stats.timeAlive);
    }

    if (gained > 0) this.addDelta(gained, 'run_end');

    const mem = this.save.save.worldMemory;
    mem.worldStage = this.getWorldStage();
    this.save.persist();

    return this.checkCompletion();
  }

  addDelta(amount: number, _reason: string): void {
    const mem = this.save.save.worldMemory;
    if (mem.gridSyncComplete) return;
    const prev = mem.gridSync;
    mem.gridSync = Math.min(100, mem.gridSync + amount);
    if (mem.gridSync > prev) {
      this.checkThresholdCrossings(prev, mem.gridSync);
    }
    this.save.persist();
  }

  subtractDelta(amount: number, _reason: string): void {
    const mem = this.save.save.worldMemory;
    if (mem.gridSyncComplete) return;
    mem.gridSync = Math.max(0, mem.gridSync - amount);
    this.save.persist();
  }

  private checkThresholdCrossings(prev: number, next: number): void {
    const t = GRID_SYNC.THRESHOLDS;
    const crossed = (value: number) => prev < value && next >= value;
    if (crossed(t.GLITCHES)) {
      this.events.emit('ui:toast', { message: 'Something in the grid shifted.', type: 'info' });
    }
    if (crossed(t.WHISPERS)) {
      this.events.emit('ai:speak', { text: 'The Grid is listening.', tone: 'whisper' });
    }
    if (crossed(t.WATCHER)) {
      this.events.emit('ui:toast', { message: 'You feel observed.', type: 'milestone' });
    }
    if (crossed(t.HIDDEN_DIM)) {
      this.events.emit('ui:toast', { message: 'A hidden layer of the Grid unlocked.', type: 'milestone' });
    }
  }

  checkCompletion(): boolean {
    const mem = this.save.save.worldMemory;
    if (mem.gridSyncComplete || mem.gridSync < GRID_SYNC.THRESHOLDS.COMPLETE) return false;

    mem.gridSync = 100;
    mem.gridSyncComplete = true;
    if (!this.save.save.unlocks.cores.includes('grid-bound')) {
      this.save.save.unlocks.cores.push('grid-bound');
    }
    this.save.save.unlocks.selectedCore = 'grid-bound';
    this.save.persist();
    this.events.emit('grid:sync_complete', {});
    return true;
  }

  static computeWorldStage(gridSync: number): number {
    let stage = 0;
    for (const e of WORLD_EVOLUTION_FROM_SYNC) {
      if (gridSync >= e.sync) stage = e.stage;
    }
    return stage;
  }
}
