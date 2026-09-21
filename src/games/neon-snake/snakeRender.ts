import type { GridPoint, Particle, PopText } from '@/games/neon-snake/snakeTypes';
import { GRID_COLS, GRID_ROWS } from '@/games/neon-snake/snakeTypes';

export const SNAKE_PALETTE = {
  bg: '#0d0b1a',
  grid: 'rgba(120, 100, 200, 0.08)',
  snakeHead: '#00e5c8',
  snakeBody: '#7c5cff',
  snakeGlow: 'rgba(0, 229, 200, 0.45)',
  food: '#ff6b35',
  foodGlow: 'rgba(255, 107, 53, 0.55)',
  accent: '#ffd54f',
};

export function drawBoard(
  ctx: CanvasRenderingContext2D,
  cell: number,
  snake: GridPoint[],
  food: GridPoint,
  shake = 0,
  reducedMotion = false,
): void {
  const w = GRID_COLS * cell;
  const h = GRID_ROWS * cell;

  ctx.save();
  if (shake > 0 && !reducedMotion) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }

  // Board background
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#12102a');
  bg.addColorStop(1, '#0a0818');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle grid
  ctx.strokeStyle = SNAKE_PALETTE.grid;
  ctx.lineWidth = 1;
  for (let x = 0; x <= GRID_COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * cell + 0.5, 0);
    ctx.lineTo(x * cell + 0.5, h);
    ctx.stroke();
  }
  for (let y = 0; y <= GRID_ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * cell + 0.5);
    ctx.lineTo(w, y * cell + 0.5);
    ctx.stroke();
  }

  // Border
  ctx.strokeStyle = 'rgba(0, 229, 200, 0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);

  drawFood(ctx, food, cell);
  drawSnake(ctx, snake, cell);

  ctx.restore();
}

function drawFood(ctx: CanvasRenderingContext2D, food: GridPoint, cell: number): void {
  const cx = food.x * cell + cell / 2;
  const cy = food.y * cell + cell / 2;
  const r = cell * 0.32;

  ctx.save();
  ctx.shadowColor = SNAKE_PALETTE.foodGlow;
  ctx.shadowBlur = cell * 0.35;

  // Cherry / orb style
  ctx.fillStyle = SNAKE_PALETTE.food;
  ctx.beginPath();
  ctx.arc(cx - r * 0.25, cy + r * 0.1, r, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.25, cy + r * 0.1, r * 0.92, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#4caf50';
  ctx.fillRect(cx - 1, cy - r * 1.2, 2, r * 0.5);
  ctx.restore();
}

function drawSnake(ctx: CanvasRenderingContext2D, snake: GridPoint[], cell: number): void {
  snake.forEach((seg, i) => {
    const pad = i === 0 ? cell * 0.1 : cell * 0.14;
    const x = seg.x * cell + pad;
    const y = seg.y * cell + pad;
    const size = cell - pad * 2;
    const isHead = i === 0;

    ctx.save();
    if (isHead) {
      ctx.shadowColor = SNAKE_PALETTE.snakeGlow;
      ctx.shadowBlur = cell * 0.4;
      ctx.fillStyle = SNAKE_PALETTE.snakeHead;
    } else {
      const t = i / Math.max(1, snake.length - 1);
      ctx.fillStyle = mixColor(SNAKE_PALETTE.snakeBody, SNAKE_PALETTE.snakeHead, 1 - t * 0.6);
    }

    const radius = isHead ? size * 0.28 : size * 0.22;
    roundRect(ctx, x, y, size, size, radius);
    ctx.fill();

    if (isHead) {
      ctx.fillStyle = '#0d0b1a';
      const eye = cell * 0.08;
      ctx.fillRect(x + size * 0.55, y + size * 0.28, eye, eye);
      ctx.fillRect(x + size * 0.55, y + size * 0.55, eye, eye);
    }
    ctx.restore();
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function mixColor(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
  };
  const ca = parse(a);
  const cb = parse(b);
  const ch = (i: number) => Math.round(ca[i]! + (cb[i]! - ca[i]!) * t);
  return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
}

export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawPopTexts(ctx: CanvasRenderingContext2D, texts: PopText[], cell: number): void {
  for (const t of texts) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, t.life);
    ctx.fillStyle = SNAKE_PALETTE.accent;
    ctx.font = `bold ${Math.max(11, cell * 0.45)}px "Syne", sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = SNAKE_PALETTE.accent;
    ctx.shadowBlur = 8;
    ctx.fillText(t.text, t.x, t.y);
    ctx.restore();
  }
}

export function spawnEatParticles(
  particles: Particle[],
  cx: number,
  cy: number,
): void {
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * 2 * i) / 10 + Math.random() * 0.4;
    const s = 1.5 + Math.random() * 2.5;
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 1,
      size: 2 + Math.random() * 2,
      color: i % 2 ? SNAKE_PALETTE.food : SNAKE_PALETTE.accent,
    });
  }
}
