export type GameCatalogStatus = 'available' | 'coming_soon';

export interface GameCatalogEntry {
  id: string;
  title: string;
  tagline: string;
  description: string;
  status: GameCatalogStatus;
  icon: string;
  accent: 'cyan' | 'magenta' | 'violet' | 'gold';
  featured?: boolean;
}

export const ARCADE = {
  TITLE: 'NEON ARCADE',
  SUBTITLE: 'Pick a game · Tap to play',
} as const;

/** Portal catalog — add new games here and register a loader in gameLoaders.ts */
export const GAME_CATALOG: GameCatalogEntry[] = [
  {
    id: 'neon-pulse',
    title: 'NEON PULSE',
    tagline: 'Lane runner',
    description: 'Dodge firewalls, collect shards, phase through danger.',
    status: 'available',
    icon: 'bolt',
    accent: 'cyan',
    featured: true,
  },
  {
    id: 'offline-rex',
    title: 'OFFLINE REX',
    tagline: 'Endless runner',
    description: 'Jump the firewalls. Duck the drones. Classic no-signal run.',
    status: 'available',
    icon: 'wifi_off',
    accent: 'magenta',
  },
  {
    id: 'void-drift',
    title: 'VOID DRIFT',
    tagline: 'Endless flyer',
    description: 'Thread neon gates in zero-gravity drift.',
    status: 'coming_soon',
    icon: 'rocket_launch',
    accent: 'magenta',
  },
];

export function getGameCatalogEntry(id: string): GameCatalogEntry | undefined {
  return GAME_CATALOG.find((g) => g.id === id);
}

export function isGamePlayable(id: string): boolean {
  return getGameCatalogEntry(id)?.status === 'available';
}
