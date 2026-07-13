import type { PowerupType } from '@/types';
import { DIFFICULTY, POWERUP, SCROLL } from '@/config/constants';
import { createRng, randomInt } from '@/utils/math';

export type SpawnEntityType = 'firewall' | 'shard' | 'powerup' | 'vault';

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
}

let nextId = 1;

export class SpawnerSystem {
  private entities: SpawnedEntity[] = [];
  private spawnTimer = 0;
  private elapsed = 0;
  private rng: () => number;
  private scrollSpeed: number;

  constructor(seed?: number) {
    this.rng = seed !== undefined ? createRng(seed) : Math.random;
    this.scrollSpeed = SCROLL.BASE_SPEED;
  }

  getEntities(): SpawnedEntity[] {
    return this.entities;
  }

  getScrollSpeed(): number {
    return this.scrollSpeed;
  }

  getElapsed(): number {
    return this.elapsed;
  }

  setScrollSpeed(speed: number): void {
    this.scrollSpeed = speed;
  }

  update(dt: number, gameWidth: number): void {
    this.elapsed += dt;
    this.scrollSpeed = Math.min(
      SCROLL.BASE_SPEED + Math.max(0, this.elapsed - 10) * SCROLL.ACCELERATION,
      SCROLL.MAX_SPEED,
    );

    for (const e of this.entities) {
      if (!e.active) continue;
      e.y += this.scrollSpeed * dt;
      if (e.y > gameWidth * 2) {
        e.active = false;
      }
    }

    this.entities = this.entities.filter((e) => e.active);

    const interval = Math.max(
      DIFFICULTY.SPAWN_INTERVAL_MIN,
      DIFFICULTY.SPAWN_INTERVAL_BASE - this.elapsed * 0.005,
    );

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnPattern();
      const warmup = this.elapsed < 25;
      this.spawnTimer = warmup ? Math.max(interval, 1.4) : interval;
    }
  }

  /** Spawn immediate onboarding pickups for fast first engagement */
  spawnStarter(): void {
    this.spawnEntity('shard', 1);
    this.spawnEntity('shard', 0);
    this.spawnTimer = 1.0;
  }

  private spawnPattern(): void {
    // Gentle onboarding: easy patterns only for first 25 seconds
    if (this.elapsed < 25) {
      this.spawnWarmupPattern();
      return;
    }

    const patternLevel = DIFFICULTY.PATTERN_UNLOCK_TIME.filter((t) => this.elapsed >= t).length;

    switch (patternLevel) {
      case 1:
        this.spawnEntity('firewall', randomInt(0, 2));
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

    if (this.elapsed > 60 && this.rng() < 0.005) {
      this.spawnEntity('vault', 1);
    }
  }

  private spawnWarmupPattern(): void {
    const roll = this.rng();
    if (roll < 0.5) {
      const shardLane = randomInt(0, 2);
      this.spawnEntity('shard', shardLane);
      const fwLane = (shardLane + 1 + randomInt(0, 1)) % 3;
      if (fwLane !== shardLane) this.spawnEntity('firewall', fwLane);
    } else {
      this.spawnEntity('shard', randomInt(0, 2));
    }
  }

  private spawnDualObstacle(): void {
    const blocked = randomInt(0, 2);
    for (let i = 0; i < 3; i++) {
      if (i !== blocked) this.spawnEntity('firewall', i);
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
      if (i !== safeLane) {
        this.spawnEntity('firewall', i);
      }
    }
    this.spawnEntity('shard', safeLane);
  }

  private spawnExpertPattern(): void {
    const r = this.rng();
    if (r < 0.3) {
      this.spawnTriplePattern();
    } else if (r < 0.6) {
      this.spawnGapPattern();
      this.spawnEntity('firewall', randomInt(0, 2));
    } else {
      for (let i = 0; i < 3; i++) {
        if (this.rng() > 0.4) {
          this.spawnEntity(this.rng() > 0.5 ? 'firewall' : 'shard', i);
        }
      }
    }
  }

  private isLaneBlocked(lane: number): boolean {
    return this.entities.some((e) => e.lane === lane && e.y < 120 && e.active);
  }

  private spawnEntity(type: SpawnEntityType, lane: number): void {
    const powerupTypes: PowerupType[] = ['shield', 'magnet', 'overclock', 'chronos'];
    const entity: SpawnedEntity = {
      id: nextId++,
      type,
      lane,
      y: -60,
      width: type === 'shard' ? 24 : type === 'powerup' ? 28 : 80,
      height: type === 'firewall' ? 24 : type === 'vault' ? 40 : 24,
      collected: false,
      active: true,
    };

    if (type === 'powerup') {
      entity.powerupType = powerupTypes[randomInt(0, powerupTypes.length - 1)];
    }

    this.entities.push(entity);
  }

  removeEntity(id: number): void {
    const e = this.entities.find((ent) => ent.id === id);
    if (e) e.active = false;
  }

  clear(): void {
    this.entities = [];
    this.spawnTimer = 0;
    this.elapsed = 0;
  }
}
