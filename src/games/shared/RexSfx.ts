import { MiniGameSfx } from '@/games/shared/MiniGameSfx';

export class RexSfx extends MiniGameSfx {
  start(): void {
    this.beep(220, 0.08, 'sine', 0.2, 440);
    setTimeout(() => this.beep(440, 0.1, 'sine', 0.18, 660), 60);
  }

  jump(): void {
    this.beep(320, 0.07, 'triangle', 0.16, 520);
  }

  land(): void {
    this.beep(180, 0.05, 'triangle', 0.08, 120);
  }

  scoreTick(): void {
    this.beep(880, 0.03, 'sine', 0.06, 1100);
  }

  death(): void {
    this.beep(180, 0.12, 'sawtooth', 0.28, 60);
    setTimeout(() => this.beep(90, 0.22, 'square', 0.2, 40), 80);
  }

  record(): void {
    this.beep(523, 0.1, 'sine', 0.18);
    setTimeout(() => this.beep(659, 0.1, 'sine', 0.18), 90);
    setTimeout(() => this.beep(784, 0.16, 'sine', 0.22), 180);
  }
}
