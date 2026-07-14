import { Container, Graphics } from 'pixi.js';
import { ObjectPool } from '@/utils/ObjectPool';
import { randomRange } from '@/utils/math';
import type { TrailDef } from '@/config/cosmeticsConfig';

interface Particle {
  graphic: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  active: boolean;
}

export class ParticleSystem {
  private container: Container;
  private pool: ObjectPool<Particle>;
  private activeList: Particle[] = [];
  private reducedMotion: boolean;
  private trailStyle: TrailDef['style'] = 'default';
  private trailTick = 0;

  constructor(parent: Container, reducedMotion = false) {
    this.container = new Container();
    parent.addChild(this.container);
    this.reducedMotion = reducedMotion;

    this.pool = new ObjectPool<Particle>(
      () => ({
        graphic: new Graphics(),
        vx: 0, vy: 0, life: 0, maxLife: 0, active: false,
      }),
      (p) => {
        p.active = false;
        p.graphic.clear();
        p.graphic.visible = false;
      },
      96,
    );
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
  }

  setTrailStyle(style: TrailDef['style']): void {
    this.trailStyle = style;
  }

  burst(x: number, y: number, color: number, count = 12, speed = 200): void {
    if (this.reducedMotion) {
      count = Math.min(count, 4);
    }

    for (let i = 0; i < count; i++) {
      const p = this.pool.acquire();
      const angle = randomRange(0, Math.PI * 2);
      const spd = randomRange(speed * 0.3, speed);
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.life = randomRange(0.3, 0.8);
      p.maxLife = p.life;
      p.active = true;

      const size = randomRange(2, 5);
      p.graphic.clear();
      p.graphic.circle(0, 0, size);
      p.graphic.fill({ color, alpha: 0.9 });
      p.graphic.x = x;
      p.graphic.y = y;
      p.graphic.visible = true;
      p.graphic.alpha = 1;
      p.graphic.rotation = 0;
      p.graphic.scale.set(1);

      if (!p.graphic.parent) {
        this.container.addChild(p.graphic);
      }
      if (!this.activeList.includes(p)) {
        this.activeList.push(p);
      }
    }
  }

  /** Radial impact ring for hits, vaults, combos */
  impactRing(x: number, y: number, color: number, radius = 40): void {
    if (this.reducedMotion) return;
    const p = this.pool.acquire();
    p.vx = 0;
    p.vy = 0;
    p.life = 0.35;
    p.maxLife = 0.35;
    p.active = true;
    p.graphic.clear();
    p.graphic.circle(0, 0, radius);
    p.graphic.stroke({ color, width: 2, alpha: 0.7 });
    p.graphic.x = x;
    p.graphic.y = y;
    p.graphic.visible = true;
    p.graphic.alpha = 0.8;
    p.graphic.scale.set(0.3);
    if (!p.graphic.parent) this.container.addChild(p.graphic);
    if (!this.activeList.includes(p)) this.activeList.push(p);
  }

  trail(x: number, y: number, color: number): void {
    if (this.reducedMotion) return;
    this.trailTick++;
    const skip = this.trailStyle === 'glitch' ? 1 : 2;
    if (this.trailTick % skip !== 0) return;

    const p = this.pool.acquire();
    p.active = true;
    p.graphic.clear();
    p.graphic.x = x + randomRange(-4, 4);
    p.graphic.y = y + randomRange(-2, 2);

    if (this.trailStyle === 'gold') {
      p.vx = randomRange(-8, 8);
      p.vy = randomRange(25, 50);
      p.life = 0.55;
      p.maxLife = 0.55;
      p.graphic.star(0, 0, 4, 4, 2);
      p.graphic.fill({ color: 0xffd700, alpha: 0.75 });
      p.graphic.alpha = 0.75;
    } else if (this.trailStyle === 'glitch') {
      p.vx = randomRange(-30, 30);
      p.vy = randomRange(10, 35);
      p.life = 0.25;
      p.maxLife = 0.25;
      const w = randomRange(2, 8);
      p.graphic.rect(-w / 2, -1, w, 2);
      p.graphic.fill({ color: Math.random() > 0.5 ? color : 0xff006e, alpha: 0.85 });
      p.graphic.alpha = 0.85;
    } else {
      p.vx = randomRange(-10, 10);
      p.vy = randomRange(20, 40);
      p.life = 0.4;
      p.maxLife = 0.4;
      p.graphic.circle(0, 0, 3);
      p.graphic.fill({ color, alpha: 0.6 });
      p.graphic.alpha = 0.6;
    }

    p.graphic.visible = true;
    if (!p.graphic.parent) this.container.addChild(p.graphic);
    if (!this.activeList.includes(p)) this.activeList.push(p);
  }

  update(dt: number): void {
    for (let i = this.activeList.length - 1; i >= 0; i--) {
      const p = this.activeList[i];
      if (!p.active) continue;

      p.life -= dt;
      p.graphic.x += p.vx * dt;
      p.graphic.y += p.vy * dt;
      const ratio = p.life / p.maxLife;
      p.graphic.alpha = ratio * 0.85;

      if (p.vx === 0 && p.vy === 0 && p.maxLife <= 0.4) {
        p.graphic.scale.set(lerpScale(p.graphic.scale.x, 1.8, dt * 4));
      } else {
        p.vy += 100 * dt;
      }

      if (p.life <= 0) {
        this.container.removeChild(p.graphic);
        this.activeList.splice(i, 1);
        this.pool.release(p);
      }
    }
  }

  clear(): void {
    this.container.removeChildren();
  }
}

function lerpScale(current: number, target: number, t: number): number {
  return current + (target - current) * Math.min(1, t);
}
