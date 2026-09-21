import { SnakeEngine } from '@/games/neon-snake/snakeEngine';
import {
  drawBoard,
  drawParticles,
  drawPopTexts,
  spawnEatParticles,
} from '@/games/neon-snake/snakeRender';
import { SnakeSfx } from '@/games/neon-snake/SnakeSfx';
import {
  GRID_COLS,
  HI_KEY,
  MUTE_KEY,
  type Direction,
  type GameScreen,
  type Particle,
  type PopText,
} from '@/games/neon-snake/snakeTypes';
import { runGameBoot } from '@/games/shared/GameBoot';
import type { GameHandle, GameLaunchOptions, GameModule } from '@/games/types';
import '@/games/neon-snake/snake.css';

const SWIPE_MIN = 28;

function padScore(n: number): string {
  return n.toString().padStart(6, '0');
}

function dirFromKey(code: string): Direction | null {
  switch (code) {
    case 'ArrowUp':
    case 'KeyW':
      return 'up';
    case 'ArrowDown':
    case 'KeyS':
      return 'down';
    case 'ArrowLeft':
    case 'KeyA':
      return 'left';
    case 'ArrowRight':
    case 'KeyD':
      return 'right';
    default:
      return null;
  }
}

export class NeonSnakeGame {
  private container: HTMLElement;
  private root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onExitToHub: (() => void) | null;

  private engine = new SnakeEngine();
  private sfx = new SnakeSfx();
  private screen: GameScreen = 'menu';
  private hiScore = 0;
  private muted = false;
  private reducedMotion = false;

  private cellSize = 20;
  private boardPx = 420;
  private running = false;
  private paused = false;
  private raf = 0;
  private lastTs = 0;
  private tickAccum = 0;
  private shake = 0;
  private particles: Particle[] = [];
  private popTexts: PopText[] = [];
  private levelBannerTimer = 0;
  private runStartMs = 0;
  private readonly startDelayMs = 900;

  private swipeStart: { x: number; y: number } | null = null;

  private boundResize = (): void => this.resize();
  private boundKeyDown = (e: KeyboardEvent): void => this.onKeyDown(e);
  private boundCanvasDown = (e: PointerEvent): void => this.onCanvasDown(e);
  private boundCanvasMove = (e: PointerEvent): void => this.onCanvasMove(e);
  private boundCanvasUp = (e: PointerEvent): void => this.onCanvasUp(e);

  constructor(container: HTMLElement, options?: GameLaunchOptions) {
    this.container = container;
    this.onExitToHub = options?.onExitToHub ?? null;
    this.hiScore = parseInt(localStorage.getItem(HI_KEY) ?? '0', 10) || 0;
    this.muted = localStorage.getItem(MUTE_KEY) === '1';
    this.sfx.setMuted(this.muted);
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.root = document.createElement('div');
    this.root.className = 'snake-root mg-root';
    this.root.innerHTML = this.buildDom();
    container.appendChild(this.root);

    const canvas = this.root.querySelector('#snake-canvas');
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) throw new Error('Snake canvas missing');
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d unavailable');
    this.ctx = ctx;

    this.bindUi();
    window.addEventListener('resize', this.boundResize);
    window.addEventListener('keydown', this.boundKeyDown);
    this.canvas.addEventListener('pointerdown', this.boundCanvasDown, { passive: false });
    this.canvas.addEventListener('pointermove', this.boundCanvasMove, { passive: false });
    this.canvas.addEventListener('pointerup', this.boundCanvasUp);
    this.canvas.addEventListener('pointercancel', this.boundCanvasUp);

    this.resize();
    this.syncHud();
  }

  private buildDom(): string {
    return `
      <header class="snake-chrome">
        <button type="button" class="mg-back" data-action="hub" aria-label="Back to Arcade">
          <span aria-hidden="true">←</span>
          <span>Arcade</span>
        </button>
        <h1 class="snake-title">SNAKE</h1>
        <span aria-hidden="true" style="width:72px"></span>
      </header>

      <div class="snake-stage">
        <div class="snake-hud" aria-live="polite">
          <div class="snake-stat">
            <span class="snake-stat-label">Score</span>
            <span class="snake-stat-value" id="snake-score">${padScore(0)}</span>
          </div>
          <div class="snake-stat">
            <span class="snake-stat-label">High</span>
            <span class="snake-stat-value gold" id="snake-hi">${padScore(this.hiScore)}</span>
          </div>
          <div class="snake-stat">
            <span class="snake-stat-label">Level</span>
            <span class="snake-stat-value" id="snake-level">01</span>
          </div>
        </div>

        <div class="snake-board-wrap" id="snake-board-wrap">
          <canvas id="snake-canvas" class="snake-canvas" role="img" aria-label="Snake game board"></canvas>
          <div class="snake-level-banner" id="snake-level-banner" aria-live="polite">LEVEL UP!</div>
        </div>

        <div class="snake-toolbar">
          <button type="button" class="snake-icon-btn" id="snake-pause" aria-label="Pause game" title="Pause (P)">⏸</button>
          <button type="button" class="snake-icon-btn" id="snake-mute" aria-label="Toggle sound" title="Mute (M)">${this.muted ? '🔇' : '🔊'}</button>
        </div>

        <p class="snake-hint-desktop">Arrow keys / WASD · P pause · M mute · Enter start</p>

        <div class="snake-dpad" aria-label="Direction pad">
          <span class="snake-dpad-empty"></span>
          <button type="button" class="snake-dpad-btn" data-dir="up" aria-label="Move up">▲</button>
          <span class="snake-dpad-empty"></span>
          <button type="button" class="snake-dpad-btn" data-dir="left" aria-label="Move left">◀</button>
          <span class="snake-dpad-btn snake-dpad-center" aria-hidden="true">●</span>
          <button type="button" class="snake-dpad-btn" data-dir="right" aria-label="Move right">▶</button>
          <span class="snake-dpad-empty"></span>
          <button type="button" class="snake-dpad-btn" data-dir="down" aria-label="Move down">▼</button>
          <span class="snake-dpad-empty"></span>
        </div>
      </div>

      <div class="snake-overlay" id="snake-overlay-menu">
        <div class="snake-panel">
          <h2 class="snake-panel-title">SNAKE</h2>
          <p class="snake-panel-tag">Classic gameplay. Freshly remastered.</p>
          <p class="snake-panel-hint">Swipe or use Arrow Keys / WASD</p>
          <button type="button" class="snake-btn snake-btn-primary" id="snake-play">Play</button>
        </div>
      </div>

      <div class="snake-overlay hidden" id="snake-overlay-pause">
        <div class="snake-panel">
          <h2 class="snake-panel-title">Paused</h2>
          <p class="snake-panel-hint">Press P or tap resume</p>
          <div class="snake-panel-actions">
            <button type="button" class="snake-btn snake-btn-primary" id="snake-resume">Resume</button>
            <button type="button" class="snake-btn snake-btn-secondary" data-action="menu">Main Menu</button>
          </div>
        </div>
      </div>

      <div class="snake-overlay hidden" id="snake-overlay-gameover">
        <div class="snake-panel">
          <h2 class="snake-panel-title">Game Over</h2>
          <p class="snake-stat-label">Score</p>
          <p class="snake-panel-score" id="snake-final-score">${padScore(0)}</p>
          <p class="snake-record-badge hidden" id="snake-new-record">New High Score!</p>
          <div class="snake-panel-actions">
            <button type="button" class="snake-btn snake-btn-primary" id="snake-again">Play Again</button>
            <button type="button" class="snake-btn snake-btn-secondary" data-action="menu">Main Menu</button>
          </div>
        </div>
      </div>
    `;
  }

  private bindUi(): void {
    this.root.querySelector('[data-action="hub"]')?.addEventListener('click', () => this.onExitToHub?.());
    this.root.querySelector('#snake-play')?.addEventListener('click', () => this.startGame());
    this.root.querySelector('#snake-again')?.addEventListener('click', () => this.startGame());
    this.root.querySelector('#snake-resume')?.addEventListener('click', () => this.resume());
    this.root.querySelector('#snake-pause')?.addEventListener('click', () => this.togglePause());
    this.root.querySelector('#snake-mute')?.addEventListener('click', () => this.toggleMute());

    this.root.querySelectorAll('[data-action="menu"]').forEach((btn) => {
      btn.addEventListener('click', () => this.showMenu());
    });

    this.root.querySelectorAll('.snake-dpad-btn[data-dir]').forEach((btn) => {
      const dir = (btn as HTMLElement).dataset.dir as Direction;
      const press = (): void => {
        if (this.screen !== 'playing' || this.paused) return;
        this.engine.queueDirection(dir);
        btn.classList.add('is-pressed');
        this.sfx.uiTap();
      };
      const release = (): void => btn.classList.remove('is-pressed');
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); press(); });
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointerleave', release);
      btn.addEventListener('pointercancel', release);
    });
  }

  async boot(): Promise<void> {
    await runGameBoot(this.root, {
      title: 'SNAKE',
      subtitle: 'Loading grid…',
      minMs: 550,
    });
    this.showMenu();
    this.running = true;
    this.lastTs = performance.now();
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  private computeBoardSize(): number {
    const hud = this.root.querySelector('.snake-hud') as HTMLElement | null;
    const toolbar = this.root.querySelector('.snake-toolbar') as HTMLElement | null;
    const dpad = this.root.querySelector('.snake-dpad') as HTMLElement | null;
    const chrome = this.root.querySelector('.snake-chrome') as HTMLElement | null;

    const vh = window.visualViewport?.height ?? window.innerHeight;
    const vw = this.container.clientWidth;

    const chromeH = chrome?.offsetHeight ?? 48;
    const hudH = hud?.offsetHeight ?? 56;
    const toolH = toolbar?.offsetHeight ?? 52;
    const dpadH = dpad && getComputedStyle(dpad).display !== 'none' ? dpad.offsetHeight + 16 : 0;
    const gaps = 48;

    const maxByHeight = vh - chromeH - hudH - toolH - dpadH - gaps;
    const maxByWidth = Math.min(vw * 0.92, 620);

    let board = Math.min(maxByWidth, maxByHeight, 620);
    board = Math.max(260, board);

    this.cellSize = Math.max(12, Math.floor(board / GRID_COLS));
    this.boardPx = this.cellSize * GRID_COLS;
    return this.boardPx;
  }

  private resize(): void {
    this.computeBoardSize();
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.canvas.width = Math.floor(this.boardPx * dpr);
    this.canvas.height = Math.floor(this.boardPx * dpr);
    this.canvas.style.width = `${this.boardPx}px`;
    this.canvas.style.height = `${this.boardPx}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  private showMenu(): void {
    this.screen = 'menu';
    this.paused = false;
    this.tickAccum = 0;
    this.particles = [];
    this.popTexts = [];
    this.engine.reset();
    this.root.querySelector('#snake-overlay-menu')?.classList.remove('hidden');
    this.root.querySelector('#snake-overlay-pause')?.classList.add('hidden');
    this.root.querySelector('#snake-overlay-gameover')?.classList.add('hidden');
    this.syncHud();
    this.draw();
  }

  private startGame(): void {
    this.sfx.ensure();
    this.sfx.start();
    this.engine.startRun();
    this.screen = 'playing';
    this.paused = false;
    this.lastTs = performance.now();
    this.tickAccum = 0;
    this.particles = [];
    this.popTexts = [];
    this.shake = 0;
    this.runStartMs = performance.now();
    this.root.querySelector('#snake-overlay-menu')?.classList.add('hidden');
    this.root.querySelector('#snake-overlay-pause')?.classList.add('hidden');
    this.root.querySelector('#snake-overlay-gameover')?.classList.add('hidden');
    this.syncHud();
    this.draw();
  }

  private togglePause(): void {
    if (this.screen === 'playing') {
      this.paused = !this.paused;
      if (this.paused) {
        this.screen = 'paused';
        this.root.querySelector('#snake-overlay-pause')?.classList.remove('hidden');
      } else {
        this.resume();
      }
      this.sfx.uiTap();
    }
  }

  private resume(): void {
    if (this.screen !== 'paused') return;
    this.screen = 'playing';
    this.paused = false;
    this.lastTs = performance.now();
    this.root.querySelector('#snake-overlay-pause')?.classList.add('hidden');
    this.sfx.uiTap();
  }

  private toggleMute(): void {
    this.muted = !this.muted;
    this.sfx.setMuted(this.muted);
    localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    const btn = this.root.querySelector('#snake-mute');
    if (btn) btn.textContent = this.muted ? '🔇' : '🔊';
    this.sfx.uiTap();
  }

  private endGame(): void {
    this.screen = 'gameover';
    const score = this.engine.state.score;
    const isRecord = score > this.hiScore;
    if (isRecord) {
      this.hiScore = score;
      localStorage.setItem(HI_KEY, String(score));
    }

    if (!this.reducedMotion) {
      this.shake = 6;
      const wrap = this.root.querySelector('#snake-board-wrap');
      wrap?.classList.add('is-shake');
      setTimeout(() => wrap?.classList.remove('is-shake'), 350);
    }

    this.sfx.gameOver();

    const final = this.root.querySelector('#snake-final-score');
    if (final) final.textContent = padScore(score);
    this.root.querySelector('#snake-new-record')?.classList.toggle('hidden', !isRecord);

    this.root.querySelector('#snake-overlay-gameover')?.classList.remove('hidden');
    this.syncHud();
  }

  private syncHud(): void {
    const s = this.engine.state;
    const scoreEl = this.root.querySelector('#snake-score');
    const hiEl = this.root.querySelector('#snake-hi');
    const levelEl = this.root.querySelector('#snake-level');
    if (scoreEl) scoreEl.textContent = padScore(s.score);
    if (hiEl) hiEl.textContent = padScore(this.hiScore);
    if (levelEl) levelEl.textContent = s.level.toString().padStart(2, '0');
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.code === 'KeyP') {
      e.preventDefault();
      this.togglePause();
      return;
    }
    if (e.code === 'KeyM') {
      e.preventDefault();
      this.toggleMute();
      return;
    }
    if (e.code === 'Enter') {
      e.preventDefault();
      if (this.screen === 'menu' || this.screen === 'gameover') this.startGame();
      else if (this.screen === 'paused') this.resume();
      return;
    }

    const dir = dirFromKey(e.code);
    if (dir) {
      e.preventDefault();
      if (this.screen === 'menu' || this.screen === 'gameover') {
        this.startGame();
        return;
      }
      if (this.screen === 'playing' && !this.paused) {
        this.engine.queueDirection(dir);
      }
    }
  }

  private onCanvasDown(e: PointerEvent): void {
    if (this.screen === 'menu' || this.screen === 'gameover') {
      this.startGame();
      return;
    }
    if (this.screen !== 'playing' || this.paused) return;
    e.preventDefault();
    this.swipeStart = { x: e.clientX, y: e.clientY };
  }

  private onCanvasMove(e: PointerEvent): void {
    if (!this.swipeStart || this.screen !== 'playing' || this.paused) return;
    e.preventDefault();
  }

  private onCanvasUp(e: PointerEvent): void {
    if (!this.swipeStart) return;
    const dx = e.clientX - this.swipeStart.x;
    const dy = e.clientY - this.swipeStart.y;
    this.swipeStart = null;

    if (Math.hypot(dx, dy) < SWIPE_MIN) return;

    let dir: Direction;
    if (Math.abs(dx) > Math.abs(dy)) {
      dir = dx > 0 ? 'right' : 'left';
    } else {
      dir = dy > 0 ? 'down' : 'up';
    }
    this.engine.queueDirection(dir);
  }

  private loop(ts: number): void {
    if (!this.running) return;
    const dt = Math.min(48, ts - this.lastTs);
    this.lastTs = ts;

    if (this.screen === 'playing' && !this.paused) {
      const sinceStart = ts - this.runStartMs;
      if (sinceStart >= this.startDelayMs) {
        this.tickAccum += dt;
        const tickMs = this.engine.state.tickMs;
        while (this.tickAccum >= tickMs) {
          this.tickAccum -= tickMs;
          const result = this.engine.step();
          if (result.died) {
            this.endGame();
            break;
          }
          if (result.ate) {
            this.sfx.eat();
            const head = this.engine.state.snake[0]!;
            spawnEatParticles(
              this.particles,
              head.x * this.cellSize + this.cellSize / 2,
              head.y * this.cellSize + this.cellSize / 2,
            );
            this.popTexts.push({
              x: this.engine.state.snake[0]!.x * this.cellSize + this.cellSize / 2,
              y: this.engine.state.snake[0]!.y * this.cellSize,
              text: '+10',
              life: 1,
            });
          }
          if (result.levelUp) {
            this.sfx.levelUp();
            this.showLevelBanner();
          }
          this.syncHud();
        }
      } else {
        this.tickAccum = 0;
      }
    } else {
      this.tickAccum = 0;
    }

    this.updateFx(dt);
    this.draw();

    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  private showLevelBanner(): void {
    if (this.reducedMotion) return;
    const el = this.root.querySelector('#snake-level-banner');
    if (!el) return;
    el.textContent = 'LEVEL UP!';
    el.classList.remove('visible');
    void (el as HTMLElement).offsetWidth;
    el.classList.add('visible');
    this.levelBannerTimer = 900;
  }

  private updateFx(dt: number): void {
    const step = dt / 16.67;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - step * 0.8);
    if (this.levelBannerTimer > 0) {
      this.levelBannerTimer -= dt;
      if (this.levelBannerTimer <= 0) {
        this.root.querySelector('#snake-level-banner')?.classList.remove('visible');
      }
    }
    for (const p of this.particles) {
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.life -= 0.04 * step;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const t of this.popTexts) {
      t.y -= 0.6 * step;
      t.life -= 0.025 * step;
    }
    this.popTexts = this.popTexts.filter((t) => t.life > 0);
  }

  private draw(): void {
    const s = this.engine.state;
    drawBoard(this.ctx, this.cellSize, s.snake, s.food, this.shake, this.reducedMotion);
    drawParticles(this.ctx, this.particles);
    drawPopTexts(this.ctx, this.popTexts, this.cellSize);
  }

  pause(): void {
    if (this.screen === 'playing') {
      this.paused = true;
      this.screen = 'paused';
      this.root.querySelector('#snake-overlay-pause')?.classList.remove('hidden');
    }
  }

  resumeExternal(): void {
    this.resume();
  }

  setAudioMuted(muted: boolean): void {
    this.muted = muted;
    this.sfx.setMuted(muted);
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    const btn = this.root.querySelector('#snake-mute');
    if (btn) btn.textContent = muted ? '🔇' : '🔊';
  }

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.boundResize);
    window.removeEventListener('keydown', this.boundKeyDown);
    this.canvas.removeEventListener('pointerdown', this.boundCanvasDown);
    this.canvas.removeEventListener('pointermove', this.boundCanvasMove);
    this.canvas.removeEventListener('pointerup', this.boundCanvasUp);
    this.canvas.removeEventListener('pointercancel', this.boundCanvasUp);
    this.root.remove();
  }
}

class NeonSnakeHandle implements GameHandle {
  constructor(private game: NeonSnakeGame) {}

  destroy(): void {
    this.game.destroy();
  }

  handlePlayablesPause(): void {
    this.game.pause();
  }

  handlePlayablesResume(): void {
    this.game.resumeExternal();
  }

  handlePlayablesAudio(enabled: boolean): void {
    this.game.setAudioMuted(!enabled);
  }
}

export async function launch(container: HTMLElement, options?: GameLaunchOptions): Promise<GameHandle> {
  const game = new NeonSnakeGame(container, options);
  await game.boot();
  return new NeonSnakeHandle(game);
}

const module: GameModule = { launch };
export default module;
