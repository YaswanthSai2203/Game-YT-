import type { PowerupType } from '@/types';
import type { RealityModifiers } from '@/systems/QuantumRealitySystem';
import { DIFFICULTY, POWERUP, SCROLL } from '@/config/constants';
import { createRng, randomInt, lerp, smoothstep } from '@/utils/math';

export type SpawnEntityType = 'firewall' | 'shard' | 'powerup' | 'vault' | 'white_firewall';

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
  private titanTimer = 0;
  private assistShardsPending = 0;

  constructor(seed?: number) {
    this.rng = seed !== undefined ? createRng(seed) : Math.random;
    this.scrollSpeed = SCROLL.MIN_SPEED;
  }

  setModifiers(mods: RealityModifiers | null): void {
    this.modifiers = mods;
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

    const intervalMult = this.modifiers?.spawnIntervalMult ?? 1;
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
      this.spawnEntity('shard', randomInt(0, 2));
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
    const l = lane ?? randomInt(0, 2);
    this.spawnEntity('white_firewall', l, { width: 80, height: 28 });
  }

  private spawnPattern(): void {
    if (this.elapsed < 20) {
      this.spawnWarmupPattern();
      return;
    }

    const fwWeight = this.modifiers?.firewallWeight ?? 1;
    const patternLevel = DIFFICULTY.PATTERN_UNLOCK_TIME.filter((t) => this.elapsed >= t).length;

    if (fwWeight < 0.7 && this.rng() < 0.45) {
      this.spawnEntity('shard', randomInt(0, 2));
      if (this.rng() < 0.4) this.spawnEntity('shard', randomInt(0, 2));
      return;
    }

    if (this.modifiers?.punishLeftLane && this.rng() < 0.5) {
      this.spawnEntity('firewall', 0);
    } else if (this.modifiers?.punishRightLane && this.rng() < 0.5) {
      this.spawnEntity('firewall', 2);
    }

    switch (patternLevel) {
      case 1:
        if (this.rng() < fwWeight) this.spawnEntity('firewall', randomInt(0, 2));
        this.spawnEntity('shard', randomInt(0, 2));
        break;
      case 2:
        this.spawnDualObstacle();
        this.spawnEntity('shard', randomInt(0, 2));
        break;
      case 3:
        this.spawnTriplePattern();
        break;
      case 4:
        this.spawnGapPattern();
        break;
      default:
        this.spawnExpertPattern();
    }

    if (this.rng() < POWERUP.SPAWN_CHANCE) {
      const lane = randomInt(0, 2);
      if (!this.isLaneBlocked(lane)) {
        this.spawnEntity('powerup', lane);
      }
    }

    const vaultChance = this.modifiers?.vaultChance ?? 0.005;
    if (this.elapsed > 40 && this.rng() < vaultChance) {
      this.spawnEntity('vault', randomInt(0, 2));
    }
  }

  private spawnWarmupPattern(): void {
    const roll = this.rng();
    if (roll < 0.5) {
      const shardLane = randomInt(0, 2);
      this.spawnEntity('shard', shardLane);
      const fwLane = (shardLane + 1 + randomInt(0, 1)) % 3;
      if (fwLane !== shardLane && this.rng() < (this.modifiers?.firewallWeight ?? 1)) {
        this.spawnEntity('firewall', fwLane);
      }
    } else {
      this.spawnEntity('shard', randomInt(0, 2));
    }
  }

  private spawnDualObstacle(): void {
    const blocked = randomInt(0, 2);
    const fwWeight = this.modifiers?.firewallWeight ?? 1;
    for (let i = 0; i < 3; i++) {
      if (i !== blocked && this.rng() < fwWeight) this.spawnEntity('firewall', i);
      else this.spawnEntity('shard', i);
    }
  }

  private spawnTriplePattern(): void {
    const pattern = randomInt(0, 2);
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
    const safeLane = randomInt(0, 2);
    for (let i = 0; i < 3; i++) {
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
        this.spawnEntity('firewall', randomInt(0, 2));
      }
    } else {
      for (let i = 0; i < 3; i++) {
        if (this.rng() > 0.4) {
          this.spawnEntity(this.rng() > 0.5 ? 'firewall' : 'shard', i);
        }
      }
    }
  }

  private spawnTitanBoss(): void {
    const gapLane = randomInt(0, 2);
    for (let i = 0; i < 3; i++) {
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
    opts?: Partial<Pick<SpawnedEntity, 'isBoss' | 'isGolden' | 'isQuantumVault' | 'width' | 'height'>>,
  ): void {
    const powerupTypes: PowerupType[] = ['shield', 'magnet', 'overclock', 'chronos'];
    const golden = this.modifiers?.goldenStorm ?? false;
    const entity: SpawnedEntity = {
      id: nextId++,
      type,
      lane,
      y: (this.modifiers?.reverseFlow ?? false) ? 800 : -60,
      width: type === 'shard' ? 24 : type === 'powerup' ? 28 : 80,
      height: type === 'firewall' ? 24 : type === 'vault' ? 40 : 24,
      collected: false,
      active: true,
      isGolden: golden && type === 'shard',
      ...opts,
    };

    if (type === 'powerup') {
      entity.powerupType = powerupTypes[randomInt(0, powerupTypes.length - 1)];
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
    this.titanTimer = 8;
    this.assistShardsPending = 0;
  }
}
