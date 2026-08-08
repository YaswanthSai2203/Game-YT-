/** CATAPULT CHAOS — shared types */

export type GamePhase = 'intro' | 'prepare' | 'aim' | 'power' | 'flying' | 'settling' | 'results';

export type MomentumState = 'stable' | 'hurt' | 'critical';

export type PowerZone = 'weak' | 'good' | 'perfect' | 'overload';

export type ObjectType =
  | 'terrain'
  | 'ramp'
  | 'crate'
  | 'trampoline'
  | 'barrel'
  | 'windmill'
  | 'coin'
  | 'target'
  | 'balloon';

export interface Vec2 {
  x: number;
  y: number;
}

export interface WorldObject {
  id: string;
  type: ObjectType;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  mass: number;
  elasticity: number;
  friction: number;
  breakStrength: number;
  hp: number;
  alive: boolean;
  vx: number;
  vy: number;
  static: boolean;
  special?: Record<string, number>;
}

export interface CharacterDef {
  id: string;
  name: string;
  mass: number;
  airControl: number;
  drag: number;
  impactResist: number;
  abilityName: string;
  abilityCooldown: number;
}

export interface ScoreBreakdown {
  distance: number;
  destruction: number;
  style: number;
  discovery: number;
  combo: number;
  precision: number;
  total: number;
}

export interface RunStats {
  maxDistance: number;
  objectsDestroyed: number;
  flips: number;
  secretsFound: number;
  maxCombo: number;
  perfectLaunch: boolean;
  coinsCollected: number;
}
