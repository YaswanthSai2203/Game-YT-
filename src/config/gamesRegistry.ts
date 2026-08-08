export type GameCatalogStatus = 'available' | 'coming_soon';

export interface GameCatalogEntry {
  id: string;
  title: string;
  tagline: string;
  description: string;
  genre: string;
  status: GameCatalogStatus;
  icon: string;
  accent: 'cyan' | 'magenta' | 'violet' | 'gold';
  featured?: boolean;
}

export const ARCADE = {
  TITLE: 'NEON ARCADE',
  SUBTITLE: 'Instant-play neon worlds — no installs, no waits',
} as const;

/** Portal catalog — add new games here and register a loader in gameLoaders.ts */
export const GAME_CATALOG: GameCatalogEntry[] = [
  {
    id: 'neon-pulse',
    title: 'NEON PULSE',
    tagline: 'Lane runner',
    description: 'Dodge firewalls, collect shards, phase through danger.',
    genre: 'Action',
    status: 'available',
    icon: 'bolt',
    accent: 'cyan',
    featured: true,
  },
  {
    id: 'offline-rex',
    title: 'OFFLINE REX',
    tagline: 'Endless runner',
    description: 'Jump firewall spikes. Duck signal drones. Survive the blackout.',
    genre: 'Arcade',
    status: 'available',
    icon: 'wifi_off',
    accent: 'magenta',
  },
  {
    id: 'void-drift',
    title: 'VOID DRIFT',
    tagline: 'Endless flyer',
    description: 'Thread neon gates in zero-gravity drift.',
    genre: 'Flight',
    status: 'coming_soon',
    icon: 'rocket_launch',
    accent: 'violet',
  },
];

export function getGameCatalogEntry(id: string): GameCatalogEntry | undefined {
  return GAME_CATALOG.find((g) => g.id === id);
}

export function isGamePlayable(id: string): boolean {
  return getGameCatalogEntry(id)?.status === 'available';
}
