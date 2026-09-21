/** Lightweight Web Audio synth base — no external assets. */

type Wave = OscillatorType;

export class MiniGameSfx {
  protected ctx: AudioContext | null = null;
  protected master: GainNode | null = null;
  protected muted = false;

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

  protected beep(
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
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + duration);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }
}
