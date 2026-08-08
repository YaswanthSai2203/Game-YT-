import type { GameHandle, GameLaunchOptions, GameModule } from '@/games/types';
import {
  drawCyberRex,
  drawDust,
  drawFirewall,
  drawGround,
  drawParallaxBg,
  drawSignalDrone,
  drawSpeedLines,
  drawVignette,
  spawnDust,
  type DustParticle,
} from '@/games/offline-rex/offlineRexRender';
import '@/games/offline-rex/offlineRex.css';

type Phase = 'intro' | 'playing' | 'dead';

interface Obstacle {
  x: number;
  w: number;
  h: number;
  type: 'cactus' | 'bird';
  wingUp: boolean;
  y?: number;
}

export class OfflineRexGame {
  private container: HTMLElement;
  private root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onExitToHub: (() => void) | null;
  private raf = 0;
  private running = false;
  private paused = false;
  private phase: Phase = 'intro';
  private lastTs = 0;
  private speed = 6;
  private groundY = 0;
  private score = 0;
  private hiScore = 0;
  private spawnTimer = 0;
  private obstacles: Obstacle[] = [];
  private dust: DustParticle[] = [];
  private dinoY = 0;
  private dinoVy = 0;
  private ducking = false;
  private animFrame = 0;
  private groundOffset = 0;
  private bgOffset = 0;
  private pulse = 0;
  private deathFlash = 0;

  private readonly gravity = 0.65;
  private readonly jumpForce = -12.5;
  private readonly dinoX = 72;
  private readonly dinoStandW = 44;
  private readonly dinoStandH = 48;
  private readonly dinoDuckW = 56;
  private readonly dinoDuckH = 28;

  private boundResize = (): void => this.resize();
  private boundKey = (e: KeyboardEvent): void => this.onKey(e);
  private boundPointer = (): void => this.onTap();

  constructor(container: HTMLElement, options?: GameLaunchOptions) {
    this.container = container;
    this.onExitToHub = options?.onExitToHub ?? null;
    this.hiScore = parseInt(localStorage.getItem('offline-rex-hi') ?? '0', 10) || 0;

    this.root = document.createElement('div');
    this.root.className = 'offline-rex-root';
    this.root.innerHTML = `
      <div class="offline-rex-chrome">
        <button type="button" class="offline-rex-back" data-action="hub">
          <span class="offline-rex-back-icon" aria-hidden="true">←</span>
          <span>Arcade</span>
        </button>
        <div class="offline-rex-hud">
          <div class="offline-rex-hud-pill">
            <span class="offline-rex-hud-label">HI</span>
            <span class="offline-rex-hi">${String(this.hiScore).padStart(5, '0')}</span>
          </div>
          <div class="offline-rex-hud-pill offline-rex-hud-score">
            <span class="offline-rex-hud-label">SCORE</span>
            <span class="offline-rex-score" id="offline-rex-score">00000</span>
          </div>
        </div>
      </div>
      <canvas class="offline-rex-canvas" aria-label="Offline Rex runner"></canvas>
      <div class="offline-rex-overlay" id="offline-rex-overlay">
        <div class="offline-rex-panel">
          <p class="offline-rex-eyebrow">No signal</p>
          <h1 class="offline-rex-title">OFFLINE REX</h1>
          <p class="offline-rex-sub" id="offline-rex-msg">The grid is down — keep running</p>
          <p class="offline-rex-hint">Tap to jump · Hold ↓ to duck under drones</p>
          <p class="offline-rex-cta" id="offline-rex-cta">TAP TO START</p>
        </div>
      </div>
    `;
    container.appendChild(this.root);

    const canvas = this.root.querySelector('canvas');
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
      throw new Error('Offline Rex canvas missing');
    }
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;

    this.root.querySelector('[data-action="hub"]')?.addEventListener('click', () => {
      this.onExitToHub?.();
    });

    window.addEventListener('resize', this.boundResize);
    window.addEventListener('keydown', this.boundKey);
    this.canvas.addEventListener('pointerdown', this.boundPointer);

    this.resize();
    this.running = true;
    this.lastTs = performance.now();
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio, 2);
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.groundY = h - Math.max(56, h * 0.14);
    this.dinoY = this.groundY - this.dinoStandH;
  }

  private onKey(e: KeyboardEvent): void {
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      if (this.phase === 'playing') this.ducking = true;
      e.preventDefault();
      return;
    }
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      this.onTap();
    }
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'ArrowDown' || e.code === 'KeyS') this.ducking = false;
  };

  private onTap(): void {
    if (this.paused) return;
    if (this.phase === 'intro' || this.phase === 'dead') {
      this.startRun();
      return;
    }
    if (this.phase === 'playing' && this.isGrounded()) {
      this.dinoVy = this.jumpForce;
    }
  }

  private isGrounded(): boolean {
    return this.dinoY >= this.groundY - this.dinoStandH - 0.5;
  }

  private startRun(): void {
    this.phase = 'playing';
    this.score = 0;
    this.speed = 6;
    this.obstacles = [];
    this.dust = [];
    this.spawnTimer = 0;
    this.deathFlash = 0;
    this.dinoY = this.groundY - this.dinoStandH;
    this.dinoVy = 0;
    this.ducking = false;
    this.root.querySelector('#offline-rex-overlay')?.classList.add('hidden');
    window.addEventListener('keyup', this.onKeyUp);
  }

  private gameOver(): void {
    this.phase = 'dead';
    this.deathFlash = 1;
    if (this.score > this.hiScore) {
      this.hiScore = this.score;
      localStorage.setItem('offline-rex-hi', String(this.hiScore));
      const hiEl = this.root.querySelector('.offline-rex-hi');
      if (hiEl) hiEl.textContent = String(this.hiScore).padStart(5, '0');
    }
    const msg = this.root.querySelector('#offline-rex-msg');
    const cta = this.root.querySelector('#offline-rex-cta');
    if (msg) msg.textContent = `Sync lost at ${this.score} points`;
    if (cta) cta.textContent = 'TAP TO RETRY';
    this.root.querySelector('#offline-rex-overlay')?.classList.remove('hidden');
    window.removeEventListener('keyup', this.onKeyUp);
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.lastTs = performance.now();
  }

  private loop(ts: number): void {
    if (!this.running) return;
    const dt = Math.min(32, ts - this.lastTs);
    this.lastTs = ts;
    if (!this.paused) {
      this.update(dt / 16.67);
      this.draw();
    }
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  private update(step: number): void {
    this.pulse += step * 0.08;
    if (this.deathFlash > 0) this.deathFlash = Math.max(0, this.deathFlash - step * 0.06);

    if (this.phase !== 'playing') {
      this.animFrame += step * 0.12;
      this.bgOffset += step * 0.5;
      return;
    }

    this.animFrame += step * 0.28;
    this.speed = Math.min(14, this.speed + step * 0.002);
    this.groundOffset = (this.groundOffset + this.speed * step) % 48;
    this.bgOffset += this.speed * step * 0.35;
    this.score += Math.floor(step * this.speed * 0.35);
    const scoreEl = this.root.querySelector('#offline-rex-score');
    if (scoreEl) scoreEl.textContent = String(this.score).padStart(5, '0');

    this.dinoVy += this.gravity * step;
    this.dinoY += this.dinoVy * step;
    const standTop = this.groundY - (this.ducking ? this.dinoDuckH : this.dinoStandH);
    if (this.dinoY > standTop) {
      this.dinoY = standTop;
      this.dinoVy = 0;
      if (Math.floor(this.animFrame) % 4 === 0) {
        this.dust.push(spawnDust(this.dinoX + 8, this.groundY - 4));
      }
    }

    for (const p of this.dust) {
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.vy += 0.08 * step;
      p.life -= step * 0.04;
    }
    this.dust = this.dust.filter((p) => p.life > 0);

    this.spawnTimer -= step;
    if (this.spawnTimer <= 0) {
      this.spawnObstacle();
      this.spawnTimer = 58 + Math.random() * 65 - this.speed * 2;
    }

    for (const o of this.obstacles) {
      o.x -= this.speed * step;
      if (o.type === 'bird') o.wingUp = Math.floor(this.animFrame * 0.8) % 2 === 0;
    }
    this.obstacles = this.obstacles.filter((o) => o.x + o.w > -30);

    if (this.checkCollision()) this.gameOver();
  }

  private spawnObstacle(): void {
    const bird = this.score > 350 && Math.random() < 0.38;
    if (bird) {
      const flyingHigh = Math.random() < 0.5;
      this.obstacles.push({
        x: this.canvas.clientWidth + 24,
        w: 42,
        h: 24,
        type: 'bird',
        wingUp: true,
        y: flyingHigh ? this.groundY - 78 : this.groundY - 52,
      });
      return;
    }
    const scale = 0.9 + Math.random() * 0.45;
    const variant = Math.floor(Math.random() * 3);
    const w = (variant === 0 ? 22 : variant === 1 ? 38 : 54) * scale;
    const h = (40 + Math.random() * 14) * scale;
    this.obstacles.push({ x: this.canvas.clientWidth + 24, w, h, type: 'cactus', wingUp: false });
  }

  private dinoHitbox(): { x: number; y: number; w: number; h: number } {
    const w = this.ducking ? this.dinoDuckW : this.dinoStandW;
    const h = this.ducking ? this.dinoDuckH : this.dinoStandH;
    const y = this.ducking ? this.groundY - h : this.dinoY;
    return { x: this.dinoX + 8, y: y + 6, w: w - 14, h: h - 10 };
  }

  private checkCollision(): boolean {
    const d = this.dinoHitbox();
    for (const o of this.obstacles) {
      const oy = o.type === 'bird' ? (o.y ?? this.groundY - 55) : this.groundY - o.h;
      const pad = 5;
      if (
        d.x + pad < o.x + o.w - pad &&
        d.x + d.w - pad > o.x + pad &&
        d.y + pad < oy + o.h - pad &&
        d.y + d.h - pad > oy + pad
      ) {
        return true;
      }
    }
    return false;
  }

  private draw(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const ctx = this.ctx;

    drawParallaxBg(ctx, w, h, this.groundY, this.groundOffset, this.bgOffset);
    drawSpeedLines(ctx, w, this.groundY, this.speed, this.groundOffset);
    drawGround(ctx, w, h, this.groundY, this.groundOffset);

    for (const o of this.obstacles) {
      if (o.type === 'cactus') drawFirewall(ctx, o.x, this.groundY, o.w, o.h, this.pulse);
      else drawSignalDrone(ctx, o.x, o.y ?? this.groundY - 55, o.w, o.wingUp, this.pulse, this.animFrame);
    }

    drawDust(ctx, this.dust);

    const duck = this.phase === 'playing' && this.ducking;
    const grounded = this.isGrounded() || duck;
    const dinoDrawY = duck ? this.groundY - this.dinoDuckH : this.dinoY;
    drawCyberRex(ctx, this.dinoX, dinoDrawY, duck, this.animFrame, grounded && this.phase === 'playing');

    drawVignette(ctx, w, h);

    if (this.deathFlash > 0) {
      ctx.fillStyle = `rgba(255, 0, 110, ${this.deathFlash * 0.4})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.boundResize);
    window.removeEventListener('keydown', this.boundKey);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('pointerdown', this.boundPointer);
    this.root.remove();
  }
}

class OfflineRexHandle implements GameHandle {
  constructor(private game: OfflineRexGame) {}

  destroy(): void {
    this.game.destroy();
  }

  handlePlayablesPause(): void {
    this.game.pause();
  }

  handlePlayablesResume(): void {
    this.game.resume();
  }

  handlePlayablesAudio(): void {
    // No audio
  }
}

export async function launch(container: HTMLElement, options?: GameLaunchOptions): Promise<GameHandle> {
  const game = new OfflineRexGame(container, options);
  return new OfflineRexHandle(game);
}

const offlineRexModule: GameModule = { launch };
export default offlineRexModule;
