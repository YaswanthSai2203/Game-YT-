/** Lightweight Web Audio synth for Catapult Chaos — no external assets */

type Wave = OscillatorType;

export class CatapultSfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;

  ensure(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.38;
    this.master.connect(this.ctx.destination);
    void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  private beep(
    freq: number,
    duration: number,
    type: Wave = 'sine',
    vol = 0.25,
    slide?: number,
  ): void {
    if (this.muted || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + duration);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  powerTick(zone: string): void {
    if (zone === 'perfect') this.beep(880, 0.04, 'sine', 0.08);
  }

  launch(perfect: boolean): void {
    this.beep(perfect ? 220 : 160, 0.08, 'sawtooth', 0.35, perfect ? 520 : 380);
    if (perfect) {
      setTimeout(() => this.beep(660, 0.12, 'sine', 0.2), 40);
    }
  }

  bounce(): void {
    this.beep(320, 0.1, 'triangle', 0.22, 180);
  }

  break(): void {
    this.beep(140, 0.14, 'square', 0.2, 70);
  }

  explode(): void {
    this.beep(90, 0.2, 'sawtooth', 0.35, 40);
    setTimeout(() => this.beep(60, 0.25, 'square', 0.15), 30);
  }

  coin(): void {
    this.beep(1040, 0.06, 'sine', 0.18, 1400);
  }

  combo(level: number): void {
    const f = 440 + Math.min(level, 20) * 40;
    this.beep(f, 0.07, 'sine', 0.15, f * 1.2);
  }

  grapple(): void {
    this.beep(300, 0.08, 'sawtooth', 0.2, 600);
  }

  crash(): void {
    this.beep(80, 0.3, 'sawtooth', 0.3, 30);
  }

  resultsRecord(): void {
    this.beep(523, 0.1, 'sine', 0.2);
    setTimeout(() => this.beep(659, 0.1, 'sine', 0.2), 100);
    setTimeout(() => this.beep(784, 0.18, 'sine', 0.25), 200);
  }
}
