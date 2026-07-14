import { Container, Graphics } from 'pixi.js';
import { COLORS } from '@/config/constants';
import {
  RUN_EVOLUTION,
  resolveThemePalette,
  type EnvEventId,
} from '@/config/backgroundConfig';
import { createRng } from '@/utils/math';

export interface LivingBackgroundOptions {
  theme: string;
  totalRuns: number;
  seed: number;
  reducedMotion: boolean;
}

function evolutionStage(totalRuns: number): number {
  if (totalRuns >= RUN_EVOLUTION.SKY_ALIVE) return 6;
  if (totalRuns >= RUN_EVOLUTION.REALITY_TEAR) return 5;
  if (totalRuns >= RUN_EVOLUTION.WATCHER_HINT) return 4;
  if (totalRuns >= RUN_EVOLUTION.AI_STRUCTURES) return 3;
  if (totalRuns >= RUN_EVOLUTION.BRIGHTER_VOID) return 2;
  if (totalRuns >= RUN_EVOLUTION.MORE_STARS) return 1;
  return 0;
}

function starCount(stage: number): number {
  return 32 + stage * 18;
}

/** Deep void + nebula fog */
function buildVoidLayer(width: number, height: number, pal: ReturnType<typeof resolveThemePalette>, stage: number): Container {
  const layer = new Container();
  layer.label = 'void';

  const bg = new Graphics();
  bg.rect(0, 0, width, height);
  bg.fill({ color: pal.bg, alpha: 1 });
  layer.addChild(bg);

  const brightness = 0.04 + stage * 0.012;
  const nebula = new Graphics();
  nebula.ellipse(width * 0.3, height * 0.25, width * 0.55, height * 0.35);
  nebula.fill({ color: pal.accent, alpha: brightness });
  nebula.ellipse(width * 0.72, height * 0.55, width * 0.4, height * 0.28);
  nebula.fill({ color: pal.glow, alpha: brightness * 0.7 });
  layer.addChild(nebula);

  const fog = new Graphics();
  fog.rect(0, height * 0.55, width, height * 0.45);
  fog.fill({ color: pal.line, alpha: 0.08 + stage * 0.01 });
  layer.addChild(fog);

  return layer;
}

/** Floating stars */
function buildStarsLayer(width: number, height: number, count: number, rng: () => number): Container {
  const layer = new Container();
  layer.label = 'stars';
  const g = new Graphics();
  for (let i = 0; i < count; i++) {
    const sx = rng() * width;
    const sy = rng() * height;
    const r = 0.4 + rng() * 1.2;
    g.circle(sx, sy, r);
    g.fill({ color: 0xffffff, alpha: 0.06 + rng() * 0.14 });
  }
  layer.addChild(g);
  return layer;
}

/** Digital dust + tiny glowing particles */
function buildDustLayer(width: number, height: number, pal: ReturnType<typeof resolveThemePalette>, rng: () => number): Container {
  const layer = new Container();
  layer.label = 'dust';
  const g = new Graphics();
  for (let i = 0; i < 60; i++) {
    const x = rng() * width;
    const y = rng() * height;
    const r = 0.5 + rng() * 1.5;
    g.circle(x, y, r);
    g.fill({ color: pal.glow, alpha: 0.04 + rng() * 0.08 });
  }
  layer.addChild(g);
  return layer;
}

/** Distant data streams */
function buildStreamsLayer(width: number, height: number, pal: ReturnType<typeof resolveThemePalette>, rng: () => number): Container {
  const layer = new Container();
  layer.label = 'streams';
  const g = new Graphics();
  for (let i = 0; i < 12; i++) {
    const x = rng() * width;
    const len = 40 + rng() * 120;
    g.moveTo(x, rng() * height);
    g.lineTo(x + (rng() - 0.5) * 8, rng() * height + len);
    g.stroke({ color: pal.accent, width: 1, alpha: 0.04 + rng() * 0.06 });
  }
  layer.addChild(g);
  return layer;
}

/** Colossal server towers / quantum cubes — different every run via seed */
function buildStructuresLayer(
  width: number,
  height: number,
  pal: ReturnType<typeof resolveThemePalette>,
  rng: () => number,
): Container {
  const layer = new Container();
  layer.label = 'structures';
  const g = new Graphics();

  const count = 4 + Math.floor(rng() * 4);
  for (let i = 0; i < count; i++) {
    const x = rng() * width;
    const baseY = height * (0.15 + rng() * 0.55);
    const w = 20 + rng() * 50;
    const h = 80 + rng() * 180;
    const kind = Math.floor(rng() * 4);

    if (kind === 0) {
      g.rect(x - w / 2, baseY, w, h);
      g.fill({ color: pal.line, alpha: 0.06 + rng() * 0.04 });
      for (let row = 0; row < 5; row++) {
        g.rect(x - w / 2 + 4, baseY + row * (h / 5) + 4, w - 8, 2);
        g.fill({ color: pal.accent, alpha: 0.08 });
      }
    } else if (kind === 1) {
      const s = 30 + rng() * 40;
      g.rect(x - s / 2, baseY, s, s);
      g.fill({ color: pal.glow, alpha: 0.05 });
      g.stroke({ color: pal.accent, width: 1, alpha: 0.12 });
    } else if (kind === 2) {
      g.moveTo(x - w / 2, baseY + h);
      g.lineTo(x, baseY);
      g.lineTo(x + w / 2, baseY + h);
      g.closePath();
      g.fill({ color: pal.line, alpha: 0.05 });
    } else {
      for (let n = 0; n < 3; n++) {
        g.circle(x + (n - 1) * 18, baseY + n * 25, 6 + rng() * 4);
        g.fill({ color: pal.glow, alpha: 0.07 });
        if (n < 2) {
          g.moveTo(x + (n - 1) * 18, baseY + n * 25);
          g.lineTo(x + n * 18, baseY + (n + 1) * 25);
          g.stroke({ color: pal.accent, width: 1, alpha: 0.1 });
        }
      }
    }
  }

  layer.addChild(g);
  layer.alpha = 0.85;
  return layer;
}

/** Animated breathing grid layers */
function buildGridLayers(
  width: number,
  height: number,
  pal: ReturnType<typeof resolveThemePalette>,
): Container[] {
  const layers: Container[] = [];
  const laneXs = [width * 0.2, width * 0.5, width * 0.8];

  for (let layer = 0; layer < 3; layer++) {
    const layerContainer = new Container();
    layerContainer.label = `grid-layer-${layer}`;
    const alpha = 0.1 + layer * 0.06;
    const spacing = 40 + layer * 20;
    const g = new Graphics();

    for (let y = 0; y < height + spacing; y += spacing) {
      g.moveTo(0, y);
      g.lineTo(width, y);
      g.stroke({ color: pal.line, width: 1, alpha });
    }
    for (const lx of laneXs) {
      g.moveTo(lx, 0);
      g.lineTo(lx, height);
      g.stroke({ color: pal.accent, width: 1, alpha: alpha * 0.4 });
    }

    layerContainer.addChild(g);
    layers.push(layerContainer);
  }

  const laneGlow = new Graphics();
  laneGlow.label = 'lane-glow';
  for (const lx of laneXs) {
    laneGlow.rect(lx - width * 0.08, 0, width * 0.16, height);
    laneGlow.fill({ color: pal.accent, alpha: 0.03 });
  }
  const laneContainer = new Container();
  laneContainer.label = 'lane-glow';
  laneContainer.addChild(laneGlow);
  layers.push(laneContainer);

  return layers;
}

/** Grid crack overlay during high combo / fracture */
export function buildFractureCracks(width: number, height: number, pal: ReturnType<typeof resolveThemePalette>, rng: () => number): Container {
  const layer = new Container();
  layer.label = 'fracture-cracks';
  layer.alpha = 0;
  const g = new Graphics();
  for (let i = 0; i < 8; i++) {
    const x = rng() * width;
    const y = rng() * height;
    g.moveTo(x, y);
    g.lineTo(x + (rng() - 0.5) * 80, y + (rng() - 0.5) * 80);
    g.lineTo(x + (rng() - 0.5) * 60, y + (rng() - 0.5) * 100);
    g.stroke({ color: pal.glow, width: 1.5, alpha: 0.5 });
  }
  layer.addChild(g);
  return layer;
}

/** Speed streak overlay */
function buildSpeedStreaks(width: number, height: number, pal: ReturnType<typeof resolveThemePalette>): Container {
  const layer = new Container();
  layer.label = 'speed-streaks';
  layer.alpha = 0;
  const g = new Graphics();
  for (let i = 0; i < 24; i++) {
    const x = (i * width) / 24;
    g.moveTo(x, 0);
    g.lineTo(x + 2, height);
    g.stroke({ color: pal.accent, width: 1, alpha: 0.06 });
  }
  layer.addChild(g);
  return layer;
}

/** Paint environmental event onto weather layer */
export function paintEnvEvent(
  container: Container,
  width: number,
  height: number,
  event: EnvEventId,
  pal: ReturnType<typeof resolveThemePalette>,
): void {
  const weather = container.children.find((c) => c.label === 'weather') as Container | undefined;
  if (!weather) return;
  weather.removeChildren();
  const g = new Graphics();

  switch (event) {
    case 'data_rain':
      for (let i = 0; i < 70; i++) {
        const x = (i * 47) % width;
        const y = (i * 31) % height;
        g.moveTo(x, y);
        g.lineTo(x - 3, y + 12);
        g.stroke({ color: pal.accent, width: 1, alpha: 0.1 + (i % 3) * 0.03 });
      }
      break;
    case 'firewall_lightning':
      for (let i = 0; i < 4; i++) {
        const x = (i + 1) * width / 5;
        let lx = x;
        let ly = 0;
        g.moveTo(lx, ly);
        for (let s = 0; s < 6; s++) {
          lx += (Math.sin(i + s) * 20);
          ly += height / 6;
          g.lineTo(lx, ly);
        }
        g.stroke({ color: 0xa855f7, width: 2, alpha: 0.15 });
      }
      break;
    case 'nebula':
      g.ellipse(width * 0.5, height * 0.4, width * 0.6, height * 0.3);
      g.fill({ color: pal.glow, alpha: 0.08 });
      g.ellipse(width * 0.2, height * 0.7, width * 0.35, height * 0.2);
      g.fill({ color: pal.accent, alpha: 0.06 });
      break;
    case 'binary_storm':
      for (let i = 0; i < 50; i++) {
        const x = (i * 61) % width;
        const y = (i * 43) % height;
        g.rect(x, y, 3, 5);
        g.fill({ color: pal.accent, alpha: 0.06 + (i % 2) * 0.04 });
      }
      break;
    case 'frozen_matrix':
      for (let i = 0; i < 40; i++) {
        const x = (i * 53) % width;
        const y = (i * 37) % height;
        g.rect(x, y, 1, 8 + (i % 4) * 4);
        g.fill({ color: 0x88ddff, alpha: 0.08 });
      }
      g.rect(0, 0, width, height);
      g.fill({ color: 0x004466, alpha: 0.04 });
      break;
    case 'inferno_grid':
      g.rect(0, height * 0.6, width, height * 0.4);
      g.fill({ color: 0xff4400, alpha: 0.06 });
      for (let i = 0; i < 20; i++) {
        g.circle((i * 73) % width, height * 0.7 + (i * 29) % (height * 0.25), 3 + (i % 3));
        g.fill({ color: 0xff6600, alpha: 0.05 });
      }
      break;
    case 'quantum_vortex':
      for (let i = 0; i < 6; i++) {
        const r = 40 + i * 35;
        g.circle(width * 0.5, height * 0.45, r);
        g.stroke({ color: pal.glow, width: 1, alpha: 0.06 - i * 0.008 });
      }
      break;
    case 'neon_dust':
      for (let i = 0; i < 35; i++) {
        g.circle((i * 89) % width, (i * 67) % height, 2 + (i % 3));
        g.fill({ color: COLORS.magenta, alpha: 0.06 });
      }
      break;
    default:
      break;
  }

  weather.addChild(g);
  weather.alpha = event === 'none' ? 0 : 0.75;
}

/** Merge director weather with env events */
export function paintDirectorWeather(
  container: Container,
  width: number,
  height: number,
  weather: string,
): void {
  if (weather === 'clear') return;
  const weatherLayer = container.children.find((c) => c.label === 'weather') as Container | undefined;
  if (!weatherLayer) return;

  const g = new Graphics();
  if (weather === 'data_rain') {
    for (let i = 0; i < 40; i++) {
      const x = (i * 47) % width;
      const y = (i * 31) % height;
      g.moveTo(x, y);
      g.lineTo(x - 4, y + 14);
      g.stroke({ color: COLORS.cyan, width: 1, alpha: 0.1 });
    }
  } else if (weather === 'static_storm') {
    for (let i = 0; i < 30; i++) {
      g.rect((i * 73) % width, (i * 53) % height, 2, 1);
      g.fill({ color: COLORS.magenta, alpha: 0.06 });
    }
  } else if (weather === 'void_fog') {
    g.rect(0, height * 0.4, width, height * 0.6);
    g.fill({ color: 0x0a0e1a, alpha: 0.3 });
  } else if (weather === 'corruption_haze') {
    g.rect(0, 0, width, height);
    g.fill({ color: COLORS.magenta, alpha: 0.05 });
  }
  weatherLayer.addChild(g);
}

export function createLivingBackground(
  width: number,
  height: number,
  options: LivingBackgroundOptions,
): Container {
  const container = new Container();
  container.label = 'living-background';

  const pal = resolveThemePalette(options.theme);
  const stage = evolutionStage(options.totalRuns);
  const rng = createRng(options.seed ^ (options.totalRuns * 7919));

  container.addChild(buildVoidLayer(width, height, pal, stage));
  container.addChild(buildStarsLayer(width, height, starCount(stage), rng));
  container.addChild(buildDustLayer(width, height, pal, rng));
  container.addChild(buildStreamsLayer(width, height, pal, rng));

  if (stage >= 3) {
    container.addChild(buildStructuresLayer(width, height, pal, rng));
  }

  for (const gridLayer of buildGridLayers(width, height, pal)) {
    container.addChild(gridLayer);
  }

  const weather = new Container();
  weather.label = 'weather';
  container.addChild(weather);

  container.addChild(buildSpeedStreaks(width, height, pal));
  container.addChild(buildFractureCracks(width, height, pal, rng));

  const scanlines = new Graphics();
  scanlines.label = 'scanlines';
  for (let y = 0; y < height; y += 4) {
    scanlines.moveTo(0, y);
    scanlines.lineTo(width, y);
    scanlines.stroke({ color: 0x000000, width: 1, alpha: 0.05 });
  }
  container.addChild(scanlines);

  if (stage >= 5) {
    const tear = new Graphics();
    tear.label = 'reality-tear';
    for (let i = 0; i < 3; i++) {
      tear.moveTo(rng() * width, 0);
      tear.lineTo(rng() * width, height);
      tear.stroke({ color: pal.glow, width: 1, alpha: 0.04 });
    }
    container.addChild(tear);
  }

  return container;
}
