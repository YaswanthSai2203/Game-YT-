import type { CharacterDef } from '@/games/catapult-chaos/types';

export const CHARACTERS: Record<string, CharacterDef> = {
  adventurer: {
    id: 'adventurer',
    name: 'The Adventurer',
    mass: 1,
    airControl: 1,
    drag: 0.992,
    impactResist: 1,
    abilityName: 'Grappling Hook',
    abilityCooldown: 4,
  },
  cannonball: {
    id: 'cannonball',
    name: 'The Cannonball',
    mass: 1.8,
    airControl: 0.45,
    drag: 0.988,
    impactResist: 1.6,
    abilityName: 'Ground Slam',
    abilityCooldown: 5,
  },
  acrobat: {
    id: 'acrobat',
    name: 'The Acrobat',
    mass: 0.75,
    airControl: 1.45,
    drag: 0.994,
    impactResist: 0.7,
    abilityName: 'Triple Flip',
    abilityCooldown: 3.5,
  },
};

export const DEFAULT_CHARACTER = 'adventurer';
