import type { FractureRule, RareEventType, RealityDimensionDef } from '@/config/realityConfig';
import {
  REALITY, REALITY_DIMENSIONS, RARE_EVENTS,
} from '@/config/realityConfig';
import { EventBus } from '@/core/EventBus';
import { clamp, createRng } from '@/utils/math';

export interface RealityModifiers {
  spawnIntervalMult: number;
  firewallWeight: number;
  shardEchoChance: number;
  vaultChance: number;
  scrollMult: number;
  shardValueMult: number;
  reverseFlow: boolean;
  shiftingLanes: boolean;
  titanBoss: boolean;
  goldenStorm: boolean;
  punishLeftLane: boolean;
  punishRightLane: boolean;
}

export interface ActiveFracture {
  dimension: RealityDimensionDef;
  timer: number;
  glitchIntensity: number;
}

export interface ActiveRareEvent {
  type: RareEventType;
  timer: number;
}

const DEFAULT_MODIFIERS: RealityModifiers = {
  spawnIntervalMult: 1,
  firewallWeight: 1,
  shardEchoChance: 0,
  vaultChance: 0.005,
  scrollMult: 1,
  shardValueMult: 1,
  reverseFlow: false,
  shiftingLanes: false,
  titanBoss: false,
  goldenStorm: false,
  punishLeftLane: false,
  punishRightLane: false,
};

export class QuantumRealitySystem {
  private events: EventBus;
  private rng: () => number;

  private flowMeter = 0;
  private struggleMeter = 0;
  private timeAlive = 0;
  private lastFractureEnd = -999;
  private fracturesThisRun = 0;
  private rareThisRun = 0;
  private rareRollTimer = 25;
  private struggleHelpTimer = 0;

  private activeFracture: ActiveFracture | null = null;
  private activeRare: ActiveRareEvent | null = null;
  private usedDimensionIds = new Set<string>();
  private glitchBuildup = 0;

  private shardsPerMinute = 0;
  private shardTimestamps: number[] = [];

  private adaptiveUnlocked = false;
  private hiddenDimensionsUnlocked = false;

  constructor(events: EventBus, seed?: number) {
    this.events = events;
    this.rng = seed !== undefined ? createRng(seed + 7919) : Math.random;
  }

  initAdaptive(unlocked: boolean): void {
    this.adaptiveUnlocked = unlocked;
  }

  setHiddenDimensionsUnlocked(unlocked: boolean): void {
    this.hiddenDimensionsUnlocked = unlocked;
  }

  setPunishLanes(left: boolean, right: boolean): void {
    this.punishLeft = left;
    this.punishRight = right;
  }

  private punishLeft = false;
  private punishRight = false;

  reset(): void {
    this.flowMeter = 0;
    this.struggleMeter = 0;
    this.timeAlive = 0;
    this.lastFractureEnd = -999;
    this.fracturesThisRun = 0;
    this.rareThisRun = 0;
    this.rareRollTimer = REALITY.RARE_ROLL_INTERVAL * 0.5 + this.rng() * 10;
    this.struggleHelpTimer = 0;
    this.activeFracture = null;
    this.activeRare = null;
    this.usedDimensionIds.clear();
    this.glitchBuildup = 0;
    this.shardTimestamps = [];
  }

  update(dt: number, combo: number, score: number): void {
    this.timeAlive += dt;
    this.flowMeter = Math.max(0, this.flowMeter - REALITY.FLOW_DECAY * dt * 0.15);
    this.struggleMeter = Math.max(0, this.struggleMeter - REALITY.STRUGGLE_DECAY * dt * 0.12);

    this.pruneShardTimestamps();
    this.shardsPerMinute = this.shardTimestamps.length;

    if (this.timeAlive > 20 && score < 200 && this.shardsPerMinute < 2) {
      this.struggleMeter = clamp(this.struggleMeter + dt * 4, 0, 100);
    }

    if (combo >= 8) {
      this.flowMeter = clamp(this.flowMeter + dt * 3, 0, 100);
    }

    this.glitchBuildup = clamp(
      this.flowMeter / 100 * 0.6 + (this.activeFracture ? 0.4 : 0),
      0,
      1,
    );

    if (this.activeFracture) {
      this.activeFracture.timer -= dt;
      if (this.activeFracture.timer <= 0) {
        this.endFracture();
      }
    }

    if (this.activeRare) {
      this.activeRare.timer -= dt;
      if (this.activeRare.timer <= 0) {
        this.endRareEvent();
      }
    }

    this.tryStruggleHelp(dt);
    this.tryFracture(combo);
    this.tryRareEvent(dt);

    this.events.emit('reality:state', {
      flow: this.flowMeter,
      struggle: this.struggleMeter,
      glitch: this.glitchBuildup,
      dimension: this.activeFracture?.dimension.name ?? null,
      rare: this.activeRare?.type ?? null,
      fractureProgress: this.activeFracture
        ? 1 - this.activeFracture.timer / this.activeFracture.dimension.duration
        : 0,
    });
  }

  onShardCollect(combo: number): void {
    this.flowMeter = clamp(this.flowMeter + 4 + combo * 0.5, 0, 100);
    this.struggleMeter = clamp(this.struggleMeter - 3, 0, 100);
    this.shardTimestamps.push(this.timeAlive);
  }

  onNearMiss(): void {
    this.flowMeter = clamp(this.flowMeter + 6, 0, 100);
  }

  onComboBreak(previousCombo: number): void {
    this.flowMeter = clamp(this.flowMeter - 8 - previousCombo * 0.5, 0, 100);
    if (previousCombo >= 5) {
      this.struggleMeter = clamp(this.struggleMeter + 12, 0, 100);
    }
  }

  onCloseCall(): void {
    this.struggleMeter = clamp(this.struggleMeter + 5, 0, 100);
  }

  onFirewallPassed(): void {
    this.flowMeter = clamp(this.flowMeter + 1.5, 0, 100);
  }

  getModifiers(): RealityModifiers {
    const mods: RealityModifiers = { ...DEFAULT_MODIFIERS };

    if (this.struggleMeter >= REALITY.STRUGGLE_HELP_THRESHOLD) {
      mods.spawnIntervalMult = 1.25;
      mods.firewallWeight = 0.55;
    }

    if (this.activeFracture) {
      const rule = this.activeFracture.dimension.rule;
      mods.spawnIntervalMult *= 0.92;
      this.applyRuleMods(mods, rule);
    }

    if (this.punishLeft) mods.punishLeftLane = true;
    if (this.punishRight) mods.punishRightLane = true;

    if (this.activeRare?.type === 'golden_storm') {
      mods.goldenStorm = true;
      mods.shardValueMult = 3;
      mods.shardEchoChance = Math.max(mods.shardEchoChance, 0.35);
    }

    return mods;
  }

  getGlitchIntensity(): number {
    return this.glitchBuildup;
  }

  getActiveDimension(): RealityDimensionDef | null {
    return this.activeFracture?.dimension ?? null;
  }

  getActiveRare(): RareEventType | null {
    return this.activeRare?.type ?? null;
  }

  getLaneShift(time: number): number {
    if (!this.activeFracture || this.activeFracture.dimension.rule !== 'shifting_lanes') return 0;
    return Math.sin(time * 1.8) * 28 + Math.sin(time * 3.1) * 12;
  }

  getMusicPitch(): number {
    let pitch = 1;
    if (this.activeFracture) pitch = this.activeFracture.dimension.musicPitch;
    if (this.activeRare?.type === 'golden_storm') pitch *= 1.1;
    return pitch;
  }

  getDiscoveredThisRun(): string[] {
    const found: string[] = [];
    for (const id of this.usedDimensionIds) found.push(id);
    if (this.activeRare) found.push(this.activeRare.type);
    return found;
  }

  shouldSpawnQuantumVault(): boolean {
    return this.activeRare?.type === 'quantum_vault' && this.activeRare.timer > 2;
  }

  isGhostRivalActive(): boolean {
    return this.activeRare?.type === 'ghost_rival';
  }

  private applyRuleMods(mods: RealityModifiers, rule: FractureRule): void {
    switch (rule) {
      case 'reverse_flow':
        mods.reverseFlow = true;
        break;
      case 'shard_echo':
        mods.shardEchoChance = 0.55;
        break;
      case 'shifting_lanes':
        mods.shiftingLanes = true;
        break;
      case 'firewall_titan':
        mods.titanBoss = true;
        mods.firewallWeight = 1.2;
        break;
      case 'chrono_corridor':
        mods.scrollMult = 0.42;
        break;
      case 'vault_rush':
        mods.vaultChance = 0.12;
        mods.shardEchoChance = 0.2;
        break;
      case 'adaptive_protocol':
        mods.shiftingLanes = true;
        mods.shardEchoChance = 0.3;
        break;
      case 'null_zone':
        mods.scrollMult = 0.55;
        mods.shardValueMult = 2;
        mods.reverseFlow = true;
        break;
    }
  }

  private tryFracture(combo: number): void {
    if (this.activeFracture) return;
    if (this.fracturesThisRun >= REALITY.MAX_FRACTURES_PER_RUN) return;
    if (this.timeAlive < REALITY.FRACTURE_MIN_TIME) return;
    if (this.timeAlive - this.lastFractureEnd < REALITY.FRACTURE_COOLDOWN) return;

    const ready = this.flowMeter >= REALITY.FRACTURE_FLOW_THRESHOLD
      && combo >= 4
      && this.timeAlive > REALITY.FRACTURE_MIN_TIME;
    const forced = this.flowMeter >= REALITY.FRACTURE_FLOW_FORCE;

    if (!ready && !forced) return;
    if (!forced && this.rng() > 0.035) return;

    const pool = REALITY_DIMENSIONS.filter((d) => {
      if (d.id === 'adaptive_protocol' && !this.adaptiveUnlocked) return false;
      if (d.id === 'null_zone' && !this.hiddenDimensionsUnlocked) return false;
      return !this.usedDimensionIds.has(d.id);
    });
    const choices = pool.length > 0 ? pool : REALITY_DIMENSIONS;
    const dimension = choices[Math.floor(this.rng() * choices.length)];

    this.startFracture(dimension);
  }

  enterNullZone(): void {
    const dim = REALITY_DIMENSIONS.find((d) => d.id === 'null_zone');
    if (dim && !this.activeFracture) {
      this.startFracture(dim);
    }
  }

  private startFracture(dimension: RealityDimensionDef): void {
    this.activeFracture = {
      dimension,
      timer: dimension.duration,
      glitchIntensity: 1,
    };
    this.usedDimensionIds.add(dimension.id);
    this.fracturesThisRun++;
    this.lastFractureEnd = this.timeAlive;

    this.events.emit('reality:fracture', {
      dimension: dimension.name,
      subtitle: dimension.subtitle,
      rule: dimension.rule,
      theme: dimension.theme,
      tint: dimension.tint,
      duration: dimension.duration,
    });
    this.events.emit('ui:hype', {
      title: 'REALITY FRACTURE',
      subtitle: dimension.name,
      tier: 4,
      color: 'magenta',
    });
  }

  private endFracture(): void {
    if (!this.activeFracture) return;
    const name = this.activeFracture.dimension.name;
    this.activeFracture = null;
    this.lastFractureEnd = this.timeAlive;
    this.events.emit('reality:fracture_end', { dimension: name });
  }

  private tryRareEvent(dt: number): void {
    if (this.rareThisRun >= REALITY.MAX_RARE_PER_RUN) return;
    if (this.activeRare) return;
    if (this.timeAlive < 35) return;

    this.rareRollTimer -= dt;
    if (this.rareRollTimer > 0) return;
    this.rareRollTimer = REALITY.RARE_ROLL_INTERVAL + this.rng() * 15;

    if (this.rng() > REALITY.RARE_ROLL_CHANCE) return;

    const types = Object.keys(RARE_EVENTS) as RareEventType[];
    const totalWeight = types.reduce((s, t) => s + RARE_EVENTS[t].rollWeight, 0);
    let roll = this.rng() * totalWeight;
    let picked: RareEventType = types[0];
    for (const t of types) {
      roll -= RARE_EVENTS[t].rollWeight;
      if (roll <= 0) {
        picked = t;
        break;
      }
    }

    this.startRareEvent(picked);
  }

  private startRareEvent(type: RareEventType): void {
    const def = RARE_EVENTS[type];
    this.activeRare = { type, timer: def.duration };
    this.rareThisRun++;

    this.events.emit('reality:rare', {
      type,
      name: def.name,
      subtitle: def.subtitle,
      duration: def.duration,
    });
    this.events.emit('ui:hype', {
      title: def.name,
      subtitle: def.subtitle,
      tier: 5,
      color: 'gold',
    });
    this.events.emit('ui:flash', { color: 'rgba(255,215,0,0.4)', duration: 400 });
  }

  private endRareEvent(): void {
    const type = this.activeRare?.type;
    this.activeRare = null;
    if (type) this.events.emit('reality:rare_end', { type });
  }

  private tryStruggleHelp(dt: number): void {
    if (this.struggleMeter < REALITY.STRUGGLE_HELP_THRESHOLD) return;
    this.struggleHelpTimer += dt;
    if (this.struggleHelpTimer < 8) return;
    this.struggleHelpTimer = 0;
    this.events.emit('reality:assist', { subtle: true });
  }

  private pruneShardTimestamps(): void {
    const cutoff = this.timeAlive - 60;
    while (this.shardTimestamps.length > 0 && this.shardTimestamps[0] < cutoff) {
      this.shardTimestamps.shift();
    }
  }
}
