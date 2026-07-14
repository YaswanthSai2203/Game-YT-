import { Container } from 'pixi.js';
import {
  BACKGROUND,
  ENV_EVENT_CYCLE,
  ENV_EVENT_INTERVAL,
  resolveThemePalette,
  type EnvEventId,
} from '@/config/backgroundConfig';
import {
  createLivingBackground,
  paintDirectorWeather,
  paintEnvEvent,
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
  private width: number;
  private height: number;
  private theme: string;
  private totalRuns: number;
  private seed: number;
  private reducedMotion: boolean;
  private directorWeather: string;

  private pulsePhase = 0;
  private envEventTimer = 0;
  private envEventIndex = 0;
  private currentEnvEvent: EnvEventId = 'none';
  private comboGlow = 0;
  private crackIntensity = 0;
  private speedStretch = 0;
  private cameraZoom = 1;
  private cameraTargetZoom = 1;
  private idleDriftPhase = 0;
  private vaultZoomPulse = 0;

  constructor(
    parent: Container,
    width: number,
    height: number,
    options: LivingBackgroundOptions & { directorWeather?: string },
  ) {
    this.parent = parent;
    this.width = width;
    this.height = height;
    this.theme = options.theme;
    this.totalRuns = options.totalRuns;
    this.seed = options.seed;
    this.reducedMotion = options.reducedMotion;
    this.directorWeather = options.directorWeather ?? 'clear';

    this.container = createLivingBackground(width, height, options);
    parent.addChildAt(this.container, 0);

    if (this.directorWeather !== 'clear') {
      paintDirectorWeather(this.container, width, height, this.directorWeather);
    }
    this.pickInitialEnvEvent();
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

  setTheme(theme: string, preserveWeather = false): void {
    this.theme = theme;
    const idx = this.parent.getChildIndex(this.container);
    this.container.destroy({ children: true });
    this.container = createLivingBackground(this.width, this.height, {
      theme: this.theme,
      totalRuns: this.totalRuns,
      seed: this.seed,
      reducedMotion: this.reducedMotion,
    });
    this.parent.addChildAt(this.container, idx);

    if (preserveWeather) {
      paintEnvEvent(this.container, this.width, this.height, this.currentEnvEvent, resolveThemePalette(theme));
    } else if (this.directorWeather !== 'clear') {
      paintDirectorWeather(this.container, this.width, this.height, this.directorWeather);
      paintEnvEvent(this.container, this.width, this.height, this.currentEnvEvent, resolveThemePalette(theme));
    } else {
      paintEnvEvent(this.container, this.width, this.height, this.currentEnvEvent, resolveThemePalette(theme));
    }
  }

  rebuild(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.setTheme(this.theme, true);
  }

  triggerVaultZoom(): void {
    this.vaultZoomPulse = 1;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }

  update(input: LivingBackgroundUpdateInput): LivingBackgroundState {
    if (this.reducedMotion) {
      return { zoom: 1, offsetX: 0, offsetY: 0, stretchY: 1 };
    }

    this.pulsePhase += input.dt;
    this.idleDriftPhase += input.dt * 0.3;
    this.updateEnvEvents(input.dt, input.timeAlive);

    const pal = resolveThemePalette(this.theme);
    const speed = input.scrollSpeed;

    for (const layer of this.container.children) {
      const label = layer.label ?? '';

      if (label === 'stars') {
        layer.y += speed * input.dt * BACKGROUND.SPEEDS.stars;
        if (layer.y > 60) layer.y -= 60;
        layer.alpha = 0.65 + Math.sin(this.pulsePhase * 0.5) * 0.12;
      } else if (label === 'dust') {
        layer.y += speed * input.dt * BACKGROUND.SPEEDS.dust;
        if (layer.y > 40) layer.y -= 40;
        layer.alpha = 0.7 + Math.sin(this.pulsePhase * 0.7) * 0.1;
      } else if (label === 'streams') {
        layer.y += speed * input.dt * BACKGROUND.SPEEDS.streams;
        if (layer.y > 50) layer.y -= 50;
      } else if (label === 'structures') {
        layer.y += speed * input.dt * BACKGROUND.SPEEDS.structures;
        if (layer.y > 20) layer.y -= 20;
        layer.x = Math.sin(this.idleDriftPhase * 0.15) * 6;
      } else if (label.startsWith('grid-layer-')) {
        const idx = parseInt(label.split('-')[2] ?? '0', 10);
        layer.y += speed * input.dt * (BACKGROUND.SPEEDS.grid0 + idx * 0.06);
        if (layer.y > 40) layer.y -= 40;
        const breathe = 0.85 + Math.sin(this.pulsePhase * (1 + idx * 0.2)) * 0.15;
        layer.alpha = breathe;
        layer.tint = pal.accent;
      } else if (label === 'lane-glow') {
        const comboBoost = clamp(input.combo / 40, 0, 1);
        layer.alpha = 0.75 + Math.sin(this.pulsePhase * 1.2) * 0.12 + comboBoost * 0.25;
      } else if (label === 'weather') {
        layer.y += speed * input.dt * BACKGROUND.SPEEDS.weather;
        if (layer.y > 30) layer.y -= 30;
        layer.alpha = (this.currentEnvEvent === 'none' ? 0 : 0.7)
          + Math.sin(this.pulsePhase * 0.9) * 0.08;
      } else if (label === 'speed-streaks') {
        const stretchTarget = input.speedRatio >= BACKGROUND.SPEED_STRETCH_THRESHOLD
          ? clamp((input.speedRatio - 1) * 0.5, 0, 0.8) : 0;
        this.speedStretch = lerp(this.speedStretch, stretchTarget, input.dt * 3);
        layer.alpha = this.speedStretch * 0.6;
        layer.scale.y = 1 + this.speedStretch * 2;
      } else if (label === 'fracture-cracks') {
        const comboCrack = input.combo >= BACKGROUND.COMBO_WAVE_THRESHOLD
          ? clamp((input.combo - 10) / 30, 0, 1) : 0;
        const target = Math.max(comboCrack, input.fractureActive ? input.fractureIntensity : 0, this.crackIntensity);
        this.crackIntensity = lerp(this.crackIntensity, target, input.dt * 4);
        layer.alpha = this.crackIntensity * 0.7;
      } else if (label === 'reality-tear') {
        layer.alpha = 0.04 + Math.sin(this.pulsePhase * 2) * 0.02;
      }
    }

    this.comboGlow = lerp(
      this.comboGlow,
      input.combo >= BACKGROUND.COMBO_GLOW_THRESHOLD ? clamp(input.combo / 25, 0, 1) : 0,
      input.dt * 4,
    );

    if (input.combo >= BACKGROUND.COMBO_WAVE_THRESHOLD) {
      const wave = Math.sin(this.pulsePhase * 4) * 0.02 * this.comboGlow;
      for (const layer of this.container.children) {
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
      stretchY: 1 + this.speedStretch * 0.03,
    };
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
      target += 0.03 * this.vaultZoomPulse;
    }

    this.cameraTargetZoom = target;
    this.cameraZoom = lerp(this.cameraZoom, this.cameraTargetZoom, input.dt * 2);
  }

  private pickInitialEnvEvent(): void {
    this.envEventIndex = Math.floor(Math.random() * ENV_EVENT_CYCLE.length);
    this.currentEnvEvent = ENV_EVENT_CYCLE[this.envEventIndex] ?? 'none';
    paintEnvEvent(
      this.container,
      this.width,
      this.height,
      this.currentEnvEvent,
      resolveThemePalette(this.theme),
    );
  }

  private updateEnvEvents(dt: number, timeAlive: number): void {
    if (timeAlive < 20) return;
    this.envEventTimer += dt;
    if (this.envEventTimer < ENV_EVENT_INTERVAL) return;

    this.envEventTimer = 0;
    this.envEventIndex = (this.envEventIndex + 1) % ENV_EVENT_CYCLE.length;
    this.currentEnvEvent = ENV_EVENT_CYCLE[this.envEventIndex] ?? 'none';
    paintEnvEvent(
      this.container,
      this.width,
      this.height,
      this.currentEnvEvent,
      resolveThemePalette(this.theme),
    );
  }
}
