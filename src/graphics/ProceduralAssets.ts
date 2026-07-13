import { Graphics, Container } from 'pixi.js';
import { COLORS, CORE_COLORS } from '@/config/constants';

export function createPlayerCore(radius: number, color: number): Container {
  const container = new Container();
  const glow = new Graphics();
  glow.circle(0, 0, radius * 1.8);
  glow.fill({ color, alpha: 0.15 });
  container.addChild(glow);

  const hex = new Graphics();
  const sides = 6;
  hex.moveTo(radius, 0);
  for (let i = 1; i <= sides; i++) {
    const angle = (i * Math.PI * 2) / sides;
    hex.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  hex.fill({ color, alpha: 0.9 });
  hex.stroke({ color: 0xffffff, width: 1.5, alpha: 0.5 });
  container.addChild(hex);

  const inner = new Graphics();
  inner.circle(0, 0, radius * 0.35);
  inner.fill({ color: 0xffffff, alpha: 0.8 });
  container.addChild(inner);

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

export function createGridBackground(width: number, height: number, theme: string): Container {
  const container = new Container();
  const lineColor = theme === 'inferno' ? 0x441100 : theme === 'matrix' ? 0x003300 : COLORS.gridLine;

  for (let layer = 0; layer < 3; layer++) {
    const layerContainer = new Container();
    const alpha = 0.15 + layer * 0.1;
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
      g.stroke({ color: lineColor, width: 1, alpha: alpha * 0.5 });
    }
    layerContainer.addChild(g);
    layerContainer.label = `grid-layer-${layer}`;
    container.addChild(layerContainer);
  }

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

export function createFloatingText(text: string, color: number, size: number): Container {
  const container = new Container();
  // PixiJS v8 text would need importing Text - use graphics placeholder
  const bg = new Graphics();
  bg.roundRect(-text.length * size * 0.3, -size * 0.6, text.length * size * 0.6, size * 1.2, 4);
  bg.fill({ color, alpha: 0.2 });
  container.addChild(bg);
  container.label = text;
  return container;
}
