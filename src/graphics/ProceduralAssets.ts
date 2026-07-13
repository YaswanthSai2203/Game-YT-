import { Graphics, Container } from 'pixi.js';
import { COLORS, CORE_COLORS } from '@/config/constants';

export function createPlayerCore(radius: number, color: number, coreId?: string): Container {
  const container = new Container();
  const isGridBound = coreId === 'grid-bound';

  const glow = new Graphics();
  glow.circle(0, 0, radius * (isGridBound ? 2.2 : 1.8));
  glow.fill({ color, alpha: isGridBound ? 0.22 : 0.15 });
  container.addChild(glow);

  if (isGridBound) {
    const ring = new Graphics();
    ring.circle(0, 0, radius * 1.35);
    ring.stroke({ color: 0xff006e, width: 1.5, alpha: 0.55 });
    container.addChild(ring);

    const lattice = new Graphics();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI * 2) / 6;
      lattice.moveTo(0, 0);
      lattice.lineTo(Math.cos(angle) * radius * 1.1, Math.sin(angle) * radius * 1.1);
      lattice.stroke({ color: 0x00f0ff, width: 1, alpha: 0.35 });
    }
    container.addChild(lattice);
  }

  const hex = new Graphics();
  const sides = 6;
  hex.moveTo(radius, 0);
  for (let i = 1; i <= sides; i++) {
    const angle = (i * Math.PI * 2) / sides;
    hex.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  hex.fill({ color, alpha: isGridBound ? 0.95 : 0.9 });
  hex.stroke({ color: isGridBound ? 0x00f0ff : 0xffffff, width: isGridBound ? 2 : 1.5, alpha: isGridBound ? 0.85 : 0.5 });
  container.addChild(hex);

  const inner = new Graphics();
  inner.circle(0, 0, radius * 0.35);
  inner.fill({ color: isGridBound ? 0xff006e : 0xffffff, alpha: isGridBound ? 0.9 : 0.8 });
  container.addChild(inner);

  if (isGridBound) {
    container.label = 'grid-bound-core';
  }

  return container;
}

export function createFirewall(width: number, height: number): Container {
  const container = new Container();
  const g = new Graphics();
  g.roundRect(-width / 2, -height / 2, width, height, 4);
  g.fill({ color: COLORS.red, alpha: 0.85 });
  g.stroke({ color: COLORS.magenta, width: 2, alpha: 0.8 });
  container.addChild(g);

  const stripes = new Graphics();
  for (let i = -width / 2; i < width / 2; i += 8) {
    stripes.moveTo(i, -height / 2);
    stripes.lineTo(i + 4, height / 2);
    stripes.stroke({ color: 0xffffff, width: 1, alpha: 0.15 });
  }
  container.addChild(stripes);

  return container;
}

export function createShard(size: number): Container {
  const container = new Container();
  const g = new Graphics();
  g.moveTo(0, -size);
  g.lineTo(size * 0.7, 0);
  g.lineTo(0, size);
  g.lineTo(-size * 0.7, 0);
  g.closePath();
  g.fill({ color: COLORS.cyan, alpha: 0.9 });
  g.stroke({ color: 0xffffff, width: 1, alpha: 0.6 });
  container.addChild(g);

  const glow = new Graphics();
  glow.circle(0, 0, size * 1.5);
  glow.fill({ color: COLORS.cyan, alpha: 0.1 });
  container.addChildAt(glow, 0);

  return container;
}

export function createPowerupIcon(type: string, size: number): Container {
  const container = new Container();
  const colors: Record<string, number> = {
    shield: COLORS.green,
    magnet: COLORS.violet,
    overclock: COLORS.gold,
    chronos: COLORS.cyan,
  };
  const color = colors[type] ?? COLORS.violet;

  const g = new Graphics();
  g.circle(0, 0, size);
  g.fill({ color, alpha: 0.8 });
  g.stroke({ color: 0xffffff, width: 1.5, alpha: 0.5 });
  container.addChild(g);

  const symbol = new Graphics();
  switch (type) {
    case 'shield':
      symbol.moveTo(0, -size * 0.5);
      symbol.lineTo(size * 0.4, -size * 0.2);
      symbol.lineTo(size * 0.4, size * 0.2);
      symbol.lineTo(0, size * 0.5);
      symbol.lineTo(-size * 0.4, size * 0.2);
      symbol.lineTo(-size * 0.4, -size * 0.2);
      symbol.closePath();
      symbol.stroke({ color: 0xffffff, width: 2, alpha: 0.9 });
      break;
    case 'magnet':
      symbol.arc(-size * 0.2, 0, size * 0.25, Math.PI, 0);
      symbol.moveTo(-size * 0.45, 0);
      symbol.lineTo(-size * 0.45, size * 0.3);
      symbol.moveTo(size * 0.05, 0);
      symbol.lineTo(size * 0.05, size * 0.3);
      symbol.stroke({ color: 0xffffff, width: 2, alpha: 0.9 });
      break;
    case 'overclock':
      symbol.moveTo(-size * 0.3, size * 0.2);
      symbol.lineTo(0, -size * 0.4);
      symbol.lineTo(size * 0.3, size * 0.2);
      symbol.stroke({ color: 0xffffff, width: 2, alpha: 0.9 });
      break;
    case 'chronos':
      symbol.circle(0, 0, size * 0.35);
      symbol.moveTo(0, 0);
      symbol.lineTo(0, -size * 0.25);
      symbol.stroke({ color: 0xffffff, width: 2, alpha: 0.9 });
      break;
  }
  container.addChild(symbol);
  return container;
}

export function createScoreBoostPickup(size: number): Container {
  const container = new Container();
  const glow = new Graphics();
  glow.circle(0, 0, size * 1.4);
  glow.fill({ color: COLORS.gold, alpha: 0.2 });
  container.addChild(glow);

  const ring = new Graphics();
  ring.circle(0, 0, size);
  ring.fill({ color: COLORS.gold, alpha: 0.85 });
  ring.stroke({ color: 0xffffff, width: 1.5, alpha: 0.7 });
  container.addChild(ring);

  const label = new Graphics();
  label.moveTo(-size * 0.35, 0);
  label.lineTo(0, -size * 0.45);
  label.lineTo(size * 0.35, 0);
  label.lineTo(0, size * 0.15);
  label.closePath();
  label.fill({ color: 0xffffff, alpha: 0.95 });
  container.addChild(label);

  container.label = 'score-boost';
  return container;
}

export function createBombPickup(size: number): Container {
  const container = new Container();
  const glow = new Graphics();
  glow.circle(0, 0, size * 1.35);
  glow.fill({ color: COLORS.red, alpha: 0.25 });
  container.addChild(glow);

  const body = new Graphics();
  body.circle(0, 0, size * 0.85);
  body.fill({ color: 0x220008, alpha: 0.95 });
  body.stroke({ color: COLORS.red, width: 2, alpha: 0.9 });
  container.addChild(body);

  const fuse = new Graphics();
  fuse.moveTo(0, -size * 0.85);
  fuse.lineTo(size * 0.2, -size * 1.15);
  fuse.stroke({ color: COLORS.gold, width: 2, alpha: 0.9 });
  fuse.circle(size * 0.2, -size * 1.15, size * 0.12);
  fuse.fill({ color: COLORS.gold, alpha: 1 });
  container.addChild(fuse);

  const skull = new Graphics();
  skull.circle(-size * 0.18, -size * 0.08, size * 0.12);
  skull.circle(size * 0.18, -size * 0.08, size * 0.12);
  skull.fill({ color: COLORS.red, alpha: 0.9 });
  skull.moveTo(-size * 0.22, size * 0.22);
  skull.quadraticCurveTo(0, size * 0.05, size * 0.22, size * 0.22);
  skull.stroke({ color: COLORS.red, width: 1.5, alpha: 0.9 });
  container.addChild(skull);

  container.label = 'bomb';
  return container;
}

export function createGridBackground(width: number, height: number, theme: string): Container {
  const container = new Container();
  container.label = 'play-background';

  const themeColors: Record<string, { bg: number; accent: number; line: number }> = {
    inferno: { bg: 0x1a0808, accent: 0xff4400, line: 0x441100 },
    matrix: { bg: 0x041204, accent: 0x00ff44, line: 0x003300 },
    quantum: { bg: 0x0c0420, accent: 0x8b5cf6, line: 0x220044 },
    ghost: { bg: 0x100818, accent: 0xff006e, line: 0x330033 },
    gold: { bg: 0x141008, accent: 0xffd700, line: 0x443300 },
    default: { bg: 0x060a14, accent: COLORS.cyan, line: COLORS.gridLine },
  };
  const pal = themeColors[theme] ?? themeColors.default;

  const gradient = new Graphics();
  gradient.rect(0, 0, width, height);
  gradient.fill({ color: pal.bg, alpha: 1 });
  container.addChild(gradient);

  const horizon = new Graphics();
  horizon.rect(0, 0, width, height * 0.45);
  horizon.fill({ color: pal.accent, alpha: 0.04 });
  container.addChild(horizon);

  const stars = new Container();
  stars.label = 'stars';
  const starGfx = new Graphics();
  for (let i = 0; i < 48; i++) {
    const sx = (i * 137.5) % width;
    const sy = (i * 97.3) % height;
    const r = 0.6 + (i % 3) * 0.4;
    starGfx.circle(sx, sy, r);
    starGfx.fill({ color: 0xffffff, alpha: 0.08 + (i % 5) * 0.04 });
  }
  stars.addChild(starGfx);
  container.addChild(stars);

  const laneGlow = new Graphics();
  laneGlow.label = 'lane-glow';
  const laneXs = [width * 0.2, width * 0.5, width * 0.8];
  for (const lx of laneXs) {
    laneGlow.rect(lx - width * 0.08, 0, width * 0.16, height);
    laneGlow.fill({ color: pal.accent, alpha: 0.035 });
  }
  container.addChild(laneGlow);

  const lineColor = pal.line;
  for (let layer = 0; layer < 3; layer++) {
    const layerContainer = new Container();
    layerContainer.label = `grid-layer-${layer}`;
    const alpha = 0.12 + layer * 0.08;
    const spacing = 40 + layer * 20;
    const g = new Graphics();
    for (let y = 0; y < height + spacing; y += spacing) {
      g.moveTo(0, y);
      g.lineTo(width, y);
      g.stroke({ color: lineColor, width: 1, alpha });
    }
    const laneWidth = width / 3;
    for (let i = 1; i < 3; i++) {
      g.moveTo(laneWidth * i, 0);
      g.lineTo(laneWidth * i, height);
      g.stroke({ color: pal.accent, width: 1, alpha: alpha * 0.35 });
    }
    layerContainer.addChild(g);
    container.addChild(layerContainer);
  }

  const scanlines = new Graphics();
  scanlines.label = 'scanlines';
  for (let y = 0; y < height; y += 4) {
    scanlines.moveTo(0, y);
    scanlines.lineTo(width, y);
    scanlines.stroke({ color: 0x000000, width: 1, alpha: 0.06 });
  }
  container.addChild(scanlines);

  return container;
}

export function getCoreColor(coreId: string): number {
  return CORE_COLORS[coreId] ?? COLORS.cyan;
}

export function createParticle(color: number, size: number): Graphics {
  const g = new Graphics();
  g.circle(0, 0, size);
  g.fill({ color, alpha: 0.9 });
  return g;
}

export function createWhiteFirewall(width: number, height: number): Container {
  const container = new Container();
  const g = new Graphics();
  g.roundRect(-width / 2, -height / 2, width, height, 4);
  g.fill({ color: 0xffffff, alpha: 0.92 });
  g.stroke({ color: COLORS.cyan, width: 2, alpha: 0.9 });
  container.addChild(g);
  return container;
}

export function createFloatingText(text: string, color: number, size: number): Container {
  const container = new Container();
  const bg = new Graphics();
  bg.roundRect(-text.length * size * 0.3, -size * 0.6, text.length * size * 0.6, size * 1.2, 4);
  bg.fill({ color, alpha: 0.2 });
  container.addChild(bg);
  container.label = text;
  return container;
}

export function createBossFirewall(width: number, height: number): Container {
  const container = createFirewall(width, height);
  const crown = new Graphics();
  crown.moveTo(-width * 0.3, -height * 0.5);
  crown.lineTo(0, -height * 0.9);
  crown.lineTo(width * 0.3, -height * 0.5);
  crown.stroke({ color: COLORS.gold, width: 3, alpha: 0.9 });
  container.addChild(crown);
  return container;
}

export function createGoldenShard(size: number): Container {
  const container = createShard(size);
  container.tint = COLORS.gold;
  return container;
}

export function createGhostCore(radius: number): Container {
  const container = createPlayerCore(radius, COLORS.magenta);
  container.alpha = 0.45;
  return container;
}
