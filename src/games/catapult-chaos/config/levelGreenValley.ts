import type { WorldObject } from '@/games/catapult-chaos/types';
import { OBJECT_TEMPLATES } from '@/games/catapult-chaos/config/objectDefs';

function obj(
  id: string,
  type: WorldObject['type'],
  x: number,
  y: number,
  w: number,
  h: number,
  opts: Partial<WorldObject> = {},
): WorldObject {
  const t = OBJECT_TEMPLATES[type];
  return {
    id,
    type,
    x,
    y,
    w,
    h,
    rotation: opts.rotation ?? 0,
    mass: opts.mass ?? t.mass,
    elasticity: opts.elasticity ?? t.elasticity,
    friction: opts.friction ?? t.friction,
    breakStrength: opts.breakStrength ?? t.breakStrength,
    hp: opts.hp ?? t.breakStrength,
    alive: true,
    vx: 0,
    vy: 0,
    static: opts.static ?? (type === 'terrain' || type === 'ramp' || type === 'windmill' || type === 'trampoline'),
    special: opts.special,
  };
}

/** Handcrafted Level 1 — Green Valley tutorial slice */
export const GREEN_VALLEY_LEVEL = {
  id: 'green-valley-1',
  name: 'First Flight',
  world: 'Green Valley',
  width: 5200,
  wind: 0.35,
  weather: 'Clear skies',
  spawn: { x: 120, y: 0 },
  catapult: { x: 80, y: 0 },
  groundY: 0,
};

export function buildGreenValleyObjects(groundY: number): WorldObject[] {
  const gy = groundY;
  return [
    // Launch platform
    obj('ground-start', 'terrain', -40, gy - 24, 320, 24),
    // First hill
    obj('hill-1', 'terrain', 280, gy - 8, 420, 32, { rotation: -0.08 }),
    obj('ramp-1', 'ramp', 520, gy - 72, 140, 20, { rotation: -0.42 }),
    // Crates cluster
    obj('crate-1', 'crate', 780, gy - 52, 48, 48),
    obj('crate-2', 'crate', 828, gy - 52, 48, 48),
    obj('crate-3', 'crate', 804, gy - 100, 48, 48),
    // Trampoline valley
    obj('ground-2', 'terrain', 920, gy + 20, 380, 28),
    obj('tramp-1', 'trampoline', 1020, gy - 18, 96, 18),
    // Mid field targets
    obj('target-1', 'target', 1380, gy - 120, 36, 36),
    obj('coin-1', 'coin', 1280, gy - 80, 20, 20),
    obj('coin-2', 'coin', 1320, gy - 140, 20, 20),
    obj('coin-3', 'coin', 1450, gy - 60, 20, 20),
    // Windmill section
    obj('ground-3', 'terrain', 1520, gy - 4, 500, 28),
    obj('windmill-base', 'terrain', 1680, gy - 120, 24, 120),
    obj('windmill-blade', 'windmill', 1692, gy - 168, 160, 12, { special: { spin: 1.2 } }),
    // Barrel chain reaction setup
    obj('barrel-1', 'barrel', 1920, gy - 44, 40, 44),
    obj('barrel-2', 'barrel', 1968, gy - 44, 40, 44),
    obj('balloon-1', 'balloon', 2100, gy - 200, 36, 48),
    // Far plateau
    obj('ground-4', 'terrain', 2280, gy - 60, 600, 36),
    obj('ramp-2', 'ramp', 2580, gy - 140, 160, 22, { rotation: -0.5 }),
    obj('target-2', 'target', 2780, gy - 220, 40, 40),
    obj('coin-4', 'coin', 2680, gy - 180, 20, 20),
    obj('coin-5', 'coin', 2900, gy - 100, 20, 20),
    // Final stretch
    obj('ground-5', 'terrain', 3100, gy + 40, 900, 32, { rotation: 0.06 }),
    obj('crate-4', 'crate', 3400, gy - 20, 52, 52),
    obj('tramp-2', 'trampoline', 3650, gy - 16, 100, 18),
    obj('ground-end', 'terrain', 3900, gy - 80, 1300, 40),
  ];
}
