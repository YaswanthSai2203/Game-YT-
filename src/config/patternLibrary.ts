/** Data-driven spawn choreography — sequences instead of hardcoded methods */

export type SpawnCmdType = 'firewall' | 'shard' | 'powerup' | 'vault' | 'score_boost' | 'bomb' | 'wait';

export interface SpawnCmd {
  type: SpawnCmdType;
  /** Lane 0-2, 'random', 'gap' (safe lane random), 'all_blocked_except' needs lane for safe */
  lane: number | 'random' | 'gap' | 'all';
  /** For gap pattern: which lane stays open when type is firewall on others */
  safeLane?: number;
}

export interface PatternDef {
  id: string;
  name: string;
  weight: number;
  minElapsed: number;
  tags: string[];
  steps: SpawnCmd[];
}

export const PATTERN_LIBRARY: PatternDef[] = [
  {
    id: 'warmup_shard',
    name: 'Warmup Shard',
    weight: 1,
    minElapsed: 0,
    tags: ['training', 'mercy', 'balanced'],
    steps: [
      { type: 'shard', lane: 'random' },
    ],
  },
  {
    id: 'single_obstacle',
    name: 'Single Obstacle',
    weight: 1.2,
    minElapsed: 20,
    tags: ['balanced', 'training'],
    steps: [
      { type: 'firewall', lane: 'random' },
      { type: 'shard', lane: 'random' },
    ],
  },
  {
    id: 'dual_gap',
    name: 'Dual Gap',
    weight: 1,
    minElapsed: 45,
    tags: ['balanced', 'hunter'],
    steps: [
      { type: 'firewall', lane: 0 },
      { type: 'firewall', lane: 2 },
      { type: 'shard', lane: 1 },
    ],
  },
  {
    id: 'center_trap',
    name: 'Center Trap',
    weight: 0.9,
    minElapsed: 45,
    tags: ['balanced', 'hunter'],
    steps: [
      { type: 'firewall', lane: 1 },
      { type: 'shard', lane: 0 },
      { type: 'shard', lane: 2 },
    ],
  },
  {
    id: 'gap_run',
    name: 'Gap Run',
    weight: 1.1,
    minElapsed: 60,
    tags: ['hunter', 'balanced'],
    steps: [
      { type: 'firewall', lane: 0 },
      { type: 'firewall', lane: 1 },
      { type: 'shard', lane: 2 },
    ],
  },
  {
    id: 'shard_rain',
    name: 'Shard Rain',
    weight: 1.3,
    minElapsed: 20,
    tags: ['mercy', 'training'],
    steps: [
      { type: 'shard', lane: 'random' },
      { type: 'shard', lane: 'random' },
      { type: 'shard', lane: 'random' },
    ],
  },
  {
    id: 'expert_chaos',
    name: 'Expert Chaos',
    weight: 0.8,
    minElapsed: 90,
    tags: ['hunter'],
    steps: [
      { type: 'firewall', lane: 0 },
      { type: 'firewall', lane: 1 },
      { type: 'firewall', lane: 2 },
      { type: 'shard', lane: 'gap' },
    ],
  },
  {
    id: 'vault_tease',
    name: 'Vault Tease',
    weight: 0.3,
    minElapsed: 50,
    tags: ['balanced'],
    steps: [
      { type: 'firewall', lane: 0 },
      { type: 'firewall', lane: 2 },
      { type: 'vault', lane: 1 },
    ],
  },
  {
    id: 'pickup_lane',
    name: 'Pickup Lane',
    weight: 0.5,
    minElapsed: 35,
    tags: ['balanced', 'mercy'],
    steps: [
      { type: 'shard', lane: 'random' },
      { type: 'score_boost', lane: 'random' },
    ],
  },
  {
    id: 'triple_wall',
    name: 'Triple Wall',
    weight: 0.7,
    minElapsed: 75,
    tags: ['hunter'],
    steps: [
      { type: 'firewall', lane: 0 },
      { type: 'firewall', lane: 1 },
      { type: 'firewall', lane: 2 },
    ],
  },
];

export function pickPattern(
  elapsed: number,
  tag: string,
  rng: () => number,
): PatternDef | null {
  const pool = PATTERN_LIBRARY.filter(
    (p) => p.minElapsed <= elapsed && (p.tags.includes(tag) || p.tags.includes('balanced')),
  );
  if (pool.length === 0) return null;
  const total = pool.reduce((s, p) => s + p.weight, 0);
  let roll = rng() * total;
  for (const p of pool) {
    roll -= p.weight;
    if (roll <= 0) return p;
  }
  return pool[pool.length - 1];
}
