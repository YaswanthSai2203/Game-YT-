import { Container, Graphics } from 'pixi.js';
import { COLORS } from '@/config/constants';
import { createRng } from '@/utils/math';

export type WatcherPhase = 'eye' | 'half_face' | 'neurons' | 'hands';

/** Gigantic background AI entity — far behind gameplay, never blocking */
export class LivingWatcher {
  private container: Container;
  private face: Graphics;
  private eye: Graphics;
  private neurons: Graphics | null = null;
  private visible = true;
  private lookIntensity = 0;
  private pulsePhase = 0;
  private phase: WatcherPhase;
  private eyeOpen = 0;
  private directLook = false;
  private hiddenForFracture = false;
  private width: number;
  private height: number;

  constructor(parent: Container, width: number, height: number, seed = Date.now()) {
    this.width = width;
    this.height = height;
    const rng = createRng(seed);
    const roll = rng();
    this.phase = roll < 0.35 ? 'eye' : roll < 0.6 ? 'half_face' : roll < 0.85 ? 'neurons' : 'hands';

    this.container = new Container();
    this.container.alpha = 0.1;
    parent.addChildAt(this.container, 1);

    this.face = new Graphics();
    this.container.addChild(this.face);

    this.eye = new Graphics();
    this.container.addChild(this.eye);

    if (this.phase === 'neurons') {
      this.neurons = new Graphics();
      this.container.addChild(this.neurons);
      this.drawNeurons();
    }

    this.container.x = width * 0.5;
    this.container.y = height * 0.32;
    this.drawFace();
    this.drawEye(0, 0);
  }

  setDefeated(): void {
    this.visible = false;
    this.container.visible = false;
  }

  setFractureHidden(hidden: boolean): void {
    this.hiddenForFracture = hidden;
    this.container.visible = this.visible && !hidden;
  }

  onCombo(combo: number): void {
    if (!this.visible || this.hiddenForFracture) return;
    if (combo >= 40) {
      this.directLook = true;
      this.eyeOpen = 1;
      this.lookIntensity = 1;
    } else if (combo >= 20) {
      this.eyeOpen = Math.max(this.eyeOpen, clamp01((combo - 20) / 20));
      this.lookIntensity = Math.max(this.lookIntensity, 0.5 + this.eyeOpen * 0.4);
    } else {
      this.lookIntensity = Math.min(0.35, combo / 60);
    }
  }

  update(dt: number, playerX: number, playerY: number): void {
    if (!this.visible || this.hiddenForFracture) return;
    this.pulsePhase += dt;

    const baseAlpha = this.phase === 'eye' ? 0.06 : 0.1;
    this.container.alpha = baseAlpha
      + this.lookIntensity * 0.14
      + Math.sin(this.pulsePhase * 0.6) * 0.025;

    const trackMult = this.directLook ? 0.004 : 0.002 * this.lookIntensity;
    const dx = (playerX - this.container.x) * trackMult;
    const dy = (playerY - this.container.y) * trackMult * 0.6;
    const pupilScale = this.directLook ? 1.2 : 0.8 + this.eyeOpen * 0.4;
    this.drawEye(dx * 40 * pupilScale, dy * 25 * pupilScale);

    if (this.neurons) {
      this.neurons.alpha = 0.5 + Math.sin(this.pulsePhase * 1.5) * 0.2;
    }

    this.container.x = this.width * 0.5 + Math.sin(this.pulsePhase * 0.12) * 8;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }

  private drawFace(): void {
    this.face.clear();
    const scale = Math.min(this.width, this.height) * 0.38;

    if (this.phase === 'eye') return;

    if (this.phase === 'half_face') {
      this.face.arc(0, 0, scale, -Math.PI * 0.35, Math.PI * 0.35);
      this.face.fill({ color: COLORS.violet, alpha: 0.05 });
      this.face.stroke({ color: COLORS.magenta, width: 2, alpha: 0.1 });
    } else if (this.phase === 'hands') {
      const bodyR = scale * 0.5;
      this.face.circle(0, -scale * 0.1, bodyR);
      this.face.fill({ color: COLORS.violet, alpha: 0.04 });
      this.face.moveTo(-scale * 0.7, scale * 0.2);
      this.face.quadraticCurveTo(-scale * 0.5, scale * 0.5, -scale * 0.3, scale * 0.15);
      this.face.stroke({ color: COLORS.magenta, width: 2, alpha: 0.08 });
      this.face.moveTo(scale * 0.7, scale * 0.2);
      this.face.quadraticCurveTo(scale * 0.5, scale * 0.5, scale * 0.3, scale * 0.15);
      this.face.stroke({ color: COLORS.magenta, width: 2, alpha: 0.08 });
    } else {
      this.face.circle(0, 0, scale * 0.55);
      this.face.fill({ color: COLORS.violet, alpha: 0.03 });
    }
  }

  private drawNeurons(): void {
    if (!this.neurons) return;
    this.neurons.clear();
    const rng = createRng(42);
    for (let i = 0; i < 12; i++) {
      const x = (rng() - 0.5) * 200;
      const y = (rng() - 0.5) * 120;
      this.neurons!.circle(x, y, 3 + rng() * 4);
      this.neurons!.fill({ color: COLORS.cyan, alpha: 0.12 });
      if (i > 0) {
        const px = (rng() - 0.5) * 200;
        const py = (rng() - 0.5) * 120;
        this.neurons!.moveTo(x, y);
        this.neurons!.lineTo(px, py);
        this.neurons!.stroke({ color: COLORS.cyan, width: 1, alpha: 0.08 });
      }
    }
  }

  private drawEye(pupilX: number, pupilY: number): void {
    this.eye.clear();
    const open = 0.4 + this.eyeOpen * 0.6;
    const r = (28 + this.lookIntensity * 24) * open;
    if (r < 2) return;

    this.eye.ellipse(0, 0, r * 1.1, r);
    this.eye.fill({ color: COLORS.magenta, alpha: 0.12 + this.eyeOpen * 0.1 });
    this.eye.circle(pupilX, pupilY, r * 0.32);
    this.eye.fill({ color: COLORS.cyan, alpha: 0.35 + this.lookIntensity * 0.4 });
    if (this.directLook) {
      this.eye.circle(pupilX, pupilY, r * 0.12);
      this.eye.fill({ color: 0xffffff, alpha: 0.6 });
    }
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
