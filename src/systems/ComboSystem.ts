import { SCORING } from '@/config/constants';
import { EventBus } from '@/core/EventBus';
import { clamp } from '@/utils/math';

export class ComboSystem {
  private combo = 0;
  private multiplier = 1;
  private timer = 0;
  private maxCombo = 0;
  private events: EventBus;

  constructor(events: EventBus) {
    this.events = events;
  }

  getMultiplier(): number {
    return this.multiplier;
  }

  getCombo(): number {
    return this.combo;
  }

  getMaxCombo(): number {
    return this.maxCombo;
  }

  getTimer(): number {
    return this.timer;
  }

  getTimerRatio(): number {
    return this.timer / SCORING.COMBO_TIMEOUT;
  }

  hit(): void {
    this.combo++;
    this.multiplier = clamp(
      1 + (this.combo - 1) * SCORING.COMBO_INCREMENT,
      1,
      SCORING.MAX_COMBO_MULTIPLIER,
    );
    this.timer = SCORING.COMBO_TIMEOUT;

    if (this.combo > 1 && this.combo % 5 === 0) {
      this.events.emit('combo:update', { combo: this.combo, multiplier: this.multiplier });
    }

    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }
  }

  break(): void {
    const prev = this.combo;
    this.combo = 0;
    this.multiplier = 1;
    this.timer = 0;
    if (prev > 1) {
      this.events.emit('combo:break', { previousCombo: prev });
    }
  }

  update(dt: number): void {
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.break();
      }
    }
  }

  reset(): void {
    this.combo = 0;
    this.multiplier = 1;
    this.timer = 0;
    this.maxCombo = 0;
  }
}
