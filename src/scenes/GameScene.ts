import { Container, Text, TextStyle } from 'pixi.js';
import type { GameConfig, PowerupType, RunStats } from '@/types';
import { BaseScene } from './BaseScene';
import {
  COLORS, PLAYER, LANES, SCORING, POWERUP, MODE_CONFIG,
} from '@/config/constants';
import { EventBus } from '@/core/EventBus';
import { AudioManager } from '@/core/AudioManager';
import { SaveManager } from '@/core/SaveManager';
import { AchievementManager } from '@/core/AchievementManager';
import { UpgradeManager } from '@/core/UpgradeManager';
import { estimateRankPercentile } from '@/core/SaveManager';
import { SpawnerSystem } from '@/systems/SpawnerSystem';
import { ComboSystem } from '@/systems/ComboSystem';
import { ParticleSystem } from '@/systems/ParticleSystem';
import {
  createPlayerCore, createFirewall, createShard,
  createPowerupIcon, createGridBackground, getCoreColor,
} from '@/graphics/ProceduralAssets';
import { clamp, easeOutCubic, circleRectOverlap } from '@/utils/math';

interface ActivePowerup {
  type: PowerupType;
  timer: number;
}

export class GameScene extends BaseScene {
  id = 'game' as const;

  private save: SaveManager;
  private achievements: AchievementManager;
  private upgrades: UpgradeManager;
  private onComplete: ((stats: RunStats) => void) | null = null;

  private config: GameConfig = { mode: 'endless' };
  private spawner!: SpawnerSystem;
  private combo!: ComboSystem;
  private particles!: ParticleSystem;

  private gameWidth = 0;
  private gameHeight = 0;
  private laneCenters: number[] = [];

  private playerLane: number = PLAYER.START_LANE;
  private playerTargetLane: number = PLAYER.START_LANE;
  private playerX = 0;
  private playerY = 0;
  private laneSwitchProgress = 1;
  private playerContainer!: Container;
  private playerScale = 1;

  private phaseActive = false;
  private phaseTimer = 0;
  private phaseCooldown = 0;
  private hasShield = false;

  private activePowerups: ActivePowerup[] = [];
  private entityGraphics = new Map<number, Container>();

  private score = 0;
  private shards = 0;
  private phaseShifts = 0;
  private powerupsCollected = 0;
  private nearMisses = 0;
  private distance = 0;
  private timeAlive = 0;
  private timeLimit = 0;
  private gameOver = false;
  private paused = false;

  private scoreText!: Text;
  private comboText!: Text;
  private gridBg!: Container;
  private shakeAmount = 0;
  private nearMissChecked = new Set<number>();
  private milestonesHit = new Set<number>();
  private runCredits = 0;
  private phaseCooldownBase: number = PLAYER.PHASE_COOLDOWN;

  private unsubscribers: (() => void)[] = [];

  constructor(
    events: EventBus,
    audio: AudioManager,
    save: SaveManager,
    achievements: AchievementManager,
    upgrades: UpgradeManager,
  ) {
    super(events, audio);
    this.save = save;
    this.achievements = achievements;
    this.upgrades = upgrades;
  }

  setOnComplete(cb: (stats: RunStats) => void): void {
    this.onComplete = cb;
  }

  override enter(data?: unknown): void {
    const cfg = data as GameConfig;
    this.config = cfg ?? { mode: 'endless' };
    this.bindInput();
    this.resetGame();
    this.events.emit('game:start', { mode: this.config.mode });
    if (!this.save.save.tutorialCompleted) {
      this.events.emit('ui:tutorial', { step: 0 });
    }
    this.audio.startMusic();
  }

  override exit(): void {
    this.audio.stopMusic();
    this.unbindInput();
    this.clearEntities();
    this.container.removeChildren();
    this.container.x = 0;
    this.container.y = 0;
    this.gameOver = true;
  }

  override async init(): Promise<void> {
    // Input bindings are attached per run in enter()
  }

  private bindInput(): void {
    this.unbindInput();
    this.unsubscribers.push(
      this.events.on('player:move', (d) => this.moveLane(d.lane)),
      this.events.on('player:phase', (d) => this.handlePhase(d.active)),
    );
  }

  private unbindInput(): void {
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers = [];
  }

  setPaused(value: boolean): void {
    this.paused = value;
  }

  private resetGame(): void {
    this.container.removeChildren();
    this.entityGraphics.clear();
    this.activePowerups = [];

    this.gameWidth = window.innerWidth;
    this.gameHeight = window.innerHeight;
    this.laneCenters = [
      this.gameWidth * 0.2,
      this.gameWidth * 0.5,
      this.gameWidth * 0.8,
    ];

    const theme = this.save.save.unlocks.selectedTheme;
    this.gridBg = createGridBackground(this.gameWidth, this.gameHeight, theme);
    this.container.addChild(this.gridBg);

    this.particles = new ParticleSystem(
      this.container,
      this.save.settings.reducedMotion,
    );

    const seed = this.config.seed
      ?? (this.config.mode === 'challenge' ? this.save.save.daily.todaySeed : undefined);
    this.spawner = new SpawnerSystem(seed);
    this.spawner.spawnStarter();
    this.combo = new ComboSystem(this.events);

    this.phaseCooldownBase = PLAYER.PHASE_COOLDOWN * this.upgrades.getPhaseCooldownFactor();

    this.playerLane = PLAYER.START_LANE;
    this.playerTargetLane = PLAYER.START_LANE;
    this.playerX = this.laneCenters[this.playerLane];
    this.playerY = this.gameHeight * 0.78;
    this.laneSwitchProgress = 1;

    const coreColor = getCoreColor(this.save.save.unlocks.selectedCore);
    this.playerContainer = createPlayerCore(PLAYER.RADIUS, coreColor);
    this.playerContainer.x = this.playerX;
    this.playerContainer.y = this.playerY;
    this.container.addChild(this.playerContainer);

    this.score = 0;
    this.shards = 0;
    this.phaseShifts = 0;
    this.powerupsCollected = 0;
    this.distance = 0;
    this.timeAlive = 0;
    this.gameOver = false;
    this.paused = false;
    this.phaseActive = false;
    this.phaseTimer = 0;
    this.phaseCooldown = 0;
    this.hasShield = false;
    this.shakeAmount = 0;
    this.nearMisses = 0;
    this.nearMissChecked.clear();
    this.milestonesHit.clear();
    this.runCredits = 0;

    if (this.upgrades.hasStartShield()) {
      this.hasShield = true;
      this.activePowerups.push({ type: 'shield', timer: POWERUP.DURATION.shield });
    }

    const modeConf = MODE_CONFIG[this.config.mode];
    this.timeLimit = this.config.timeLimit ?? modeConf.timeLimit ?? 0;

    this.scoreText = new Text({
      text: '0',
      style: new TextStyle({
        fontFamily: 'Orbitron',
        fontSize: 28,
        fill: COLORS.white,
        fontWeight: '800',
      }),
    });
    this.scoreText.x = 16;
    this.scoreText.y = 16;
    this.container.addChild(this.scoreText);

    this.comboText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: 'Orbitron',
        fontSize: 18,
        fill: COLORS.gold,
        fontWeight: '600',
      }),
    });
    this.comboText.x = 16;
    this.comboText.y = 52;
    this.container.addChild(this.comboText);
  }

  private moveLane(direction: number): void {
    if (this.gameOver || this.paused) return;
    const newLane = clamp(this.playerTargetLane + direction, 0, LANES.COUNT - 1);
    if (newLane !== this.playerTargetLane) {
      this.playerTargetLane = newLane;
      this.laneSwitchProgress = 0;
      this.audio.playLaneSwitch();
      if (!this.save.save.tutorialCompleted) {
        this.save.markTutorialComplete();
        this.events.emit('ui:tutorial', { step: -1 });
      }
    }
  }

  private handlePhase(active: boolean): void {
    if (this.gameOver || this.paused) return;
    if (active && this.phaseCooldown <= 0 && !this.phaseActive) {
      this.phaseActive = true;
      this.phaseTimer = PLAYER.PHASE_DURATION;
      this.phaseCooldown = this.phaseCooldownBase;
      this.phaseShifts++;
      this.audio.playPhaseShift();
      this.particles.burst(this.playerX, this.playerY, COLORS.violet, 16, 250);
      this.playerContainer.alpha = 0.5;
    }
  }

  override update(dt: number): void {
    if (this.gameOver || this.paused) return;

    const timeScale = this.activePowerups.some((p) => p.type === 'chronos')
      ? POWERUP.CHRONOS_FACTOR : 1;
    const scaledDt = dt * timeScale;

    this.timeAlive += dt;
    this.distance += this.spawner.getScrollSpeed() * scaledDt * 0.01;

    if (this.timeLimit > 0 && this.timeAlive >= this.timeLimit) {
      this.endGame(false);
      return;
    }

    this.updatePlayer(scaledDt);
    this.spawner.update(scaledDt, this.gameHeight);
    this.combo.update(dt);
    this.particles.update(dt);
    this.updatePowerups(dt);
    this.updatePhase(dt);
    this.syncEntities();
    this.checkCollisions();
    this.checkNearMisses();
    this.checkMilestones();
    this.updateGrid(scaledDt);
    this.updateHUD();
    this.applyScreenShake();

    const intensity = clamp(this.spawner.getElapsed() / 120, 0, 1);
    this.audio.setIntensity(intensity);

    if (!this.save.settings.reducedMotion) {
      this.particles.trail(this.playerX, this.playerY, getCoreColor(this.save.save.unlocks.selectedCore));
    }
  }

  private updatePlayer(dt: number): void {
    if (this.laneSwitchProgress < 1) {
      this.laneSwitchProgress = Math.min(1, this.laneSwitchProgress + dt / LANES.SWITCH_DURATION);
      const t = easeOutCubic(this.laneSwitchProgress);
      const fromX = this.laneCenters[this.playerLane];
      const toX = this.laneCenters[this.playerTargetLane];
      this.playerX = fromX + (toX - fromX) * t;
      if (this.laneSwitchProgress >= 1) {
        this.playerLane = this.playerTargetLane;
      }
    }

    this.playerContainer.x = this.playerX;
    this.playerContainer.y = this.playerY;

    const pulse = 1 + Math.sin(this.timeAlive * 6) * 0.05;
    this.playerScale = pulse;
    this.playerContainer.scale.set(this.playerScale);
  }

  private updatePhase(dt: number): void {
    if (this.phaseActive) {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.phaseActive = false;
        this.playerContainer.alpha = 1;
      }
    }
    if (this.phaseCooldown > 0) {
      this.phaseCooldown -= dt;
    }
  }

  private updatePowerups(dt: number): void {
    for (let i = this.activePowerups.length - 1; i >= 0; i--) {
      this.activePowerups[i].timer -= dt;
      if (this.activePowerups[i].timer <= 0) {
        const type = this.activePowerups[i].type;
        if (type === 'shield') this.hasShield = false;
        this.events.emit('powerup:expire', { type });
        this.activePowerups.splice(i, 1);
      }
    }
  }

  private syncEntities(): void {
    const activeIds = new Set<number>();

    for (const entity of this.spawner.getEntities()) {
      if (!entity.active) continue;
      activeIds.add(entity.id);

      let graphic = this.entityGraphics.get(entity.id);
      if (!graphic) {
        switch (entity.type) {
          case 'firewall':
            graphic = createFirewall(entity.width, entity.height);
            break;
          case 'shard':
            graphic = createShard(14);
            break;
          case 'powerup':
            graphic = createPowerupIcon(entity.powerupType ?? 'shield', 14);
            break;
          case 'vault':
            graphic = createShard(22);
            graphic.alpha = 0.8;
            break;
          default:
            continue;
        }
        this.container.addChild(graphic);
        this.entityGraphics.set(entity.id, graphic);
      }

      graphic.x = this.laneCenters[entity.lane];
      graphic.y = entity.y;

      if (entity.type === 'shard' || entity.type === 'vault') {
        graphic.rotation += 0.02;
      }
    }

    for (const [id, graphic] of this.entityGraphics) {
      if (!activeIds.has(id)) {
        this.container.removeChild(graphic);
        graphic.destroy({ children: true });
        this.entityGraphics.delete(id);
      }
    }
  }

  private checkCollisions(): void {
    const pr = PLAYER.RADIUS * 0.8;

    for (const entity of this.spawner.getEntities()) {
      if (!entity.active || entity.collected) continue;

      const ex = this.laneCenters[entity.lane];
      const ey = entity.y;

      if (entity.lane !== this.playerLane && entity.type !== 'shard' && entity.type !== 'vault') {
        if (entity.type === 'powerup') {
          const magnetActive = this.activePowerups.some((p) => p.type === 'magnet');
          if (!magnetActive) continue;
          const magnetRange = POWERUP.MAGNET_RANGE * this.upgrades.getMagnetRangeMultiplier();
          const dist = Math.abs(ex - this.playerX) + Math.abs(ey - this.playerY);
          if (dist > magnetRange) continue;
        } else {
          continue;
        }
      }

      const hit = circleRectOverlap(
        this.playerX, this.playerY, pr,
        ex - entity.width / 2, ey - entity.height / 2,
        entity.width, entity.height,
      );

      if (!hit) continue;

      switch (entity.type) {
        case 'firewall':
          this.handleFirewallHit(entity.id);
          break;
        case 'shard':
          this.collectShard(entity.id, SCORING.SHARD_BASE);
          break;
        case 'vault':
          this.collectShard(entity.id, SCORING.VAULT_BONUS);
          this.particles.burst(ex, ey, COLORS.gold, 30, 350);
          break;
        case 'powerup':
          this.collectPowerup(entity.id, entity.powerupType!);
          break;
      }
    }
  }

  private checkNearMisses(): void {
    const pr = PLAYER.RADIUS;
    for (const entity of this.spawner.getEntities()) {
      if (!entity.active || entity.type !== 'firewall') continue;
      if (entity.lane === this.playerLane) continue;
      if (this.nearMissChecked.has(entity.id)) continue;

      const ey = entity.y;
      const passed = ey > this.playerY + pr && ey < this.playerY + pr + 40;
      if (!passed) continue;

      const ex = this.laneCenters[entity.lane];
      const lateralDist = Math.abs(ex - this.playerX);
      if (lateralDist < 100) {
        this.nearMissChecked.add(entity.id);
        this.nearMisses++;
        this.addScore(SCORING.NEAR_MISS_BONUS);
        this.events.emit('ui:toast', { message: `NEAR MISS +${SCORING.NEAR_MISS_BONUS}`, type: 'bonus' });
        this.particles.burst(this.playerX, this.playerY - 20, COLORS.gold, 6, 120);
      } else {
        this.nearMissChecked.add(entity.id);
      }
    }
  }

  private checkMilestones(): void {
    const checks: [number, string][] = [
      [30, '⚡ 30 SECONDS — KEEP SYNCING'],
      [60, '🔥 1 MINUTE — ON FIRE'],
      [90, '💎 ELITE RUNNER'],
      [120, '🏆 QUANTUM MASTER'],
    ];
    for (const [sec, label] of checks) {
      if (this.timeAlive >= sec && !this.milestonesHit.has(sec)) {
        this.milestonesHit.add(sec);
        this.events.emit('milestone:reach', { label });
        this.events.emit('ui:toast', { message: label, type: 'milestone' });
      }
    }
  }

  private handleFirewallHit(entityId: number): void {
    if (this.phaseActive) {
      this.spawner.removeEntity(entityId);
      this.addScore(SCORING.PHASE_BONUS);
      this.particles.burst(this.playerX, this.playerY, COLORS.violet, 20, 300);
      return;
    }

    if (this.hasShield) {
      this.hasShield = false;
      this.activePowerups = this.activePowerups.filter((p) => p.type !== 'shield');
      this.spawner.removeEntity(entityId);
      this.particles.burst(this.playerX, this.playerY, COLORS.green, 16, 250);
      this.shakeAmount = 8;
      return;
    }

    if (this.config.mode === 'practice') {
      this.spawner.removeEntity(entityId);
      this.shakeAmount = 12;
      return;
    }

    this.endGame(true);
  }

  private collectShard(entityId: number, baseValue: number): void {
    this.spawner.removeEntity(entityId);
    this.shards++;
    this.runCredits += 1;
    this.combo.hit();
    const boosted = Math.floor(baseValue * this.upgrades.getShardMultiplier());
    const points = Math.floor(boosted * this.combo.getMultiplier());
    this.addScore(points);
    this.audio.playShardCollect(this.combo.getCombo());
    if (this.combo.getCombo() === 5) {
      this.events.emit('ui:toast', { message: '🔗 COMBO ×3.0 — NICE!', type: 'combo' });
    }
    if (this.combo.getCombo() > 1 && this.combo.getCombo() % 5 === 0) {
      this.audio.playComboUp();
    }
    this.events.emit('shard:collect', { value: points, combo: this.combo.getCombo() });
    this.particles.burst(this.laneCenters[this.playerLane], this.playerY - 30, COLORS.cyan, 8, 150);
  }

  private collectPowerup(entityId: number, type: PowerupType): void {
    this.spawner.removeEntity(entityId);
    this.powerupsCollected++;
    this.activePowerups.push({ type, timer: POWERUP.DURATION[type] });
    if (type === 'shield') this.hasShield = true;
    this.audio.playPowerup();
    this.events.emit('powerup:activate', { type });
    this.particles.burst(this.playerX, this.playerY, COLORS.gold, 14, 200);
  }

  private addScore(delta: number): void {
    const overclock = this.activePowerups.some((p) => p.type === 'overclock')
      ? POWERUP.OVERCLOCK_MULTIPLIER : 1;
    const finalDelta = Math.floor(delta * overclock);
    this.score += finalDelta;
    this.events.emit('score:change', { score: this.score, delta: finalDelta });
  }

  private endGame(fromDeath: boolean): void {
    if (this.gameOver) return;
    this.gameOver = true;

    if (fromDeath) {
      this.audio.playHit();
      this.shakeAmount = 20;
      if (!this.save.settings.reducedMotion) {
        this.particles.burst(this.playerX, this.playerY, COLORS.magenta, 40, 400);
      }
      this.playerContainer.visible = false;
    }

    const stats: RunStats = {
      score: this.score,
      shards: this.shards,
      combo: this.combo.getCombo(),
      maxCombo: this.combo.getMaxCombo(),
      distance: this.distance,
      timeAlive: this.timeAlive,
      phaseShifts: this.phaseShifts,
      powerups: this.powerupsCollected,
      nearMisses: this.nearMisses,
      mode: this.config.mode,
      creditsEarned: this.runCredits,
      rankPercentile: estimateRankPercentile(this.score),
    };

    setTimeout(() => {
      this.events.emit('game:over', { stats });
      this.achievements.check(stats);
      this.onComplete?.(stats);
    }, fromDeath ? 800 : 100);
  }

  private updateGrid(dt: number): void {
    const speed = this.spawner.getScrollSpeed();
    for (let i = 0; i < this.gridBg.children.length; i++) {
      const layer = this.gridBg.children[i];
      layer.y += speed * dt * (0.2 + i * 0.15);
      if (layer.y > 40) layer.y -= 40;
    }
  }

  private updateHUD(): void {
    this.scoreText.text = this.score.toLocaleString();
    const combo = this.combo.getCombo();
    if (combo > 1) {
      this.comboText.text = `COMBO ×${this.combo.getMultiplier().toFixed(1)}`;
      this.comboText.alpha = 0.5 + this.combo.getTimerRatio() * 0.5;
    } else {
      this.comboText.text = '';
    }
  }

  private applyScreenShake(): void {
    if (this.shakeAmount > 0 && !this.save.settings.reducedMotion) {
      this.container.x = (Math.random() - 0.5) * this.shakeAmount;
      this.container.y = (Math.random() - 0.5) * this.shakeAmount;
      this.shakeAmount *= 0.9;
      if (this.shakeAmount < 0.5) {
        this.shakeAmount = 0;
        this.container.x = 0;
        this.container.y = 0;
      }
    }
  }

  private clearEntities(): void {
    for (const [, g] of this.entityGraphics) {
      g.destroy({ children: true });
    }
    this.entityGraphics.clear();
  }

  getScore(): number { return this.score; }
  getTimeAlive(): number { return this.timeAlive; }
  getTimeLimit(): number { return this.timeLimit; }
  isGameOver(): boolean { return this.gameOver; }
  getPhaseRatio(): number {
    return this.phaseCooldown > 0
      ? 1 - this.phaseCooldown / this.phaseCooldownBase
      : 1;
  }
  getActivePowerups(): ActivePowerup[] { return this.activePowerups; }
  getComboDisplay(): string {
    const combo = this.combo.getCombo();
    if (combo <= 1) return '';
    return `COMBO ×${this.combo.getMultiplier().toFixed(1)}`;
  }
}
