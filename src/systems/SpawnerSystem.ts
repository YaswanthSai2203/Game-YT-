import type { PowerupType } from '@/types';
import type { RealityModifiers } from '@/systems/QuantumRealitySystem';
import { DIFFICULTY, POWERUP, PICKUP, SCROLL, UI } from '@/config/constants';
import { pickPattern, type PatternDef, type SpawnCmd } from '@/config/patternLibrary';
import { createRng, lerp, smoothstep } from '@/utils/math';

export type SpawnEntityType = 'firewall' | 'shard' | 'powerup' | 'vault' | 'white_firewall' | 'score_boost' | 'bomb';

export interface SpawnedEntity {
  id: number;
  type: SpawnEntityType;
  lane: number;
  y: number;
  powerupType?: PowerupType;
  width: number;
  height: number;
  collected: boolean;
  active: boolean;
  isBoss?: boolean;
  isGolden?: boolean;
  isQuantumVault?: boolean;
}

let nextId = 1;

export class SpawnerSystem {
  private entities: SpawnedEntity[] = [];
  private spawnTimer = 0;
  private elapsed = 0;
  private rng: () => number;
  private scrollSpeed: number;
  private speedRatio = 0;
  private modifiers: RealityModifiers | null = null;
  private directorMods: { spawnIntervalMult?: number; firewallWeight?: number; shardWeight?: number; patternStyle?: string } | null = null;
  private mercyPulse = false;
  private titanTimer = 0;
  private assistShardsPending = 0;
  private maxLane = 2;

  constructor(seed?: number) {
    this.rng = seed !== undefined ? createRng(seed) : Math.random;
    this.scrollSpeed = SCROLL.MIN_SPEED;
  }

  setModifiers(mods: RealityModifiers | null): void {
    this.modifiers = mods;
  }

  setDirectorModifiers(mods: { spawnIntervalMult?: number; firewallWeight?: number; shardWeight?: number; patternStyle?: string } | null): void {
    this.directorMods = mods;
  }

  setMercyPulse(active: boolean): void {
    this.mercyPulse = active;
  }

  /** When the myth fourth lane is active, obstacles can spawn in lane 3 too. */
  setMaxLane(lane: number): void {
    this.maxLane = clampLane(lane);
  }

  private randInt(min: number, max: number): number {
    return Math.floor(this.rng() * (max - min + 1)) + min;
  }

  queueAssistShard(): void {
    this.assistShardsPending++;
  }

  getEntities(): SpawnedEntity[] {
    return this.entities;
  }

  getScrollSpeed(): number {
    const mult = this.modifiers?.scrollMult ?? 1;
    return this.scrollSpeed * mult;
  }

  getSpeedRatio(): number {
    return this.speedRatio;
  }

  getSpeedMultiplier(): number {
    return this.getScrollSpeed() / SCROLL.MIN_SPEED;
  }

  getElapsed(): number {
    return this.elapsed;
  }

  setScrollSpeed(speed: number): void {
    this.scrollSpeed = speed;
  }

  private updateScrollSpeed(): void {
    const t = this.elapsed / SCROLL.RAMP_DURATION;
    this.speedRatio = smoothstep(t);
    this.scrollSpeed = lerp(SCROLL.MIN_SPEED, SCROLL.MAX_SPEED, this.speedRatio);
  }

  update(dt: number, gameHeight: number): void {
    this.elapsed += dt;
    this.updateScrollSpeed();

    const reverse = this.modifiers?.reverseFlow ?? false;
    const speed = this.getScrollSpeed();

    for (const e of this.entities) {
      if (!e.active) continue;
      e.y += reverse ? -speed * dt : speed * dt;
      const outOfBounds = reverse ? e.y < -120 : e.y > gameHeight + 120;
      if (outOfBounds) e.active = false;
    }

    this.entities = this.entities.filter((e) => e.active);

    const intervalMult = (this.modifiers?.spawnIntervalMult ?? 1)
      * (this.directorMods?.spawnIntervalMult ?? 1)
      * (this.mercyPulse ? 1.45 : 1);
    const interval = lerp(
      DIFFICULTY.SPAWN_INTERVAL_BASE,
      DIFFICULTY.SPAWN_INTERVAL_MIN,
      this.speedRatio,
    ) * intervalMult;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnPattern();
      const warmup = this.elapsed < 20;
      this.spawnTimer = warmup ? Math.max(interval, 1.3) : interval;
    }

    if (this.modifiers?.titanBoss) {
      this.titanTimer -= dt;
      if (this.titanTimer <= 0) {
        this.spawnTitanBoss();
        this.titanTimer = 7 + this.rng() * 4;
      }
    }

    while (this.assistShardsPending > 0) {
      this.spawnEntity('shard', this.randInt(0, this.maxLane));
      this.assistShardsPending--;
    }
  }

  spawnStarter(): void {
    this.spawnEntity('shard', 1);
    this.spawnEntity('shard', 0);
    this.spawnTimer = 1.0;
    this.titanTimer = 8;
  }

  spawnQuantumVault(lane = 1): void {
    this.spawnEntity('vault', lane, { isQuantumVault: true, height: 52, width: 36 });
  }

  spawnWhiteFirewall(lane?: number): void {
    const l = lane ?? this.randInt(0, this.maxLane);
    this.spawnEntity('white_firewall', l, { width: 80, height: 28 });
  }

  private spawnPattern(): void {
    if (this.elapsed < 20) {
      this.spawnWarmupPattern();
      return;
    }

    const tag = this.directorMods?.patternStyle ?? 'balanced';
    const pattern = pickPattern(this.elapsed, tag, this.rng);
    if (pattern) {
      this.executePattern(pattern);
    } else {
      this.spawnLegacyPattern();
    }

    this.maybeSpawnBonusPickup();
  }

  private executePattern(pattern: PatternDef): void {
    const fwWeight = (this.modifiers?.firewallWeight ?? 1) * (this.directorMods?.firewallWeight ?? 1);
    const safeLane = this.randInt(0, this.maxLane);
    let stepIndex = 0;

    for (const step of pattern.steps) {
      if (step.type === 'wait') continue;
      if (step.type === 'firewall' && this.rng() > fwWeight) continue;

      const lane = this.resolveLane(step, safeLane);
      if (lane === null) continue;
      if (step.type === 'firewall' && this.isLaneBlocked(lane)) continue;

      this.spawnEntity(step.type as SpawnEntityType, lane, { yOffset: -stepIndex * 72 });
      stepIndex++;
    }
  }

  private resolveLane(cmd: SpawnCmd, safeLane: number): number | null {
    if (typeof cmd.lane === 'number') return clampLane(cmd.lane);
    if (cmd.lane === 'random') return this.randInt(0, this.maxLane);
    if (cmd.lane === 'gap') return safeLane;
    if (cmd.lane === 'all') return this.randInt(0, this.maxLane);
    return null;
  }

  private maybeSpawnBonusPickup(): void {
    if (this.rng() < POWERUP.SPAWN_CHANCE) {
      const lane = this.randInt(0, this.maxLane);
      if (!this.isLaneBlocked(lane)) {
        this.spawnEntity('powerup', lane);
      }
    }

    if (this.elapsed >= PICKUP.MIN_SPAWN_TIME) {
      const lane = this.randInt(0, this.maxLane);
      if (!this.isLaneBlocked(lane)) {
        const roll = this.rng();
        if (roll < PICKUP.BONUS_SPAWN_CHANCE) {
          this.spawnEntity('score_boost', lane);
        } else if (!UI.SIMPLE_MODE && roll < PICKUP.BONUS_SPAWN_CHANCE + PICKUP.TRAP_SPAWN_CHANCE) {
          this.spawnEntity('bomb', lane);
        }
      }
    }

    const vaultChance = this.modifiers?.vaultChance ?? 0.005;
    if (this.elapsed > 40 && this.rng() < vaultChance) {
      this.spawnEntity('vault', this.randInt(0, this.maxLane));
    }
  }

  private spawnLegacyPattern(): void {
    const fwWeight = (this.modifiers?.firewallWeight ?? 1) * (this.directorMods?.firewallWeight ?? 1);
    const patternLevel = DIFFICULTY.PATTERN_UNLOCK_TIME.filter((t) => this.elapsed >= t).length;
    const style = this.directorMods?.patternStyle ?? 'balanced';

    if (style === 'mercy' || fwWeight < 0.7) {
      if (this.rng() < 0.55) {
        this.spawnEntity('shard', this.randInt(0, this.maxLane));
        if (this.rng() < 0.45) this.spawnEntity('shard', this.randInt(0, this.maxLane));
        return;
      }
    }

    if (style === 'training' && this.elapsed < 35) {
      this.spawnWarmupPattern();
      return;
    }

    if (fwWeight < 0.7 && this.rng() < 0.45) {
      this.spawnEntity('shard', this.randInt(0, this.maxLane));
      if (this.rng() < 0.4) this.spawnEntity('shard', this.randInt(0, this.maxLane));
      return;
    }

    if (this.modifiers?.punishLeftLane && this.rng() < 0.5) {
      this.spawnEntity('firewall', 0);
    } else if (this.modifiers?.punishRightLane && this.rng() < 0.5) {
      this.spawnEntity('firewall', 2);
    }

    switch (patternLevel) {
      case 1:
        if (this.rng() < fwWeight) this.spawnEntity('firewall', this.randInt(0, this.maxLane));
        this.spawnEntity('shard', this.randInt(0, this.maxLane));
        break;
      case 2:
        this.spawnDualObstacle();
        this.spawnEntity('shard', this.randInt(0, this.maxLane));
        break;
      case 3:
        if (style === 'hunter') this.spawnGapPattern();
        else this.spawnTriplePattern();
        break;
      case 4:
        if (style === 'hunter') this.spawnExpertPattern();
        else this.spawnGapPattern();
        break;
      default:
        this.spawnExpertPattern();
    }
  }

  private spawnWarmupPattern(): void {
    const roll = this.rng();
    if (roll < 0.5) {
      const shardLane = this.randInt(0, this.maxLane);
      this.spawnEntity('shard', shardLane);
      const fwLane = (shardLane + 1 + this.randInt(0, 1)) % (this.maxLane + 1);
      if (fwLane !== shardLane && this.rng() < (this.modifiers?.firewallWeight ?? 1)) {
        this.spawnEntity('firewall', fwLane);
      }
    } else {
      this.spawnEntity('shard', this.randInt(0, this.maxLane));
    }
  }

  private spawnDualObstacle(): void {
    const blocked = this.randInt(0, this.maxLane);
    const fwWeight = (this.modifiers?.firewallWeight ?? 1) * (this.directorMods?.firewallWeight ?? 1);
    for (let i = 0; i <= this.maxLane; i++) {
      if (i !== blocked && this.rng() < fwWeight) this.spawnEntity('firewall', i);
      else this.spawnEntity('shard', i);
    }
  }

  private spawnTriplePattern(): void {
    const pattern = this.randInt(0, 2);
    if (pattern === 0) {
      this.spawnEntity('firewall', 0);
      this.spawnEntity('firewall', 2);
      this.spawnEntity('shard', 1);
    } else if (pattern === 1) {
      this.spawnEntity('firewall', 1);
      this.spawnEntity('shard', 0);
      this.spawnEntity('shard', 2);
    } else {
      this.spawnEntity('firewall', 0);
      this.spawnEntity('firewall', 1);
      this.spawnEntity('shard', 2);
    }
  }

  private spawnGapPattern(): void {
    const safeLane = this.randInt(0, this.maxLane);
    for (let i = 0; i <= this.maxLane; i++) {
      if (i !== safeLane) this.spawnEntity('firewall', i);
    }
    this.spawnEntity('shard', safeLane);
  }

  private spawnExpertPattern(): void {
    const r = this.rng();
    if (r < 0.3) {
      this.spawnTriplePattern();
    } else if (r < 0.6) {
      this.spawnGapPattern();
      if (this.rng() < (this.modifiers?.firewallWeight ?? 1)) {
        this.spawnEntity('firewall', this.randInt(0, this.maxLane));
      }
    } else {
      for (let i = 0; i <= this.maxLane; i++) {
        if (this.rng() > 0.4) {
          this.spawnEntity(this.rng() > 0.5 ? 'firewall' : 'shard', i);
        }
      }
    }
  }

  private spawnTitanBoss(): void {
    const gapLane = this.randInt(0, this.maxLane);
    for (let i = 0; i <= this.maxLane; i++) {
      if (i === gapLane) {
        this.spawnEntity('shard', i, { isBoss: false });
      } else {
        this.spawnEntity('firewall', i, { isBoss: true, height: 56, width: 100 });
      }
    }
  }

  private isLaneBlocked(lane: number): boolean {
    return this.entities.some((e) => e.lane === lane && e.y < 120 && e.active);
  }

  private spawnEntity(
    type: SpawnEntityType,
    lane: number,
    opts?: Partial<Pick<SpawnedEntity, 'isBoss' | 'isGolden' | 'isQuantumVault' | 'width' | 'height'>> & { yOffset?: number },
  ): void {
    const powerupTypes: PowerupType[] = ['shield', 'magnet', 'overclock', 'chronos'];
    const golden = this.modifiers?.goldenStorm ?? false;
    const yOffset = opts?.yOffset ?? 0;
    const entity: SpawnedEntity = {
      id: nextId++,
      type,
      lane: clampLane(lane),
      y: ((this.modifiers?.reverseFlow ?? false) ? 800 : -60) + yOffset,
      width: type === 'shard' ? 24 : type === 'powerup' ? 28 : type === 'score_boost' || type === 'bomb' ? 26 : 80,
      height: type === 'firewall' ? 24 : type === 'vault' ? 40 : type === 'score_boost' || type === 'bomb' ? 26 : 24,
      collected: false,
      active: true,
      isGolden: golden && type === 'shard',
      ...opts,
    };

    if (type === 'powerup') {
      entity.powerupType = powerupTypes[this.randInt(0, powerupTypes.length - 1)];
    }

    if (type === 'white_firewall') {
      entity.width = opts?.width ?? 80;
      entity.height = opts?.height ?? 28;
    }

    this.entities.push(entity);

    if (type === 'shard' && (this.modifiers?.shardEchoChance ?? 0) > 0) {
      if (this.rng() < (this.modifiers?.shardEchoChance ?? 0)) {
        const echoLane = lane === 0 ? 1 : lane === 2 ? 1 : this.rng() > 0.5 ? 0 : 2;
        if (echoLane !== lane) {
          this.spawnEntity('shard', echoLane, { isGolden: golden });
        }
      }
    }
  }

  removeEntity(id: number): void {
    const e = this.entities.find((ent) => ent.id === id);
    if (e) e.active = false;
  }

  clear(): void {
    this.entities = [];
    this.spawnTimer = 0;
    this.elapsed = 0;
    this.speedRatio = 0;
    this.scrollSpeed = SCROLL.MIN_SPEED;
    this.modifiers = null;
    this.directorMods = null;
    this.titanTimer = 8;
    this.assistShardsPending = 0;
    this.mercyPulse = false;
    this.maxLane = 2;
  }
}

function clampLane(lane: number): number {
  return Math.max(0, Math.min(3, Math.floor(lane)));
}
