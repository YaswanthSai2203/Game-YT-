import {
  DIR_DELTA,
  FOOD_PER_LEVEL,
  GRID_COLS,
  GRID_ROWS,
  OPPOSITE,
  SCORE_PER_FOOD,
  type Direction,
  type GridPoint,
} from '@/games/neon-snake/snakeTypes';

export interface SnakeEngineState {
  snake: GridPoint[];
  direction: Direction;
  food: GridPoint;
  score: number;
  level: number;
  foodEaten: number;
  gameOver: boolean;
  tickMs: number;
  levelUpFlash: number;
  graceTicks: number;
}

function pointsEqual(a: GridPoint, b: GridPoint): boolean {
  return a.x === b.x && a.y === b.y;
}

function inBounds(p: GridPoint): boolean {
  return p.x >= 0 && p.x < GRID_COLS && p.y >= 0 && p.y < GRID_ROWS;
}

function tickMsForLevel(level: number): number {
  return Math.max(68, 152 - (level - 1) * 11);
}

function spawnFood(snake: GridPoint[], rng: () => number): GridPoint {
  const occupied = new Set(snake.map((s) => `${s.x},${s.y}`));
  const free: GridPoint[] = [];
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  if (free.length === 0) return { x: 0, y: 0 };
  return free[Math.floor(rng() * free.length)]!;
}

function initialSnake(): GridPoint[] {
  const cx = Math.floor(GRID_COLS / 2);
  const cy = Math.floor(GRID_ROWS / 2);
  return [
    { x: cx, y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy },
  ];
}

/** Pure grid Snake rules — one cell per tick. */
export class SnakeEngine {
  private rng: () => number;
  private pendingDir: Direction | null = null;
  state: SnakeEngineState;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
    this.state = this.createFreshState();
  }

  createFreshState(): SnakeEngineState {
    const snake = initialSnake();
    return {
      snake,
      direction: 'right',
      food: spawnFood(snake, this.rng),
      score: 0,
      level: 1,
      foodEaten: 0,
      gameOver: false,
      tickMs: tickMsForLevel(1),
      levelUpFlash: 0,
      graceTicks: 2,
    };
  }

  reset(): void {
    this.pendingDir = null;
    this.state = this.createFreshState();
  }

  /** Begin a run — brief grace period avoids spurious collisions on first ticks. */
  startRun(): void {
    this.reset();
    this.state.graceTicks = 2;
  }

  queueDirection(dir: Direction): void {
    if (this.state.gameOver) return;
    const current = this.pendingDir ?? this.state.direction;
    if (dir === OPPOSITE[current]) return;
    if (dir === current) return;
    this.pendingDir = dir;
  }

  /** Advance one grid tick. Returns true if food was eaten. */
  step(): { ate: boolean; levelUp: boolean; died: boolean } {
    const s = this.state;
    if (s.gameOver) return { ate: false, levelUp: false, died: false };

    if (s.levelUpFlash > 0) s.levelUpFlash -= 1;

    if (this.pendingDir) {
      s.direction = this.pendingDir;
      this.pendingDir = null;
    }

    const head = s.snake[0]!;
    const delta = DIR_DELTA[s.direction];
    const next = { x: head.x + delta.x, y: head.y + delta.y };

    if (!inBounds(next)) {
      if (s.graceTicks > 0) {
        s.graceTicks -= 1;
        return { ate: false, levelUp: false, died: false };
      }
      s.gameOver = true;
      return { ate: false, levelUp: false, died: true };
    }

    if (s.snake.some((seg) => pointsEqual(seg, next))) {
      if (s.graceTicks > 0) {
        s.graceTicks -= 1;
        return { ate: false, levelUp: false, died: false };
      }
      s.gameOver = true;
      return { ate: false, levelUp: false, died: true };
    }

    if (s.graceTicks > 0) s.graceTicks -= 1;

    const ate = pointsEqual(next, s.food);
    s.snake.unshift(next);
    if (!ate) {
      s.snake.pop();
    } else {
      s.score += SCORE_PER_FOOD;
      s.foodEaten += 1;
      s.food = spawnFood(s.snake, this.rng);
      const newLevel = Math.floor(s.foodEaten / FOOD_PER_LEVEL) + 1;
      let levelUp = false;
      if (newLevel > s.level) {
        s.level = newLevel;
        s.levelUpFlash = 28;
        levelUp = true;
      }
      s.tickMs = tickMsForLevel(s.level);
      return { ate: true, levelUp, died: false };
    }

    return { ate: false, levelUp: false, died: false };
  }
}
