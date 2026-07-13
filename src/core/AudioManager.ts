import { SaveManager } from './SaveManager';

type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicOscs: OscillatorNode[] = [];
  private musicInterval: ReturnType<typeof setInterval> | null = null;
  private musicPlaying = false;
  private save: SaveManager;
  private intensity = 0;

  constructor(save: SaveManager) {
    this.save = save;
  }

  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
    this.applyVolumes();
  }

  private applyVolumes(): void {
    const s = this.save.settings;
    if (!this.masterGain) return;
    this.masterGain.gain.value = s.masterVolume;
    if (this.sfxGain) this.sfxGain.gain.value = s.sfxVolume;
    if (this.musicGain) this.musicGain.gain.value = s.musicVolume;
  }

  refresh(): void {
    this.applyVolumes();
  }

  resume(): void {
    this.ctx?.resume();
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.3,
    detune = 0,
  ): void {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  private playNoise(duration: number, volume = 0.15): void {
    if (!this.ctx || !this.sfxGain) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(this.sfxGain);
    source.start();
  }

  playMenuHover(): void { this.playTone(800, 0.05, 'sine', 0.15); }
  playMenuConfirm(): void {
    this.playTone(523, 0.1, 'sine', 0.2);
    setTimeout(() => this.playTone(659, 0.1, 'sine', 0.2), 80);
    setTimeout(() => this.playTone(784, 0.15, 'sine', 0.25), 160);
  }
  playLaneSwitch(): void { this.playNoise(0.08, 0.1); }
  playShardCollect(combo: number): void {
    const base = 440 + combo * 30;
    this.playTone(base, 0.12, 'sine', 0.25);
    this.playTone(base * 1.5, 0.08, 'triangle', 0.1);
  }
  playComboUp(): void {
    this.playTone(660, 0.08, 'square', 0.15);
    setTimeout(() => this.playTone(880, 0.08, 'square', 0.15), 60);
  }
  playPhaseShift(): void {
    this.playTone(110, 0.3, 'sawtooth', 0.3);
    this.playTone(880, 0.2, 'sine', 0.15);
  }
  playPowerup(): void {
    this.playTone(330, 0.15, 'square', 0.25);
    setTimeout(() => this.playTone(440, 0.15, 'square', 0.25), 100);
    setTimeout(() => this.playTone(550, 0.2, 'square', 0.25), 200);
  }
  playHit(): void {
    this.playNoise(0.4, 0.4);
    this.playTone(80, 0.5, 'sawtooth', 0.4);
  }
  playAchievement(): void {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 0.2, 'sine', 0.3), i * 120);
    });
  }

  setIntensity(value: number): void {
    this.intensity = value;
  }

  startMusic(): void {
    if (this.musicPlaying || !this.ctx || !this.musicGain) return;
    this.musicPlaying = true;

    const baseFreq = 110;
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = i === 0 ? 'sawtooth' : 'sine';
      osc.frequency.value = baseFreq * (i + 1);
      gain.gain.value = i === 0 ? 0.04 : 0.02;
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start();
      this.musicOscs.push(osc);
    }

    let step = 0;
    const scale = [261, 294, 330, 349, 392, 440, 494, 523];
    this.musicInterval = setInterval(() => {
      if (!this.ctx) return;
      const freq = scale[step % scale.length] * (1 + this.intensity * 0.5);
      this.playTone(freq, 0.15, 'triangle', 0.06 + this.intensity * 0.04);
      step++;
    }, 400 - this.intensity * 100);
  }

  stopMusic(): void {
    this.musicPlaying = false;
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    this.musicOscs.forEach((o) => { try { o.stop(); } catch { /* */ } });
    this.musicOscs = [];
  }

  destroy(): void {
    this.stopMusic();
    this.ctx?.close();
    this.ctx = null;
  }
}
