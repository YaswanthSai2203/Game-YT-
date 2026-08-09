/** Screen shake, particles, flash — juice layer for Catapult Chaos */

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
}

export class FeelEffects {
  shake = 0;
  flash = 0;
  flashColor = '#00f0ff';
  comboBanner = 0;
  comboBannerLevel = 0;
  particles: Particle[] = [];

  reset(): void {
    this.shake = 0;
    this.flash = 0;
    this.comboBanner = 0;
    this.particles = [];
  }

  bumpShake(amount: number): void {
    this.shake = Math.min(18, this.shake + amount);
  }

  bumpFlash(color: string, strength = 0.45): void {
    this.flash = Math.min(1, this.flash + strength);
    this.flashColor = color;
  }

  showCombo(level: number): void {
    if (level < 3) return;
    this.comboBanner = 1;
    this.comboBannerLevel = level;
  }

  spawnBurst(x: number, y: number, color: string, count = 8, speed = 4): void {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const s = speed * (0.5 + Math.random());
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 2,
        life: 1,
        size: 2 + Math.random() * 3,
        color,
      });
    }
  }

  tick(dt: number): { shakeX: number; shakeY: number } {
    this.shake *= Math.pow(0.82, dt);
    this.flash = Math.max(0, this.flash - dt * 0.04);
    if (this.comboBanner > 0) this.comboBanner = Math.max(0, this.comboBanner - dt * 0.018);

    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.18 * dt;
      p.life -= 0.028 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    const s = this.shake;
    return {
      shakeX: (Math.random() - 0.5) * s * 2,
      shakeY: (Math.random() - 0.5) * s * 2,
    };
  }
}
