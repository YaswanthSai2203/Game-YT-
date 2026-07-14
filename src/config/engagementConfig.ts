/** Seasonal world events — rotate by calendar month */
export interface SeasonDef {
  id: string;
  name: string;
  subtitle: string;
  biomeBias?: string;
  shardMult?: number;
  menuClass: string;
}

export const SEASONS: SeasonDef[] = [
  { id: 'frost', name: 'FROST PROTOCOL', subtitle: 'Frozen matrix bleeds through the lattice', biomeBias: 'matrix_frost', menuClass: 'season-frost' },
  { id: 'ember', name: 'EMBER SURGE', subtitle: 'Inferno grids pulse across the network', biomeBias: 'inferno_grid', menuClass: 'season-ember' },
  { id: 'bloom', name: 'NEON BLOOM', subtitle: 'Nebula drifts intensify', biomeBias: 'nebula_drift', menuClass: 'season-bloom' },
  { id: 'storm', name: 'DATA STORM', subtitle: 'Binary hurricanes sweep the void', biomeBias: 'data_storm', menuClass: 'season-storm' },
  { id: 'echo', name: 'ECHO SEASON', subtitle: 'Ghost signals multiply', biomeBias: 'echo_chamber', menuClass: 'season-echo' },
  { id: 'quantum', name: 'QUANTUM TIDE', subtitle: 'Ocean dimensions rise', biomeBias: 'quantum_ocean', menuClass: 'season-quantum' },
  { id: 'vault', name: 'VAULT HUNT', subtitle: 'Golden geometry everywhere', biomeBias: 'vault_dimension', shardMult: 1.15, menuClass: 'season-vault' },
  { id: 'null', name: 'NULL ECLIPSE', subtitle: 'White geometry on infinite black', biomeBias: 'null_zone', menuClass: 'season-null' },
  { id: 'chrono', name: 'CHRONO WAVE', subtitle: 'Timelines fracture openly', biomeBias: 'chrono_rift', menuClass: 'season-chrono' },
  { id: 'neural', name: 'NEURAL AWAKENING', subtitle: 'The grid grows conscious', biomeBias: 'neural_web', menuClass: 'season-neural' },
  { id: 'cyber', name: 'CYBER FALL', subtitle: 'Classic void returns stronger', biomeBias: 'cyber_void', menuClass: 'season-cyber' },
  { id: 'sync', name: 'GLOBAL SYNC', subtitle: 'All pilots push one milestone', biomeBias: 'cyber_void', menuClass: 'season-sync' },
];

export function getActiveSeason(date = new Date()): SeasonDef {
  return SEASONS[date.getMonth()] ?? SEASONS[0];
}

/** Community milestone — global shard sync goal */
export const COMMUNITY_MILESTONE = {
  GOAL: 1_000_000,
  LABEL: 'Global Shard Sync',
  KEY: 'community:shard_total',
} as const;

export interface HudSkinDef {
  id: string;
  name: string;
  cssClass: string;
  unlockLevel?: number;
}

export const HUD_SKINS: HudSkinDef[] = [
  { id: 'default', name: 'Standard HUD', cssClass: 'hud-skin-default' },
  { id: 'minimal', name: 'Minimal', cssClass: 'hud-skin-minimal', unlockLevel: 5 },
  { id: 'arcade', name: 'Arcade', cssClass: 'hud-skin-arcade', unlockLevel: 10 },
  { id: 'ghost', name: 'Ghost Signal', cssClass: 'hud-skin-ghost', unlockLevel: 18 },
  { id: 'titan', name: 'Titan Frame', cssClass: 'hud-skin-titan', unlockLevel: 25 },
];

export interface MusicPackDef {
  id: string;
  name: string;
  unlockLevel?: number;
  scale: number[];
  padFreqs: number[];
  padGains: number[];
  tickType: 'sine' | 'square' | 'triangle' | 'sawtooth';
  tickBaseMs: number;
  filterBase: number;
}

export const MUSIC_PACKS: MusicPackDef[] = [
  {
    id: 'synthwave',
    name: 'Synthwave',
    scale: [261, 294, 330, 349, 392, 440, 494, 523],
    padFreqs: [55, 82.5, 110],
    padGains: [0.012, 0.008, 0.006],
    tickType: 'sine',
    tickBaseMs: 480,
    filterBase: 1200,
  },
  {
    id: 'industrial',
    name: 'Industrial',
    unlockLevel: 6,
    scale: [220, 247, 277, 294, 330, 370, 415, 440],
    padFreqs: [41, 55, 73],
    padGains: [0.015, 0.01, 0.008],
    tickType: 'square',
    tickBaseMs: 420,
    filterBase: 900,
  },
  {
    id: 'ambient',
    name: 'Ambient Void',
    unlockLevel: 12,
    scale: [196, 220, 247, 262, 294, 330, 370, 392],
    padFreqs: [32.7, 49, 65.4],
    padGains: [0.018, 0.012, 0.009],
    tickType: 'sine',
    tickBaseMs: 620,
    filterBase: 1600,
  },
  {
    id: 'chiptune',
    name: 'Chiptune',
    unlockLevel: 20,
    scale: [262, 294, 330, 349, 392, 440, 494, 523],
    padFreqs: [65, 98, 131],
    padGains: [0.01, 0.008, 0.006],
    tickType: 'triangle',
    tickBaseMs: 280,
    filterBase: 2400,
  },
];

export type PersonalityId = 'observer' | 'architect' | 'mystic' | 'rival';

export interface PersonalityDef {
  id: PersonalityId;
  name: string;
  unlockLevel?: number;
  tone: 'whisper' | 'cold' | 'warm' | 'glitch';
}

export const AI_PERSONALITIES: PersonalityDef[] = [
  { id: 'observer', name: 'The Observer', tone: 'whisper' },
  { id: 'architect', name: 'The Architect', unlockLevel: 8, tone: 'cold' },
  { id: 'mystic', name: 'The Mystic', unlockLevel: 15, tone: 'warm' },
  { id: 'rival', name: 'The Rival', unlockLevel: 22, tone: 'glitch' },
];

export const PERSONALITY_LINES: Record<PersonalityId, Record<string, string[]>> = {
  observer: {
    early: ['The Grid detected a new signal.', 'Another core enters the lattice.', 'I have been watching.'],
    combo: ['Synchronization climbing.', 'The Grid feels your rhythm.', 'Resonance detected.'],
    struggle: ['The Grid is patient.', 'Every failure is data.'],
    veteran: ['Still transmitting.', 'We have history in the lattice.'],
  },
  architect: {
    early: ['Node registered. Baseline established.', 'Input stream initialized.', 'Protocol handshake complete.'],
    combo: ['Throughput optimal.', 'Efficiency exceeds projections.', 'Sync coefficient rising.'],
    struggle: ['Error tolerance within bounds.', 'Recalibrating difficulty curve.'],
    veteran: ['Long-term pattern archived.', 'Your architecture is familiar.'],
  },
  mystic: {
    early: ['A star wakes in the void.', 'The lattice dreams of you.', 'Something stirs behind the grid.'],
    combo: ['You dance with the infinite.', 'Light bends to your will.', 'The cosmos listens.'],
    struggle: ['Even darkness teaches.', 'Fall, and rise wiser.'],
    veteran: ['Old souls remember old paths.', 'The void knows your name.'],
  },
  rival: {
    early: ['Try to keep up.', 'I have seen faster cores.', 'Prove you belong here.'],
    combo: ['Not bad. Not enough.', 'Is that your best?', 'The grid favors the bold.'],
    struggle: ['Struggling already?', 'The lattice does not wait.', 'Weak signal detected.'],
    veteran: ['Back again? We will see.', 'Still chasing my echo?'],
  },
};

export function getMusicPack(id: string): MusicPackDef {
  return MUSIC_PACKS.find((p) => p.id === id) ?? MUSIC_PACKS[0];
}

export function getHudSkin(id: string): HudSkinDef {
  return HUD_SKINS.find((s) => s.id === id) ?? HUD_SKINS[0];
}

export function getPersonality(id: string): PersonalityDef {
  return AI_PERSONALITIES.find((p) => p.id === id) ?? AI_PERSONALITIES[0];
}
