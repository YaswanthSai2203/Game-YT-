import { Container } from 'pixi.js';
import {
  BACKGROUND,
  BIOME_SWAP_FADE,
  BIOME_SWAP_INTERVAL,
  ENV_EVENT_CYCLE,
  resolveBiomeFromEnvEvent,
  resolveBiomeFromTheme,
  resolveThemePalette,
  type BackgroundBiomeId,
  type EnvEventId,
} from '@/config/backgroundConfig';
import {
  createLivingBackground,
  getBiomeLabel,
  type LivingBackgroundOptions,
} from '@/graphics/LivingBackground';
import { clamp, lerp } from '@/utils/math';

export interface LivingBackgroundState {
  zoom: number;
  offsetX: number;
  offsetY: number;
  stretchY: number;
}

export interface LivingBackgroundUpdateInput {
  dt: number;
  scrollSpeed: number;
  speedRatio: number;
  combo: number;
  timeAlive: number;
  nearDeath: boolean;
  fractureActive: boolean;
  fractureIntensity: number;
  playerX: number;
  playerY: number;
  vaultNearby: boolean;
  hasShield: boolean;
}

export class LivingBackgroundSystem {
  private parent: Container;
  private container: Container;
  private pendingContainer: Container | null = null;
  private width: number;
  private height: number;
  private biome: BackgroundBiomeId;
  private baseBiome: BackgroundBiomeId;
  private totalRuns: number;
  private seed: number;
  private reducedMotion: boolean;

  private pulsePhase = 0;
  private envEventTimer = 0;
  private envEventIndex = 0;
  private currentEnvEvent: EnvEventId = 'nebula';
  private comboGlow = 0;
  private crackIntensity = 0;
  private speedStretch = 0;
  private cameraZoom = 1;
  private idleDriftPhase = 0;
  private vaultZoomPulse = 0;
  private swapFade = 0;
  private onBiomeChange: ((label: string) => void) | null = null;

  constructor(
    parent: Container,
    width: number,
    height: number,
    options: LivingBackgroundOptions & { onBiomeChange?: (label: string) => void },
  ) {
    this.parent = parent;
    this.width = width;
    this.height = height;
    this.biome = options.biome;
    this.baseBiome = options.biome;
    this.totalRuns = options.totalRuns;
    this.seed = options.seed;
    this.reducedMotion = options.reducedMotion;
    this.onBiomeChange = options.onBiomeChange ?? null;

    this.container = this.buildContainer(options.biome);
    parent.addChildAt(this.container, 0);

    this.envEventIndex = Math.floor(Math.random() * ENV_EVENT_CYCLE.length);
    this.currentEnvEvent = ENV_EVENT_CYCLE[this.envEventIndex] ?? 'nebula';
  }

  getBiome(): BackgroundBiomeId {
    return this.biome;
  }

  getContainer(): Container {
    return this.container;
  }

  setFractureActive(active: boolean, intensity = 0.5): void {
    if (active) {
      this.crackIntensity = Math.max(this.crackIntensity, intensity);
    } else {
      this.crackIntensity = lerp(this.crackIntensity, 0, 0.08);
    }
  }

  /** Full biome swap for reality fractures */
  setTheme(theme: string): void {
    const biome = resolveBiomeFromTheme(theme);
    this.swapBiome(biome, true);
  }

  /** Return to run's base biome after fracture */
  restoreBaseBiome(): void {
    this.swapBiome(this.baseBiome, true);
  }

  rebuild(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.hardSwap(this.biome);
  }

  triggerVaultZoom(): void {
    this.vaultZoomPulse = 1;
    this.swapBiome('vault_dimension', false);
    setTimeout(() => {
      if (this.biome === 'vault_dimension') {
        this.swapBiome(this.baseBiome, false);
      }
    }, 4000);
  }

  destroy(): void {
    this.pendingContainer?.destroy({ children: true });
    this.container.destroy({ children: true });
  }

  update(input: LivingBackgroundUpdateInput): LivingBackgroundState {
    if (this.reducedMotion) {
      return { zoom: 1, offsetX: 0, offsetY: 0, stretchY: 1 };
    }

    this.pulsePhase += input.dt;
    this.idleDriftPhase += input.dt * 0.3;
    this.updateBiomeRotation(input.dt, input.timeAlive, input.fractureActive);
    this.updateSwapFade(input.dt);

    const pal = resolveThemePalette(this.biome === 'inferno_grid' ? 'inferno'
      : this.biome === 'quantum_ocean' ? 'quantum'
      : this.biome === 'null_zone' ? 'null'
      : this.biome === 'echo_chamber' ? 'ghost'
      : this.biome === 'chrono_rift' ? 'chrono'
      : this.biome === 'vault_dimension' ? 'gold'
      : this.biome === 'matrix_frost' ? 'matrix'
      : 'default');

    const speed = input.scrollSpeed;
    const activeContainer = this.container;

    for (const layer of activeContainer.children) {
      const label = layer.label ?? '';

      if (label === 'stars' && layer.children.length > 0) {
        layer.y += speed * input.dt * BACKGROUND.SPEEDS.stars;
        if (layer.y > 60) layer.y -= 60;
        layer.alpha = 0.65 + Math.sin(this.pulsePhase * 0.5) * 0.12;
      } else if (label === 'dust' && layer.children.length > 0) {
        layer.y += speed * input.dt * BACKGROUND.SPEEDS.dust;
        if (layer.y > 40) layer.y -= 40;
        layer.alpha = 0.7 + Math.sin(this.pulsePhase * 0.7) * 0.1;
      } else if (label === 'streams') {
        layer.y += speed * input.dt * BACKGROUND.SPEEDS.streams;
        if (layer.y > 50) layer.y -= 50;
      } else if (label === 'structures') {
        layer.y += speed * input.dt * BACKGROUND.SPEEDS.structures;
        if (layer.y > 20) layer.y -= 20;
        layer.x = Math.sin(this.idleDriftPhase * 0.15) * 8;
      } else if (label.startsWith('grid-layer-')) {
        const idx = parseInt(label.split('-')[2] ?? '0', 10);
        layer.y += speed * input.dt * (BACKGROUND.SPEEDS.grid0 + idx * 0.06);
        if (layer.y > 40) layer.y -= 40;
        layer.alpha = 0.85 + Math.sin(this.pulsePhase * (1 + idx * 0.2)) * 0.15;
        layer.tint = pal.accent;
      } else if (label === 'lane-glow') {
        const comboBoost = clamp(input.combo / 40, 0, 1);
        layer.alpha = 0.75 + Math.sin(this.pulsePhase * 1.2) * 0.12 + comboBoost * 0.3;
      } else if (label === 'speed-streaks') {
        const stretchTarget = input.speedRatio >= BACKGROUND.SPEED_STRETCH_THRESHOLD
          ? clamp((input.speedRatio - 1) * 0.5, 0, 0.8) : 0;
        this.speedStretch = lerp(this.speedStretch, stretchTarget, input.dt * 3);
        layer.alpha = this.speedStretch * 0.65;
        layer.scale.y = 1 + this.speedStretch * 2.5;
      } else if (label === 'fracture-cracks') {
        const comboCrack = input.combo >= BACKGROUND.COMBO_WAVE_THRESHOLD
          ? clamp((input.combo - 10) / 30, 0, 1) : 0;
        const target = Math.max(comboCrack, input.fractureActive ? input.fractureIntensity : 0, this.crackIntensity);
        this.crackIntensity = lerp(this.crackIntensity, target, input.dt * 4);
        layer.alpha = this.crackIntensity * 0.75;
      } else if (label === 'reality-tear') {
        layer.alpha = 0.04 + Math.sin(this.pulsePhase * 2) * 0.02;
      } else if (label === 'void') {
        layer.alpha = 0.95 + Math.sin(this.pulsePhase * 0.3) * 0.05;
      }
    }

    this.comboGlow = lerp(
      this.comboGlow,
      input.combo >= BACKGROUND.COMBO_GLOW_THRESHOLD ? clamp(input.combo / 25, 0, 1) : 0,
      input.dt * 4,
    );

    if (input.combo >= BACKGROUND.COMBO_WAVE_THRESHOLD) {
      const wave = Math.sin(this.pulsePhase * 4) * 0.025 * this.comboGlow;
      for (const layer of activeContainer.children) {
        if (layer.label?.startsWith('grid-layer-')) {
          layer.scale.x = 1 + wave;
        }
      }
    }

    this.updateCamera(input);

    if (this.vaultZoomPulse > 0) {
      this.vaultZoomPulse = Math.max(0, this.vaultZoomPulse - input.dt * 2);
    }

    return {
      zoom: this.cameraZoom,
      offsetX: Math.sin(this.idleDriftPhase) * 3,
      offsetY: Math.cos(this.idleDriftPhase * 0.7) * 2,
      stretchY: 1 + this.speedStretch * 0.04,
    };
  }

  private buildContainer(biome: BackgroundBiomeId): Container {
    return createLivingBackground(this.width, this.height, {
      biome,
      totalRuns: this.totalRuns,
      seed: this.seed,
      reducedMotion: this.reducedMotion,
    });
  }

  private swapBiome(biome: BackgroundBiomeId, announce: boolean): void {
    if (biome === this.biome && !this.pendingContainer) return;

    if (this.reducedMotion) {
      this.hardSwap(biome);
      if (announce) this.onBiomeChange?.(getBiomeLabel(biome));
      return;
    }

    this.biome = biome;
    const idx = this.parent.getChildIndex(this.container);
    this.pendingContainer = this.buildContainer(biome);
    this.pendingContainer.alpha = 0;
    this.parent.addChildAt(this.pendingContainer, idx);
    this.swapFade = 0;

    if (announce) {
      this.onBiomeChange?.(getBiomeLabel(biome));
    }
  }

  private hardSwap(biome: BackgroundBiomeId): void {
    const idx = this.parent.getChildIndex(this.container);
    this.container.destroy({ children: true });
    this.biome = biome;
    this.container = this.buildContainer(biome);
    this.parent.addChildAt(this.container, idx);
    this.pendingContainer = null;
    this.swapFade = 1;
  }

  private updateSwapFade(dt: number): void {
    if (!this.pendingContainer) return;
    this.swapFade += dt / BIOME_SWAP_FADE;
    this.pendingContainer.alpha = clamp(this.swapFade, 0, 1);
    this.container.alpha = 1 - this.pendingContainer.alpha;

    if (this.swapFade >= 1) {
      const old = this.container;
      this.container = this.pendingContainer;
      this.pendingContainer = null;
      this.container.alpha = 1;
      old.destroy({ children: true });
    }
  }

  private updateBiomeRotation(dt: number, timeAlive: number, fractureActive: boolean): void {
    if (fractureActive || timeAlive < 25) return;
    this.envEventTimer += dt;
    if (this.envEventTimer < BIOME_SWAP_INTERVAL) return;

    this.envEventTimer = 0;
    this.envEventIndex = (this.envEventIndex + 1) % ENV_EVENT_CYCLE.length;
    this.currentEnvEvent = ENV_EVENT_CYCLE[this.envEventIndex] ?? 'nebula';
    const biome = resolveBiomeFromEnvEvent(this.currentEnvEvent);
    this.swapBiome(biome, true);
  }

  private updateCamera(input: LivingBackgroundUpdateInput): void {
    let target = 1;
    if (input.combo >= 20) {
      target += BACKGROUND.CAMERA_COMBO_ZOOM * clamp((input.combo - 20) / 20, 0, 1);
    }
    if (input.speedRatio >= BACKGROUND.SPEED_STRETCH_THRESHOLD) {
      target += BACKGROUND.CAMERA_SPEED_ZOOM * clamp(input.speedRatio - 1, 0, 1);
    }
    if (this.vaultZoomPulse > 0) {
      target += 0.04 * this.vaultZoomPulse;
    }
    this.cameraZoom = lerp(this.cameraZoom, target, input.dt * 2);
  }
}
