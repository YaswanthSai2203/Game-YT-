import type { MomentumState, Vec2, WorldObject } from '@/games/catapult-chaos/types';

const GRAVITY = 0.42;
const GROUND_FRICTION = 0.82;
const AIR_DRAG_BASE = 0.998;

export interface PlayerBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVel: number;
  radius: number;
  mass: number;
  onGround: boolean;
  momentum: MomentumState;
  alive: boolean;
}

export interface PhysicsEvent {
  kind: 'hit' | 'break' | 'bounce' | 'explode' | 'collect' | 'kill';
  objectId?: string;
  objectType?: string;
  impact: number;
  label?: string;
}

export class PhysicsWorld {
  objects: WorldObject[] = [];
  events: PhysicsEvent[] = [];
  groundY = 0;
  wind = 0;
  time = 0;

  player: PlayerBody = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    angularVel: 0,
    radius: 15,
    mass: 1,
    onGround: false,
    momentum: 'stable',
    alive: true,
  };

  reset(objects: WorldObject[], groundY: number, wind: number, spawn: Vec2): void {
    this.objects = objects.map((o) => ({ ...o, vx: o.vx ?? 0, vy: o.vy ?? 0, alive: o.alive ?? true }));
    this.groundY = groundY;
    this.wind = wind;
    this.time = 0;
    this.events = [];
    this.player = {
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      angle: 0,
      angularVel: 0,
      radius: 15,
      mass: 1,
      onGround: true,
      momentum: 'stable',
      alive: true,
    };
  }

  launchPlayer(vx: number, vy: number): void {
    this.player.vx = vx;
    this.player.vy = vy;
    this.player.onGround = false;
    this.player.momentum = 'stable';
  }

  drainEvents(): PhysicsEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  step(dt: number, airControl: number, dragMult: number): void {
    if (!this.player.alive) return;
    this.time += dt;
    const p = this.player;

    // Wind
    p.vx += this.wind * 0.012 * dt;

    // Gravity
    p.vy += GRAVITY * dt;

    // Air drag
    const drag = AIR_DRAG_BASE * dragMult;
    p.vx *= Math.pow(drag, dt);
    p.vy *= Math.pow(drag, dt);
    p.angularVel *= Math.pow(0.96, dt);

    // Air control (horizontal + slight rotation)
    p.vx += airControl * 0.22 * dt;
    p.angularVel += airControl * 0.018 * dt;

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.angle += p.angularVel * dt;

    p.onGround = false;

    // Spin windmills
    for (const o of this.objects) {
      if (o.type === 'windmill' && o.alive) {
        o.rotation += (o.special?.spin ?? 1) * 0.04 * dt;
      }
    }

    // Dynamic objects integrate
    for (const o of this.objects) {
      if (!o.alive || o.static) continue;
      o.vy += GRAVITY * 0.6 * dt;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.vy *= Math.pow(0.99, dt);
      o.vx *= Math.pow(0.99, dt);
    }

    this.resolvePlayerCollisions();
    this.resolveObjectGround();
  }

  applyAbilityBurst(dx: number, dy: number): void {
    const p = this.player;
    p.vx += dx;
    p.vy += dy;
    this.events.push({ kind: 'bounce', impact: 0, label: 'Ability' });
  }

  private resolvePlayerCollisions(): void {
    const p = this.player;
    for (const o of this.objects) {
      if (!o.alive) continue;
      if (o.type === 'coin') {
        if (this.circleRectOverlap(p, o)) {
          o.alive = false;
          this.events.push({ kind: 'collect', objectId: o.id, objectType: o.type, impact: 0 });
        }
        continue;
      }

      const hit = this.circleObbOverlap(p, o);
      if (!hit) continue;

      const impact = Math.hypot(p.vx, p.vy);
      this.handleObjectHit(o, impact);

      if (!p.alive) return;

      const nx = hit.nx;
      const ny = hit.ny;
      const relVel = p.vx * nx + p.vy * ny;
      if (relVel < 0) {
        const bounce = o.elasticity;
        p.vx -= (1 + bounce) * relVel * nx;
        p.vy -= (1 + bounce) * relVel * ny;

        if (o.type === 'trampoline') {
          p.vy = -Math.abs(p.vy) * 1.65 - 4;
          p.vx *= 1.08;
          this.events.push({ kind: 'bounce', objectId: o.id, objectType: o.type, impact, label: 'Trampoline' });
        } else if (o.type === 'windmill') {
          p.vy -= 6;
          p.vx += 3 * Math.sign(p.x - o.x);
          this.events.push({ kind: 'bounce', objectId: o.id, objectType: o.type, impact, label: 'Windmill' });
        } else if (o.type === 'ramp') {
          this.events.push({ kind: 'bounce', objectId: o.id, objectType: o.type, impact, label: 'Ramp' });
        } else if (o.type === 'balloon') {
          p.vy -= 5;
          o.alive = false;
          this.events.push({ kind: 'collect', objectId: o.id, objectType: o.type, impact, label: 'Balloon' });
        } else {
          this.events.push({ kind: 'hit', objectId: o.id, objectType: o.type, impact });
        }

        // Separate
        p.x += nx * hit.depth;
        p.y += ny * hit.depth;

        this.applyImpactDamage(impact);
        if (o.type === 'terrain' || o.type === 'ramp') {
          p.onGround = ny < -0.4;
          if (p.onGround) {
            p.vx *= GROUND_FRICTION;
            p.vy *= 0.2;
          }
        }
      }
    }
  }

  private handleObjectHit(o: WorldObject, impact: number): void {
    if (o.type === 'barrel' && impact > 4) {
      o.alive = false;
      this.explodeAt(o.x + o.w / 2, o.y + o.h / 2, 120);
      this.events.push({ kind: 'explode', objectId: o.id, objectType: o.type, impact, label: 'Barrel' });
      return;
    }

    if (!o.static && o.breakStrength < Infinity) {
      o.hp -= impact * 8;
      if (o.hp <= 0) {
        o.alive = false;
        this.events.push({ kind: 'break', objectId: o.id, objectType: o.type, impact });
        if (!o.static) {
          o.vx = this.player.vx * 0.4;
          o.vy = this.player.vy * 0.4 - 2;
        }
      }
    }
  }

  private explodeAt(cx: number, cy: number, radius: number): void {
    const p = this.player;
    const dx = p.x - cx;
    const dy = p.y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < radius) {
      const force = (1 - dist / radius) * 14;
      p.vx += (dx / dist) * force;
      p.vy += (dy / dist) * force - 6;
    }
    for (const o of this.objects) {
      if (!o.alive || o.static) continue;
      const ox = o.x + o.w / 2 - cx;
      const oy = o.y + o.h / 2 - cy;
      const d = Math.hypot(ox, oy);
      if (d < radius) {
        const f = (1 - d / radius) * 10;
        o.vx += (ox / d) * f;
        o.vy += (oy / d) * f - 4;
      }
    }
  }

  private applyImpactDamage(impact: number): void {
    const p = this.player;
    const resist = 1;
    if (impact > 18 / resist) {
      p.alive = false;
      p.momentum = 'critical';
      this.events.push({ kind: 'kill', impact });
      return;
    }
    if (impact > 12 / resist) p.momentum = 'critical';
    else if (impact > 7 / resist) p.momentum = 'hurt';
    else p.momentum = 'stable';
  }

  private resolveObjectGround(): void {
    for (const o of this.objects) {
      if (!o.alive || o.static) continue;
      const bottom = o.y + o.h;
      if (bottom > this.groundY) {
        o.y = this.groundY - o.h;
        o.vy *= -o.elasticity * 0.4;
        o.vx *= o.friction;
      }
    }
  }

  private circleRectOverlap(p: PlayerBody, o: WorldObject): boolean {
    const cx = Math.max(o.x, Math.min(p.x, o.x + o.w));
    const cy = Math.max(o.y, Math.min(p.y, o.y + o.h));
    const dx = p.x - cx;
    const dy = p.y - cy;
    return dx * dx + dy * dy < p.radius * p.radius;
  }

  private circleObbOverlap(
    p: PlayerBody,
    o: WorldObject,
  ): { nx: number; ny: number; depth: number } | null {
    const cx = o.x + o.w / 2;
    const cy = o.y + o.h / 2;
    const cos = Math.cos(-o.rotation);
    const sin = Math.sin(-o.rotation);
    const lx = p.x - cx;
    const ly = p.y - cy;
    const rx = lx * cos - ly * sin;
    const ry = lx * sin + ly * cos;

    const hw = o.w / 2;
    const hh = o.h / 2;
    const closestX = Math.max(-hw, Math.min(rx, hw));
    const closestY = Math.max(-hh, Math.min(ry, hh));
    const dx = rx - closestX;
    const dy = ry - closestY;
    const distSq = dx * dx + dy * dy;
    if (distSq >= p.radius * p.radius) return null;

    const dist = Math.sqrt(distSq) || 0.001;
    let nx = dx / dist;
    let ny = dy / dist;
    if (distSq < 0.01) {
      nx = 0;
      ny = -1;
    }
    const worldNx = nx * cos + ny * sin;
    const worldNy = -nx * sin + ny * cos;
    const depth = p.radius - dist;
    return { nx: worldNx, ny: worldNy, depth };
  }
}
