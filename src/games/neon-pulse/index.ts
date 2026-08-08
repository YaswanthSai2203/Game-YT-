import { Game } from '@/core/Game';
import type { GameHandle, GameLaunchOptions, GameModule } from '@/games/types';

class NeonPulseHandle implements GameHandle {
  constructor(private game: Game) {}

  destroy(): void {
    this.game.destroy();
  }

  handlePlayablesPause(): void {
    this.game.handlePlayablesPause();
  }

  handlePlayablesResume(): void {
    this.game.handlePlayablesResume();
  }

  handlePlayablesAudio(enabled: boolean): void {
    this.game.handlePlayablesAudio(enabled);
  }
}

export async function launch(container: HTMLElement, options?: GameLaunchOptions): Promise<GameHandle> {
  const game = new Game(container);
  if (options?.onExitToHub) {
    game.setExitToHubHandler(options.onExitToHub);
  }
  await game.init();
  return new NeonPulseHandle(game);
}

const neonPulseModule: GameModule = { launch };
export default neonPulseModule;
