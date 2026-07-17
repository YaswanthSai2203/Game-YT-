import { SaveManager } from './SaveManager';
import { getMusicPack, type MusicPackDef } from '@/config/engagementConfig';

type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private realityPitch = 1;
  private musicOscs: OscillatorNode[] = [];
  private musicInterval: ReturnType<typeof setInterval> | null = null;
  private musicPlaying = false;
  private musicStep = 0;
  private pauseDucked = false;
  private platformMuted = false;
  private save: SaveManager;
  private intensity = 0;
  private gridMood = 'curious';
  private musicPack: MusicPackDef = getMusicPack('synthwave');

  constructor(save: SaveManager) {
    this.save = save;
  }

  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    void this.ctx.resume();
    this.masterGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.musicFilter = this.ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 1200;
    this.musicFilter.Q.value = 0.7;
    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.musicFilter);
    this.musicFilter.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
    this.applyVolumes();
  }

  private applyVolumes(): void {
    const s = this.save.settings;
    if (!this.masterGain) return;
    this.masterGain.gain.value = this.platformMuted ? 0 : s.masterVolume;
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

  setPlatformMuted(muted: boolean): void {
    this.platformMuted = muted;
    this.applyVolumes();
  }

  resume(): void {
    void this.ctx?.resume();
  }

  private ensureAudible(): void {
    if (!this.ctx) this.init();
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.3,
    detune = 0,
    destination: GainNode | null = this.sfxGain,
  ): void {
    this.ensureAudible();
    if (!this.ctx || !destination) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  private playNoise(duration: number, volume = 0.15): void {
    this.ensureAudible();
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
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    source.start();
  }

  playMenuHover(): void {
    this.ensureAudible();
    this.playTone(800, 0.05, 'sine', 0.15);
  }
  playMenuConfirm(): void {
    this.ensureAudible();
    this.playTone(523, 0.1, 'sine', 0.2);
    setTimeout(() => this.playTone(659, 0.1, 'sine', 0.2), 80);
    setTimeout(() => this.playTone(784, 0.15, 'sine', 0.25), 160);
  }
  playLaneSwitch(): void {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(780, this.ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }
  playShardCollect(combo: number): void {
    const base = 440 + combo * 30;
    this.playTone(base, 0.12, 'sine', 0.25);
    this.playTone(base * 1.5, 0.08, 'sine', 0.08);
  }
  playComboUp(): void {
    this.playTone(660, 0.08, 'sine', 0.15);
    setTimeout(() => this.playTone(880, 0.08, 'sine', 0.15), 60);
  }
  playPhaseShift(): void {
    this.playTone(220, 0.25, 'sine', 0.18);
    this.playTone(880, 0.2, 'sine', 0.12);
  }
  playPowerup(): void {
    this.playTone(330, 0.15, 'sine', 0.22);
    setTimeout(() => this.playTone(440, 0.15, 'sine', 0.2), 100);
    setTimeout(() => this.playTone(550, 0.2, 'sine', 0.2), 200);
  }
  playHit(): void {
    this.playNoise(0.35, 0.3);
    this.playTone(90, 0.4, 'sine', 0.25);
  }
  playAchievement(): void {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 0.2, 'sine', 0.3), i * 120);
    });
  }
  playNearMiss(): void {
    this.playTone(880, 0.06, 'sine', 0.18);
    setTimeout(() => this.playTone(1100, 0.08, 'sine', 0.1), 40);
  }
  playShieldBreak(): void {
    this.playNoise(0.2, 0.18);
    this.playTone(220, 0.2, 'sine', 0.16);
    setTimeout(() => this.playTone(440, 0.15, 'sine', 0.12), 80);
  }
  playComboBreak(): void {
    this.playTone(330, 0.12, 'sine', 0.1);
    setTimeout(() => this.playTone(220, 0.18, 'sine', 0.08), 60);
  }
  playCountdownTick(final = false): void {
    if (final) {
      this.playTone(523, 0.12, 'sine', 0.22);
      setTimeout(() => this.playTone(784, 0.2, 'sine', 0.26), 80);
    } else {
      this.playTone(440, 0.08, 'sine', 0.18);
    }
  }
  playHype(tier: number): void {
    const t = Math.max(1, Math.min(5, tier));
    const base = 330 + t * 80;
    this.playTone(base, 0.1, 'sine', 0.2);
    setTimeout(() => this.playTone(base * 1.25, 0.1, 'sine', 0.18), 70);
    setTimeout(() => this.playTone(base * 1.5, 0.15, 'sine', 0.24), 140);
    if (t >= 3) {
      setTimeout(() => this.playTone(base * 2, 0.2, 'sine', 0.14), 220);
    }
    if (t >= 4) {
      this.playNoise(0.1, 0.08);
    }
  }
  playVaultJackpot(): void {
    [440, 554, 659, 880, 1108].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 0.18, 'sine', 0.24), i * 90);
    });
    setTimeout(() => this.playNoise(0.15, 0.1), 400);
  }

  setRealityPitch(pitch: number): void {
    this.realityPitch = pitch;
    if (this.musicPlaying) this.restartMusicTicker();
  }

  playFracture(): void {
    this.playNoise(0.25, 0.14);
    [220, 330, 440, 550].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 0.15, 'sine', 0.14), i * 60);
    });
  }

  playRareEvent(): void {
    [523, 659, 784, 988, 1175].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 0.2, 'sine', 0.2), i * 100);
    });
    setTimeout(() => this.playNoise(0.2, 0.12), 500);
  }

  setGridMood(mood: string): void {
    this.gridMood = mood;
    if (!this.musicFilter || !this.ctx) return;
    const freq = mood === 'aggressive' ? 700 : mood === 'respectful' ? 1400 : mood === 'testing' ? 1000 : 1200;
    this.musicFilter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.4);
  }

  setMusicPack(packId: string): void {
    this.musicPack = getMusicPack(packId);
    if (this.musicFilter) {
      this.musicFilter.frequency.setTargetAtTime(this.musicPack.filterBase, this.ctx?.currentTime ?? 0, 0.3);
    }
    if (this.musicPlaying) {
      this.stopMusic();
      this.startMusic();
    }
  }

  refreshMusicPackFromSave(): void {
    this.setMusicPack(this.save.save.unlocks.selectedMusicPack ?? 'synthwave');
  }


  setIntensity(value: number): void {
    const prev = this.intensity;
    this.intensity = Math.max(0, Math.min(1, value));
    if (this.musicFilter) {
      const targetFreq = 900 + this.intensity * 500;
      this.musicFilter.frequency.setTargetAtTime(targetFreq, this.ctx?.currentTime ?? 0, 0.2);
    }
    if (this.musicPlaying && Math.abs(prev - this.intensity) > 0.08) {
      this.restartMusicTicker();
    }
  }

  private getMusicTickMs(): number {
    return Math.max(180, this.musicPack.tickBaseMs - this.intensity * 160);
  }

  private startMusicTicker(): void {
    const scale = this.musicPack.scale;
    const tickType = this.musicPack.tickType;
    this.musicInterval = setInterval(() => {
      if (!this.ctx || !this.musicGain) return;
      const freq = scale[this.musicStep % scale.length] * (1 + this.intensity * 0.35) * this.realityPitch;
      this.playTone(freq, 0.18, tickType, 0.035 + this.intensity * 0.02, 0, this.musicGain);
      this.musicStep++;
    }, this.getMusicTickMs());
  }

  startMusic(): void {
    this.ensureAudible();
    if (this.musicPlaying || !this.ctx || !this.musicGain) return;
    this.musicPlaying = true;
    this.musicPack = getMusicPack(this.save.save.unlocks.selectedMusicPack ?? 'synthwave');

    const pads = this.musicPack.padFreqs.map((freq, i) => ({
      freq,
      gain: this.musicPack.padGains[i] ?? 0.008,
    }));
    for (const pad of pads) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = this.musicPack.tickType === 'square' ? 'square' : 'sine';
      osc.frequency.value = pad.freq;
      gain.gain.value = pad.gain;
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start();
      this.musicOscs.push(osc);
    }

    if (this.musicFilter) {
      this.musicFilter.frequency.value = this.musicPack.filterBase;
    }

    this.musicStep = 0;
    this.startMusicTicker();
  }

  private restartMusicTicker(): void {
    if (!this.musicPlaying) return;
    if (this.musicInterval) clearInterval(this.musicInterval);
    this.startMusicTicker();
  }

  getGridMood(): string {
    return this.gridMood;
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
      this.layerInterval = setInterval(() => this.playTone(55, 0.06, 'sine', 0.08, 0, this.musicGain), 850);
    } else if (layer === 'choir') {
      this.layerInterval = setInterval(() => {
        this.playTone(330, 0.22, 'sine', 0.04, 0, this.musicGain);
        this.playTone(415, 0.22, 'sine', 0.035, 0, this.musicGain);
        this.playTone(523, 0.22, 'sine', 0.035, 0, this.musicGain);
      }, 1100);
    } else if (layer === 'piano') {
      [262, 330, 392].forEach((f, i) => {
        setTimeout(() => this.playTone(f, 0.5, 'sine', 0.1, 0, this.musicGain), i * 180);
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
