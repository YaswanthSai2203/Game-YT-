import { Container, BlurFilter, ColorMatrixFilter, NoiseFilter } from 'pixi.js';

export interface PostProcessState {
  speedRatio: number;
  combo: number;
  fractureActive: boolean;
  nearDeath: boolean;
}

/** Pixi post-process stack — bloom-ish glow, speed blur, combo saturation */
export class PostProcessSystem {
  private target: Container;
  private blur: BlurFilter;
  private color: ColorMatrixFilter;
  private noise: NoiseFilter;
  private enabled: boolean;

  constructor(target: Container, reducedMotion: boolean) {
    this.target = target;
    this.enabled = !reducedMotion;

    this.blur = new BlurFilter({ strength: 0, quality: 2 });
    this.color = new ColorMatrixFilter();
    this.noise = new NoiseFilter({ noise: 0.08, seed: Math.random() });

    if (this.enabled) {
      this.target.filters = [this.color, this.blur, this.noise];
    }
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
    this.target.filters = value ? [this.color, this.blur, this.noise] : [];
  }

  update(state: PostProcessState): void {
    if (!this.enabled) return;

    const speedBlur = Math.max(0, (state.speedRatio - 1.2) * 1.2);
    this.blur.strength = speedBlur;

    this.color.reset();
    const sat = 1 + Math.min(state.combo / 30, 0.35);
    this.color.saturate(sat - 1, false);
    if (state.combo >= 10) {
      this.color.brightness(1 + Math.min(state.combo / 80, 0.12), false);
    }
    if (state.fractureActive) {
      this.color.hue(15, false);
      this.noise.noise = 0.18;
    } else if (state.nearDeath) {
      this.color.hue(-8, false);
      this.noise.noise = 0.12;
    } else {
      this.noise.noise = 0.06;
    }
  }

  pulseFracture(): void {
    if (!this.enabled) return;
    this.blur.strength = 4;
    setTimeout(() => { if (this.enabled) this.blur.strength = 0; }, 120);
  }

  destroy(): void {
    this.target.filters = [];
  }
}
