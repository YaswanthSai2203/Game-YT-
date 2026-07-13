import { Container, Graphics } from 'pixi.js';
import { COLORS } from '@/config/constants';

/** Gigantic background entity that watches the player */
export class LivingWatcher {
  private container: Container;
  private eye: Graphics;
  private visible = true;
  private lookIntensity = 0;
  private pulsePhase = 0;

  constructor(parent: Container, width: number, height: number) {
    this.container = new Container();
    this.container.alpha = 0.12;
    parent.addChildAt(this.container, 0);

    const body = new Graphics();
    body.circle(0, 0, Math.min(width, height) * 0.35);
    body.fill({ color: COLORS.violet, alpha: 0.08 });
    body.stroke({ color: COLORS.magenta, width: 2, alpha: 0.15 });
    this.container.addChild(body);

    this.eye = new Graphics();
    this.container.addChild(this.eye);
    this.container.x = width * 0.5;
    this.container.y = height * 0.35;
    this.drawEye(0, 0);
  }

  setDefeated(): void {
    this.visible = false;
    this.container.visible = false;
  }

  onCombo(combo: number): void {
    if (!this.visible) return;
    this.lookIntensity = Math.min(1, combo / 15);
  }

  update(dt: number, playerX: number, playerY: number): void {
    if (!this.visible) return;
    this.pulsePhase += dt;
    this.container.alpha = 0.08 + this.lookIntensity * 0.12 + Math.sin(this.pulsePhase * 0.8) * 0.03;

    const dx = (playerX - this.container.x) * 0.002 * this.lookIntensity;
    const dy = (playerY - this.container.y) * 0.001 * this.lookIntensity;
    this.drawEye(dx * 30, dy * 20);
  }

  private drawEye(pupilX: number, pupilY: number): void {
    this.eye.clear();
    const r = 40 + this.lookIntensity * 20;
    this.eye.circle(0, 0, r);
    this.eye.fill({ color: COLORS.magenta, alpha: 0.15 });
    this.eye.circle(pupilX, pupilY, r * 0.35);
    this.eye.fill({ color: COLORS.cyan, alpha: 0.4 + this.lookIntensity * 0.3 });
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
