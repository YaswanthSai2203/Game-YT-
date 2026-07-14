import type { BackgroundBiomeId } from '@/config/backgroundConfig';

export interface CoreDef {
  id: string;
  name: string;
  color: number;
  animated?: boolean;
}

export interface TrailDef {
  id: string;
  name: string;
  style: 'default' | 'gold' | 'glitch';
}

export interface ThemeDef {
  id: string;
  name: string;
  biome: BackgroundBiomeId;
}

export const CORE_DEFS: CoreDef[] = [
  { id: 'default', name: 'Cyan Core', color: 0x00f0ff },
  { id: 'cyan', name: 'Cyan Core', color: 0x00f0ff },
  { id: 'magenta', name: 'Magenta Core', color: 0xff006e },
  { id: 'violet', name: 'Violet Core', color: 0x8b5cf6 },
  { id: 'quantum', name: 'Quantum Core', color: 0x00d4ff, animated: true },
  { id: 'grid-bound', name: 'Grid Bound', color: 0xff006e },
];

export const TRAIL_DEFS: TrailDef[] = [
  { id: 'default', name: 'Standard Pulse', style: 'default' },
  { id: 'gold', name: 'Gold Trail', style: 'gold' },
  { id: 'glitch', name: 'Glitch Trail', style: 'glitch' },
];

export const THEME_DEFS: ThemeDef[] = [
  { id: 'default', name: 'Cyber Void', biome: 'cyber_void' },
  { id: 'matrix', name: 'Matrix Grid', biome: 'matrix_frost' },
  { id: 'inferno', name: 'Inferno Grid', biome: 'inferno_grid' },
  { id: 'quantum', name: 'Quantum Ocean', biome: 'quantum_ocean' },
  { id: 'ghost', name: 'Echo Chamber', biome: 'echo_chamber' },
  { id: 'gold', name: 'Vault Dimension', biome: 'vault_dimension' },
];

export function getTrailStyle(trailId: string): TrailDef['style'] {
  return TRAIL_DEFS.find((t) => t.id === trailId)?.style ?? 'default';
}

export function getThemeBiome(themeId: string): BackgroundBiomeId | null {
  return THEME_DEFS.find((t) => t.id === themeId)?.biome ?? null;
}

export function getCoreDef(coreId: string): CoreDef {
  return CORE_DEFS.find((c) => c.id === coreId) ?? CORE_DEFS[0];
}
