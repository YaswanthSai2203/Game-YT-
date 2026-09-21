export type Direction = 'up' | 'down' | 'left' | 'right';

export type GameScreen = 'menu' | 'playing' | 'paused' | 'gameover';

export interface GridPoint {
  x: number;
  y: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
}

export interface PopText {
  x: number;
  y: number;
  text: string;
  life: number;
}

export const GRID_COLS = 21;
export const GRID_ROWS = 21;
export const SCORE_PER_FOOD = 10;
export const FOOD_PER_LEVEL = 5;
export const HI_KEY = 'neon-snake-hi';
export const MUTE_KEY = 'neon-snake-muted';

export const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

export const DIR_DELTA: Record<Direction, GridPoint> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
