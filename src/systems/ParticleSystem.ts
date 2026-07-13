import { Container, Graphics } from 'pixi.js';
import { ObjectPool } from '@/utils/ObjectPool';
import { randomRange } from '@/utils/math';

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
      64,
    );
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
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

      if (!p.graphic.parent) {
        this.container.addChild(p.graphic);
      }
      if (!this.activeList.includes(p)) {
        this.activeList.push(p);
      }
    }
  }

  trail(x: number, y: number, color: number): void {
    if (this.reducedMotion) return;
    const p = this.pool.acquire();
    p.vx = randomRange(-10, 10);
    p.vy = randomRange(20, 40);
    p.life = 0.4;
    p.maxLife = 0.4;
    p.active = true;
    p.graphic.clear();
    p.graphic.circle(0, 0, 3);
    p.graphic.fill({ color, alpha: 0.6 });
    p.graphic.x = x;
    p.graphic.y = y;
    p.graphic.visible = true;
    p.graphic.alpha = 0.6;
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
      p.graphic.alpha = (p.life / p.maxLife) * 0.8;
      p.vy += 100 * dt;

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
