/** Canvas draw helpers — neon arcade style for Offline Rex */

export const REX_PALETTE = {
  void: '#0a0e1a',
  voidMid: '#121829',
  cyan: '#00f0ff',
  cyanDim: '#00b8c4',
  magenta: '#ff006e',
  violet: '#8b5cf6',
  gold: '#ffd700',
  white: '#e8edf5',
  grid: 'rgba(0, 240, 255, 0.08)',
};

export function withGlow(
  ctx: CanvasRenderingContext2D,
  color: string,
  blur: number,
  fn: () => void,
): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  fn();
  ctx.restore();
}

export function drawParallaxBg(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  groundY: number,
  gridOffset: number,
  bgOffset: number,
): void {
  const grad = ctx.createLinearGradient(0, 0, 0, groundY);
  grad.addColorStop(0, '#060912');
  grad.addColorStop(0.45, '#0a0e1a');
  grad.addColorStop(1, '#0f1628');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Distant horizon glow
  const horizon = ctx.createRadialGradient(w * 0.5, groundY, 0, w * 0.5, groundY, w * 0.65);
  horizon.addColorStop(0, 'rgba(139, 92, 246, 0.12)');
  horizon.addColorStop(0.5, 'rgba(0, 240, 255, 0.06)');
  horizon.addColorStop(1, 'transparent');
  ctx.fillStyle = horizon;
  ctx.fillRect(0, groundY - 120, w, 120);

  // Perspective grid (back layer)
  ctx.save();
  ctx.strokeStyle = REX_PALETTE.grid;
  ctx.lineWidth = 1;
  const gridTop = groundY - 80;
  for (let i = -2; i < 20; i++) {
    const gx = ((i * 48 - (bgOffset * 0.4) % 48) + w) % (w + 48) - 24;
    ctx.beginPath();
    ctx.moveTo(gx, gridTop);
    ctx.lineTo(gx + (gx - w / 2) * 0.15, groundY);
    ctx.stroke();
  }
  for (let row = 0; row < 6; row++) {
    const t = row / 6;
    const y = gridTop + (groundY - gridTop) * t;
    const scroll = (gridOffset * (0.3 + t * 0.5)) % 40;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.globalAlpha = 0.15 + t * 0.25;
    ctx.stroke();
    ctx.globalAlpha = 1;
    void scroll;
  }
  ctx.restore();

  // Floating data shards (stars)
  ctx.fillStyle = 'rgba(0, 240, 255, 0.35)';
  for (let i = 0; i < 24; i++) {
    const sx = ((i * 97 + bgOffset * 0.15) % w);
    const sy = 24 + (i * 53) % (groundY * 0.45);
    const sz = i % 3 === 0 ? 2 : 1;
    ctx.globalAlpha = 0.25 + (i % 5) * 0.12;
    ctx.fillRect(sx, sy, sz, sz);
  }
  ctx.globalAlpha = 1;
}

export function drawGround(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  groundY: number,
  offset: number,
): void {
  const floorGrad = ctx.createLinearGradient(0, groundY, 0, h);
  floorGrad.addColorStop(0, '#141e36');
  floorGrad.addColorStop(1, '#0a0e1a');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, groundY, w, h - groundY);

  withGlow(ctx, REX_PALETTE.cyan, 14, () => {
    ctx.strokeStyle = REX_PALETTE.cyan;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(w, groundY);
    ctx.stroke();
  });

  ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
  for (let x = -offset; x < w + 24; x += 32) {
    const dashW = 14 + (Math.floor(x / 32) % 2) * 6;
    ctx.fillRect(x, groundY + 18, dashW, 3);
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  for (let x = -offset * 1.4; x < w; x += 48) {
    ctx.fillRect(x, groundY + 32, 20, 1);
  }
}

export function drawCyberRex(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  duck: boolean,
  anim: number,
  grounded: boolean,
): void {
  const run = grounded ? Math.floor(anim * 0.55) % 2 : 0;
  const legA = run === 0 ? 0 : 6;
  const legB = run === 0 ? 6 : 0;

  withGlow(ctx, REX_PALETTE.cyan, 20, () => {
    ctx.fillStyle = REX_PALETTE.cyan;
    ctx.strokeStyle = '#a8ffff';
    ctx.lineWidth = 1.25;
    ctx.lineJoin = 'round';

    if (duck) {
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 22);
      ctx.lineTo(x + 52, y + 22);
      ctx.lineTo(x + 58, y + 14);
      ctx.lineTo(x + 68, y + 14);
      ctx.lineTo(x + 72, y + 18);
      ctx.lineTo(x + 72, y + 26);
      ctx.lineTo(x + 4, y + 26);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = REX_PALETTE.void;
      ctx.fillRect(x + 62, y + 16, 4, 4);
      return;
    }

    // Tail
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 32);
    ctx.lineTo(x - 4, y + 28);
    ctx.lineTo(x - 2, y + 36);
    ctx.lineTo(x + 8, y + 38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Body
    ctx.beginPath();
    ctx.moveTo(x + 12, y + 38);
    ctx.lineTo(x + 38, y + 38);
    ctx.quadraticCurveTo(x + 42, y + 20, x + 52, y + 12);
    ctx.lineTo(x + 62, y + 8);
    ctx.lineTo(x + 68, y + 14);
    ctx.lineTo(x + 66, y + 22);
    ctx.lineTo(x + 40, y + 28);
    ctx.lineTo(x + 14, y + 38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Head crest
    ctx.beginPath();
    ctx.moveTo(x + 54, y + 10);
    ctx.lineTo(x + 58, y + 2);
    ctx.lineTo(x + 62, y + 10);
    ctx.fill();

    // Legs
    ctx.fillRect(x + 18, y + 38, 9, 10 + legA);
    ctx.fillRect(x + 32, y + 38, 9, 10 + legB);

    // Arm
    ctx.fillRect(x + 44, y + 24, 6, 4);

    // Eye
    ctx.fillStyle = REX_PALETTE.void;
    ctx.fillRect(x + 60, y + 12, 5, 5);
    ctx.fillStyle = REX_PALETTE.gold;
    ctx.fillRect(x + 61, y + 13, 2, 2);
  });
}

/** Firewall spike cluster — replaces blocky cactus */
export function drawFirewall(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  w: number,
  h: number,
  pulse: number,
): void {
  const y = groundY - h;
  const glow = 12 + Math.sin(pulse) * 4;

  withGlow(ctx, REX_PALETTE.magenta, glow, () => {
    const drawSpike = (sx: number, sw: number, sh: number): void => {
      ctx.fillStyle = 'rgba(255, 0, 110, 0.85)';
      ctx.strokeStyle = '#ff4d9a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx + sw / 2, y);
      ctx.lineTo(sx + sw, y + sh);
      ctx.lineTo(sx, y + sh);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Inner core
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.moveTo(sx + sw / 2, y + sh * 0.15);
      ctx.lineTo(sx + sw * 0.65, y + sh * 0.55);
      ctx.lineTo(sx + sw * 0.35, y + sh * 0.55);
      ctx.closePath();
      ctx.fill();
    };

    if (w < 28) {
      drawSpike(x + w * 0.2, w * 0.6, h);
    } else if (w < 44) {
      drawSpike(x, w * 0.38, h);
      drawSpike(x + w * 0.48, w * 0.42, h * 0.92);
    } else {
      drawSpike(x + w * 0.08, w * 0.28, h);
      drawSpike(x + w * 0.36, w * 0.32, h * 1.05);
      drawSpike(x + w * 0.66, w * 0.26, h * 0.88);
    }

    // Base platform
    ctx.fillStyle = 'rgba(255, 0, 110, 0.25)';
    ctx.fillRect(x, groundY - 4, w, 4);
  });
}

/** Signal drone — replaces blocky bird */
export function drawSignalDrone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  wingUp: boolean,
  pulse: number,
): void {
  const cy = y + 12;
  withGlow(ctx, REX_PALETTE.violet, 14 + Math.sin(pulse * 2) * 3, () => {
    ctx.fillStyle = 'rgba(139, 92, 246, 0.9)';
    ctx.strokeStyle = '#b794ff';
    ctx.lineWidth = 1.5;

    // Fuselage
    ctx.beginPath();
    ctx.ellipse(x + w * 0.45, cy, w * 0.35, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Nose
    ctx.beginPath();
    ctx.moveTo(x + w * 0.78, cy);
    ctx.lineTo(x + w * 0.92, cy - 3);
    ctx.lineTo(x + w * 0.92, cy + 3);
    ctx.closePath();
    ctx.fill();

    // Wings
    const wingY = wingUp ? cy - 14 : cy + 4;
    ctx.strokeStyle = REX_PALETTE.cyan;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.2, cy);
    ctx.lineTo(x - 4, wingY);
    ctx.moveTo(x + w * 0.55, cy);
    ctx.lineTo(x + w + 6, wingY);
    ctx.stroke();

    // Scanner eye
    ctx.fillStyle = REX_PALETTE.cyan;
    ctx.beginPath();
    ctx.arc(x + w * 0.72, cy - 1, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Exhaust trail
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 2, cy);
  ctx.lineTo(x - 18, cy + (wingUp ? 2 : -2));
  ctx.stroke();
}

export interface DustParticle {
  x: number;
  y: number;
  life: number;
  vx: number;
}

export function spawnDust(x: number, y: number): DustParticle {
  return {
    x,
    y,
    life: 1,
    vx: -2 - Math.random() * 2,
  };
}

export function drawDust(ctx: CanvasRenderingContext2D, particles: DustParticle[]): void {
  for (const p of particles) {
    ctx.fillStyle = `rgba(0, 240, 255, ${p.life * 0.35})`;
    ctx.fillRect(p.x, p.y, 3 * p.life, 2 * p.life);
  }
}
