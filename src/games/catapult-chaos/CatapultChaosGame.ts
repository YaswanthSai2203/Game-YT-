import { CHARACTERS, DEFAULT_CHARACTER } from '@/games/catapult-chaos/config/characters';
import { buildGreenValleyObjects, GREEN_VALLEY_LEVEL } from '@/games/catapult-chaos/config/levelGreenValley';
import {
  CC_PALETTE,
  drawCatapult,
  drawFloatingText,
  drawGroundFill,
  drawPlayer,
  drawSky,
  drawTrajectoryPreview,
  drawWindIndicator,
  drawWorldObject,
  powerZoneColor,
} from '@/games/catapult-chaos/catapultChaosRender';
import { ComboManager } from '@/games/catapult-chaos/systems/ComboManager';
import { PhysicsWorld } from '@/games/catapult-chaos/systems/PhysicsWorld';
import { ScoreManager } from '@/games/catapult-chaos/systems/ScoreManager';
import type { GamePhase, PowerZone, ScoreBreakdown } from '@/games/catapult-chaos/types';
import type { GameHandle, GameLaunchOptions, GameModule } from '@/games/types';
import '@/games/catapult-chaos/catapultChaos.css';

const HI_KEY = 'catapult-chaos-hi';

interface FloatText {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
}

export class CatapultChaosGame {
  private container: HTMLElement;
  private root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onExitToHub: (() => void) | null;
  private raf = 0;
  private running = false;
  private paused = false;
  private lastTs = 0;

  private phase: GamePhase = 'intro';
  private physics = new PhysicsWorld();
  private combo = new ComboManager();
  private score = new ScoreManager();
  private characterId = DEFAULT_CHARACTER;
  private hiScore = 0;

  private groundY = 0;
  private launchAngle = 0.75;
  private powerMeter = 0;
  private powerDir = 1;
  private powerZone: PowerZone = 'good';
  private airInput = 0;
  private abilityReady = true;
  private abilityTimer = 0;
  private settleTimer = 0;
  private camX = 0;
  private camY = 0;
  private floatTexts: FloatText[] = [];
  private flipAccumulator = 0;
  private lastAngle = 0;
  private slowMo = 0;
  private pulse = 0;

  private boundResize = (): void => this.resize();
  private boundKeyDown = (e: KeyboardEvent): void => this.onKeyDown(e);
  private boundKeyUp = (e: KeyboardEvent): void => this.onKeyUp(e);
  private boundPointerDown = (e: PointerEvent): void => this.onPointerDown(e);
  private boundPointerMove = (e: PointerEvent): void => this.onPointerMove(e);
  private boundPointerUp = (): void => this.onPointerUp();

  constructor(container: HTMLElement, options?: GameLaunchOptions) {
    this.container = container;
    this.onExitToHub = options?.onExitToHub ?? null;
    this.hiScore = parseInt(localStorage.getItem(HI_KEY) ?? '0', 10) || 0;

    this.root = document.createElement('div');
    this.root.className = 'cc-root';
    this.root.innerHTML = this.buildDom();
    container.appendChild(this.root);

    const canvas = this.root.querySelector('canvas');
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) throw new Error('Canvas missing');
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d unavailable');
    this.ctx = ctx;

    this.root.querySelector('[data-action="hub"]')?.addEventListener('click', () => this.onExitToHub?.());
    this.root.querySelector('[data-action="retry"]')?.addEventListener('click', () => this.startRun());
    this.root.querySelector('[data-action="start"]')?.addEventListener('click', () => this.enterPrepare());
    this.root.querySelector('#cc-power-btn')?.addEventListener('click', () => this.beginPowerPhase());
    this.root.querySelector('#cc-ability')?.addEventListener('click', () => this.useAbility());

    window.addEventListener('resize', this.boundResize);
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    this.canvas.addEventListener('pointerdown', this.boundPointerDown);
    this.canvas.addEventListener('pointermove', this.boundPointerMove);
    window.addEventListener('pointerup', this.boundPointerUp);

    this.resize();
    this.initLevel();
    this.running = true;
    this.lastTs = performance.now();
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  private buildDom(): string {
    return `
      <div class="cc-chrome">
        <button type="button" class="cc-back" data-action="hub">
          <span class="ms-icon" aria-hidden="true">arrow_back</span>
          <span>Arcade</span>
        </button>
        <div class="cc-hud" id="cc-hud">
          <div class="cc-hud-pill"><span class="cc-hud-label">DIST</span><span id="cc-dist">0m</span></div>
          <div class="cc-hud-pill cc-hud-combo"><span class="cc-hud-label">COMBO</span><span id="cc-combo">×0</span></div>
        </div>
      </div>
      <canvas class="cc-canvas" aria-label="Catapult Chaos"></canvas>
      <div class="cc-overlay" id="cc-overlay">
        <div class="cc-panel" id="cc-panel-intro">
          <p class="cc-eyebrow">World 1 — Green Valley</p>
          <h1 class="cc-title">CATAPULT CHAOS</h1>
          <p class="cc-sub">Every shot is a calculated disaster.</p>
          <p class="cc-hint">Aim · Power · Air control · Chain reactions</p>
          <button type="button" class="cc-cta" data-action="start">Enter range</button>
        </div>
        <div class="cc-panel hidden" id="cc-panel-prepare">
          <p class="cc-eyebrow">Prepare launch</p>
          <p class="cc-prepare-wind" id="cc-wind-text"></p>
          <p class="cc-hint">Drag to aim · Tap when ready for power</p>
          <button type="button" class="cc-cta" id="cc-power-btn">Set power</button>
        </div>
        <div class="cc-power-ui hidden" id="cc-power-ui">
          <p class="cc-power-label">Release on PERFECT</p>
          <div class="cc-power-track">
            <div class="cc-power-zones">
              <span>Weak</span><span>Good</span><span>Perfect</span><span>Overload</span>
            </div>
            <div class="cc-power-bar"><div class="cc-power-fill" id="cc-power-fill"></div></div>
          </div>
        </div>
        <div class="cc-panel hidden" id="cc-panel-results">
          <p class="cc-eyebrow">Run complete</p>
          <p class="cc-results-total" id="cc-results-total">0</p>
          <div class="cc-results-grid" id="cc-results-grid"></div>
          <p class="cc-results-record hidden" id="cc-results-record">NEW PERSONAL BEST</p>
          <p class="cc-results-near hidden" id="cc-results-near"></p>
          <button type="button" class="cc-cta" data-action="retry">Play again</button>
        </div>
      </div>
      <button type="button" class="cc-ability hidden" id="cc-ability" aria-label="Ability">⚡</button>
    `;
  }

  private initLevel(): void {
    const h = this.canvas.clientHeight;
    this.groundY = h * 0.72;
    const objects = buildGreenValleyObjects(this.groundY);
    const spawn = { x: GREEN_VALLEY_LEVEL.catapult.x + 60, y: this.groundY - 50 };
    this.physics.reset(objects, this.groundY, GREEN_VALLEY_LEVEL.wind, spawn);
    this.camX = 0;
    this.camY = 0;
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
    this.groundY = h * 0.72;
  }

  private enterPrepare(): void {
    this.phase = 'prepare';
    this.showPanel('cc-panel-prepare');
    const windEl = this.root.querySelector('#cc-wind-text');
    if (windEl) {
      const kmh = Math.abs(GREEN_VALLEY_LEVEL.wind * 40).toFixed(0);
      const dir = GREEN_VALLEY_LEVEL.wind > 0 ? '→' : '←';
      windEl.textContent = `Wind ${kmh} km/h ${dir} · ${GREEN_VALLEY_LEVEL.weather}`;
    }
    this.initLevel();
    this.combo.reset();
    this.score.reset();
    this.launchAngle = 0.75;
    this.phase = 'aim';
  }

  private startRun(): void {
    this.hideAllPanels();
    this.enterPrepare();
    this.phase = 'aim';
  }

  private beginPowerPhase(): void {
    this.phase = 'power';
    this.root.querySelector('#cc-panel-prepare')?.classList.add('hidden');
    this.root.querySelector('#cc-power-ui')?.classList.remove('hidden');
    this.powerMeter = 0;
    this.powerDir = 1;
  }

  private launch(): void {
    const charDef = CHARACTERS[this.characterId]!;
    const basePower = 11 + this.powerMeter * 14;
    const zoneBonus = this.powerZone === 'perfect' ? 1.12 : this.powerZone === 'good' ? 1.04 : this.powerZone === 'overload' ? 0.92 : 0.85;
    const vx = Math.cos(-this.launchAngle) * basePower * zoneBonus;
    const vy = Math.sin(-this.launchAngle) * basePower * zoneBonus;
    this.physics.player.mass = charDef.mass;
    this.physics.launchPlayer(vx, vy);
    this.score.setPrecision(this.powerZone === 'perfect', this.powerZone === 'perfect' ? 2500 : this.powerZone === 'good' ? 800 : 0);
    this.phase = 'flying';
    this.root.querySelector('#cc-power-ui')?.classList.add('hidden');
    this.root.querySelector('#cc-overlay')?.classList.add('cc-overlay-hidden');
    this.root.querySelector('#cc-ability')?.classList.remove('hidden');
    this.abilityReady = true;
    this.abilityTimer = 0;
    this.settleTimer = 0;
    this.flipAccumulator = 0;
    this.lastAngle = this.physics.player.angle;
  }

  private endRun(): void {
    this.phase = 'results';
    this.root.querySelector('#cc-overlay')?.classList.remove('cc-overlay-hidden');
    this.root.querySelector('#cc-ability')?.classList.add('hidden');
    const bd = this.score.breakdown();
    const isRecord = bd.total > this.hiScore;
    if (isRecord) {
      this.hiScore = bd.total;
      localStorage.setItem(HI_KEY, String(this.hiScore));
    }
    this.showResults(bd, isRecord);
  }

  private showResults(bd: ScoreBreakdown, isRecord: boolean): void {
    this.showPanel('cc-panel-results');
    const totalEl = this.root.querySelector('#cc-results-total');
    if (totalEl) totalEl.textContent = bd.total.toLocaleString();
    const grid = this.root.querySelector('#cc-results-grid');
    if (grid) {
      grid.innerHTML = `
        <div class="cc-result-row"><span>Distance</span><span>${bd.distance.toLocaleString()}</span></div>
        <div class="cc-result-row"><span>Destruction</span><span>${bd.destruction.toLocaleString()}</span></div>
        <div class="cc-result-row"><span>Style</span><span>${bd.style.toLocaleString()}</span></div>
        <div class="cc-result-row"><span>Discovery</span><span>${bd.discovery.toLocaleString()}</span></div>
        <div class="cc-result-row"><span>Combo</span><span>${bd.combo.toLocaleString()}</span></div>
        <div class="cc-result-row"><span>Precision</span><span>${bd.precision.toLocaleString()}</span></div>
      `;
    }
    const rec = this.root.querySelector('#cc-results-record');
    rec?.classList.toggle('hidden', !isRecord);
    const near = this.root.querySelector('#cc-results-near');
    if (near && !isRecord && this.hiScore > 0) {
      const gap = this.hiScore - bd.total;
      near.textContent = `${gap.toLocaleString()} from your best — chain more combos!`;
      near.classList.remove('hidden');
    } else {
      near?.classList.add('hidden');
    }
  }

  private showPanel(id: string): void {
    this.hideAllPanels();
    this.root.querySelector(`#${id}`)?.classList.remove('hidden');
    this.root.querySelector('#cc-overlay')?.classList.remove('cc-overlay-hidden');
  }

  private hideAllPanels(): void {
    this.root.querySelectorAll('.cc-panel, #cc-power-ui').forEach((el) => el.classList.add('hidden'));
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.airInput = -1;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') this.airInput = 1;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      this.handlePrimaryAction();
    }
    if (e.code === 'ShiftLeft' || e.code === 'KeyE') this.useAbility();
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'ArrowRight' || e.code === 'KeyD') {
      this.airInput = 0;
    }
  }

  private aimPointerY: number | null = null;

  private onPointerDown(e: PointerEvent): void {
    if (this.phase === 'aim') this.aimPointerY = e.clientY;
    if (this.phase === 'power') this.releasePower();
    if (this.phase === 'flying') {
      const rect = this.canvas.getBoundingClientRect();
      if (e.clientX < rect.left + rect.width * 0.5) this.airInput = -1;
      else this.airInput = 1;
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.phase === 'aim' && this.aimPointerY !== null) {
      const dy = this.aimPointerY - e.clientY;
      this.launchAngle = Math.max(0.25, Math.min(1.35, 0.75 + dy * 0.004));
    }
  }

  private onPointerUp(): void {
    this.aimPointerY = null;
    if (this.phase === 'flying') this.airInput = 0;
  }

  private handlePrimaryAction(): void {
    if (this.phase === 'intro') this.enterPrepare();
    else if (this.phase === 'aim') this.beginPowerPhase();
    else if (this.phase === 'power') this.releasePower();
    else if (this.phase === 'results') this.startRun();
  }

  private releasePower(): void {
    if (this.phase !== 'power') return;
    this.launch();
  }

  private useAbility(): void {
    if (this.phase !== 'flying' || !this.abilityReady) return;
    const p = this.physics.player;
    const speed = Math.hypot(p.vx, p.vy) || 1;
    this.physics.applyAbilityBurst((p.vx / speed) * 5, (p.vy / speed) * 5 - 3);
    this.abilityReady = false;
    this.abilityTimer = CHARACTERS[this.characterId]!.abilityCooldown * 60;
    const r = this.combo.registerStyle('Grapple', 600);
    this.addFloatText(p.x, p.y - 20, `+${r.points}  Hook`, CC_PALETTE.violet);
    this.slowMo = 0.4;
  }

  private addFloatText(x: number, y: number, text: string, color: string): void {
    this.floatTexts.push({ x, y, text, life: 1, color });
  }

  pause(): void { this.paused = true; }
  resume(): void { this.paused = false; this.lastTs = performance.now(); }

  private loop(ts: number): void {
    if (!this.running) return;
    const dt = Math.min(2.5, (ts - this.lastTs) / 16.67);
    this.lastTs = ts;
    if (!this.paused) {
      this.update(dt);
      this.draw();
    }
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number): void {
    this.pulse += dt * 0.05;
    if (this.slowMo > 0) this.slowMo = Math.max(0, this.slowMo - dt * 0.02);

    if (this.phase === 'power') {
      this.powerMeter += this.powerDir * dt * 0.035;
      if (this.powerMeter >= 1) { this.powerMeter = 1; this.powerDir = -1; }
      if (this.powerMeter <= 0) { this.powerMeter = 0; this.powerDir = 1; }
      if (this.powerMeter < 0.25) this.powerZone = 'weak';
      else if (this.powerMeter < 0.55) this.powerZone = 'good';
      else if (this.powerMeter < 0.78) this.powerZone = 'perfect';
      else this.powerZone = 'overload';
      const fill = this.root.querySelector('#cc-power-fill') as HTMLElement | null;
      if (fill) {
        fill.style.width = `${this.powerMeter * 100}%`;
        fill.style.background = powerZoneColor(this.powerZone);
      }
    }

    if (this.phase === 'flying' || this.phase === 'settling') {
      const charDef = CHARACTERS[this.characterId]!;
      const step = dt * (this.slowMo > 0 ? 0.55 : 1);
      this.physics.step(step, this.airInput * charDef.airControl, charDef.drag);

      const p = this.physics.player;
      const meters = Math.max(0, Math.round((p.x - GREEN_VALLEY_LEVEL.catapult.x) / 8));
      this.score.updateDistance(meters);
      this.score.setComboScore(this.combo.comboScore, this.combo.maxCombo);

      // Flip detection
      const delta = p.angle - this.lastAngle;
      this.flipAccumulator += Math.abs(delta);
      this.lastAngle = p.angle;
      if (this.flipAccumulator > Math.PI * 1.8) {
        this.flipAccumulator = 0;
        const r = this.combo.registerStyle('Flip', 850);
        this.score.addStyle(r.points, 1);
        this.addFloatText(p.x, p.y - 30, `+${r.points}  Flip`, CC_PALETTE.gold);
      }

      for (const ev of this.physics.drainEvents()) {
        const r = this.combo.register(ev);
        if (r) {
          this.addFloatText(p.x, p.y - 24, `+${r.points}  ×${r.combo}`, CC_PALETTE.cyan);
          if (ev.kind === 'break') this.score.addDestruction(r.points);
          if (ev.kind === 'collect' && ev.objectType === 'coin') this.score.addCoin();
          if (r.combo >= 5) this.slowMo = 0.35;
        }
        if (ev.kind === 'kill') {
          this.phase = 'settling';
        }
      }

      this.combo.tick(dt);

      if (this.abilityTimer > 0) {
        this.abilityTimer -= dt;
        if (this.abilityTimer <= 0) this.abilityReady = true;
      }

      // Camera
      const targetX = p.x - this.canvas.clientWidth * 0.28;
      const targetY = p.y - this.canvas.clientHeight * 0.45;
      this.camX += (targetX - this.camX) * 0.08 * dt;
      this.camY += (targetY - this.camY) * 0.06 * dt;

      // Settle / end
      const speed = Math.hypot(p.vx, p.vy);
      if (this.phase === 'settling' || (p.onGround && speed < 1.2)) {
        this.settleTimer += dt;
        if (this.settleTimer > 45 || !p.alive) this.endRun();
      } else {
        this.settleTimer = 0;
      }

      if (p.x > GREEN_VALLEY_LEVEL.width) this.endRun();

      const distEl = this.root.querySelector('#cc-dist');
      const comboEl = this.root.querySelector('#cc-combo');
      if (distEl) distEl.textContent = `${meters.toLocaleString()}m`;
      if (comboEl) comboEl.textContent = `×${this.combo.combo}`;
    }

    for (const ft of this.floatTexts) {
      ft.y -= 0.8 * dt;
      ft.life -= 0.018 * dt;
    }
    this.floatTexts = this.floatTexts.filter((f) => f.life > 0);
  }

  private draw(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const ctx = this.ctx;
    const level = GREEN_VALLEY_LEVEL;
    const catapultX = level.catapult.x;
    const catapultY = this.groundY - 28;

    drawSky(ctx, w, h, this.camX);
    drawGroundFill(ctx, w, h, this.groundY - this.camY);

    for (const o of this.physics.objects) {
      drawWorldObject(ctx, o, this.camX, this.camY, this.physics.time);
    }

    if (this.phase === 'aim' || this.phase === 'prepare' || this.phase === 'power') {
      const power = 11 + this.powerMeter * 14;
      drawTrajectoryPreview(
        ctx,
        catapultX + 60,
        this.groundY - 50,
        -this.launchAngle,
        power,
        level.wind,
        this.camX,
        this.camY,
      );
      drawCatapult(ctx, catapultX - this.camX, catapultY - this.camY, this.launchAngle, this.phase === 'power' ? 0.3 : 0);
      drawPlayer(ctx, this.physics.player, this.camX, this.camY, 'stable', true);
    } else {
      drawCatapult(ctx, catapultX - this.camX, catapultY - this.camY, 0.5, 0);
      drawPlayer(ctx, this.physics.player, this.camX, this.camY, this.physics.player.momentum, false);
    }

    drawFloatingText(ctx, this.floatTexts, this.camX, this.camY);
    drawWindIndicator(ctx, w, level.wind);

    if (this.phase === 'intro') {
      ctx.fillStyle = CC_PALETTE.cyan;
      ctx.globalAlpha = 0.4 + Math.sin(this.pulse * 3) * 0.15;
      ctx.font = '600 11px Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▶  TAP TO START', w / 2, h * 0.55);
      ctx.globalAlpha = 1;
    }
  }

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.boundResize);
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    this.canvas.removeEventListener('pointerdown', this.boundPointerDown);
    this.canvas.removeEventListener('pointermove', this.boundPointerMove);
    window.removeEventListener('pointerup', this.boundPointerUp);
    this.root.remove();
  }
}

class CatapultChaosHandle implements GameHandle {
  constructor(private game: CatapultChaosGame) {}
  destroy(): void { this.game.destroy(); }
  handlePlayablesPause(): void { this.game.pause(); }
  handlePlayablesResume(): void { this.game.resume(); }
  handlePlayablesAudio(): void { /* no audio yet */ }
}

export async function launch(container: HTMLElement, options?: GameLaunchOptions): Promise<GameHandle> {
  return new CatapultChaosHandle(new CatapultChaosGame(container, options));
}

const module: GameModule = { launch };
export default module;
