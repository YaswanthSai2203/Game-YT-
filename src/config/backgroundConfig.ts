/** World evolution driven by total runs (subconscious progression) */
export const RUN_EVOLUTION = {
  MORE_STARS: 10,
  BRIGHTER_VOID: 30,
  AI_STRUCTURES: 60,
  WATCHER_HINT: 100,
  REALITY_TEAR: 200,
  SKY_ALIVE: 500,
} as const;

/** Ambient environment events — cosmetic only, rotate every ~90s */
export type EnvEventId =
  | 'none'
  | 'data_rain'
  | 'firewall_lightning'
  | 'nebula'
  | 'binary_storm'
  | 'frozen_matrix'
  | 'inferno_grid'
  | 'quantum_vortex'
  | 'neon_dust';

export const ENV_EVENT_CYCLE: EnvEventId[] = [
  'none',
  'data_rain',
  'nebula',
  'binary_storm',
  'firewall_lightning',
  'quantum_vortex',
  'neon_dust',
  'frozen_matrix',
];

export const ENV_EVENT_INTERVAL = 88;

export const BACKGROUND = {
  /** Parallax speed multipliers per layer label */
  SPEEDS: {
    structures: 0.015,
    stars: 0.04,
    dust: 0.06,
    streams: 0.08,
    grid0: 0.2,
    grid1: 0.26,
    grid2: 0.32,
    weather: 0.08,
  },
  COMBO_GLOW_THRESHOLD: 5,
  COMBO_WAVE_THRESHOLD: 10,
  FRACTURE_CRACK_THRESHOLD: 0.3,
  CAMERA_COMBO_ZOOM: 0.02,
  CAMERA_SPEED_ZOOM: 0.015,
  SPEED_STRETCH_THRESHOLD: 1.4,
} as const;

export const THEME_PALETTES: Record<string, { bg: number; accent: number; line: number; glow: number }> = {
  inferno: { bg: 0x1a0808, accent: 0xff4400, line: 0x441100, glow: 0xff6600 },
  matrix: { bg: 0x041204, accent: 0x00ff44, line: 0x003300, glow: 0x00cc66 },
  quantum: { bg: 0x0c0420, accent: 0x8b5cf6, line: 0x220044, glow: 0x6d28d9 },
  ghost: { bg: 0x100818, accent: 0xff006e, line: 0x330033, glow: 0xff006e },
  gold: { bg: 0x141008, accent: 0xffd700, line: 0x443300, glow: 0xffaa00 },
  void: { bg: 0x020204, accent: 0xffffff, line: 0x222222, glow: 0x888888 },
  chrono: { bg: 0x080818, accent: 0x00f0ff, line: 0x004466, glow: 0x00d4ff },
  null: { bg: 0x010102, accent: 0xffffff, line: 0x333333, glow: 0xcccccc },
  default: { bg: 0x030508, accent: 0x00f0ff, line: 0x0a1828, glow: 0x00f0ff },
};

/** Map fracture dimension themes to visual palettes */
export function resolveThemePalette(theme: string): typeof THEME_PALETTES.default {
  return THEME_PALETTES[theme] ?? THEME_PALETTES.default;
}
