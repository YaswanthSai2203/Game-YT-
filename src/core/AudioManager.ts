import { SaveManager } from './SaveManager';

type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private realityPitch = 1;
  private musicOscs: OscillatorNode[] = [];
  private musicInterval: ReturnType<typeof setInterval> | null = null;
  private musicPlaying = false;
  private musicStep = 0;
  private pauseDucked = false;
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
    if (this.pauseDucked) this.setPaused(true);
  }

  setPaused(ducked: boolean): void {
    if (!this.musicGain || !this.ctx) return;
    this.pauseDucked = ducked;
    const vol = this.save.settings.musicVolume * (ducked ? 0.15 : 1);
    this.musicGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.08);
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
  playNearMiss(): void {
    this.playTone(880, 0.06, 'sine', 0.18);
    setTimeout(() => this.playTone(1100, 0.08, 'triangle', 0.12), 40);
  }
  playShieldBreak(): void {
    this.playNoise(0.25, 0.25);
    this.playTone(220, 0.2, 'square', 0.2);
    setTimeout(() => this.playTone(440, 0.15, 'sine', 0.15), 80);
  }
  playComboBreak(): void {
    this.playTone(330, 0.12, 'sawtooth', 0.12);
    setTimeout(() => this.playTone(220, 0.18, 'sawtooth', 0.1), 60);
  }
  playCountdownTick(final = false): void {
    if (final) {
      this.playTone(523, 0.12, 'square', 0.25);
      setTimeout(() => this.playTone(784, 0.2, 'square', 0.3), 80);
    } else {
      this.playTone(440, 0.08, 'square', 0.2);
    }
  }
  playHype(tier: number): void {
    const t = Math.max(1, Math.min(5, tier));
    const base = 330 + t * 80;
    this.playTone(base, 0.1, 'square', 0.22);
    setTimeout(() => this.playTone(base * 1.25, 0.1, 'square', 0.2), 70);
    setTimeout(() => this.playTone(base * 1.5, 0.15, 'sine', 0.28), 140);
    if (t >= 3) {
      setTimeout(() => this.playTone(base * 2, 0.2, 'triangle', 0.18), 220);
    }
    if (t >= 4) {
      this.playNoise(0.12, 0.12);
    }
  }
  playVaultJackpot(): void {
    [440, 554, 659, 880, 1108].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 0.18, 'square', 0.28), i * 90);
    });
    setTimeout(() => this.playNoise(0.2, 0.15), 400);
  }

  setRealityPitch(pitch: number): void {
    this.realityPitch = pitch;
    if (this.musicPlaying) this.restartMusicTicker();
  }

  playFracture(): void {
    this.playNoise(0.35, 0.2);
    [220, 330, 440, 550].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 0.15, 'sawtooth', 0.2), i * 60);
    });
  }

  playRareEvent(): void {
    [523, 659, 784, 988, 1175].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 0.2, 'square', 0.25), i * 100);
    });
    setTimeout(() => this.playNoise(0.25, 0.18), 500);
  }

  setIntensity(value: number): void {
    const prev = this.intensity;
    this.intensity = Math.max(0, Math.min(1, value));
    if (this.musicPlaying && Math.abs(prev - this.intensity) > 0.08) {
      this.restartMusicTicker();
    }
  }

  private getMusicTickMs(): number {
    return Math.max(180, 420 - this.intensity * 180);
  }

  private restartMusicTicker(): void {
    if (!this.musicPlaying) return;
    if (this.musicInterval) clearInterval(this.musicInterval);
    this.startMusicTicker();
  }

  private startMusicTicker(): void {
    const scale = [261, 294, 330, 349, 392, 440, 494, 523];
    this.musicInterval = setInterval(() => {
      if (!this.ctx) return;
      const freq = scale[this.musicStep % scale.length] * (1 + this.intensity * 0.5) * this.realityPitch;
      this.playTone(freq, 0.15, 'triangle', 0.06 + this.intensity * 0.04);
      this.musicStep++;
    }, this.getMusicTickMs());
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

    this.musicStep = 0;
    this.startMusicTicker();
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

  private layerInterval: ReturnType<typeof setInterval> | null = null;
  private currentLayer: string | null = null;

  setEmotionalLayer(layer: 'heartbeat' | 'choir' | 'piano' | 'none', active: boolean): void {
    if (!active || layer === 'none') {
      if (this.layerInterval) {
        clearInterval(this.layerInterval);
        this.layerInterval = null;
      }
      this.currentLayer = null;
      return;
    }
    if (this.currentLayer === layer) return;
    this.currentLayer = layer;
    if (this.layerInterval) clearInterval(this.layerInterval);

    if (layer === 'heartbeat') {
      this.layerInterval = setInterval(() => this.playTone(55, 0.08, 'sine', 0.12), 700);
    } else if (layer === 'choir') {
      this.layerInterval = setInterval(() => {
        this.playTone(330, 0.2, 'sine', 0.06);
        this.playTone(415, 0.2, 'sine', 0.05);
        this.playTone(523, 0.2, 'sine', 0.05);
      }, 900);
    } else if (layer === 'piano') {
      [262, 330, 392].forEach((f, i) => {
        setTimeout(() => this.playTone(f, 0.5, 'triangle', 0.15), i * 180);
      });
    }
  }

  destroy(): void {
    if (this.layerInterval) clearInterval(this.layerInterval);
    this.stopMusic();
    this.ctx?.close();
    this.ctx = null;
  }
}
