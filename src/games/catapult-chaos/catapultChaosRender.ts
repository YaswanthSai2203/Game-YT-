/** Premium canvas rendering for Catapult Chaos */

import type { MomentumState, PowerZone, WorldObject } from '@/games/catapult-chaos/types';
import type { PlayerBody } from '@/games/catapult-chaos/systems/PhysicsWorld';

export const CC_PALETTE = {
  skyTop: '#0a1628',
  skyMid: '#142238',
  skyHorizon: '#1e3a52',
  hillFar: '#1a4a3a',
  hillMid: '#2d6b4f',
  hillNear: '#3d8f62',
  grass: '#4caf6e',
  grassDark: '#2e7d52',
  wood: '#8d6e4a',
  woodDark: '#5d4030',
  gold: '#ffd54f',
  cyan: '#00f0ff',
  magenta: '#ff006e',
  violet: '#8b5cf6',
  white: '#e8edf5',
};

export function drawSky(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  camX: number,
): void {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, CC_PALETTE.skyTop);
  grad.addColorStop(0.45, CC_PALETTE.skyMid);
  grad.addColorStop(1, CC_PALETTE.skyHorizon);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Aurora accent (arcade tie-in)
  const aurora = ctx.createRadialGradient(w * 0.7, h * 0.2, 0, w * 0.7, h * 0.2, w * 0.5);
  aurora.addColorStop(0, 'rgba(0, 240, 255, 0.08)');
  aurora.addColorStop(0.5, 'rgba(139, 92, 246, 0.05)');
  aurora.addColorStop(1, 'transparent');
  ctx.fillStyle = aurora;
  ctx.fillRect(0, 0, w, h);

  // Parallax hills
  drawHillLayer(ctx, w, h, camX, 0.15, CC_PALETTE.hillFar, 0.35);
  drawHillLayer(ctx, w, h, camX, 0.28, CC_PALETTE.hillMid, 0.55);
  drawHillLayer(ctx, w, h, camX, 0.42, CC_PALETTE.hillNear, 0.75);

  // Clouds
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  for (let i = 0; i < 6; i++) {
    const cx = ((i * 420 - camX * 0.08) % (w + 200)) - 80;
    const cy = 40 + (i % 3) * 28;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 50, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHillLayer(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  camX: number,
  parallax: number,
  color: string,
  heightFrac: number,
): void {
  const baseY = h * heightFrac;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w + 80; x += 40) {
    const wx = x + camX * parallax;
    const y = baseY + Math.sin(wx * 0.008) * 24 + Math.sin(wx * 0.02) * 10;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

export function drawWorldObject(
  ctx: CanvasRenderingContext2D,
  o: WorldObject,
  camX: number,
  camY: number,
  time: number,
): void {
  if (!o.alive) return;
  const x = o.x - camX;
  const y = o.y - camY;

  ctx.save();
  ctx.translate(x + o.w / 2, y + o.h / 2);
  ctx.rotate(o.rotation);
  ctx.translate(-o.w / 2, -o.h / 2);

  switch (o.type) {
    case 'terrain':
      drawTerrain(ctx, o.w, o.h);
      break;
    case 'ramp':
      drawRamp(ctx, o.w, o.h);
      break;
    case 'crate':
      drawCrate(ctx, o.w, o.h);
      break;
    case 'trampoline':
      drawTrampoline(ctx, o.w, o.h, time);
      break;
    case 'barrel':
      drawBarrel(ctx, o.w, o.h);
      break;
    case 'windmill':
      drawWindmillBlade(ctx, o.w, o.h, time);
      break;
    case 'coin':
      drawCoin(ctx, o.w, time);
      break;
    case 'target':
      drawTarget(ctx, o.w, o.h);
      break;
    case 'balloon':
      drawBalloon(ctx, o.w, o.h, time);
      break;
  }
  ctx.restore();
}

function drawTerrain(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, CC_PALETTE.grass);
  grad.addColorStop(1, CC_PALETTE.grassDark);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0, h - 4, w, 4);
}

function drawRamp(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = CC_PALETTE.wood;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(w, 0);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = CC_PALETTE.woodDark;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawCrate(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = CC_PALETTE.wood;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = CC_PALETTE.woodDark;
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, w - 4, h - 4);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, h);
  ctx.moveTo(w, 0);
  ctx.lineTo(0, h);
  ctx.stroke();
}

function drawTrampoline(ctx: CanvasRenderingContext2D, w: number, h: number, time: number): void {
  const pulse = Math.sin(time * 0.006) * 2;
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, h - 6, w, 6);
  ctx.strokeStyle = CC_PALETTE.magenta;
  ctx.lineWidth = 3 + pulse * 0.2;
  ctx.shadowColor = CC_PALETTE.magenta;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(0, h - 4);
  ctx.quadraticCurveTo(w / 2, h - 14 - pulse, w, h - 4);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawBarrel(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, '#c62828');
  grad.addColorStop(0.5, '#ff5252');
  grad.addColorStop(1, '#b71c1c');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(w - 6, 0);
  ctx.quadraticCurveTo(w, 0, w, 6);
  ctx.lineTo(w, h - 6);
  ctx.quadraticCurveTo(w, h, w - 6, h);
  ctx.lineTo(6, h);
  ctx.quadraticCurveTo(0, h, 0, h - 6);
  ctx.lineTo(0, 6);
  ctx.quadraticCurveTo(0, 0, 6, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffeb3b';
  ctx.font = 'bold 14px Orbitron, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('!', w / 2, h / 2 + 5);
}

function drawWindmillBlade(ctx: CanvasRenderingContext2D, w: number, h: number, _time: number): void {
  ctx.fillStyle = 'rgba(200, 200, 200, 0.9)';
  ctx.fillRect(-w * 0.05, -h / 2, w * 1.1, h);
  ctx.fillStyle = CC_PALETTE.cyan;
  ctx.shadowColor = CC_PALETTE.cyan;
  ctx.shadowBlur = 8;
  ctx.fillRect(w * 0.35, -h, w * 0.08, h * 2);
  ctx.shadowBlur = 0;
}

function drawCoin(ctx: CanvasRenderingContext2D, size: number, time: number): void {
  const s = size * (0.85 + Math.sin(time * 0.008) * 0.15);
  const grad = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, '#fff59d');
  grad.addColorStop(0.6, CC_PALETTE.gold);
  grad.addColorStop(1, '#f9a825');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f57f17';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawTarget(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const rings = ['#fff', CC_PALETTE.magenta, '#fff', CC_PALETTE.magenta];
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = rings[i];
    ctx.beginPath();
    ctx.arc(cx, cy, (w / 2) * (1 - i * 0.22), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBalloon(ctx: CanvasRenderingContext2D, w: number, h: number, time: number): void {
  const bob = Math.sin(time * 0.004) * 4;
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w / 2, h);
  ctx.lineTo(w / 2, h + 20);
  ctx.stroke();
  const grad = ctx.createRadialGradient(w * 0.35, h * 0.3, 0, w / 2, h / 2, w / 2);
  grad.addColorStop(0, '#ff8a80');
  grad.addColorStop(1, CC_PALETTE.magenta);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2 + bob, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawCatapult(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  armPull: number,
): void {
  ctx.save();
  ctx.translate(x, y);

  // Base
  ctx.fillStyle = CC_PALETTE.woodDark;
  ctx.beginPath();
  ctx.moveTo(-30, 0);
  ctx.lineTo(30, 0);
  ctx.lineTo(20, 28);
  ctx.lineTo(-20, 28);
  ctx.closePath();
  ctx.fill();

  // A-frame
  ctx.strokeStyle = CC_PALETTE.wood;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-22, 28);
  ctx.lineTo(0, -8);
  ctx.lineTo(22, 28);
  ctx.stroke();

  // Arm
  ctx.translate(0, -8);
  ctx.rotate(-angle);
  ctx.strokeStyle = '#a1887f';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(55 + armPull * 20, 0);
  ctx.stroke();

  // Bucket
  ctx.fillStyle = CC_PALETTE.wood;
  ctx.fillRect(48 + armPull * 20, -8, 18, 16);

  ctx.restore();
}

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  p: PlayerBody,
  camX: number,
  camY: number,
  momentum: MomentumState,
  inBucket: boolean,
): void {
  const x = p.x - camX;
  const y = p.y - camY;

  if (inBucket) return;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(p.angle);

  const hurt = momentum === 'hurt';
  const crit = momentum === 'critical';
  const bodyColor = crit ? '#ff5252' : hurt ? '#ffb74d' : CC_PALETTE.cyan;

  ctx.shadowColor = bodyColor;
  ctx.shadowBlur = crit ? 20 : 12;

  // Body
  const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, p.radius);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.4, bodyColor);
  grad.addColorStop(1, '#006874');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, p.radius, p.radius * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // Visor
  ctx.fillStyle = CC_PALETTE.violet;
  ctx.fillRect(4, -5, 10, 6);

  // Trail scarf
  ctx.strokeStyle = CC_PALETTE.magenta;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-8, 2);
  ctx.quadraticCurveTo(-22, 6, -30, 0);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.restore();
}

export function drawTrajectoryPreview(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  angle: number,
  power: number,
  wind: number,
  camX: number,
  camY: number,
): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  let x = startX;
  let y = startY;
  let vx = Math.cos(angle) * power;
  let vy = Math.sin(angle) * power;
  ctx.moveTo(x - camX, y - camY);
  for (let i = 0; i < 40; i++) {
    vy += 0.42;
    vx += wind * 0.012;
    vx *= 0.998;
    vy *= 0.998;
    x += vx;
    y += vy;
    ctx.lineTo(x - camX, y - camY);
  }
  ctx.stroke();
  ctx.restore();
}

export function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: { x: number; y: number; life: number; size: number; color: string }[],
  camX: number,
  camY: number,
): void {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.life * 0.85;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(p.x - camX, p.y - camY, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawScreenFlash(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  alpha: number,
  color: string,
): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function drawComboBanner(
  ctx: CanvasRenderingContext2D,
  w: number,
  level: number,
  life: number,
): void {
  if (life <= 0 || level < 3) return;
  const scale = 0.9 + life * 0.15;
  ctx.save();
  ctx.translate(w / 2, 108);
  ctx.scale(scale, scale);
  ctx.textAlign = 'center';
  ctx.font = '900 28px Orbitron, sans-serif';
  ctx.fillStyle = `rgba(255, 213, 79, ${life})`;
  ctx.shadowColor = '#ffd54f';
  ctx.shadowBlur = 24;
  ctx.fillText(`×${level} COMBO`, 0, 0);
  ctx.restore();
}

export function drawFloatingText(
  ctx: CanvasRenderingContext2D,
  texts: { x: number; y: number; text: string; life: number; color: string }[],
  camX: number,
  camY: number,
): void {
  for (const t of texts) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, t.life);
    ctx.fillStyle = t.color;
    ctx.font = 'bold 14px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 10;
    ctx.fillText(t.text, t.x - camX, t.y - camY);
    ctx.restore();
  }
}

export function drawWindIndicator(
  ctx: CanvasRenderingContext2D,
  w: number,
  wind: number,
): void {
  const cx = w - 80;
  const cy = 36;
  ctx.fillStyle = 'rgba(10, 14, 26, 0.75)';
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 48, cy - 16);
  ctx.lineTo(cx + 48, cy - 16);
  ctx.lineTo(cx + 44, cy + 16);
  ctx.lineTo(cx - 44, cy + 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = CC_PALETTE.white;
  ctx.font = '600 10px Rajdhani, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WIND', cx, cy - 4);
  ctx.fillStyle = CC_PALETTE.cyan;
  ctx.font = 'bold 12px Orbitron, sans-serif';
  const arrows = wind > 0.1 ? '→→' : wind < -0.1 ? '←←' : '·';
  ctx.fillText(`${Math.abs(wind * 40).toFixed(0)} ${arrows}`, cx, cy + 12);
}

export function powerZoneColor(zone: PowerZone): string {
  switch (zone) {
    case 'weak': return '#8892a8';
    case 'good': return '#4caf50';
    case 'perfect': return CC_PALETTE.gold;
    case 'overload': return CC_PALETTE.magenta;
  }
}

/** In-game launch HUD — drawn on canvas so the world stays visible */
export function drawLaunchHud(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  phase: 'aim' | 'power',
  angle: number,
  powerMeter: number,
  powerZone: PowerZone,
  worldName: string,
  weather: string,
  pulse: number,
  angleReady = false,
): void {
  const pad = 16;
  const bottom = h - Math.max(20, pad);

  // Top instruction pill
  const msg = phase === 'aim'
    ? (angleReady ? 'TAP TO CHARGE POWER' : 'DRAG UP/DOWN TO AIM')
    : 'TAP OR RELEASE ON PERFECT';
  ctx.fillStyle = 'rgba(10, 14, 26, 0.82)';
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
  ctx.lineWidth = 1;
  const pillW = Math.min(340, w - 32);
  const pillX = (w - pillW) / 2;
  const pillY = 72;
  ctx.beginPath();
  ctx.moveTo(pillX + 12, pillY);
  ctx.lineTo(pillX + pillW - 12, pillY);
  ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + 12);
  ctx.lineTo(pillX + pillW, pillY + 36);
  ctx.quadraticCurveTo(pillX + pillW, pillY + 48, pillX + pillW - 12, pillY + 48);
  ctx.lineTo(pillX + 12, pillY + 48);
  ctx.quadraticCurveTo(pillX, pillY + 48, pillX, pillY + 36);
  ctx.lineTo(pillX, pillY + 12);
  ctx.quadraticCurveTo(pillX, pillY, pillX + 12, pillY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = CC_PALETTE.magenta;
  ctx.font = '600 9px Rajdhani, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(worldName.toUpperCase(), w / 2, pillY + 14);
  ctx.fillStyle = phase === 'power' ? CC_PALETTE.gold : CC_PALETTE.cyan;
  ctx.font = 'bold 11px Orbitron, sans-serif';
  ctx.globalAlpha = 0.85 + Math.sin(pulse * 3) * 0.15;
  ctx.fillText(msg, w / 2, pillY + 34);
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(136, 146, 168, 0.9)';
  ctx.font = '600 10px Rajdhani, sans-serif';
  ctx.fillText(weather, w / 2, pillY + 62);

  // Angle gauge (left side)
  const gx = 36;
  const gy = h * 0.38;
  const gh = 120;
  ctx.fillStyle = 'rgba(10, 14, 26, 0.75)';
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.fillRect(gx - 20, gy - 10, 40, gh + 20);
  ctx.strokeRect(gx - 20, gy - 10, 40, gh + 20);

  ctx.fillStyle = CC_PALETTE.white;
  ctx.font = '600 8px Rajdhani, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ANGLE', gx, gy - 16);

  const angleNorm = (angle - 0.25) / (1.35 - 0.25);
  const markerY = gy + gh - angleNorm * gh;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(gx - 8, gy, 16, gh);
  ctx.fillStyle = CC_PALETTE.cyan;
  ctx.shadowColor = CC_PALETTE.cyan;
  ctx.shadowBlur = 10;
  ctx.fillRect(gx - 10, markerY - 3, 20, 6);
  ctx.shadowBlur = 0;

  const deg = Math.round((angle * 180) / Math.PI);
  ctx.fillStyle = CC_PALETTE.cyan;
  ctx.font = 'bold 12px Orbitron, sans-serif';
  ctx.fillText(`${deg}°`, gx, gy + gh + 28);

  // Power meter (bottom) — visible during both phases; active during power
  const barW = Math.min(360, w - 40);
  const barX = (w - barW) / 2;
  const barY = bottom - 48;
  const barH = 18;

  ctx.fillStyle = 'rgba(10, 14, 26, 0.85)';
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.fillRect(barX - 4, barY - 28, barW + 8, 56);
  ctx.strokeRect(barX - 4, barY - 28, barW + 8, 56);

  ctx.fillStyle = CC_PALETTE.white;
  ctx.font = '600 9px Rajdhani, sans-serif';
  ctx.fillText('POWER', w / 2, barY - 14);

  // Zone backgrounds
  const zones: [number, number, string][] = [
    [0, 0.25, 'rgba(136,146,168,0.25)'],
    [0.25, 0.55, 'rgba(76,175,80,0.25)'],
    [0.55, 0.78, 'rgba(255,213,79,0.35)'],
    [0.78, 1, 'rgba(255,0,110,0.25)'],
  ];
  for (const [a, b, col] of zones) {
    ctx.fillStyle = col;
    ctx.fillRect(barX + barW * a, barY, barW * (b - a), barH);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);

  if (phase === 'power') {
    const fillW = barW * powerMeter;
    ctx.fillStyle = powerZoneColor(powerZone);
    ctx.shadowColor = powerZoneColor(powerZone);
    ctx.shadowBlur = 14;
    ctx.fillRect(barX, barY, fillW, barH);
    ctx.shadowBlur = 0;

    ctx.fillStyle = powerZoneColor(powerZone);
    ctx.font = 'bold 11px Orbitron, sans-serif';
    ctx.fillText(powerZone.toUpperCase(), w / 2, barY + barH + 18);
  } else {
    ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.fillRect(barX, barY, barW * 0.3, barH);
    ctx.fillStyle = 'rgba(136, 146, 168, 0.8)';
    ctx.font = '600 10px Rajdhani, sans-serif';
    ctx.fillText('Tap when ready', w / 2, barY + barH + 18);
  }

  const labels = ['Weak', 'Good', 'Perfect', 'Overload'];
  ctx.font = '600 7px Rajdhani, sans-serif';
  ctx.fillStyle = 'rgba(136,146,168,0.7)';
  labels.forEach((lbl, i) => {
    ctx.fillText(lbl, barX + barW * (0.125 + i * 0.25), barY + barH + 30);
  });
}

export function drawGroundFill(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  groundScreenY: number,
): void {
  const grad = ctx.createLinearGradient(0, groundScreenY, 0, h);
  grad.addColorStop(0, CC_PALETTE.grassDark);
  grad.addColorStop(1, '#1a3328');
  ctx.fillStyle = grad;
  ctx.fillRect(0, groundScreenY, w, h - groundScreenY);
}
