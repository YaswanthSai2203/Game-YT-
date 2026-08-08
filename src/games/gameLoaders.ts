import type { GameModule } from '@/games/types';
import { isGamePlayable } from '@/config/gamesRegistry';

type Loader = () => Promise<GameModule>;

const LOADERS: Record<string, Loader> = {
  'neon-pulse': async () => {
    const mod = await import('@/games/neon-pulse');
    return mod;
  },
};

export async function loadGameModule(gameId: string): Promise<GameModule | null> {
  if (!isGamePlayable(gameId)) return null;
  const loader = LOADERS[gameId];
  if (!loader) return null;
  return loader();
}
