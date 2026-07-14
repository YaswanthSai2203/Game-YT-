import { Container, Graphics } from 'pixi.js';
import {
  RUN_EVOLUTION,
  resolveThemePalette,
  type BackgroundBiomeId,
} from '@/config/backgroundConfig';
import { createRng } from '@/utils/math';

export interface BiomeBuildOptions {
  biome: BackgroundBiomeId;
  totalRuns: number;
  seed: number;
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

function labeled(name: string): Container {
  const c = new Container();
  c.label = name;
  return c;
}

function addScanlines(container: Container, width: number, height: number, alpha = 0.05): void {
  const scanlines = new Graphics();
  scanlines.label = 'scanlines';
  for (let y = 0; y < height; y += 4) {
    scanlines.moveTo(0, y);
    scanlines.lineTo(width, y);
    scanlines.stroke({ color: 0x000000, width: 1, alpha });
  }
  container.addChild(scanlines);
}

function addLaneGlow(container: Container, width: number, height: number, color: number, alpha: number): void {
  const lane = labeled('lane-glow');
  const g = new Graphics();
  for (const lx of [width * 0.2, width * 0.5, width * 0.8]) {
    g.rect(lx - width * 0.08, 0, width * 0.16, height);
    g.fill({ color, alpha });
  }
  lane.addChild(g);
  container.addChild(lane);
}

function addGridLayers(
  container: Container,
  width: number,
  height: number,
  lineColor: number,
  accent: number,
  style: 'lines' | 'dots' | 'hex' | 'minimal' | 'circuit' | 'ripple' = 'lines',
): void {
  const laneXs = [width * 0.2, width * 0.5, width * 0.8];
  for (let layer = 0; layer < 3; layer++) {
    const lc = labeled(`grid-layer-${layer}`);
    const g = new Graphics();
    const alpha = 0.1 + layer * 0.07;
    const spacing = 38 + layer * 18;

    if (style === 'lines') {
      for (let y = 0; y < height + spacing; y += spacing) {
        g.moveTo(0, y);
        g.lineTo(width, y);
        g.stroke({ color: lineColor, width: 1, alpha });
      }
      for (const lx of laneXs) {
        g.moveTo(lx, 0);
        g.lineTo(lx, height);
        g.stroke({ color: accent, width: 1, alpha: alpha * 0.45 });
      }
    } else if (style === 'dots') {
      for (let y = 0; y < height; y += spacing) {
        for (let x = 0; x < width; x += spacing) {
          g.circle(x, y, 1.2);
          g.fill({ color: accent, alpha: alpha * 0.6 });
        }
      }
    } else if (style === 'hex') {
      for (let y = 0; y < height; y += spacing * 1.2) {
        for (let x = 0; x < width; x += spacing * 1.4) {
          const hx = x + (Math.floor(y / spacing) % 2) * (spacing * 0.7);
          g.moveTo(hx, y);
          g.lineTo(hx + 8, y + 5);
          g.lineTo(hx + 8, y + 15);
          g.lineTo(hx, y + 20);
          g.lineTo(hx - 8, y + 15);
          g.lineTo(hx - 8, y + 5);
          g.closePath();
          g.stroke({ color: lineColor, width: 1, alpha: alpha * 0.5 });
        }
      }
    } else if (style === 'minimal') {
      for (const lx of laneXs) {
        g.moveTo(lx, 0);
        g.lineTo(lx, height);
        g.stroke({ color: accent, width: 1, alpha: alpha * 0.9 });
      }
      for (let y = 0; y < height; y += spacing * 2) {
        g.moveTo(0, y);
        g.lineTo(width, y);
        g.stroke({ color: lineColor, width: 1, alpha: alpha * 0.35 });
      }
    } else if (style === 'circuit') {
      for (let i = 0; i < 8; i++) {
        const y = (i + 1) * (height / 9);
        g.moveTo(0, y);
        g.lineTo(width * 0.3, y);
        g.lineTo(width * 0.35, y - 20);
        g.lineTo(width * 0.65, y - 20);
        g.lineTo(width * 0.7, y);
        g.lineTo(width, y);
        g.stroke({ color: accent, width: 1.5, alpha: alpha * 0.7 });
      }
    } else if (style === 'ripple') {
      for (let i = 0; i < 6; i++) {
        const cy = height * (0.2 + i * 0.13);
        g.ellipse(width * 0.5, cy, width * (0.3 + i * 0.04), 12 + i * 3);
        g.stroke({ color: accent, width: 1, alpha: alpha * (0.8 - i * 0.1) });
      }
    }

    lc.addChild(g);
    container.addChild(lc);
  }
}

function addOverlayLayers(container: Container, width: number, height: number, pal: ReturnType<typeof resolveThemePalette>, rng: () => number): void {
  const weather = labeled('weather');
  container.addChild(weather);

  const streaks = labeled('speed-streaks');
  streaks.alpha = 0;
  const sg = new Graphics();
  for (let i = 0; i < 20; i++) {
    const x = (i * width) / 20;
    sg.moveTo(x, 0);
    sg.lineTo(x + 2, height);
    sg.stroke({ color: pal.accent, width: 1, alpha: 0.06 });
  }
  streaks.addChild(sg);
  container.addChild(streaks);

  const cracks = labeled('fracture-cracks');
  cracks.alpha = 0;
  const cg = new Graphics();
  for (let i = 0; i < 8; i++) {
    const x = rng() * width;
    const y = rng() * height;
    cg.moveTo(x, y);
    cg.lineTo(x + (rng() - 0.5) * 80, y + (rng() - 0.5) * 80);
    cg.stroke({ color: pal.glow, width: 1.5, alpha: 0.5 });
  }
  cracks.addChild(cg);
  container.addChild(cracks);
}

/** Default — dark cosmic cyber grid */
function buildCyberVoid(w: number, h: number, stage: number, rng: () => number): Container {
  const c = labeled('living-background');
  const pal = resolveThemePalette('default');

  const voidL = labeled('void');
  const bg = new Graphics();
  bg.rect(0, 0, w, h);
  bg.fill({ color: 0x020408, alpha: 1 });
  voidL.addChild(bg);
  const neb = new Graphics();
  neb.ellipse(w * 0.35, h * 0.2, w * 0.5, h * 0.3);
  neb.fill({ color: 0x00f0ff, alpha: 0.05 + stage * 0.01 });
  voidL.addChild(neb);
  c.addChild(voidL);

  const stars = labeled('stars');
  const sg = new Graphics();
  for (let i = 0; i < 40 + stage * 12; i++) {
    sg.circle(rng() * w, rng() * h, 0.5 + rng());
    sg.fill({ color: 0xffffff, alpha: 0.08 + rng() * 0.12 });
  }
  stars.addChild(sg);
  c.addChild(stars);

  const dust = labeled('dust');
  const dg = new Graphics();
  for (let i = 0; i < 50; i++) {
    dg.circle(rng() * w, rng() * h, 0.8 + rng());
    dg.fill({ color: pal.glow, alpha: 0.05 + rng() * 0.06 });
  }
  dust.addChild(dg);
  c.addChild(dust);

  const streams = labeled('streams');
  const stg = new Graphics();
  for (let i = 0; i < 10; i++) {
    stg.moveTo(rng() * w, rng() * h);
    stg.lineTo(rng() * w, rng() * h + 80);
    stg.stroke({ color: pal.accent, width: 1, alpha: 0.06 });
  }
  streams.addChild(stg);
  c.addChild(streams);

  if (stage >= 3) {
    const structures = labeled('structures');
    const tg = new Graphics();
    for (let i = 0; i < 5; i++) {
      const x = rng() * w;
      const bh = 100 + rng() * 150;
      tg.rect(x - 15, h * 0.1 + rng() * 0.3 * h, 30 + rng() * 30, bh);
      tg.fill({ color: pal.line, alpha: 0.07 });
    }
    structures.addChild(tg);
    c.addChild(structures);
  }

  addGridLayers(c, w, h, pal.line, pal.accent, 'lines');
  addLaneGlow(c, w, h, pal.accent, 0.035);
  addOverlayLayers(c, w, h, pal, rng);
  addScanlines(c, w, h);
  return c;
}

/** Inferno — molten orange circuits, ember ash, heat bands */
function buildInfernoGrid(w: number, h: number, rng: () => number): Container {
  const c = labeled('living-background');
  const pal = resolveThemePalette('inferno');

  const voidL = labeled('void');
  const bg = new Graphics();
  bg.rect(0, 0, w, h);
  bg.fill({ color: 0x0a0200, alpha: 1 });
  bg.rect(0, h * 0.5, w, h * 0.5);
  bg.fill({ color: 0x2a0800, alpha: 0.6 });
  for (let i = 0; i < 5; i++) {
    bg.rect(0, h * (0.55 + i * 0.08), w, h * 0.04);
    bg.fill({ color: 0xff4400, alpha: 0.04 + i * 0.01 });
  }
  voidL.addChild(bg);
  c.addChild(voidL);

  const dust = labeled('dust');
  const dg = new Graphics();
  for (let i = 0; i < 80; i++) {
    dg.circle(rng() * w, rng() * h, 1 + rng() * 2);
    dg.fill({ color: 0xff6600, alpha: 0.06 + rng() * 0.1 });
  }
  dust.addChild(dg);
  c.addChild(dust);

  const stars = labeled('stars');
  const sg = new Graphics();
  for (let i = 0; i < 30; i++) {
    sg.circle(rng() * w, rng() * h * 0.6, 1 + rng() * 2);
    sg.fill({ color: 0xffaa00, alpha: 0.08 });
  }
  stars.addChild(sg);
  c.addChild(stars);

  const streams = labeled('streams');
  streams.alpha = 0.5;
  c.addChild(streams);

  const structures = labeled('structures');
  const tg = new Graphics();
  for (let i = 0; i < 4; i++) {
    const x = w * (0.15 + i * 0.22);
    tg.moveTo(x, h);
    tg.lineTo(x - 40, h * 0.3);
    tg.lineTo(x + 40, h * 0.3);
    tg.closePath();
    tg.fill({ color: 0x441100, alpha: 0.12 });
    tg.stroke({ color: 0xff4400, width: 2, alpha: 0.15 });
  }
  structures.addChild(tg);
  c.addChild(structures);

  addGridLayers(c, w, h, 0x661100, 0xff4400, 'circuit');
  addLaneGlow(c, w, h, 0xff6600, 0.06);
  addOverlayLayers(c, w, h, pal, rng);
  addScanlines(c, w, h, 0.03);
  return c;
}

/** Quantum Ocean — deep blue, ripples, floating cubes */
function buildQuantumOcean(w: number, h: number, rng: () => number): Container {
  const c = labeled('living-background');
  const pal = resolveThemePalette('quantum');

  const voidL = labeled('void');
  const bg = new Graphics();
  bg.rect(0, 0, w, h);
  bg.fill({ color: 0x020818, alpha: 1 });
  bg.rect(0, 0, w, h * 0.5);
  bg.fill({ color: 0x0a2060, alpha: 0.35 });
  for (let i = 0; i < 8; i++) {
    bg.ellipse(w * 0.5, h * (0.3 + i * 0.08), w * 0.45, 18);
    bg.fill({ color: 0x2266cc, alpha: 0.04 });
  }
  voidL.addChild(bg);
  c.addChild(voidL);

  const stars = labeled('stars');
  stars.alpha = 0.4;
  c.addChild(stars);

  const dust = labeled('dust');
  const dg = new Graphics();
  for (let i = 0; i < 40; i++) {
    dg.circle(rng() * w, rng() * h, 1 + rng());
    dg.fill({ color: 0x6699ff, alpha: 0.08 });
  }
  dust.addChild(dg);
  c.addChild(dust);

  const structures = labeled('structures');
  const tg = new Graphics();
  for (let i = 0; i < 12; i++) {
    const s = 12 + rng() * 28;
    const x = rng() * w;
    const y = rng() * h;
    tg.rect(x - s / 2, y - s / 2, s, s);
    tg.fill({ color: 0x3355aa, alpha: 0.1 });
    tg.stroke({ color: 0x88bbff, width: 1, alpha: 0.2 });
  }
  structures.addChild(tg);
  c.addChild(structures);

  const streams = labeled('streams');
  const stg = new Graphics();
  for (let i = 0; i < 6; i++) {
    stg.circle(w * 0.5, h * (0.25 + i * 0.12), 30 + i * 25);
    stg.stroke({ color: 0x4488ff, width: 1, alpha: 0.08 - i * 0.01 });
  }
  streams.addChild(stg);
  c.addChild(streams);

  addGridLayers(c, w, h, 0x112244, 0x6699ff, 'ripple');
  addLaneGlow(c, w, h, 0x4488ff, 0.05);
  addOverlayLayers(c, w, h, pal, rng);
  addScanlines(c, w, h, 0.03);
  return c;
}

/** Null Zone — near-black, white wire geometry only */
function buildNullZone(w: number, h: number, rng: () => number): Container {
  const c = labeled('living-background');
  const pal = resolveThemePalette('null');

  const voidL = labeled('void');
  const bg = new Graphics();
  bg.rect(0, 0, w, h);
  bg.fill({ color: 0x000001, alpha: 1 });
  voidL.addChild(bg);
  c.addChild(voidL);

  const stars = labeled('stars');
  stars.alpha = 0;
  c.addChild(stars);

  const dust = labeled('dust');
  dust.alpha = 0;
  c.addChild(dust);

  const streams = labeled('streams');
  streams.alpha = 0;
  c.addChild(streams);

  const structures = labeled('structures');
  const tg = new Graphics();
  for (let i = 0; i < 3; i++) {
    tg.rect(w * (0.1 + i * 0.35), h * 0.15, 2, h * 0.5);
    tg.fill({ color: 0xffffff, alpha: 0.04 });
  }
  structures.addChild(tg);
  c.addChild(structures);

  addGridLayers(c, w, h, 0x333333, 0xffffff, 'minimal');
  addLaneGlow(c, w, h, 0xffffff, 0.02);
  addOverlayLayers(c, w, h, pal, rng);
  return c;
}

/** Echo Chamber — mirrored duplicates, ghost particles */
function buildEchoChamber(w: number, h: number, rng: () => number): Container {
  const c = labeled('living-background');
  const pal = resolveThemePalette('ghost');

  const voidL = labeled('void');
  const bg = new Graphics();
  bg.rect(0, 0, w, h);
  bg.fill({ color: 0x0c0614, alpha: 1 });
  bg.rect(w * 0.5, 0, w * 0.5, h);
  bg.fill({ color: 0x180a20, alpha: 0.5 });
  voidL.addChild(bg);
  c.addChild(voidL);

  const stars = labeled('stars');
  const sg = new Graphics();
  for (let i = 0; i < 60; i++) {
    const x = rng() * w * 0.5;
    const y = rng() * h;
    sg.circle(x, y, 0.8 + rng());
    sg.fill({ color: 0xff006e, alpha: 0.1 });
    sg.circle(w - x, y, 0.8 + rng());
    sg.fill({ color: 0xff006e, alpha: 0.06 });
  }
  stars.addChild(sg);
  c.addChild(stars);

  const dust = labeled('dust');
  const dg = new Graphics();
  for (let i = 0; i < 40; i++) {
    dg.circle(rng() * w, rng() * h, 2 + rng() * 3);
    dg.fill({ color: 0xff006e, alpha: 0.04 });
  }
  dust.addChild(dg);
  c.addChild(dust);

  const streams = labeled('streams');
  streams.alpha = 0.3;
  c.addChild(streams);

  addGridLayers(c, w, h, 0x330033, 0xff006e, 'dots');
  addLaneGlow(c, w, h, 0xff006e, 0.04);
  addOverlayLayers(c, w, h, pal, rng);
  addScanlines(c, w, h, 0.04);
  return c;
}

/** Chrono Rift — clock fragments, floating numbers */
function buildChronoRift(w: number, h: number, rng: () => number): Container {
  const c = labeled('living-background');
  const pal = resolveThemePalette('chrono');

  const voidL = labeled('void');
  const bg = new Graphics();
  bg.rect(0, 0, w, h);
  bg.fill({ color: 0x040818, alpha: 1 });
  voidL.addChild(bg);
  c.addChild(voidL);

  const stars = labeled('stars');
  const sg = new Graphics();
  for (let i = 0; i < 25; i++) {
    const cx = rng() * w;
    const cy = rng() * h * 0.7;
    const r = 15 + rng() * 30;
    sg.circle(cx, cy, r);
    sg.stroke({ color: 0x00f0ff, width: 1, alpha: 0.08 });
    for (let t = 0; t < 12; t++) {
      const a = (t / 12) * Math.PI * 2;
      sg.moveTo(cx, cy);
      sg.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      sg.stroke({ color: 0x00d4ff, width: 1, alpha: 0.06 });
    }
  }
  stars.addChild(sg);
  c.addChild(stars);

  const dust = labeled('dust');
  const dg = new Graphics();
  const nums = ['0', '1', '7', '3', '9', '∞'];
  for (let i = 0; i < 20; i++) {
    const x = rng() * w;
    const y = rng() * h;
    dg.rect(x, y, 8, 12);
    dg.fill({ color: 0x00f0ff, alpha: 0.06 + (i % 3) * 0.03 });
    void nums;
  }
  dust.addChild(dg);
  c.addChild(dust);

  const streams = labeled('streams');
  streams.alpha = 0.4;
  c.addChild(streams);

  addGridLayers(c, w, h, 0x004466, 0x00f0ff, 'hex');
  addLaneGlow(c, w, h, 0x00f0ff, 0.045);
  addOverlayLayers(c, w, h, pal, rng);
  addScanlines(c, w, h);
  return c;
}

/** Neural Web — massive AI circuitry */
function buildNeuralWeb(w: number, h: number, rng: () => number): Container {
  const c = labeled('living-background');
  const pal = resolveThemePalette('ghost');

  const voidL = labeled('void');
  const bg = new Graphics();
  bg.rect(0, 0, w, h);
  bg.fill({ color: 0x060410, alpha: 1 });
  voidL.addChild(bg);
  c.addChild(voidL);

  const structures = labeled('structures');
  const tg = new Graphics();
  const nodes: { x: number; y: number }[] = [];
  for (let i = 0; i < 18; i++) {
    nodes.push({ x: rng() * w, y: rng() * h * 0.75 });
  }
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (rng() > 0.65) continue;
      tg.moveTo(nodes[i].x, nodes[i].y);
      tg.lineTo(nodes[j].x, nodes[j].y);
      tg.stroke({ color: 0x9944ff, width: 1, alpha: 0.06 });
    }
  }
  for (const n of nodes) {
    tg.circle(n.x, n.y, 4 + rng() * 6);
    tg.fill({ color: 0xcc66ff, alpha: 0.1 });
  }
  structures.addChild(tg);
  c.addChild(structures);

  const stars = labeled('stars');
  stars.alpha = 0.3;
  c.addChild(stars);

  const dust = labeled('dust');
  dust.alpha = 0.5;
  c.addChild(dust);

  const streams = labeled('streams');
  streams.alpha = 0.3;
  c.addChild(streams);

  addGridLayers(c, w, h, 0x220044, 0x9944ff, 'circuit');
  addLaneGlow(c, w, h, 0x9944ff, 0.05);
  addOverlayLayers(c, w, h, pal, rng);
  addScanlines(c, w, h);
  return c;
}

/** Matrix Frost — green digital rain columns */
function buildMatrixFrost(w: number, h: number, rng: () => number): Container {
  const c = labeled('living-background');
  const pal = resolveThemePalette('matrix');

  const voidL = labeled('void');
  const bg = new Graphics();
  bg.rect(0, 0, w, h);
  bg.fill({ color: 0x010a04, alpha: 1 });
  voidL.addChild(bg);
  c.addChild(voidL);

  const streams = labeled('streams');
  const stg = new Graphics();
  for (let col = 0; col < 40; col++) {
    const x = (col / 40) * w + rng() * 8;
    let y = rng() * h * 0.5;
    stg.moveTo(x, y);
    for (let seg = 0; seg < 8; seg++) {
      y += 12 + rng() * 20;
      stg.lineTo(x + (rng() - 0.5) * 4, y);
    }
    stg.stroke({ color: 0x00ff44, width: 1, alpha: 0.08 + (col % 3) * 0.03 });
  }
  streams.addChild(stg);
  c.addChild(streams);

  const dust = labeled('dust');
  const dg = new Graphics();
  for (let i = 0; i < 30; i++) {
    dg.rect(rng() * w, rng() * h, 2, 6 + rng() * 10);
    dg.fill({ color: 0x00cc66, alpha: 0.1 });
  }
  dust.addChild(dg);
  c.addChild(dust);

  const stars = labeled('stars');
  stars.alpha = 0.2;
  c.addChild(stars);

  addGridLayers(c, w, h, 0x003300, 0x00ff44, 'dots');
  addLaneGlow(c, w, h, 0x00ff44, 0.04);
  addOverlayLayers(c, w, h, pal, rng);
  addScanlines(c, w, h, 0.06);
  return c;
}

/** Data Storm — binary blocks, static interference */
function buildDataStorm(w: number, h: number, rng: () => number): Container {
  const c = labeled('living-background');
  const pal = resolveThemePalette('default');

  const voidL = labeled('void');
  const bg = new Graphics();
  bg.rect(0, 0, w, h);
  bg.fill({ color: 0x080810, alpha: 1 });
  bg.rect(0, 0, w, h);
  bg.fill({ color: 0xff006e, alpha: 0.03 });
  voidL.addChild(bg);
  c.addChild(voidL);

  const dust = labeled('dust');
  const dg = new Graphics();
  for (let i = 0; i < 120; i++) {
    const bw = 3 + (i % 4) * 2;
    const bh = 3 + (i % 3) * 3;
    dg.rect(rng() * w, rng() * h, bw, bh);
    dg.fill({ color: i % 2 ? 0x00f0ff : 0xff006e, alpha: 0.07 + rng() * 0.06 });
  }
  dust.addChild(dg);
  c.addChild(dust);

  const stars = labeled('stars');
  stars.alpha = 0.15;
  c.addChild(stars);

  const streams = labeled('streams');
  streams.alpha = 0.6;
  c.addChild(streams);

  addGridLayers(c, w, h, 0x222233, 0xff006e, 'lines');
  addLaneGlow(c, w, h, 0x00f0ff, 0.035);
  addOverlayLayers(c, w, h, pal, rng);
  addScanlines(c, w, h, 0.08);
  return c;
}

/** Nebula Drift — deep cosmic purple clouds */
function buildNebulaDrift(w: number, h: number, stage: number, rng: () => number): Container {
  const c = labeled('living-background');
  const pal = resolveThemePalette('quantum');

  const voidL = labeled('void');
  const bg = new Graphics();
  bg.rect(0, 0, w, h);
  bg.fill({ color: 0x050210, alpha: 1 });
  for (let i = 0; i < 6; i++) {
    bg.ellipse(rng() * w, rng() * h * 0.8, w * (0.2 + rng() * 0.3), h * (0.1 + rng() * 0.15));
    bg.fill({ color: [0x6633aa, 0x9944cc, 0x3366aa][i % 3], alpha: 0.06 + stage * 0.008 });
  }
  voidL.addChild(bg);
  c.addChild(voidL);

  const stars = labeled('stars');
  const sg = new Graphics();
  for (let i = 0; i < 80 + stage * 10; i++) {
    sg.circle(rng() * w, rng() * h, 0.5 + rng() * 1.5);
    sg.fill({ color: 0xffffff, alpha: 0.06 + rng() * 0.14 });
  }
  stars.addChild(sg);
  c.addChild(stars);

  const dust = labeled('dust');
  dust.alpha = 0.6;
  c.addChild(dust);

  const streams = labeled('streams');
  streams.alpha = 0.4;
  c.addChild(streams);

  addGridLayers(c, w, h, 0x220044, 0xaa66ff, 'hex');
  addLaneGlow(c, w, h, 0x9944cc, 0.04);
  addOverlayLayers(c, w, h, pal, rng);
  addScanlines(c, w, h, 0.03);
  return c;
}

/** Vault Dimension — golden sacred geometry */
function buildVaultDimension(w: number, h: number, rng: () => number): Container {
  const c = labeled('living-background');
  const pal = resolveThemePalette('gold');

  const voidL = labeled('void');
  const bg = new Graphics();
  bg.rect(0, 0, w, h);
  bg.fill({ color: 0x0a0804, alpha: 1 });
  bg.ellipse(w * 0.5, h * 0.4, w * 0.4, h * 0.25);
  bg.fill({ color: 0xffd700, alpha: 0.06 });
  voidL.addChild(bg);
  c.addChild(voidL);

  const structures = labeled('structures');
  const tg = new Graphics();
  for (let i = 0; i < 3; i++) {
    const cx = w * (0.25 + i * 0.25);
    const cy = h * 0.35;
    const r = 40 + i * 20;
    tg.circle(cx, cy, r);
    tg.stroke({ color: 0xffd700, width: 1, alpha: 0.12 });
    tg.circle(cx, cy, r * 0.5);
    tg.stroke({ color: 0xffaa00, width: 1, alpha: 0.08 });
  }
  structures.addChild(tg);
  c.addChild(structures);

  const stars = labeled('stars');
  const sg = new Graphics();
  for (let i = 0; i < 35; i++) {
    sg.circle(rng() * w, rng() * h, 1 + rng());
    sg.fill({ color: 0xffd700, alpha: 0.1 });
  }
  stars.addChild(sg);
  c.addChild(stars);

  const dust = labeled('dust');
  dust.alpha = 0.5;
  c.addChild(dust);

  const streams = labeled('streams');
  streams.alpha = 0.3;
  c.addChild(streams);

  addGridLayers(c, w, h, 0x443300, 0xffd700, 'hex');
  addLaneGlow(c, w, h, 0xffd700, 0.05);
  addOverlayLayers(c, w, h, pal, rng);
  addScanlines(c, w, h, 0.03);
  return c;
}

export function buildBackgroundBiome(
  width: number,
  height: number,
  options: BiomeBuildOptions,
): Container {
  const stage = evolutionStage(options.totalRuns);
  const rng = createRng(options.seed ^ (options.totalRuns * 7919));

  switch (options.biome) {
    case 'inferno_grid': return buildInfernoGrid(width, height, rng);
    case 'quantum_ocean': return buildQuantumOcean(width, height, rng);
    case 'null_zone': return buildNullZone(width, height, rng);
    case 'echo_chamber': return buildEchoChamber(width, height, rng);
    case 'chrono_rift': return buildChronoRift(width, height, rng);
    case 'neural_web': return buildNeuralWeb(width, height, rng);
    case 'matrix_frost': return buildMatrixFrost(width, height, rng);
    case 'data_storm': return buildDataStorm(width, height, rng);
    case 'nebula_drift': return buildNebulaDrift(width, height, stage, rng);
    case 'vault_dimension': return buildVaultDimension(width, height, rng);
    case 'cyber_void':
    default:
      return buildCyberVoid(width, height, stage, rng);
  }
}

export function getBiomeLabel(biome: BackgroundBiomeId): string {
  const labels: Record<BackgroundBiomeId, string> = {
    cyber_void: 'Cyber Void',
    inferno_grid: 'Inferno Grid',
    quantum_ocean: 'Quantum Ocean',
    null_zone: 'Null Zone',
    echo_chamber: 'Echo Chamber',
    chrono_rift: 'Chrono Rift',
    neural_web: 'Neural Web',
    matrix_frost: 'Frozen Matrix',
    data_storm: 'Binary Storm',
    nebula_drift: 'Nebula Drift',
    vault_dimension: 'Vault Dimension',
  };
  return labels[biome];
}
