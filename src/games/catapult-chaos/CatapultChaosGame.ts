import { CHARACTERS, DEFAULT_CHARACTER } from '@/games/catapult-chaos/config/characters';
import { buildGreenValleyObjects, GREEN_VALLEY_LEVEL } from '@/games/catapult-chaos/config/levelGreenValley';
import {
  CC_PALETTE,
  drawCatapult,
  drawComboBanner,
  drawFloatingText,
  drawGroundFill,
  drawLaunchHud,
  drawParticles,
  drawPlayer,
  drawScreenFlash,
  drawSky,
  drawTrajectoryPreview,
  drawWindIndicator,
  drawWorldObject,
} from '@/games/catapult-chaos/catapultChaosRender';
import { AnimatedNumber } from '@/games/shared/AnimatedNumber';
import { animateScoreElement } from '@/games/shared/animateScore';
import { runGameBoot } from '@/games/shared/GameBoot';
import { CatapultSfx } from '@/games/catapult-chaos/systems/CatapultSfx';
import { ComboManager } from '@/games/catapult-chaos/systems/ComboManager';
import { FeelEffects } from '@/games/catapult-chaos/systems/FeelEffects';
import { PhysicsWorld } from '@/games/catapult-chaos/systems/PhysicsWorld';
import { ScoreManager } from '@/games/catapult-chaos/systems/ScoreManager';
import type { GamePhase, PowerZone, ScoreBreakdown } from '@/games/catapult-chaos/types';
import type { GameHandle, GameLaunchOptions, GameModule } from '@/games/types';
import '@/games/catapult-chaos/catapultChaos.css';

const HI_KEY = 'catapult-chaos-hi';
const HI_COMBO_KEY = 'catapult-chaos-hi-combo';
const DIST_MILESTONES = [500, 1000, 2000, 3500, 5000];

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
  private distAnim = new AnimatedNumber();
  private comboAnim = new AnimatedNumber();
  private scoreCancel: (() => void) | null = null;
  private physics = new PhysicsWorld();
  private combo = new ComboManager();
  private score = new ScoreManager();
  private characterId = DEFAULT_CHARACTER;
  private hiScore = 0;
  private hiCombo = 0;
  private sfx = new CatapultSfx();
  private feel = new FeelEffects();
  private lastPowerZone: PowerZone = 'good';
  private shakeX = 0;
  private shakeY = 0;

  private groundY = 0;
  private launchAngle = 0.75;
  private powerMeter = 0;
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

  private launchHold = { active: false, pointerId: -1, startY: 0, startAngle: 0.75 };
  private spaceHeld = false;

  private boundResize = (): void => this.resize();
  private boundKeyDown = (e: KeyboardEvent): void => this.onKeyDown(e);
  private boundKeyUp = (e: KeyboardEvent): void => this.onKeyUp(e);
  private boundPointerDown = (e: PointerEvent): void => this.onPointerDown(e);
  private boundPointerMove = (e: PointerEvent): void => this.onPointerMove(e);
  private boundPointerUp = (e: PointerEvent): void => this.onPointerUp(e);
  private boundPointerCancel = (e: PointerEvent): void => this.onPointerUp(e);

  constructor(container: HTMLElement, options?: GameLaunchOptions) {
    this.container = container;
    this.onExitToHub = options?.onExitToHub ?? null;
    this.hiScore = parseInt(localStorage.getItem(HI_KEY) ?? '0', 10) || 0;
    this.hiCombo = parseInt(localStorage.getItem(HI_COMBO_KEY) ?? '0', 10) || 0;

    this.root = document.createElement('div');
    this.root.className = 'cc-root mg-root';
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
    this.root.querySelector('[data-action="intro"]')?.addEventListener('click', () => this.beginFromIntro());
    this.root.querySelector('#cc-ability')?.addEventListener('click', () => this.useAbility());

    window.addEventListener('resize', this.boundResize);
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    this.canvas.addEventListener('pointerdown', this.boundPointerDown, { passive: false });
    window.addEventListener('pointermove', this.boundPointerMove, { passive: false });
    window.addEventListener('pointerup', this.boundPointerUp);
    window.addEventListener('pointercancel', this.boundPointerCancel);

    this.resize();
    this.initLevel();
  }

  async boot(): Promise<void> {
    await runGameBoot(this.root, {
      title: 'CATAPULT CHAOS',
      subtitle: 'Charging launch systems…',
      minMs: 650,
    });
    this.beginLaunchSetup();
    this.running = true;
    this.lastTs = performance.now();
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  private buildDom(): string {
    return `
      <div class="mg-chrome">
        <button type="button" class="mg-back" data-action="hub">
          <span aria-hidden="true">←</span>
          <span>Arcade</span>
        </button>
        <div class="mg-hud" id="cc-hud">
          <div class="mg-hud-pill mg-hud-pill-accent">
            <span class="mg-hud-label">Distance</span>
            <span class="mg-hud-value mg-hud-value-live" id="cc-dist">0m</span>
          </div>
          <div class="mg-hud-pill mg-hud-pill-gold">
            <span class="mg-hud-label">Combo</span>
            <span class="mg-hud-value mg-hud-value-gold" id="cc-combo">×0</span>
          </div>
        </div>
      </div>
      <canvas class="cc-canvas" aria-label="Catapult Chaos"></canvas>
      <div class="mg-overlay" id="cc-overlay">
        <div class="mg-panel" id="cc-panel-intro">
          <p class="mg-eyebrow">Green Valley</p>
          <h1 class="mg-title">CATAPULT CHAOS</h1>
          <p class="mg-sub">Aim, charge, launch. Chain combos through the valley.</p>
          <p class="mg-hint">Hold & drag to aim · Release to launch · Steer in the air</p>
          <button type="button" class="mg-cta" data-action="intro">Play</button>
        </div>
        <div class="mg-panel hidden" id="cc-panel-results">
          <p class="mg-eyebrow">Run complete</p>
          <p class="mg-badge hidden" id="cc-results-record">New personal best</p>
          <p class="cc-results-total" id="cc-results-total">0</p>
          <div class="cc-results-grid" id="cc-results-grid"></div>
          <div class="cc-results-tips" id="cc-results-tips"></div>
          <p class="cc-results-near hidden" id="cc-results-near"></p>
          <button type="button" class="mg-cta" data-action="retry">Play again</button>
        </div>
      </div>
      <button type="button" class="cc-ability hidden" id="cc-ability" aria-label="Ability">⚡</button>
    `;
  }

  private beginFromIntro(): void {
    this.sfx.ensure();
    this.beginLaunchSetup();
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
    this.ctx.imageSmoothingEnabled = true;
    this.groundY = h * 0.72;
  }

  private beginLaunchSetup(): void {
    this.scoreCancel?.();
    this.scoreCancel = null;
    this.initLevel();
    this.combo.reset();
    this.score.reset();
    this.feel.reset();
    this.distAnim.snap(0);
    this.comboAnim.snap(0);
    this.lastPowerZone = 'good';
    this.launchAngle = 0.75;
    this.powerMeter = 0;
    this.launchHold.active = false;
    this.spaceHeld = false;
    this.phase = 'launch';
    this.camX = 0;
    this.camY = 0;
    this.root.classList.add('cc-playing');
    this.root.querySelector('#cc-overlay')?.classList.add('mg-overlay-hidden');
    this.root.querySelector('#cc-ability')?.classList.add('hidden');
    const p = this.physics.player;
    p.x = GREEN_VALLEY_LEVEL.catapult.x + 60;
    p.y = this.groundY - 50;
    p.vx = 0;
    p.vy = 0;
    p.alive = true;
    p.momentum = 'stable';
  }

  private startRun(): void {
    this.hideAllPanels();
    this.root.querySelector('#cc-overlay')?.classList.add('mg-overlay-hidden');
    this.beginLaunchSetup();
  }

  private updatePowerZone(): void {
    if (this.powerMeter < 0.25) this.powerZone = 'weak';
    else if (this.powerMeter < 0.55) this.powerZone = 'good';
    else if (this.powerMeter < 0.78) this.powerZone = 'perfect';
    else this.powerZone = 'overload';
    if (this.powerZone === 'perfect' && this.lastPowerZone !== 'perfect') {
      this.sfx.powerTick('perfect');
    }
    this.lastPowerZone = this.powerZone;
  }

  private launch(): void {
    const charDef = CHARACTERS[this.characterId]!;
    const safePower = Math.min(Math.max(this.powerMeter, 0.12), 0.78);
    const basePower = 9 + safePower * 11;
    const zoneBonus = this.powerZone === 'perfect' ? 1.12 : this.powerZone === 'good' ? 1.04 : this.powerZone === 'overload' ? 0.92 : 0.85;
    const vx = Math.cos(-this.launchAngle) * basePower * zoneBonus;
    const vy = Math.sin(-this.launchAngle) * basePower * zoneBonus;
    this.physics.player.mass = charDef.mass;
    this.physics.player.impactResist = charDef.impactResist;
    this.physics.launchPlayer(vx, vy);
    this.score.setPrecision(this.powerZone === 'perfect', this.powerZone === 'perfect' ? 2500 : this.powerZone === 'good' ? 800 : 0);
    const perfect = this.powerZone === 'perfect';
    this.sfx.launch(perfect);
    if (perfect) {
      this.feel.bumpFlash('#ffd54f', 0.35);
      this.feel.bumpShake(6);
      this.feel.spawnBurst(
        GREEN_VALLEY_LEVEL.catapult.x + 60,
        this.groundY - 50,
        '#ffd54f',
        14,
        5,
      );
    } else {
      this.feel.bumpShake(3);
    }
    this.phase = 'flying';
    this.root.querySelector('#cc-ability')?.classList.remove('hidden');
    this.abilityReady = true;
    this.abilityTimer = 0;
    this.settleTimer = 0;
    this.flipAccumulator = 0;
    this.lastAngle = this.physics.player.angle;
  }

  private endRun(): void {
    this.phase = 'results';
    this.root.classList.remove('cc-playing');
    this.root.querySelector('#cc-overlay')?.classList.remove('mg-overlay-hidden');
    this.root.querySelector('#cc-ability')?.classList.add('hidden');
    const bd = this.score.breakdown();
    const isRecord = bd.total > this.hiScore;
    const comboRecord = this.score.stats.maxCombo > this.hiCombo;
    if (isRecord) {
      this.hiScore = bd.total;
      localStorage.setItem(HI_KEY, String(this.hiScore));
      this.sfx.resultsRecord();
    }
    if (comboRecord) {
      this.hiCombo = this.score.stats.maxCombo;
      localStorage.setItem(HI_COMBO_KEY, String(this.hiCombo));
    }
    this.showResults(bd, isRecord);
  }

  private countCoinsLeft(): number {
    return this.physics.objects.filter((o) => o.type === 'coin' && o.alive).length;
  }

  private nextDistanceGoal(meters: number): number | null {
    for (const m of DIST_MILESTONES) {
      if (meters < m) return m;
    }
    return null;
  }

  private showResults(bd: ScoreBreakdown, isRecord: boolean): void {
    this.showPanel('cc-panel-results');
    const totalEl = this.root.querySelector('#cc-results-total') as HTMLElement | null;
    if (totalEl) {
      totalEl.classList.toggle('is-record', isRecord);
      this.scoreCancel = animateScoreElement(totalEl, bd.total);
    }
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

    const tipsEl = this.root.querySelector('#cc-results-tips');
    const tips: string[] = [];
    const meters = this.score.stats.maxDistance;
    const coinsLeft = this.countCoinsLeft();
    const nextDist = this.nextDistanceGoal(meters);

    if (coinsLeft > 0) tips.push(`${coinsLeft} coin${coinsLeft > 1 ? 's' : ''} still out there`);
    if (nextDist) tips.push(`${(nextDist - meters).toLocaleString()}m to ${nextDist.toLocaleString()}m goal`);
    if (this.score.stats.maxCombo < this.hiCombo && this.hiCombo > 0) {
      tips.push(`Beat your ×${this.hiCombo} combo record`);
    }
    if (!isRecord && this.hiScore > 0) {
      tips.push(`${(this.hiScore - bd.total).toLocaleString()} pts from personal best`);
    }
    if (tipsEl) {
      tipsEl.innerHTML = tips.map((t) => `<p class="cc-result-tip">${t}</p>`).join('');
    }

    const near = this.root.querySelector('#cc-results-near');
    if (near) {
      near.textContent = tips.length > 0 ? 'One more run could change everything.' : '';
      near.classList.toggle('hidden', tips.length === 0);
    }
  }

  private showPanel(id: string): void {
    this.hideAllPanels();
    this.root.querySelector(`#${id}`)?.classList.remove('hidden');
    this.root.querySelector('#cc-overlay')?.classList.remove('mg-overlay-hidden');
  }

  private hideAllPanels(): void {
    this.root.querySelectorAll('.mg-panel').forEach((el) => el.classList.add('hidden'));
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (this.phase === 'launch') {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        this.launchAngle = Math.min(1.35, this.launchAngle + 0.04);
        return;
      }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        this.launchAngle = Math.max(0.25, this.launchAngle - 0.04);
        return;
      }
      if ((e.code === 'Space' || e.code === 'Enter') && !this.spaceHeld) {
        e.preventDefault();
        this.spaceHeld = true;
        this.powerMeter = 0;
        return;
      }
    }
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.airInput = -1;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') this.airInput = 1;
    if (e.code === 'ShiftLeft' || e.code === 'KeyE') this.useAbility();
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (this.phase === 'launch' && (e.code === 'Space' || e.code === 'Enter') && this.spaceHeld) {
      e.preventDefault();
      this.spaceHeld = false;
      this.launch();
      return;
    }
    if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'ArrowRight' || e.code === 'KeyD') {
      this.airInput = 0;
    }
  }

  private onPointerDown(e: PointerEvent): void {
    if ((e.target as HTMLElement).closest('.mg-back, .mg-cta, .cc-ability, .mg-panel')) return;
    this.sfx.ensure();
    if (this.phase === 'intro') {
      this.beginFromIntro();
      return;
    }
    if (this.phase === 'launch') {
      e.preventDefault();
      this.launchHold = {
        active: true,
        pointerId: e.pointerId,
        startY: e.clientY,
        startAngle: this.launchAngle,
      };
      this.powerMeter = 0;
      this.canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (this.phase === 'flying') {
      const rect = this.canvas.getBoundingClientRect();
      if (e.clientX < rect.left + rect.width * 0.5) this.airInput = -1;
      else this.airInput = 1;
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.phase === 'launch' && this.launchHold.active && e.pointerId === this.launchHold.pointerId) {
      e.preventDefault();
      const dy = this.launchHold.startY - e.clientY;
      this.launchAngle = Math.max(0.25, Math.min(1.35, this.launchHold.startAngle + dy * 0.012));
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.phase === 'launch' && this.launchHold.active && e.pointerId === this.launchHold.pointerId) {
      this.launchHold.active = false;
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch {
        // already released
      }
      this.launch();
      return;
    }
    if (this.phase === 'flying') this.airInput = 0;
  }

  private useAbility(): void {
    if (this.phase !== 'flying' || !this.abilityReady) return;
    const p = this.physics.player;
    const speed = Math.hypot(p.vx, p.vy) || 1;
    this.physics.applyAbilityBurst((p.vx / speed) * 5, (p.vy / speed) * 5 - 3);
    this.abilityReady = false;
    this.abilityTimer = CHARACTERS[this.characterId]!.abilityCooldown * 60;
    const r = this.combo.registerStyle('Grapple', 600);
    this.sfx.grapple();
    this.feel.bumpShake(4);
    this.addFloatText(p.x, p.y - 20, `+${r.points}  Hook`, CC_PALETTE.violet);
    this.slowMo = 0.4;
  }

  private addFloatText(x: number, y: number, text: string, color: string): void {
    this.floatTexts.push({ x, y, text, life: 1, color });
  }

  pause(): void { this.paused = true; }
  resume(): void { this.paused = false; this.lastTs = performance.now(); }

  setAudioMuted(muted: boolean): void {
    this.sfx.setMuted(muted);
  }

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

    if (this.phase === 'launch') {
      if (this.launchHold.active || this.spaceHeld) {
        this.powerMeter = Math.min(1, this.powerMeter + dt * 0.045);
      }
      this.updatePowerZone();
      this.camX += (0 - this.camX) * 0.12 * dt;
      this.camY += (0 - this.camY) * 0.12 * dt;
    }

    const shake = this.feel.tick(dt);
    this.shakeX = shake.shakeX;
    this.shakeY = shake.shakeY;

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
        const p = this.physics.player;
        const r = this.combo.register(ev);
        if (r) {
          this.addFloatText(p.x, p.y - 24, `+${r.points}  ×${r.combo}`, CC_PALETTE.cyan);
          if (ev.kind === 'break') {
            this.score.addDestruction(r.points);
            this.sfx.break();
            this.feel.bumpShake(5);
            this.feel.spawnBurst(p.x, p.y, '#8d6e4a', 10, 4);
          }
          if (ev.kind === 'collect' && ev.objectType === 'coin') {
            this.score.addCoin();
            this.sfx.coin();
            this.feel.spawnBurst(p.x, p.y, '#ffd54f', 6, 3);
          }
          if (ev.kind === 'bounce') {
            this.sfx.bounce();
            this.feel.bumpShake(3);
          }
          if (ev.kind === 'explode') {
            this.sfx.explode();
            this.feel.bumpShake(12);
            this.feel.bumpFlash('#ff006e', 0.25);
            this.feel.spawnBurst(p.x, p.y, '#ff006e', 18, 7);
            this.slowMo = 0.45;
          }
          if (r.combo >= 3) {
            this.sfx.combo(r.combo);
            this.feel.showCombo(r.combo);
          }
        }
        if (ev.kind === 'kill') {
          this.sfx.crash();
          this.feel.bumpShake(14);
          this.feel.bumpFlash('#ff5252', 0.4);
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
      this.distAnim.set(meters);
      this.comboAnim.set(this.combo.combo);
      this.distAnim.tick(dt);
      this.comboAnim.tick(dt);
      if (distEl) distEl.textContent = `${this.distAnim.rounded().toLocaleString()}m`;
      if (comboEl) comboEl.textContent = `×${this.comboAnim.rounded()}`;
    }

    if (this.phase === 'launch') {
      this.root.querySelector('#cc-hud')?.classList.add('cc-hud-launch');
    } else {
      this.root.querySelector('#cc-hud')?.classList.remove('cc-hud-launch');
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

    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);

    drawSky(ctx, w, h, this.camX);
    drawGroundFill(ctx, w, h, this.groundY - this.camY);

    for (const o of this.physics.objects) {
      drawWorldObject(ctx, o, this.camX, this.camY, this.physics.time);
    }

    if (this.phase === 'launch') {
      const charging = this.launchHold.active || this.spaceHeld;
      const previewPower = charging ? this.powerMeter : 0.55;
      const armPull = charging ? 0.15 + this.powerMeter * 0.35 : 0;
      drawTrajectoryPreview(
        ctx,
        catapultX + 60,
        this.groundY - 50,
        -this.launchAngle,
        9 + previewPower * 11,
        level.wind,
        this.camX,
        this.camY,
      );
      drawCatapult(ctx, catapultX - this.camX, catapultY - this.camY, this.launchAngle, armPull);

      // Character in bucket
      const bucketX = catapultX + 60 + Math.cos(-this.launchAngle) * (8 + armPull * 20);
      const bucketY = this.groundY - 50 + Math.sin(-this.launchAngle) * (8 + armPull * 20);
      const bucketPlayer = { ...this.physics.player, x: bucketX, y: bucketY, angle: -this.launchAngle + 0.3 };
      drawPlayer(ctx, bucketPlayer, this.camX, this.camY, 'stable', false);

      drawLaunchHud(
        ctx, w, h, this.launchAngle, this.powerMeter, this.powerZone,
        level.world, level.weather, this.pulse, charging,
      );
    } else {
      drawCatapult(ctx, catapultX - this.camX, catapultY - this.camY, 0.5, 0);
      drawPlayer(ctx, this.physics.player, this.camX, this.camY, this.physics.player.momentum, false);
    }

    drawFloatingText(ctx, this.floatTexts, this.camX, this.camY);
    drawParticles(ctx, this.feel.particles, this.camX, this.camY);
    drawWindIndicator(ctx, w, level.wind);
    drawComboBanner(ctx, w, this.feel.comboBannerLevel, this.feel.comboBanner);

    ctx.restore();

    drawScreenFlash(ctx, w, h, this.feel.flash, this.feel.flashColor);
  }

  destroy(): void {
    this.running = false;
    this.scoreCancel?.();
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.boundResize);
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    this.canvas.removeEventListener('pointerdown', this.boundPointerDown);
    window.removeEventListener('pointermove', this.boundPointerMove);
    window.removeEventListener('pointerup', this.boundPointerUp);
    window.removeEventListener('pointercancel', this.boundPointerCancel);
    this.root.remove();
  }
}

class CatapultChaosHandle implements GameHandle {
  constructor(private game: CatapultChaosGame) {}
  destroy(): void { this.game.destroy(); }
  handlePlayablesPause(): void { this.game.pause(); }
  handlePlayablesResume(): void { this.game.resume(); }
  handlePlayablesAudio(enabled: boolean): void {
    this.game.setAudioMuted(!enabled);
  }
}

export async function launch(container: HTMLElement, options?: GameLaunchOptions): Promise<GameHandle> {
  const game = new CatapultChaosGame(container, options);
  await game.boot();
  return new CatapultChaosHandle(game);
}

const module: GameModule = { launch };
export default module;
