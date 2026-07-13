import { Container } from 'pixi.js';
import type { GameConfig, PowerupType, RunStats } from '@/types';
import { BaseScene } from './BaseScene';
import {
  COLORS, PLAYER, LANES, SCORING, POWERUP, MODE_CONFIG, HYPE_COMBO_TIERS,
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
import { FloatingTextSystem } from '@/systems/FloatingTextSystem';
import {
  createPlayerCore, createFirewall, createShard,
  createPowerupIcon, createGridBackground, getCoreColor,
  createBossFirewall, createGoldenShard, createGhostCore,
} from '@/graphics/ProceduralAssets';
import { QuantumRealitySystem } from '@/systems/QuantumRealitySystem';
import { clamp, easeOutCubic, circleRectOverlap, lerp } from '@/utils/math';

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
  private floatingText!: FloatingTextSystem;
  private reality!: QuantumRealitySystem;

  private gameWidth = 0;
  private gameHeight = 0;
  private laneCenters: number[] = [];

  private playerLane: number = PLAYER.START_LANE;
  private playerTargetLane: number = PLAYER.START_LANE;
  private playerX = 0;
  private playerY = 0;
  private laneSwitchProgress = 1;
  private playerContainer!: Container;
  private ghostContainer: Container | null = null;
  private ghostLane = 1;
  private ghostBonusTimer = 0;
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
  private countdownActive = false;

  private gridBg!: Container;
  private shakeAmount = 0;
  private nearMissChecked = new Set<number>();
  private milestonesHit = new Set<number>();
  private speedTiersHit = new Set<number>();
  private comboHypeHit = new Set<number>();
  private challengeComplete = false;
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
      this.events.on('combo:break', (d) => this.reality?.onComboBreak(d.previousCombo)),
      this.events.on('reality:fracture', (d) => this.onRealityFracture(d.theme, d.tint)),
      this.events.on('reality:fracture_end', () => this.onRealityFractureEnd()),
      this.events.on('reality:rare', (d) => this.onRareEvent(d.type)),
      this.events.on('reality:rare_end', (d) => this.onRareEventEnd(d.type)),
      this.events.on('reality:assist', () => this.spawner?.queueAssistShard()),
    );
  }

  private unbindInput(): void {
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers = [];
  }

  setPaused(value: boolean): void {
    this.paused = value;
  }

  setCountdownActive(value: boolean): void {
    this.countdownActive = value;
  }

  onResize(): void {
    if (this.gameOver) return;
    this.gameWidth = window.innerWidth;
    this.gameHeight = window.innerHeight;
    this.laneCenters = [this.gameWidth * 0.2, this.gameWidth * 0.5, this.gameWidth * 0.8];
    this.playerY = this.gameHeight * 0.78;
    this.playerX = this.laneCenters[this.playerLane];
    if (this.playerContainer) {
      this.playerContainer.x = this.playerX;
      this.playerContainer.y = this.playerY;
    }
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
    this.floatingText = new FloatingTextSystem(this.container);

    const seed = this.config.seed
      ?? (this.config.mode === 'challenge' ? this.save.save.daily.todaySeed : undefined);
    this.spawner = new SpawnerSystem(seed);
    this.spawner.spawnStarter();
    this.combo = new ComboSystem(this.events);
    this.reality = new QuantumRealitySystem(this.events, seed);
    this.reality.reset();

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
    this.speedTiersHit.clear();
    this.comboHypeHit.clear();
    this.challengeComplete = false;
    this.runCredits = 0;
    this.ghostContainer = null;
    this.ghostBonusTimer = 0;

    if (this.upgrades.hasStartShield()) {
      this.hasShield = true;
      this.activePowerups.push({ type: 'shield', timer: POWERUP.DURATION.shield });
    }

    const modeConf = MODE_CONFIG[this.config.mode];
    this.timeLimit = this.config.timeLimit ?? modeConf.timeLimit ?? 0;

    this.events.emit('game:start', { mode: this.config.mode });
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
    }
  }

  override update(dt: number): void {
    if (this.gameOver || this.paused || this.countdownActive) return;

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
    this.reality.update(dt, this.combo.getCombo(), this.score);
    this.spawner.setModifiers(this.reality.getModifiers());
    this.spawner.update(scaledDt, this.gameHeight);
    this.updateLaneShift();
    this.updateGhostRival(scaledDt);
    this.combo.update(dt);
    this.particles.update(dt);
    this.floatingText.update(dt);
    this.updatePowerups(dt);
    this.updatePhase(dt);
    this.syncEntities();
    this.checkCollisions();
    this.checkNearMisses();
    this.checkMilestones();
    this.checkSpeedTiers();
    this.updateGrid(scaledDt);
    this.applyScreenShake();
    this.applyRealityGlitch();
    this.updatePlayerVisuals();

    const intensity = this.spawner.getSpeedRatio();
    this.audio.setIntensity(intensity);
    this.audio.setRealityPitch(this.reality.getMusicPitch());

    if (!this.save.settings.reducedMotion) {
      this.particles.trail(this.playerX, this.playerY, getCoreColor(this.save.save.unlocks.selectedCore));
    }
  }

  private updateLaneShift(): void {
    const base = [this.gameWidth * 0.2, this.gameWidth * 0.5, this.gameWidth * 0.8];
    const shift = this.reality.getLaneShift(this.timeAlive);
    this.laneCenters = base.map((x, i) => x + shift * (i === 1 ? 0.5 : i === 0 ? 1 : -1));
  }

  private updateGhostRival(dt: number): void {
    if (!this.reality.isGhostRivalActive()) {
      if (this.ghostContainer) {
        this.container.removeChild(this.ghostContainer);
        this.ghostContainer.destroy({ children: true });
        this.ghostContainer = null;
      }
      return;
    }

    if (!this.ghostContainer) {
      this.ghostContainer = createGhostCore(PLAYER.RADIUS * 0.9);
      this.container.addChild(this.ghostContainer);
      this.ghostLane = this.playerLane;
    }

    this.ghostLane = lerp(this.ghostLane, this.playerLane, dt * 0.8);
    const ghostX = this.laneCenters[Math.round(this.ghostLane)] ?? this.laneCenters[1];
    this.ghostContainer.x = ghostX;
    this.ghostContainer.y = this.playerY - 140 + Math.sin(this.timeAlive * 4) * 8;
    this.ghostContainer.alpha = 0.35 + Math.sin(this.timeAlive * 6) * 0.15;

    const dist = Math.hypot(this.ghostContainer.x - this.playerX, this.ghostContainer.y - this.playerY);
    if (dist < 50) {
      this.reality.onCloseCall();
      this.ghostContainer.y = this.playerY - 180;
    }
  }

  private onRealityFracture(theme: string, _tint: string): void {
    if (this.save.settings.reducedMotion) return;
    this.shakeAmount = Math.max(this.shakeAmount, 10);
    this.container.removeChild(this.gridBg);
    this.gridBg.destroy({ children: true });
    this.gridBg = createGridBackground(this.gameWidth, this.gameHeight, theme);
    this.container.addChildAt(this.gridBg, 0);
    this.audio.playFracture();
  }

  private onRealityFractureEnd(): void {
    const theme = this.save.save.unlocks.selectedTheme;
    this.container.removeChild(this.gridBg);
    this.gridBg.destroy({ children: true });
    this.gridBg = createGridBackground(this.gameWidth, this.gameHeight, theme);
    this.container.addChildAt(this.gridBg, 0);
    this.audio.setRealityPitch(1);
  }

  private onRareEvent(type: string): void {
    if (type === 'quantum_vault') {
      this.spawner.spawnQuantumVault(1);
    }
    if (type === 'ghost_rival') {
      this.ghostBonusTimer = 0;
    }
    this.audio.playRareEvent();
  }

  private onRareEventEnd(type: string): void {
    if (type === 'ghost_rival' && this.ghostBonusTimer >= 3) {
      this.addScore(300, this.playerX, this.playerY - 40);
      this.events.emit('ui:hype', {
        title: 'RIVAL OUTRUN!',
        subtitle: '+300 ghost bonus',
        tier: 3,
        color: 'magenta',
      });
    }
  }

  private applyRealityGlitch(): void {
    if (this.save.settings.reducedMotion) return;
    const g = this.reality.getGlitchIntensity();
    if (g > 0.35) {
      this.container.x += (Math.random() - 0.5) * g * 4;
    }
  }

  private getShardValueMult(): number {
    return this.reality.getModifiers().shardValueMult;
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

  private updatePlayerVisuals(): void {
    const chronos = this.activePowerups.some((p) => p.type === 'chronos');
    const overclock = this.activePowerups.some((p) => p.type === 'overclock');
    if (this.phaseActive) {
      this.playerContainer.alpha = 0.55;
      this.playerContainer.tint = COLORS.violet;
    } else if (this.hasShield) {
      this.playerContainer.alpha = 1;
      this.playerContainer.tint = COLORS.green;
    } else if (overclock) {
      this.playerContainer.tint = COLORS.gold;
    } else if (chronos) {
      this.playerContainer.tint = COLORS.cyan;
    } else {
      this.playerContainer.alpha = 1;
      this.playerContainer.tint = 0xffffff;
    }
  }

  private popScore(x: number, y: number, delta: number, color: number = COLORS.cyan): void {
    this.floatingText.spawn(x, y, `+${delta}`, color, delta >= 100 ? 22 : 16);
  }

  private updatePhase(dt: number): void {
    if (this.phaseActive) {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.phaseActive = false;
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
    const magnetActive = this.activePowerups.some((p) => p.type === 'magnet');
    const magnetRange = POWERUP.MAGNET_RANGE * this.upgrades.getMagnetRangeMultiplier();

    for (const entity of this.spawner.getEntities()) {
      if (!entity.active) continue;
      activeIds.add(entity.id);

      let graphic = this.entityGraphics.get(entity.id);
      if (!graphic) {
        switch (entity.type) {
          case 'firewall':
            graphic = entity.isBoss
              ? createBossFirewall(entity.width, entity.height)
              : createFirewall(entity.width, entity.height);
            break;
          case 'shard':
            graphic = entity.isGolden ? createGoldenShard(14) : createShard(14);
            break;
          case 'powerup':
            graphic = createPowerupIcon(entity.powerupType ?? 'shield', 14);
            break;
          case 'vault':
            graphic = entity.isQuantumVault ? createGoldenShard(26) : createShard(22);
            graphic.alpha = entity.isQuantumVault ? 1 : 0.8;
            break;
          default:
            continue;
        }
        this.container.addChild(graphic);
        this.entityGraphics.set(entity.id, graphic);
      }

      let ex = this.laneCenters[entity.lane];
      let ey = entity.y;

      if (magnetActive && (entity.type === 'shard' || entity.type === 'vault')) {
        const dist = Math.hypot(ex - this.playerX, ey - this.playerY);
        if (dist < magnetRange) {
          ex = lerp(ex, this.playerX, 0.12);
          ey = lerp(ey, this.playerY, 0.12);
          entity.y = ey;
        }
      }

      graphic.x = ex;
      graphic.y = ey;

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
        case 'vault': {
          const isQuantum = entity.isQuantumVault ?? false;
          this.collectShard(entity.id, isQuantum ? SCORING.VAULT_BONUS * 2 : SCORING.VAULT_BONUS, true, isQuantum);
          break;
        }
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
        this.popScore(this.playerX, this.playerY - 30, SCORING.NEAR_MISS_BONUS, COLORS.gold);
        this.audio.playNearMiss();
        this.reality.onNearMiss();
        this.events.emit('ui:hype', { title: 'EDGE RUNNER!', subtitle: `+${SCORING.NEAR_MISS_BONUS} near miss`, tier: 2, color: 'gold' });
        this.shakeAmount = Math.max(this.shakeAmount, 5);
        this.particles.burst(this.playerX, this.playerY - 20, COLORS.gold, 12, 180);
      } else {
        this.nearMissChecked.add(entity.id);
      }
    }
  }

  private checkMilestones(): void {
    const checks: [number, string, string, number][] = [
      [30, '30 SECONDS', 'Keep syncing — you are warming up', 1],
      [60, '1 MINUTE', 'You are officially ON FIRE', 2],
      [90, 'ELITE RUNNER', 'The grid bends to your will', 3],
      [120, 'QUANTUM MASTER', 'Transcendent sync achieved', 4],
    ];
    for (const [sec, title, subtitle, tier] of checks) {
      if (this.timeAlive >= sec && !this.milestonesHit.has(sec)) {
        this.milestonesHit.add(sec);
        this.events.emit('milestone:reach', { label: title });
        this.events.emit('ui:hype', { title, subtitle, tier, color: 'violet' });
        this.audio.playHype(tier);
        if (tier >= 2) this.shakeAmount = Math.max(this.shakeAmount, tier * 2);
      }
    }
  }

  private checkSpeedTiers(): void {
    const mult = this.spawner.getSpeedMultiplier();
    const tiers: [number, string, string, number][] = [
      [1.3, 'VELOCITY SURGE', 'Speed ×1.3', 1],
      [1.6, 'HYPER DRIVE', 'Speed ×1.6', 2],
      [2.0, 'OVERDRIVE', 'Speed ×2.0 — hang on!', 3],
      [2.5, 'WARP SPEED', 'Speed ×2.5', 4],
      [3.0, 'MAX OVERDRIVE', 'Absolute terminal velocity', 5],
    ];
    for (const [threshold, title, subtitle, tier] of tiers) {
      const key = Math.round(threshold * 10);
      if (mult >= threshold && !this.speedTiersHit.has(key)) {
        this.speedTiersHit.add(key);
        this.events.emit('ui:hype', { title, subtitle, tier, color: 'cyan' });
        this.audio.playHype(tier);
        if (!this.save.settings.reducedMotion) {
          this.shakeAmount = Math.max(this.shakeAmount, tier * 2);
          this.events.emit('ui:flash', { color: 'rgba(0,240,255,0.15)', duration: 120 });
        }
      }
    }
  }

  private handleFirewallHit(entityId: number): void {
    if (this.phaseActive) {
      this.spawner.removeEntity(entityId);
      this.addScore(SCORING.PHASE_BONUS, this.playerX, this.playerY - 20);
      this.particles.burst(this.playerX, this.playerY, COLORS.violet, 20, 300);
      return;
    }

    if (this.hasShield) {
      this.hasShield = false;
      this.activePowerups = this.activePowerups.filter((p) => p.type !== 'shield');
      this.spawner.removeEntity(entityId);
      this.particles.burst(this.playerX, this.playerY, COLORS.green, 16, 250);
      this.shakeAmount = 8;
      this.events.emit('ui:flash', { color: 'rgba(0,255,136,0.35)', duration: 200 });
      this.audio.playShieldBreak();
      return;
    }

    if (this.config.mode === 'practice') {
      this.spawner.removeEntity(entityId);
      this.shakeAmount = 12;
      return;
    }

    this.endGame(true);
  }

  private collectShard(entityId: number, baseValue: number, isVault = false, isQuantumVault = false): void {
    this.spawner.removeEntity(entityId);
    this.shards++;
    this.runCredits += 1;
    this.combo.hit();
    const boosted = Math.floor(baseValue * this.upgrades.getShardMultiplier() * this.getShardValueMult());
    const points = Math.floor(boosted * this.combo.getMultiplier());
    this.addScore(points, this.laneCenters[this.playerLane], this.playerY - 30);
    this.reality.onShardCollect(this.combo.getCombo());
    this.audio.playShardCollect(this.combo.getCombo());
    if (this.reality.isGhostRivalActive()) {
      this.ghostBonusTimer++;
    }

    if (isQuantumVault) {
      this.events.emit('ui:hype', {
        title: 'QUANTUM VAULT!',
        subtitle: 'Impossible cache breached',
        tier: 5,
        color: 'gold',
      });
      this.audio.playVaultJackpot();
      this.shakeAmount = Math.max(this.shakeAmount, 16);
    } else if (isVault) {
      this.events.emit('ui:hype', { title: 'VAULT JACKPOT!', subtitle: `+${points.toLocaleString()}`, tier: 5, color: 'gold' });
      this.audio.playVaultJackpot();
      this.shakeAmount = Math.max(this.shakeAmount, 14);
      this.events.emit('ui:flash', { color: 'rgba(255,215,0,0.35)', duration: 250 });
      if (!this.save.settings.reducedMotion) {
        this.particles.burst(this.laneCenters[this.playerLane], this.playerY - 30, COLORS.gold, 40, 420);
      }
    } else {
      this.checkComboHype();
      if (this.combo.getCombo() > 1 && this.combo.getCombo() % 5 === 0) {
        this.audio.playComboUp();
      }
      this.particles.burst(this.laneCenters[this.playerLane], this.playerY - 30, COLORS.cyan, 8 + Math.min(this.combo.getCombo(), 12), 150);
    }

    this.events.emit('shard:collect', { value: points, combo: this.combo.getCombo() });
  }

  private checkComboHype(): void {
    const c = this.combo.getCombo();
    for (const tier of HYPE_COMBO_TIERS) {
      if (c < tier.combo || this.comboHypeHit.has(tier.combo)) continue;
      this.comboHypeHit.add(tier.combo);
      this.events.emit('ui:hype', {
        title: tier.title,
        subtitle: tier.subtitle,
        tier: tier.tier,
        color: tier.tier >= 4 ? 'magenta' : tier.tier >= 2 ? 'gold' : 'cyan',
      });
      this.audio.playHype(tier.tier);
      this.shakeAmount = Math.max(this.shakeAmount, tier.tier * 2.5);
      if (tier.tier >= 3 && !this.save.settings.reducedMotion) {
        this.particles.burst(this.playerX, this.playerY, COLORS.gold, 16 + tier.tier * 4, 280);
        this.events.emit('ui:flash', { color: 'rgba(0,240,255,0.2)', duration: 150 });
      }
    }
  }

  private checkChallengeVictory(): void {
    const target = this.config.targetScore ?? 0;
    if (target <= 0 || this.challengeComplete || this.score < target) return;
    this.challengeComplete = true;
    this.events.emit('ui:hype', {
      title: 'TARGET SYNCED!',
      subtitle: 'Daily challenge crushed — keep pushing!',
      tier: 5,
      color: 'cyan',
    });
    this.audio.playHype(5);
    this.shakeAmount = Math.max(this.shakeAmount, 10);
    this.events.emit('ui:flash', { color: 'rgba(0,255,136,0.3)', duration: 300 });
  }

  private collectPowerup(entityId: number, type: PowerupType): void {
    this.spawner.removeEntity(entityId);
    this.powerupsCollected++;
    this.activePowerups.push({ type, timer: POWERUP.DURATION[type] });
    if (type === 'shield') this.hasShield = true;
    this.audio.playPowerup();
    this.events.emit('powerup:activate', { type });
    this.particles.burst(this.playerX, this.playerY, COLORS.gold, 14, 200);

    const hypeMap: Partial<Record<PowerupType, { title: string; subtitle: string; tier: number }>> = {
      overclock: { title: 'OVERCLOCK!', subtitle: '2× score multiplier', tier: 3 },
      chronos: { title: 'CHRONOS!', subtitle: 'Time slows for you', tier: 3 },
      magnet: { title: 'MAGNET SYNC!', subtitle: 'Shards drawn to core', tier: 2 },
      shield: { title: 'SHIELD UP!', subtitle: 'One hit absorbed', tier: 2 },
    };
    const hype = hypeMap[type];
    if (hype) {
      this.events.emit('ui:hype', { ...hype, color: 'violet' });
      this.audio.playHype(hype.tier);
    }
  }

  private addScore(delta: number, popupX?: number, popupY?: number): void {
    const overclock = this.activePowerups.some((p) => p.type === 'overclock')
      ? POWERUP.OVERCLOCK_MULTIPLIER : 1;
    const finalDelta = Math.floor(delta * overclock);
    this.score += finalDelta;
    this.events.emit('score:change', { score: this.score, delta: finalDelta });
    this.checkChallengeVictory();
    if (popupX !== undefined && popupY !== undefined) {
      this.popScore(popupX, popupY, finalDelta, overclock > 1 ? COLORS.gold : COLORS.cyan);
    }
  }

  private endGame(fromDeath: boolean): void {
    if (this.gameOver) return;
    this.gameOver = true;

    if (fromDeath) {
      this.audio.playHit();
      this.shakeAmount = 20;
      this.events.emit('ui:flash', { color: 'rgba(255,0,110,0.45)', duration: 350 });
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
      realitiesDiscovered: this.reality.getDiscoveredThisRun(),
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
  getComboCount(): number {
    return this.combo.getCombo();
  }
  getComboTimerRatio(): number {
    return this.combo.getCombo() > 1 ? this.combo.getTimerRatio() : 0;
  }
  getTargetScore(): number {
    return this.config.targetScore ?? 0;
  }
  getPowerupTimers(): { type: PowerupType; ratio: number }[] {
    return this.activePowerups.map((p) => ({
      type: p.type,
      ratio: p.timer / POWERUP.DURATION[p.type],
    }));
  }
  getSpeedMultiplier(): number {
    return this.spawner.getSpeedMultiplier();
  }
  getSpeedRatio(): number {
    return this.spawner.getSpeedRatio();
  }
}
