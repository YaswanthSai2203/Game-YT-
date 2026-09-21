import type { GameHandle, GameLaunchOptions, GameModule } from '@/games/types';
import { AnimatedNumber } from '@/games/shared/AnimatedNumber';
import { animateScoreElement } from '@/games/shared/animateScore';
import { FeelEffects } from '@/games/shared/FeelEffects';
import { runGameBoot } from '@/games/shared/GameBoot';
import { RexSfx } from '@/games/shared/RexSfx';
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
  private scoreAnim = new AnimatedNumber();
  private feel = new FeelEffects();
  private sfx = new RexSfx();
  private shakeX = 0;
  private shakeY = 0;
  private lastScoreMilestone = 0;
  private wasGrounded = true;
  private scoreCancel: (() => void) | null = null;

  private readonly gravity = 0.65;
  private readonly jumpForce = -12.5;
  private dinoX = 72;
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
    this.root.className = 'offline-rex-root mg-root';
    this.root.innerHTML = `
      <div class="mg-chrome">
        <button type="button" class="mg-back" data-action="hub">
          <span aria-hidden="true">←</span>
          <span>Arcade</span>
        </button>
        <div class="mg-hud">
          <div class="mg-hud-pill">
            <span class="mg-hud-label">Best</span>
            <span class="mg-hud-value offline-rex-hi">${this.hiScore.toLocaleString()}</span>
          </div>
          <div class="mg-hud-pill mg-hud-pill-accent" id="offline-rex-score-pill">
            <span class="mg-hud-label">Score</span>
            <span class="mg-hud-value mg-hud-value-live" id="offline-rex-score">0</span>
          </div>
        </div>
      </div>
      <canvas class="offline-rex-canvas" aria-label="Offline Rex runner"></canvas>
      <div class="mg-overlay" id="offline-rex-overlay">
        <div class="mg-panel" id="offline-rex-panel-intro">
          <p class="mg-eyebrow">Signal lost</p>
          <h1 class="mg-title">OFFLINE REX</h1>
          <p class="mg-sub">The grid is down. Keep running until sync fails.</p>
          <p class="mg-hint">Tap to jump · Hold ↓ to duck under drones</p>
          <button type="button" class="mg-cta" id="offline-rex-start">Start run</button>
        </div>
        <div class="mg-panel hidden" id="offline-rex-panel-dead">
          <p class="mg-eyebrow">Sync lost</p>
          <p class="mg-badge hidden" id="offline-rex-record">New personal best</p>
          <p class="mg-score-hero offline-rex-dead-score" id="offline-rex-dead-score">0</p>
          <div class="offline-rex-stats-row">
            <div class="offline-rex-stat">
              <span class="offline-rex-stat-label">Distance</span>
              <span class="offline-rex-stat-value" id="offline-rex-dead-dist">0</span>
            </div>
            <div class="offline-rex-stat">
              <span class="offline-rex-stat-label">Best</span>
              <span class="offline-rex-stat-value" id="offline-rex-dead-best">0</span>
            </div>
          </div>
          <button type="button" class="mg-cta" id="offline-rex-retry">Try again</button>
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
    this.root.querySelector('#offline-rex-start')?.addEventListener('click', () => {
      this.sfx.ensure();
      this.startRun();
    });
    this.root.querySelector('#offline-rex-retry')?.addEventListener('click', () => {
      this.sfx.ensure();
      this.startRun();
    });

    window.addEventListener('resize', this.boundResize);
    window.addEventListener('keydown', this.boundKey);
    this.canvas.addEventListener('pointerdown', this.boundPointer);

    this.resize();
  }

  async boot(): Promise<void> {
    await runGameBoot(this.root, {
      title: 'OFFLINE REX',
      subtitle: 'Loading run systems…',
      minMs: 900,
    });
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
    this.dinoX = Math.max(56, w * 0.12);
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
    this.sfx.ensure();
    if (this.phase === 'intro' || this.phase === 'dead') {
      this.startRun();
      return;
    }
    if (this.phase === 'playing' && this.isGrounded()) {
      this.dinoVy = this.jumpForce;
      this.sfx.jump();
    }
  }

  private isGrounded(): boolean {
    return this.dinoY >= this.groundY - this.dinoStandH - 0.5;
  }

  private startRun(): void {
    this.scoreCancel?.();
    this.scoreCancel = null;
    this.phase = 'playing';
    this.score = 0;
    this.scoreAnim.snap(0);
    this.lastScoreMilestone = 0;
    this.speed = 6;
    this.obstacles = [];
    this.dust = [];
    this.spawnTimer = 0;
    this.feel.reset();
    this.dinoY = this.groundY - this.dinoStandH;
    this.dinoVy = 0;
    this.ducking = false;
    this.wasGrounded = true;
    this.root.querySelector('#offline-rex-overlay')?.classList.add('mg-overlay-hidden');
    this.updateScoreDisplay(true);
    this.sfx.start();
    window.addEventListener('keyup', this.onKeyUp);
  }

  private gameOver(): void {
    this.phase = 'dead';
    const isRecord = this.score > this.hiScore;
    if (isRecord) {
      this.hiScore = this.score;
      localStorage.setItem('offline-rex-hi', String(this.hiScore));
      const hiEl = this.root.querySelector('.offline-rex-hi');
      if (hiEl) hiEl.textContent = this.hiScore.toLocaleString();
      this.sfx.record();
    } else {
      this.sfx.death();
    }

    this.feel.bumpShake(14);
    this.feel.bumpFlash('#e8367a', 0.45);
    this.feel.spawnBurst(this.dinoX + 20, this.dinoY + 24, '#e8367a', 16, 6);

    this.root.querySelector('#offline-rex-panel-intro')?.classList.add('hidden');
    this.root.querySelector('#offline-rex-panel-dead')?.classList.remove('hidden');
    this.root.querySelector('#offline-rex-overlay')?.classList.remove('mg-overlay-hidden');
    this.root.querySelector('#offline-rex-record')?.classList.toggle('hidden', !isRecord);

    const deadScore = this.root.querySelector('#offline-rex-dead-score') as HTMLElement | null;
    const deadDist = this.root.querySelector('#offline-rex-dead-dist');
    const deadBest = this.root.querySelector('#offline-rex-dead-best');
    if (deadDist) deadDist.textContent = this.score.toLocaleString();
    if (deadBest) deadBest.textContent = this.hiScore.toLocaleString();
    if (deadScore) {
      this.scoreCancel = animateScoreElement(deadScore, this.score);
      deadScore.classList.toggle('is-record', isRecord);
    }

    window.removeEventListener('keyup', this.onKeyUp);
  }

  private updateScoreDisplay(snap = false): void {
    const scoreEl = this.root.querySelector('#offline-rex-score');
    if (scoreEl) scoreEl.textContent = snap ? '0' : this.scoreAnim.formatted();
  }

  private bumpScorePill(): void {
    const pill = this.root.querySelector('#offline-rex-score-pill');
    if (!pill) return;
    pill.classList.remove('mg-hud-pill-bump');
    void (pill as HTMLElement).offsetWidth;
    pill.classList.add('mg-hud-pill-bump');
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.lastTs = performance.now();
  }

  setMuted(muted: boolean): void {
    this.sfx.setMuted(muted);
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
    const shake = this.feel.tick(step);
    this.shakeX = shake.shakeX;
    this.shakeY = shake.shakeY;

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
    this.scoreAnim.set(this.score);
    this.scoreAnim.tick(step);
    this.updateScoreDisplay();

    const milestone = Math.floor(this.score / 500);
    if (milestone > this.lastScoreMilestone) {
      this.lastScoreMilestone = milestone;
      this.sfx.scoreTick();
      this.bumpScorePill();
    }

    this.dinoVy += this.gravity * step;
    this.dinoY += this.dinoVy * step;
    const standTop = this.groundY - (this.ducking ? this.dinoDuckH : this.dinoStandH);
    const grounded = this.dinoY >= standTop - 0.5;
    if (this.dinoY > standTop) {
      this.dinoY = standTop;
      if (!this.wasGrounded && this.dinoVy > 2) this.sfx.land();
      this.dinoVy = 0;
      if (Math.floor(this.animFrame) % 4 === 0) {
        this.dust.push(spawnDust(this.dinoX + 8, this.groundY - 4));
      }
    }
    this.wasGrounded = grounded;

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

    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);

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

    if (this.feel.flash > 0) {
      ctx.fillStyle = this.feel.flashColor;
      ctx.globalAlpha = this.feel.flash * 0.35;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    for (const p of this.feel.particles) {
      ctx.globalAlpha = p.life * 0.7;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  destroy(): void {
    this.running = false;
    this.scoreCancel?.();
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

  handlePlayablesAudio(enabled: boolean): void {
    this.game.setMuted(!enabled);
  }
}

export async function launch(container: HTMLElement, options?: GameLaunchOptions): Promise<GameHandle> {
  const game = new OfflineRexGame(container, options);
  await game.boot();
  return new OfflineRexHandle(game);
}

const offlineRexModule: GameModule = { launch };
export default offlineRexModule;
