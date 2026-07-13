export type FractureRule =
  | 'reverse_flow'
  | 'shard_echo'
  | 'shifting_lanes'
  | 'firewall_titan'
  | 'chrono_corridor'
  | 'vault_rush';

export type RareEventType =
  | 'golden_storm'
  | 'quantum_vault'
  | 'ghost_rival';

export interface RealityDimensionDef {
  id: string;
  name: string;
  subtitle: string;
  rule: FractureRule;
  theme: 'void' | 'inferno' | 'matrix' | 'quantum' | 'ghost' | 'gold';
  tint: string;
  duration: number;
  musicPitch: number;
}

export const REALITY_DIMENSIONS: RealityDimensionDef[] = [
  {
    id: 'inverted_nexus',
    name: 'INVERTED NEXUS',
    subtitle: 'Gravity reversed — data flows upward',
    rule: 'reverse_flow',
    theme: 'quantum',
    tint: 'rgba(139,92,246,0.25)',
    duration: 18,
    musicPitch: 0.85,
  },
  {
    id: 'echo_chamber',
    name: 'ECHO CHAMBER',
    subtitle: 'Shards duplicate across dimensions',
    rule: 'shard_echo',
    theme: 'matrix',
    tint: 'rgba(0,255,136,0.2)',
    duration: 16,
    musicPitch: 1.1,
  },
  {
    id: 'flux_grid',
    name: 'FLUX GRID',
    subtitle: 'Lanes shift beneath your core',
    rule: 'shifting_lanes',
    theme: 'void',
    tint: 'rgba(0,240,255,0.22)',
    duration: 20,
    musicPitch: 1.05,
  },
  {
    id: 'titan_gate',
    name: 'TITAN GATE',
    subtitle: 'Colossal firewalls breach the grid',
    rule: 'firewall_titan',
    theme: 'inferno',
    tint: 'rgba(255,34,68,0.28)',
    duration: 22,
    musicPitch: 0.75,
  },
  {
    id: 'chrono_rift',
    name: 'CHRONO RIFT',
    subtitle: 'Bullet-time corridor — move fast, think faster',
    rule: 'chrono_corridor',
    theme: 'quantum',
    tint: 'rgba(0,240,255,0.3)',
    duration: 15,
    musicPitch: 1.25,
  },
  {
    id: 'vault_dimension',
    name: 'VAULT DIMENSION',
    subtitle: 'Hidden caches flooding the network',
    rule: 'vault_rush',
    theme: 'gold',
    tint: 'rgba(255,215,0,0.25)',
    duration: 14,
    musicPitch: 1.15,
  },
];

export const RARE_EVENTS: Record<RareEventType, {
  name: string;
  subtitle: string;
  duration: number;
  rollWeight: number;
}> = {
  golden_storm: {
    name: 'GOLDEN NETWORK STORM',
    subtitle: 'Ultra-rare — 3× shard value across the grid',
    duration: 12,
    rollWeight: 0.35,
  },
  quantum_vault: {
    name: 'HIDDEN QUANTUM VAULT',
    subtitle: 'A vault that should not exist has opened',
    duration: 8,
    rollWeight: 0.35,
  },
  ghost_rival: {
    name: 'GHOST RIVAL',
    subtitle: 'A phantom core mirrors your every move',
    duration: 20,
    rollWeight: 0.30,
  },
};

export const REALITY = {
  FLOW_DECAY: 8,
  STRUGGLE_DECAY: 6,
  FRACTURE_FLOW_THRESHOLD: 62,
  FRACTURE_FLOW_FORCE: 82,
  FRACTURE_MIN_TIME: 28,
  FRACTURE_COOLDOWN: 40,
  STRUGGLE_HELP_THRESHOLD: 55,
  RARE_ROLL_INTERVAL: 25,
  RARE_ROLL_CHANCE: 0.009,
  MAX_FRACTURES_PER_RUN: 4,
  MAX_RARE_PER_RUN: 1,
  GLITCH_FLOW_THRESHOLD: 45,
} as const;
