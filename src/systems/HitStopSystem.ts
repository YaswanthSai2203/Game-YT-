/** Brief time-freeze on heavy impacts — game feel punch */
export class HitStopSystem {
  private remaining = 0;
  private strength = 1;

  trigger(durationMs: number, strength = 1): void {
    this.remaining = Math.max(this.remaining, durationMs / 1000);
    this.strength = Math.max(this.strength, strength);
  }

  /** Returns time scale 0..1 for this frame */
  consume(dt: number): number {
    if (this.remaining <= 0) {
      this.strength = 1;
      return 1;
    }
    this.remaining -= dt;
    if (this.remaining <= 0) {
      this.strength = 1;
      return 1;
    }
    return 1 - this.strength * 0.92;
  }

  isActive(): boolean {
    return this.remaining > 0;
  }

  reset(): void {
    this.remaining = 0;
    this.strength = 1;
  }
}
