import type { ObjectType } from '@/games/catapult-chaos/types';

export interface ObjectTemplate {
  mass: number;
  elasticity: number;
  friction: number;
  breakStrength: number;
  scoreOnHit: number;
  scoreOnBreak: number;
}

export const OBJECT_TEMPLATES: Record<ObjectType, ObjectTemplate> = {
  terrain: { mass: 0, elasticity: 0.35, friction: 0.85, breakStrength: Infinity, scoreOnHit: 0, scoreOnBreak: 0 },
  ramp: { mass: 0, elasticity: 0.55, friction: 0.6, breakStrength: Infinity, scoreOnHit: 100, scoreOnBreak: 0 },
  crate: { mass: 25, elasticity: 0.25, friction: 0.7, breakStrength: 50, scoreOnHit: 150, scoreOnBreak: 400 },
  trampoline: { mass: 100, elasticity: 1.8, friction: 0.3, breakStrength: Infinity, scoreOnHit: 500, scoreOnBreak: 0 },
  barrel: { mass: 30, elasticity: 0.4, friction: 0.5, breakStrength: 20, scoreOnHit: 200, scoreOnBreak: 1200 },
  windmill: { mass: 0, elasticity: 0.9, friction: 0.2, breakStrength: Infinity, scoreOnHit: 600, scoreOnBreak: 0 },
  coin: { mass: 0, elasticity: 0.1, friction: 0.1, breakStrength: 1, scoreOnHit: 250, scoreOnBreak: 250 },
  target: { mass: 5, elasticity: 0.2, friction: 0.4, breakStrength: 30, scoreOnHit: 800, scoreOnBreak: 800 },
  balloon: { mass: 0, elasticity: 0.05, friction: 0.1, breakStrength: 8, scoreOnHit: 350, scoreOnBreak: 350 },
};
