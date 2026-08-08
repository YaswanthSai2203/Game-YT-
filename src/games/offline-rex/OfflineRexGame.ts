import type { GameHandle, GameLaunchOptions, GameModule } from '@/games/types';
import '@/games/offline-rex/offlineRex.css';

const COLORS = {
  bg: '#0a0e1a',
  ground: '#1a2744',
  groundLine: '#00f0ff',
  dino: '#00f0ff',
  dinoEye: '#0a0e1a',
  obstacle: '#ff006e',
  bird: '#8b5cf6',
  text: '#e8edf5',
  textDim: '#8892a8',
  score: '#00f0ff',
};

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
  private dinoY = 0;
  private dinoVy = 0;
  private ducking = false;
  private animFrame = 0;
  private groundOffset = 0;

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
      <button type="button" class="offline-rex-back" data-action="hub">← Arcade</button>
      <div class="offline-rex-hud">
        <span class="offline-rex-hi">HI ${String(this.hiScore).padStart(5, '0')}</span>
        <span class="offline-rex-score" id="offline-rex-score">00000</span>
      </div>
      <canvas class="offline-rex-canvas" aria-label="Offline Rex runner"></canvas>
      <div class="offline-rex-overlay" id="offline-rex-overlay">
        <p class="offline-rex-title">OFFLINE REX</p>
        <p class="offline-rex-sub" id="offline-rex-msg">No signal detected — run anyway</p>
        <p class="offline-rex-hint">Tap or press Space to jump · ↓ to duck</p>
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
    this.groundY = h - Math.max(48, h * 0.12);
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
    this.spawnTimer = 0;
    this.dinoY = this.groundY - this.dinoStandH;
    this.dinoVy = 0;
    this.ducking = false;
    const overlay = this.root.querySelector('#offline-rex-overlay');
    overlay?.classList.add('hidden');
    window.addEventListener('keyup', this.onKeyUp);
  }

  private gameOver(): void {
    this.phase = 'dead';
    if (this.score > this.hiScore) {
      this.hiScore = this.score;
      localStorage.setItem('offline-rex-hi', String(this.hiScore));
      const hiEl = this.root.querySelector('.offline-rex-hi');
      if (hiEl) hiEl.textContent = `HI ${String(this.hiScore).padStart(5, '0')}`;
    }
    const overlay = this.root.querySelector('#offline-rex-overlay');
    const msg = this.root.querySelector('#offline-rex-msg');
    if (msg) msg.textContent = `Connection lost — score ${this.score}`;
    overlay?.classList.remove('hidden');
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
    if (this.phase !== 'playing') {
      this.animFrame += step * 0.15;
      return;
    }

    this.animFrame += step * 0.25;
    this.speed = Math.min(14, this.speed + step * 0.002);
    this.groundOffset = (this.groundOffset + this.speed * step) % 24;
    this.score += Math.floor(step * this.speed * 0.35);
    const scoreEl = this.root.querySelector('#offline-rex-score');
    if (scoreEl) scoreEl.textContent = String(this.score).padStart(5, '0');

    // Dino physics
    this.dinoVy += this.gravity * step;
    this.dinoY += this.dinoVy * step;
    const standTop = this.groundY - (this.ducking ? this.dinoDuckH : this.dinoStandH);
    if (this.dinoY > standTop) {
      this.dinoY = standTop;
      this.dinoVy = 0;
    }

    // Obstacles
    this.spawnTimer -= step;
    if (this.spawnTimer <= 0) {
      this.spawnObstacle();
      this.spawnTimer = 55 + Math.random() * 70 - this.speed * 2;
    }

    for (const o of this.obstacles) {
      o.x -= this.speed * step;
      if (o.type === 'bird') o.wingUp = Math.floor(this.animFrame) % 2 === 0;
    }
    this.obstacles = this.obstacles.filter((o) => o.x + o.w > -20);

    if (this.checkCollision()) this.gameOver();
  }

  private spawnObstacle(): void {
    const bird = this.score > 400 && Math.random() < 0.35;
    if (bird) {
      const h = 24;
      const flyingHigh = Math.random() < 0.5;
      this.obstacles.push({
        x: this.canvas.clientWidth + 20,
        w: 36,
        h,
        type: 'bird',
        wingUp: true,
        y: flyingHigh ? this.groundY - 70 : this.groundY - 48,
      });
      return;
    }
    const scale = 0.85 + Math.random() * 0.5;
    const w = (18 + Math.floor(Math.random() * 3) * 12) * scale;
    const h = (38 + Math.random() * 16) * scale;
    this.obstacles.push({ x: this.canvas.clientWidth + 20, w, h, type: 'cactus', wingUp: false });
  }

  private dinoHitbox(): { x: number; y: number; w: number; h: number } {
    const w = this.ducking ? this.dinoDuckW : this.dinoStandW;
    const h = this.ducking ? this.dinoDuckH : this.dinoStandH;
    const y = this.ducking ? this.groundY - h : this.dinoY;
    return { x: this.dinoX + 6, y: y + 4, w: w - 12, h: h - 8 };
  }

  private checkCollision(): boolean {
    const d = this.dinoHitbox();
    for (const o of this.obstacles) {
      const oy = o.type === 'bird'
        ? (o.y ?? this.groundY - 55)
        : this.groundY - o.h;
      const pad = 4;
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

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    // Ground
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, this.groundY, w, h - this.groundY);
    ctx.strokeStyle = COLORS.groundLine;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, this.groundY);
    ctx.lineTo(w, this.groundY);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Ground dashes
    ctx.fillStyle = COLORS.groundLine;
    ctx.globalAlpha = 0.2;
    for (let x = -this.groundOffset; x < w; x += 24) {
      ctx.fillRect(x, this.groundY + 14, 12, 2);
    }
    ctx.globalAlpha = 1;

    // Obstacles
    for (const o of this.obstacles) {
      if (o.type === 'cactus') this.drawCactus(o);
      else this.drawBird(o);
    }

    // Dino
    this.drawDino();

    // Intro idle bounce
    if (this.phase === 'intro') {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '12px Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAP TO START', w / 2, this.groundY - 80);
    }
  }

  private drawDino(): void {
    const ctx = this.ctx;
    const duck = this.phase === 'playing' && this.ducking;
    const w = duck ? this.dinoDuckW : this.dinoStandW;
    const h = duck ? this.dinoDuckH : this.dinoStandH;
    const y = duck ? this.groundY - h : this.dinoY;
    const leg = Math.floor(this.animFrame) % 2 === 0;

    ctx.fillStyle = COLORS.dino;
    if (duck) {
      ctx.fillRect(this.dinoX, y + 8, w, h - 8);
      ctx.fillRect(this.dinoX + w - 14, y, 14, 14);
    } else {
      ctx.fillRect(this.dinoX + 8, y + 10, w - 16, h - 18);
      ctx.fillRect(this.dinoX + w - 18, y + 2, 16, 16);
      ctx.fillRect(this.dinoX, y + h - 10, 10, leg ? 6 : 10);
      ctx.fillRect(this.dinoX + 14, y + h - 10, 10, leg ? 10 : 6);
    }
    ctx.fillStyle = COLORS.dinoEye;
    ctx.fillRect(this.dinoX + w - 10, y + (duck ? 4 : 6), 4, 4);
  }

  private drawCactus(o: Obstacle): void {
    const ctx = this.ctx;
    const x = o.x;
    const y = this.groundY - o.h;
    ctx.fillStyle = COLORS.obstacle;
    ctx.fillRect(x + o.w * 0.35, y, o.w * 0.3, o.h);
    if (o.w > 22) {
      ctx.fillRect(x, y + o.h * 0.35, o.w * 0.35, o.h * 0.12);
      ctx.fillRect(x + o.w * 0.2, y + o.h * 0.2, o.w * 0.2, o.h * 0.2);
      ctx.fillRect(x + o.w * 0.65, y + o.h * 0.45, o.w * 0.35, o.h * 0.12);
      ctx.fillRect(x + o.w * 0.6, y + o.h * 0.3, o.w * 0.2, o.h * 0.2);
    }
  }

  private drawBird(o: Obstacle): void {
    const ctx = this.ctx;
    const y = o.y ?? this.groundY - 55;
    ctx.fillStyle = COLORS.bird;
    ctx.fillRect(o.x, y + 8, o.w, 6);
    ctx.fillRect(o.x + 8, y, 8, 10);
    const wingY = o.wingUp ? y + 2 : y + 10;
    ctx.fillRect(o.x + 18, wingY, 14, 4);
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
    // No audio in this mini-game
  }
}

export async function launch(container: HTMLElement, options?: GameLaunchOptions): Promise<GameHandle> {
  const game = new OfflineRexGame(container, options);
  return new OfflineRexHandle(game);
}

const offlineRexModule: GameModule = { launch };
export default offlineRexModule;
