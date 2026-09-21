import { MiniGameSfx } from '@/games/shared/MiniGameSfx';

export class SnakeSfx extends MiniGameSfx {
  start(): void {
    this.ensure();
    this.beep(440, 0.08, 'square', 0.18);
    setTimeout(() => this.beep(660, 0.1, 'square', 0.16), 70);
  }

  eat(): void {
    this.ensure();
    this.beep(880, 0.06, 'square', 0.2, 1200);
  }

  levelUp(): void {
    this.ensure();
    this.beep(523, 0.07, 'triangle', 0.18);
    setTimeout(() => this.beep(784, 0.09, 'triangle', 0.2), 80);
    setTimeout(() => this.beep(988, 0.1, 'triangle', 0.16), 160);
  }

  gameOver(): void {
    this.ensure();
    this.beep(220, 0.14, 'sawtooth', 0.22, 90);
    setTimeout(() => this.beep(130, 0.2, 'sawtooth', 0.18, 60), 120);
  }

  uiTap(): void {
    this.ensure();
    this.beep(520, 0.04, 'sine', 0.12);
  }
}
