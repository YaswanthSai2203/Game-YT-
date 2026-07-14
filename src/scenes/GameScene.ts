import { Container } from 'pixi.js';
import type { GameConfig, PowerupType, RunStats } from '@/types';
import { BaseScene } from './BaseScene';
import {
  COLORS, PLAYER, LANES, SCORING, POWERUP, PICKUP, MODE_CONFIG, HYPE_COMBO_TIERS,
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
  createPowerupIcon, getCoreColor,
  createBossFirewall, createGoldenShard, createGhostCore, createWhiteFirewall,
  createScoreBoostPickup, createBombPickup,
} from '@/graphics/ProceduralAssets';
import { LivingBackgroundSystem } from '@/systems/LivingBackgroundSystem';
import { RUN_EVOLUTION, pickBiomeFromSeed } from '@/config/backgroundConfig';
import { QuantumRealitySystem } from '@/systems/QuantumRealitySystem';
import { SentientAISystem } from '@/systems/SentientAISystem';
import { MythEventSystem } from '@/systems/MythEventSystem';
import { LivingWatcher } from '@/systems/LivingWatcher';
import { GridSyncSystem } from '@/systems/GridSyncSystem';
import { AIDirectorSystem, type RunPlan } from '@/systems/AIDirectorSystem';
import { GhostReplaySystem } from '@/systems/GhostReplaySystem';
import { GRID_SYNC } from '@/config/sentientConfig';
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
  private onComplete: ((stats: RunStats, syncCompleted?: boolean) => void) | null = null;

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

  private livingBg: LivingBackgroundSystem | null = null;
  private cameraZoom = 1;
  private cameraStretchY = 1;
  private shakeAmount = 0;
  private nearMissChecked = new Set<number>();
  private milestonesHit = new Set<number>();
  private speedTiersHit = new Set<number>();
  private comboHypeHit = new Set<number>();
  private challengeComplete = false;
  private runCredits = 0;
  private scoreBoostTimer = 0;
  private sentient!: SentientAISystem;
  private gridSync!: GridSyncSystem;
  private director!: AIDirectorSystem;
  private ghostReplay!: GhostReplaySystem;
  private runPlan: RunPlan | null = null;
  private slowMoScale = 1;
  private slowMoTimer = 0;
  private myth!: MythEventSystem;
  private watcher: LivingWatcher | null = null;
  private fourthLaneActive = false;
  private gamePausedForEvent = false;
  private phaseCooldownBase: number = PLAYER.PHASE_COOLDOWN;
  private currentAudioLayer: 'heartbeat' | 'choir' | 'piano' | 'none' = 'none';
  private firstMoveLogged = false;
  private lastRunFirstMove: number | null = null;

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

  setOnComplete(cb: (stats: RunStats, syncCompleted?: boolean) => void): void {
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
    this.container.pivot.set(0, 0);
    this.container.scale.set(1);
    this.livingBg = null;
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
      this.events.on('reality:assist', () => {
        this.spawner?.queueAssistShard();
        this.gridSync?.onAssistReceived();
      }),
      this.events.on('myth:spawn_white', () => this.spawner?.spawnWhiteFirewall()),
      this.events.on('world:impossible_crash', () => { void this.handleImpossibleCrash(); }),
      this.events.on('grid:myth', (d) => this.gridSync?.onMythWitnessed(d.id)),
      this.events.on('grid:habit_broken', () => this.gridSync?.onHabitBroken()),
      this.events.on('grid:adaptive_unlock', () => this.gridSync?.onAdaptiveUnlocked()),
      this.events.on('director:slowmo', (d) => {
        this.slowMoTimer = d.duration;
        this.slowMoScale = d.scale;
      }),
      this.events.on('audio:mood', (d) => this.audio.setGridMood(d.mood)),
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
    this.livingBg?.rebuild(this.gameWidth, this.gameHeight);
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

    this.director = new AIDirectorSystem(this.events, this.save);
    this.runPlan = this.director.planRun(this.config.mode);
    this.director.emitRunStart(this.runPlan);
    this.audio.setGridMood(this.runPlan.mood);

    const bgSeed = this.config.seed ?? this.runPlan.theme.length * 9973 + this.save.save.stats.totalRuns;
    const startBiome = pickBiomeFromSeed(bgSeed, this.runPlan.theme);
    this.livingBg = new LivingBackgroundSystem(this.container, this.gameWidth, this.gameHeight, {
      biome: startBiome,
      totalRuns: this.save.save.stats.totalRuns,
      seed: bgSeed,
      reducedMotion: this.save.settings.reducedMotion,
      onBiomeChange: (label) => {
        this.events.emit('ui:toast', {
          message: `Dimension shift — ${label}`,
          type: 'info',
        });
      },
    });

    this.ghostReplay = new GhostReplaySystem();
    this.ghostReplay.startRecording(this.config.mode);
    if (this.runPlan.useGhostReplay && this.save.save.worldMemory.ghostReplay) {
      this.ghostReplay.loadPlayback(this.save.save.worldMemory.ghostReplay, this.container);
    }

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
    this.reality.initAdaptive(this.save.save.worldMemory.adaptiveUnlocked);
    this.reality.setHiddenDimensionsUnlocked(
      this.save.save.worldMemory.gridSync >= GRID_SYNC.THRESHOLDS.HIDDEN_DIM,
    );
    this.sentient = new SentientAISystem(this.events, this.save);
    this.sentient.reset();
    this.gridSync = new GridSyncSystem(this.events, this.save);
    this.gridSync.resetRun();
    this.myth = new MythEventSystem(this.events, this.save, seed);
    this.myth.reset();
    this.spawner.setDirectorModifiers(this.director.getSpawnModifiers());
    this.myth.setDirectorMultiplier(this.runPlan.mythRollMult);
    this.reality.setFractureBoost(this.runPlan.fractureBoost);

    const totalRuns = this.save.save.stats.totalRuns;
    const showWatcher = (
      totalRuns >= RUN_EVOLUTION.WATCHER_HINT
      || this.save.save.worldMemory.gridSync >= GRID_SYNC.THRESHOLDS.WATCHER
    ) && !this.save.save.worldMemory.watcherDefeated;
    if (showWatcher) {
      this.watcher = new LivingWatcher(this.container, this.gameWidth, this.gameHeight, bgSeed);
    } else {
      this.watcher = null;
    }

    this.phaseCooldownBase = PLAYER.PHASE_COOLDOWN * this.upgrades.getPhaseCooldownFactor();

    this.playerLane = PLAYER.START_LANE;
    this.playerTargetLane = PLAYER.START_LANE;
    this.playerX = this.laneCenters[this.playerLane];
    this.playerY = this.gameHeight * 0.78;
    this.laneSwitchProgress = 1;

    const coreId = this.save.save.unlocks.selectedCore;
    const coreColor = getCoreColor(coreId);
    this.playerContainer = createPlayerCore(PLAYER.RADIUS, coreColor, coreId);
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
    this.scoreBoostTimer = 0;
    this.cameraZoom = 1;
    this.cameraStretchY = 1;
    this.slowMoScale = 1;
    this.slowMoTimer = 0;
    this.ghostContainer = null;
    this.ghostBonusTimer = 0;

    this.firstMoveLogged = false;
    this.currentAudioLayer = 'none';

    if (this.upgrades.hasStartShield()) {
      this.hasShield = true;
      this.activePowerups.push({ type: 'shield', timer: POWERUP.DURATION.shield });
    }

    const modeConf = MODE_CONFIG[this.config.mode];
    this.timeLimit = this.config.timeLimit ?? modeConf.timeLimit ?? 0;

    this.events.emit('game:start', { mode: this.config.mode });
    this.sentient.onRunStart();
  }

  private moveLane(direction: number): void {
    if (this.gameOver || this.paused) return;
    const maxLane = this.fourthLaneActive ? 3 : LANES.COUNT - 1;
    const newLane = clamp(this.playerTargetLane + direction, 0, maxLane);
    if (newLane !== this.playerTargetLane) {
      this.playerTargetLane = newLane;
      this.laneSwitchProgress = 0;
      this.audio.playLaneSwitch();
      this.sentient.onLaneMove(direction);
      if (!this.firstMoveLogged) {
        this.firstMoveLogged = true;
        const sameAsLast = this.lastRunFirstMove === direction;
        this.gridSync.onFirstMove(direction, sameAsLast);
        this.lastRunFirstMove = direction;
      }
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
      this.gridSync.onPhaseUsed();
      this.audio.playPhaseShift();
      this.particles.burst(this.playerX, this.playerY, COLORS.violet, 16, 250);
    }
  }

  override update(dt: number): void {
    if (this.gameOver || this.paused || this.countdownActive || this.gamePausedForEvent) return;

    if (this.slowMoTimer > 0) {
      this.slowMoTimer -= dt;
      if (this.slowMoTimer <= 0) this.slowMoScale = 1;
    } else if (this.slowMoScale < 1) {
      this.slowMoScale = lerp(this.slowMoScale, 1, dt * 5);
      if (this.slowMoScale > 0.98) this.slowMoScale = 1;
    }

    const timeScale = this.activePowerups.some((p) => p.type === 'chronos')
      ? POWERUP.CHRONOS_FACTOR : 1;
    const scaledDt = dt * timeScale * this.slowMoScale;

    this.timeAlive += dt;
    this.distance += this.spawner.getScrollSpeed() * scaledDt * 0.01;

    if (this.timeLimit > 0 && this.timeAlive >= this.timeLimit) {
      this.endGame(false);
      return;
    }

    this.updatePlayer(scaledDt);
    this.reality.update(dt, this.combo.getCombo(), this.score);
    this.sentient.update(dt, this.combo.getCombo(), this.timeAlive, this.isNearDeath());
    this.gridSync.onCombo(this.combo.getCombo());
    this.director.update(dt, {
      combo: this.combo.getCombo(),
      score: this.score,
      timeAlive: this.timeAlive,
      nearDeath: this.isNearDeath(),
      nearMisses: this.nearMisses,
      flow: this.reality.getFlowRatio(),
      struggle: this.reality.getStruggleRatio(),
      lane: this.playerLane,
    });
    this.ghostReplay.setLaneCenters(this.laneCenters, this.playerY);
    this.ghostReplay.record(this.timeAlive, this.playerLane);
    const ghostStatus = this.ghostReplay.update(scaledDt, this.timeAlive);
    if (ghostStatus.ahead && this.timeAlive > 30 && Math.random() < dt * 0.008) {
      this.events.emit('ui:toast', { message: 'Your echo falls behind.', type: 'info' });
    }
    this.myth.update(dt, this.timeAlive);
    this.sentient.onComboHigh(this.combo.getCombo());
    this.reality.setPunishLanes(this.sentient.shouldPunishLeftHabit(), this.sentient.shouldPunishRightHabit());
    this.fourthLaneActive = this.myth.isFourthLaneActive();
    this.updateLaneLayout();
    this.spawner.setModifiers(this.reality.getModifiers());
    this.spawner.update(scaledDt, this.gameHeight);
    this.checkPickupHints();
    this.updateGhostRival(scaledDt);
    this.combo.update(dt);
    this.particles.update(dt);
    this.floatingText.update(dt);
    this.updatePowerups(dt);
    this.updateScoreBoost(dt);
    this.updatePhase(dt);
    this.syncEntities();
    this.checkCollisions();
    this.checkNearMisses();
    this.checkMilestones();
    this.checkSpeedTiers();
    this.updateLivingBackground(scaledDt);
    this.applyDynamicCamera();
    this.applyScreenShake();
    this.applyRealityGlitch();
    this.updatePlayerVisuals();

    const intensity = this.spawner.getSpeedRatio();
    this.audio.setIntensity(intensity);
    this.watcher?.update(dt, this.playerX, this.playerY);
    const combo = this.combo.getCombo();
    if (combo >= 10) this.watcher?.onCombo(combo);

    if (this.timeAlive >= 120 && this.watcher && !this.save.save.worldMemory.watcherDefeated) {
      this.save.markWatcherDefeated();
      this.watcher.setDefeated();
      this.watcher = null;
    }

    this.updateAudioLayers();
    this.audio.setRealityPitch(this.reality.getMusicPitch());

    if (!this.save.settings.reducedMotion) {
      this.particles.trail(this.playerX, this.playerY, getCoreColor(this.save.save.unlocks.selectedCore));
    }
  }

  private updateLaneLayout(): void {
    const ratios = this.fourthLaneActive
      ? [0.12, 0.32, 0.55, 0.78]
      : [0.2, 0.5, 0.8];
    const base = ratios.map((r) => this.gameWidth * r);
    const shift = this.reality.getLaneShift(this.timeAlive);
    this.laneCenters = base.map((x, i) => {
      const mult = i === 0 ? 1 : i === base.length - 1 ? -1 : 0.5;
      return x + shift * mult;
    });
  }

  private isNearDeath(): boolean {
    return !this.hasShield && !this.phaseActive && this.spawner.getSpeedMultiplier() > 2;
  }

  private setAudioLayer(layer: 'heartbeat' | 'choir' | 'piano' | 'none'): void {
    if (this.currentAudioLayer === layer) return;
    this.currentAudioLayer = layer;
    this.audio.setEmotionalLayer(layer, layer !== 'none');
  }

  private updateAudioLayers(): void {
    if (this.isNearDeath()) {
      this.setAudioLayer('heartbeat');
    } else if (this.combo.getCombo() >= 8) {
      this.setAudioLayer('choir');
    } else if (this.reality.getActiveDimension()) {
      this.setAudioLayer('none');
    } else {
      this.setAudioLayer('none');
    }
  }

  private async handleImpossibleCrash(): Promise<void> {
    this.gamePausedForEvent = true;
    this.events.emit('ui:impossible_crash', {});
    await new Promise((r) => setTimeout(r, 5500));
    this.events.emit('ui:hype', {
      title: 'JUST KIDDING',
      subtitle: 'Welcome to the Null Zone',
      tier: 5,
      color: 'magenta',
    });
    this.reality.enterNullZone();
    this.gamePausedForEvent = false;
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
    const dim = this.reality.getActiveDimension();
    if (dim) {
      this.save.recordDimensionSeen(dim.id);
      this.gridSync.onDimensionEntered(dim.id);
      this.events.emit('grid:dimension', { id: dim.id });
    }
    this.livingBg?.setTheme(theme);
    this.livingBg?.setFractureActive(true, 0.85);
    this.watcher?.setFractureHidden(true);
    if (this.save.settings.reducedMotion) return;
    this.shakeAmount = Math.max(this.shakeAmount, 10);
    this.audio.playFracture();
  }

  private onRealityFractureEnd(): void {
    this.livingBg?.restoreBaseBiome();
    this.livingBg?.setFractureActive(false);
    this.watcher?.setFractureHidden(false);
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
    const baseGlitch = this.save.save.worldMemory.gridSync >= GRID_SYNC.THRESHOLDS.GLITCHES ? 0.12 : 0;
    const g = this.reality.getGlitchIntensity() + baseGlitch;
    if (g > 0.2) {
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
    const label = delta >= 0 ? `+${delta}` : `${delta}`;
    this.floatingText.spawn(x, y, label, color, Math.abs(delta) >= 50 ? 22 : 16);
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
          case 'white_firewall':
            graphic = createWhiteFirewall(entity.width, entity.height);
            break;
          case 'vault':
            graphic = entity.isQuantumVault ? createGoldenShard(26) : createShard(22);
            graphic.alpha = entity.isQuantumVault ? 1 : 0.8;
            break;
          case 'score_boost':
            graphic = createScoreBoostPickup(14);
            break;
          case 'bomb':
            graphic = createBombPickup(14);
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

      if (entity.type === 'shard' || entity.type === 'vault' || entity.type === 'score_boost') {
        graphic.rotation += 0.02;
      }
      if (entity.type === 'bomb') {
        graphic.rotation = Math.sin(this.timeAlive * 5 + entity.id) * 0.15;
        graphic.scale.set(1 + Math.sin(this.timeAlive * 8 + entity.id) * 0.06);
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

      if (entity.lane !== this.playerLane && entity.type !== 'shard' && entity.type !== 'vault' && entity.type !== 'white_firewall') {
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
        case 'white_firewall':
          this.spawner.removeEntity(entity.id);
          this.addScore(200, this.playerX, this.playerY - 25);
          this.popScore(this.playerX, this.playerY - 25, 200, COLORS.white);
          this.particles.burst(this.playerX, this.playerY, COLORS.white, 20, 200);
          break;
        case 'powerup':
          this.collectPowerup(entity.id, entity.powerupType!);
          break;
        case 'score_boost':
          this.collectScoreBoost(entity.id);
          break;
        case 'bomb':
          this.collectBomb(entity.id);
          break;
      }
    }
  }

  private checkPickupHints(): void {
    for (const entity of this.spawner.getEntities()) {
      if (!entity.active || entity.collected) continue;
      if (entity.type !== 'bomb' && entity.type !== 'score_boost') continue;
      if (this.save.hasSeenPickup(entity.type)) continue;
      if (entity.y < 40 || entity.y > this.gameHeight) continue;

      this.save.markPickupSeen(entity.type);
      const message = entity.type === 'bomb'
        ? 'Data trap! Avoid it — −100 points'
        : 'Gold star — double points for 10 seconds!';
      this.events.emit('ui:toast', { message, type: 'info' });
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
        this.save.recordNearMissLifetime();
        if (lateralDist < 55 && this.spawner.getSpeedMultiplier() > 1.5) {
          this.director.onNearMissClutch();
        }
        this.addScore(SCORING.NEAR_MISS_BONUS);
        this.popScore(this.playerX, this.playerY - 30, SCORING.NEAR_MISS_BONUS, COLORS.gold);
        this.audio.playNearMiss();
        this.reality.onNearMiss();
        this.events.emit('ui:hype', { title: 'EDGE RUNNER!', subtitle: `+${SCORING.NEAR_MISS_BONUS} near miss`, tier: 2, color: 'gold' });
        this.shakeAmount = Math.max(this.shakeAmount, 5);
        this.particles.burst(this.playerX, this.playerY - 20, COLORS.gold, 12, 180);
      } else {
        this.nearMissChecked.add(entity.id);
        this.save.recordFirewallDodged();
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
      this.audio.setEmotionalLayer('piano', true);
      setTimeout(() => this.audio.setEmotionalLayer('piano', false), 2000);
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
    const mythMult = this.myth.getShardMultiplier();
    if (mythMult > 1) this.myth.consumeMythMultiplier();
    const boosted = Math.floor(baseValue * this.upgrades.getShardMultiplier() * this.getShardValueMult() * mythMult);
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
      this.livingBg?.triggerVaultZoom();
    } else if (isVault) {
      this.events.emit('ui:hype', { title: 'VAULT JACKPOT!', subtitle: `+${points.toLocaleString()}`, tier: 5, color: 'gold' });
      this.audio.playVaultJackpot();
      this.shakeAmount = Math.max(this.shakeAmount, 14);
      this.livingBg?.triggerVaultZoom();
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

  private updateScoreBoost(dt: number): void {
    if (this.scoreBoostTimer > 0) {
      this.scoreBoostTimer = Math.max(0, this.scoreBoostTimer - dt);
    }
  }

  private collectScoreBoost(entityId: number): void {
    this.spawner.removeEntity(entityId);
    this.director.onRiskChoice(false);
    this.scoreBoostTimer = PICKUP.SCORE_BOOST_DURATION;
    this.audio.playPowerup();
    this.particles.burst(this.playerX, this.playerY, COLORS.gold, 18, 220);
    this.events.emit('ui:hype', {
      title: '2× SYNC!',
      subtitle: 'Double points for 10 seconds',
      tier: 3,
      color: 'gold',
    });
    this.events.emit('ui:toast', { message: 'Score multiplier active!', type: 'milestone' });
  }

  private collectBomb(entityId: number): void {
    this.spawner.removeEntity(entityId);
    this.director.onRiskChoice(true);
    this.subtractScore(PICKUP.BOMB_PENALTY, this.playerX, this.playerY - 20);
    this.audio.playComboBreak();
    this.shakeAmount = Math.max(this.shakeAmount, 14);
    this.events.emit('ui:flash', { color: 'rgba(255,0,80,0.35)', duration: 180 });
    this.particles.burst(this.playerX, this.playerY, COLORS.red, 22, 280);
    this.events.emit('ui:hype', {
      title: 'DATA TRAP!',
      subtitle: `−${PICKUP.BOMB_PENALTY} points`,
      tier: 1,
      color: 'magenta',
    });
  }

  private subtractScore(amount: number, popupX?: number, popupY?: number): void {
    const loss = Math.min(amount, this.score);
    this.score = Math.max(0, this.score - loss);
    this.events.emit('score:change', { score: this.score, delta: -loss });
    if (popupX !== undefined && popupY !== undefined && loss > 0) {
      this.popScore(popupX, popupY, -loss, COLORS.red);
    }
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
    const boost = this.scoreBoostTimer > 0 ? PICKUP.SCORE_BOOST_MULTIPLIER : 1;
    const finalDelta = Math.floor(delta * overclock * boost);
    this.score += finalDelta;
    this.events.emit('score:change', { score: this.score, delta: finalDelta });
    this.checkChallengeVictory();
    if (popupX !== undefined && popupY !== undefined) {
      const color = boost > 1 || overclock > 1 ? COLORS.gold : COLORS.cyan;
      this.popScore(popupX, popupY, finalDelta, color);
    }
  }

  private endGame(fromDeath: boolean): void {
    if (this.gameOver) return;
    this.gameOver = true;

    if (fromDeath) {
      this.save.recordDeath({
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
      });
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

    const syncCompleted = this.gridSync.finalizeRun(stats);

    const modeKey = stats.mode === 'timeAttack60' ? 'timeAttack60'
      : stats.mode === 'timeAttack120' ? 'timeAttack120'
      : stats.mode === 'challenge' ? 'challenge' : 'endless';
    const best = this.save.save.highScores[modeKey as keyof typeof this.save.save.highScores];
    const ghost = this.ghostReplay.finalize(stats.score, best);
    if (ghost) this.save.saveGhostReplay(ghost);
    this.director.finalizeRun(stats.score, stats.timeAlive, stats.mode);
    this.ghostReplay.destroy();

    setTimeout(() => {
      this.events.emit('game:over', { stats });
      this.achievements.check(stats);
      this.onComplete?.(stats, syncCompleted);
    }, fromDeath ? 800 : 100);
  }

  private updateLivingBackground(dt: number): void {
    if (!this.livingBg) return;
    const fractureActive = !!this.reality.getActiveDimension();
    const cam = this.livingBg.update({
      dt,
      scrollSpeed: this.spawner.getScrollSpeed(),
      speedRatio: this.spawner.getSpeedRatio(),
      combo: this.combo.getCombo(),
      timeAlive: this.timeAlive,
      nearDeath: this.isNearDeath(),
      fractureActive,
      fractureIntensity: fractureActive ? 0.7 : 0,
      playerX: this.playerX,
      playerY: this.playerY,
      vaultNearby: false,
      hasShield: this.hasShield,
    });
    this.cameraZoom = cam.zoom;
    this.cameraStretchY = cam.stretchY;
    if (this.isNearDeath() && !this.save.settings.reducedMotion) {
      this.shakeAmount = Math.max(this.shakeAmount, 2.5);
    }
  }

  private applyDynamicCamera(): void {
    if (this.save.settings.reducedMotion) {
      this.container.pivot.set(0, 0);
      this.container.scale.set(1);
      this.container.x = 0;
      this.container.y = 0;
      return;
    }
    const bossVisible = this.spawner.getEntities().some((e) => e.isBoss && e.active);
    let zoom = this.cameraZoom;
    if (bossVisible) zoom += 0.015;
    this.container.scale.set(zoom, zoom * this.cameraStretchY);
    this.container.pivot.set(this.gameWidth / 2, this.gameHeight * 0.5);
    this.container.x = this.gameWidth / 2;
    this.container.y = this.gameHeight * 0.5;
  }

  private applyScreenShake(): void {
    if (this.shakeAmount > 0 && !this.save.settings.reducedMotion) {
      this.container.x += (Math.random() - 0.5) * this.shakeAmount;
      this.container.y += (Math.random() - 0.5) * this.shakeAmount;
      this.shakeAmount *= 0.9;
      if (this.shakeAmount < 0.5) {
        this.shakeAmount = 0;
      }
    }
  }

  private clearEntities(): void {
    for (const [, g] of this.entityGraphics) {
      g.destroy({ children: true });
    }
    this.entityGraphics.clear();
  }

  abandonRunEarly(): void {
    if (this.gameOver) return;
    this.gridSync.onQuitEarly(this.timeAlive);
    this.gameOver = true;
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
  getScoreBoostRatio(): number {
    return this.scoreBoostTimer / PICKUP.SCORE_BOOST_DURATION;
  }
  hasScoreBoost(): boolean {
    return this.scoreBoostTimer > 0;
  }
}
