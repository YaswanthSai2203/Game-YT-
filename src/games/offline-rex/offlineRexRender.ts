/** Canvas draw helpers — premium neon arcade style for Offline Rex */

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

function fillGradientPath(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: [number, string][],
): void {
  const grad = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [t, c] of stops) grad.addColorStop(t, c);
  ctx.fillStyle = grad;
  ctx.fill(path);
}

/** Distant neon city silhouette */
export function drawCityscape(
  ctx: CanvasRenderingContext2D,
  w: number,
  groundY: number,
  offset: number,
): void {
  const baseY = groundY - 28;
  const scroll = offset * 0.12;

  ctx.save();
  ctx.globalAlpha = 0.55;

  const buildings: { x: number; w: number; h: number; hue: string }[] = [];
  for (let i = -1; i < Math.ceil(w / 60) + 2; i++) {
    const seed = (i * 7919 + 13) % 997;
    const bw = 28 + (seed % 40);
    const bh = 40 + (seed % 90);
    const bx = i * 58 - (scroll % 58);
    buildings.push({ x: bx, w: bw, h: bh, hue: seed % 3 === 0 ? '#00f0ff' : seed % 3 === 1 ? '#8b5cf6' : '#ff006e' });
  }

  for (const b of buildings) {
    const top = baseY - b.h;
    const grad = ctx.createLinearGradient(0, top, 0, baseY);
    grad.addColorStop(0, 'rgba(18, 24, 41, 0.95)');
    grad.addColorStop(1, 'rgba(10, 14, 26, 0.7)');
    ctx.fillStyle = grad;
    ctx.fillRect(b.x, top, b.w, b.h);

    // Window lights
    ctx.fillStyle = b.hue;
    ctx.globalAlpha = 0.12 + (b.h % 5) * 0.04;
    for (let wy = top + 8; wy < baseY - 6; wy += 10) {
      for (let wx = b.x + 5; wx < b.x + b.w - 4; wx += 9) {
        if ((wx + wy + b.h) % 17 < 8) {
          ctx.fillRect(wx, wy, 3, 4);
        }
      }
    }
    ctx.globalAlpha = 0.55;

    // Rooftop antenna glow
    if (b.h > 70) {
      withGlow(ctx, b.hue, 8, () => {
        ctx.fillStyle = b.hue;
        ctx.fillRect(b.x + b.w / 2 - 1, top - 10, 2, 10);
        ctx.beginPath();
        ctx.arc(b.x + b.w / 2, top - 12, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }
  ctx.restore();
}

export function drawParallaxBg(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  groundY: number,
  _gridOffset: number,
  bgOffset: number,
): void {
  const grad = ctx.createLinearGradient(0, 0, 0, groundY);
  grad.addColorStop(0, '#04060d');
  grad.addColorStop(0.35, '#080c18');
  grad.addColorStop(0.7, '#0a0e1a');
  grad.addColorStop(1, '#0f1628');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  drawCityscape(ctx, w, groundY, bgOffset);

  const horizon = ctx.createRadialGradient(w * 0.5, groundY, 0, w * 0.5, groundY, w * 0.7);
  horizon.addColorStop(0, 'rgba(139, 92, 246, 0.14)');
  horizon.addColorStop(0.45, 'rgba(0, 240, 255, 0.08)');
  horizon.addColorStop(1, 'transparent');
  ctx.fillStyle = horizon;
  ctx.fillRect(0, groundY - 140, w, 140);

  ctx.save();
  ctx.strokeStyle = REX_PALETTE.grid;
  ctx.lineWidth = 1;
  const gridTop = groundY - 90;
  for (let i = -2; i < 22; i++) {
    const gx = ((i * 48 - (bgOffset * 0.4) % 48) + w) % (w + 48) - 24;
    ctx.beginPath();
    ctx.moveTo(gx, gridTop);
    ctx.lineTo(gx + (gx - w / 2) * 0.18, groundY);
    ctx.stroke();
  }
  for (let row = 0; row < 7; row++) {
    const t = row / 7;
    const y = gridTop + (groundY - gridTop) * t;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.globalAlpha = 0.12 + t * 0.28;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Floating data motes
  for (let i = 0; i < 32; i++) {
    const sx = (i * 97 + bgOffset * 0.15) % w;
    const sy = 20 + (i * 53) % (groundY * 0.5);
    const pulse = 0.3 + Math.sin(bgOffset * 0.02 + i) * 0.2;
    ctx.fillStyle = i % 4 === 0 ? `rgba(255, 0, 110, ${pulse * 0.5})` : `rgba(0, 240, 255, ${pulse * 0.45})`;
    const sz = i % 3 === 0 ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.arc(sx, sy, sz, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawGround(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  groundY: number,
  offset: number,
): void {
  const floorGrad = ctx.createLinearGradient(0, groundY, 0, h);
  floorGrad.addColorStop(0, '#1a2540');
  floorGrad.addColorStop(0.4, '#121829');
  floorGrad.addColorStop(1, '#0a0e1a');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, groundY, w, h - groundY);

  // Floor reflection band
  const reflect = ctx.createLinearGradient(0, groundY, 0, groundY + 40);
  reflect.addColorStop(0, 'rgba(0, 240, 255, 0.08)');
  reflect.addColorStop(1, 'transparent');
  ctx.fillStyle = reflect;
  ctx.fillRect(0, groundY, w, 40);

  withGlow(ctx, REX_PALETTE.cyan, 18, () => {
    ctx.strokeStyle = REX_PALETTE.cyan;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(w, groundY);
    ctx.stroke();
  });

  ctx.fillStyle = 'rgba(0, 240, 255, 0.22)';
  for (let x = -offset; x < w + 32; x += 36) {
    const dashW = 16 + (Math.floor(x / 36) % 2) * 8;
    ctx.fillRect(x, groundY + 16, dashW, 3);
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  for (let x = -offset * 1.5; x < w; x += 52) {
    ctx.fillRect(x, groundY + 30, 24, 1);
  }
}

/** Premium cyber-rex with layered armor and glow core */
export function drawCyberRex(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  duck: boolean,
  anim: number,
  grounded: boolean,
): void {
  const run = grounded ? Math.floor(anim * 0.55) % 2 : 0;
  const legA = run === 0 ? 0 : 7;
  const legB = run === 0 ? 7 : 0;
  const tailWave = Math.sin(anim * 0.4) * 3;

  if (duck) {
  withGlow(ctx, REX_PALETTE.cyan, 22, () => {
    const body = new Path2D();
    body.moveTo(x + 2, y + 24);
    body.lineTo(x + 54, y + 24);
    body.quadraticCurveTo(x + 62, y + 20, x + 74, y + 16);
    body.lineTo(x + 78, y + 22);
    body.quadraticCurveTo(x + 80, y + 28, x + 74, y + 30);
    body.lineTo(x + 2, y + 30);
    body.closePath();
    fillGradientPath(ctx, body, x, y, x + 80, y + 30, [
      [0, '#00f0ff'],
      [0.5, '#00c8d8'],
      [1, '#0088aa'],
    ]);
    ctx.strokeStyle = '#b8ffff';
    ctx.lineWidth = 1.5;
    ctx.stroke(body);

    // Dorsal plates
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.moveTo(x + 14 + i * 10, y + 20);
      ctx.lineTo(x + 18 + i * 10, y + 14);
      ctx.lineTo(x + 22 + i * 10, y + 20);
      ctx.fill();
    }

    ctx.fillStyle = REX_PALETTE.void;
    ctx.fillRect(x + 68, y + 17, 5, 5);
    ctx.fillStyle = REX_PALETTE.gold;
    ctx.fillRect(x + 69, y + 18, 2, 2);
  });
    return;
  }

  // Tail trail glow
  withGlow(ctx, REX_PALETTE.cyan, 10, () => {
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 34);
    ctx.quadraticCurveTo(x - 8, y + 30 + tailWave, x - 14, y + 36);
    ctx.stroke();
  });

  withGlow(ctx, REX_PALETTE.cyan, 24, () => {
    // Tail segments
    const tail = new Path2D();
    tail.moveTo(x + 8, y + 34);
    tail.lineTo(x - 2, y + 30 + tailWave);
    tail.lineTo(x - 6, y + 38 + tailWave);
    tail.lineTo(x + 4, y + 40);
    tail.closePath();
    fillGradientPath(ctx, tail, x - 6, y + 28, x + 8, y + 40, [
      [0, '#00a8b8'],
      [1, '#00f0ff'],
    ]);
    ctx.strokeStyle = '#a8ffff';
    ctx.lineWidth = 1.25;
    ctx.stroke(tail);

    // Tail tip glow
    ctx.fillStyle = REX_PALETTE.gold;
    ctx.beginPath();
    ctx.arc(x - 4, y + 34 + tailWave, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Main body
    const body = new Path2D();
    body.moveTo(x + 14, y + 40);
    body.lineTo(x + 36, y + 40);
    body.quadraticCurveTo(x + 40, y + 22, x + 50, y + 14);
    body.lineTo(x + 58, y + 8);
    body.quadraticCurveTo(x + 66, y + 6, x + 72, y + 12);
    body.quadraticCurveTo(x + 76, y + 18, x + 72, y + 24);
    body.quadraticCurveTo(x + 68, y + 28, x + 42, y + 30);
    body.lineTo(x + 14, y + 40);
    body.closePath();
    fillGradientPath(ctx, body, x + 14, y + 6, x + 76, y + 40, [
      [0, '#00f0ff'],
      [0.4, '#00d4e8'],
      [0.75, '#00a8c0'],
      [1, '#007888'],
    ]);
    ctx.strokeStyle = '#c8ffff';
    ctx.lineWidth = 1.5;
    ctx.stroke(body);

    // Chest core
    const coreGrad = ctx.createRadialGradient(x + 38, y + 28, 0, x + 38, y + 28, 8);
    coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    coreGrad.addColorStop(0.4, 'rgba(0, 240, 255, 0.7)');
    coreGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.ellipse(x + 38, y + 28, 7, 5, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Dorsal spines
    const spines = [x + 28, x + 36, x + 44, x + 52];
    for (const sx of spines) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.moveTo(sx, y + 18);
      ctx.lineTo(sx + 3, y + 10);
      ctx.lineTo(sx + 6, y + 18);
      ctx.fill();
    }

    // Jaw
    ctx.fillStyle = '#00b8c8';
    ctx.beginPath();
    ctx.moveTo(x + 64, y + 16);
    ctx.lineTo(x + 74, y + 20);
    ctx.lineTo(x + 68, y + 24);
    ctx.closePath();
    ctx.fill();

    // Head crest
    ctx.fillStyle = '#00e8f8';
    ctx.beginPath();
    ctx.moveTo(x + 56, y + 10);
    ctx.lineTo(x + 60, y + 0);
    ctx.lineTo(x + 66, y + 10);
    ctx.closePath();
    ctx.fill();

    // Legs with knee joints
    const drawLeg = (lx: number, ext: number): void => {
      ctx.fillStyle = '#00c8d8';
      ctx.fillRect(lx, y + 38, 10, 6 + ext * 0.4);
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(lx + 1, y + 44 + ext * 0.4, 8, 6 + ext * 0.6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(lx + 3, y + 42 + ext * 0.3, 4, 2);
    };
    drawLeg(x + 18, legA);
    drawLeg(x + 32, legB);

    // Arm claw
    ctx.fillStyle = '#00d8e8';
    ctx.beginPath();
    ctx.moveTo(x + 46, y + 26);
    ctx.lineTo(x + 54, y + 24);
    ctx.lineTo(x + 52, y + 30);
    ctx.closePath();
    ctx.fill();

    // Eye with scan line
    ctx.fillStyle = REX_PALETTE.void;
    ctx.fillRect(x + 62, y + 11, 7, 7);
    ctx.fillStyle = REX_PALETTE.gold;
    ctx.fillRect(x + 64, y + 13, 3, 3);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillRect(x + 64, y + 12, 2, 1);
  });
}

/** Energy pylon firewall — replaces cheap cactus spikes */
export function drawFirewall(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  w: number,
  h: number,
  pulse: number,
): void {
  const glow = 14 + Math.sin(pulse) * 5;
  const flicker = 0.85 + Math.sin(pulse * 3.7) * 0.15;

  const drawPylon = (px: number, pw: number, ph: number, phase: number): void => {
    const top = groundY - ph;
    const beamW = pw * 0.35;

    // Hex base
    withGlow(ctx, REX_PALETTE.magenta, glow * 0.6, () => {
      ctx.fillStyle = 'rgba(30, 10, 30, 0.9)';
      ctx.strokeStyle = `rgba(255, 0, 110, ${flicker})`;
      ctx.lineWidth = 1.5;
      const hex = new Path2D();
      const hx = px + pw / 2;
      const hy = groundY - 6;
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const rx = hx + Math.cos(a) * (pw * 0.45);
        const ry = hy + Math.sin(a) * 5;
        if (i === 0) hex.moveTo(rx, ry);
        else hex.lineTo(rx, ry);
      }
      hex.closePath();
      ctx.fill(hex);
      ctx.stroke(hex);
    });

    // Plasma beam
    withGlow(ctx, REX_PALETTE.magenta, glow, () => {
      const beam = new Path2D();
      beam.moveTo(px + (pw - beamW) / 2, top);
      beam.lineTo(px + (pw + beamW) / 2, top);
      beam.lineTo(px + (pw + beamW * 0.7) / 2, groundY - 8);
      beam.lineTo(px + (pw - beamW * 0.7) / 2, groundY - 8);
      beam.closePath();
      const beamGrad = ctx.createLinearGradient(0, top, 0, groundY);
      beamGrad.addColorStop(0, `rgba(255, 255, 255, ${0.7 * flicker})`);
      beamGrad.addColorStop(0.2, `rgba(255, 0, 110, ${0.9 * flicker})`);
      beamGrad.addColorStop(0.6, `rgba(255, 0, 110, ${0.5 * flicker})`);
      beamGrad.addColorStop(1, 'rgba(255, 0, 110, 0.15)');
      ctx.fillStyle = beamGrad;
      ctx.fill(beam);
      ctx.strokeStyle = '#ff4d9a';
      ctx.lineWidth = 1.25;
      ctx.stroke(beam);

      // Energy rings
      const ringY = top + ph * (0.25 + phase * 0.15);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 * flicker})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(px + pw / 2, ringY, beamW * 0.55, 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Cap crystal
    withGlow(ctx, '#ffffff', 8, () => {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * flicker})`;
      ctx.beginPath();
      ctx.moveTo(px + pw / 2, top - 6);
      ctx.lineTo(px + pw / 2 + 5, top);
      ctx.lineTo(px + pw / 2 - 5, top);
      ctx.closePath();
      ctx.fill();
    });
  };

  if (w < 28) {
    drawPylon(x + w * 0.15, w * 0.7, h, 0);
  } else if (w < 44) {
    drawPylon(x, w * 0.4, h, 0);
    drawPylon(x + w * 0.5, w * 0.42, h * 0.9, 0.5);
  } else {
    drawPylon(x + w * 0.06, w * 0.28, h, 0);
    drawPylon(x + w * 0.36, w * 0.3, h * 1.05, 0.33);
    drawPylon(x + w * 0.66, w * 0.26, h * 0.88, 0.66);
  }

  // Ground hazard glow
  ctx.fillStyle = `rgba(255, 0, 110, ${0.2 * flicker})`;
  ctx.fillRect(x, groundY - 3, w, 3);
}

/** Quadcopter signal drone — replaces cheap bird */
export function drawSignalDrone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  wingUp: boolean,
  pulse: number,
  anim: number,
): void {
  const cy = y + 14;
  const rotorAngle = anim * 0.9;
  const bob = Math.sin(pulse * 2.5) * 2;

  // Scan cone beneath drone
  ctx.save();
  ctx.globalAlpha = 0.12 + Math.sin(pulse * 2) * 0.06;
  const scanGrad = ctx.createLinearGradient(0, cy, 0, cy + 40);
  scanGrad.addColorStop(0, 'rgba(0, 240, 255, 0.4)');
  scanGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = scanGrad;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.3, cy + 6);
  ctx.lineTo(x + w * 0.7, cy + 6);
  ctx.lineTo(x + w * 0.85, cy + 38);
  ctx.lineTo(x + w * 0.15, cy + 38);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Exhaust trail
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.35)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x - 4, cy + bob);
  for (let i = 1; i <= 4; i++) {
    ctx.lineTo(x - 8 - i * 5, cy + bob + Math.sin(anim + i) * 3);
  }
  ctx.stroke();

  withGlow(ctx, REX_PALETTE.violet, 16 + Math.sin(pulse * 2) * 4, () => {
    // Rotor arms
    const rotors: [number, number][] = [
      [x + w * 0.2, cy - 10 + bob],
      [x + w * 0.75, cy - 10 + bob],
      [x + w * 0.2, cy + 10 + bob],
      [x + w * 0.75, cy + 10 + bob],
    ];

    ctx.strokeStyle = 'rgba(180, 150, 255, 0.7)';
    ctx.lineWidth = 2;
    for (const [rx, ry] of rotors) {
      ctx.beginPath();
      ctx.moveTo(x + w * 0.48, cy + bob);
      ctx.lineTo(rx, ry);
      ctx.stroke();
    }

    // Spinning rotors
    for (const [rx, ry] of rotors) {
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(rx, ry, 9, 3, rotorAngle, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(rx, ry, 3, 9, rotorAngle, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = REX_PALETTE.cyan;
      ctx.beginPath();
      ctx.arc(rx, ry, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fuselage body
    const bodyGrad = ctx.createRadialGradient(
      x + w * 0.48, cy + bob, 2,
      x + w * 0.48, cy + bob, w * 0.3,
    );
    bodyGrad.addColorStop(0, '#d4c4ff');
    bodyGrad.addColorStop(0.4, '#8b5cf6');
    bodyGrad.addColorStop(1, '#4a2080');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.48, cy + bob, w * 0.28, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c4a8ff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Nose sensor array
    ctx.fillStyle = REX_PALETTE.cyan;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.72, cy + bob);
    ctx.lineTo(x + w * 0.92, cy + bob - 4);
    ctx.lineTo(x + w * 0.92, cy + bob + 4);
    ctx.closePath();
    ctx.fill();

    // Scanner eye
    const eyeGlow = 0.7 + Math.sin(pulse * 4) * 0.3;
    ctx.fillStyle = `rgba(0, 240, 255, ${eyeGlow})`;
    ctx.beginPath();
    ctx.arc(x + w * 0.62, cy + bob - 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + w * 0.61, cy + bob - 3, 2, 1);

    // Status LEDs
    ctx.fillStyle = wingUp ? '#00ff88' : REX_PALETTE.magenta;
    ctx.fillRect(x + w * 0.38, cy + bob - 5, 3, 3);
    ctx.fillStyle = REX_PALETTE.gold;
    ctx.fillRect(x + w * 0.44, cy + bob + 3, 3, 3);
  });
}

export function drawSpeedLines(
  ctx: CanvasRenderingContext2D,
  w: number,
  groundY: number,
  speed: number,
  offset: number,
): void {
  if (speed < 9) return;
  const intensity = Math.min(1, (speed - 9) / 5);
  ctx.save();
  ctx.globalAlpha = intensity * 0.35;
  ctx.strokeStyle = REX_PALETTE.cyan;
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const ly = 40 + (i * 47) % (groundY - 60);
    const lx = ((i * 113 - offset * 2.5) % (w + 80)) - 40;
    const len = 30 + (i % 3) * 20;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx - len, ly);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawVignette(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.85);
  vg.addColorStop(0, 'transparent');
  vg.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

export interface DustParticle {
  x: number;
  y: number;
  life: number;
  vx: number;
  vy: number;
  size: number;
}

export function spawnDust(x: number, y: number): DustParticle {
  return {
    x,
    y,
    life: 1,
    vx: -2.5 - Math.random() * 2.5,
    vy: -0.5 - Math.random() * 1.5,
    size: 2 + Math.random() * 2,
  };
}

export function drawDust(ctx: CanvasRenderingContext2D, particles: DustParticle[]): void {
  for (const p of particles) {
    const alpha = p.life * 0.45;
    withGlow(ctx, REX_PALETTE.cyan, 4 * p.life, () => {
      ctx.fillStyle = `rgba(0, 240, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}
