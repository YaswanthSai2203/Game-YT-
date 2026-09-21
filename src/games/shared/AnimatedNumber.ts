/** Smooth count-up for score and distance displays. */
export class AnimatedNumber {
  display = 0;
  target = 0;

  set(value: number): void {
    this.target = Math.max(0, value);
  }

  snap(value: number): void {
    this.target = value;
    this.display = value;
  }

  tick(dt: number, speed = 0.14): number {
    const diff = this.target - this.display;
    if (Math.abs(diff) < 0.6) {
      this.display = this.target;
    } else {
      this.display += diff * Math.min(1, dt * speed);
    }
    return this.display;
  }

  rounded(): number {
    return Math.round(this.display);
  }

  padded(width: number): string {
    return String(this.rounded()).padStart(width, '0');
  }

  formatted(): string {
    return this.rounded().toLocaleString();
  }
}
