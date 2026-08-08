import { GAME } from '@/config/constants';
import { getGameCatalogEntry, isGamePlayable } from '@/config/gamesRegistry';
import { loadGameModule } from '@/games/gameLoaders';
import type { GameHandle } from '@/games/types';
import { HubUI } from '@/portal/HubUI';
import { isYouTubePlayablesRuntime } from '@/config/platform';
import {
  bindPlayablesLifecycle,
  hydrateSaveFromPlayables,
} from '@/platform/playables';

const LAST_GAME_KEY = 'neon-arcade-last-game';

export class PortalApp {
  private container: HTMLElement;
  private hub: HubUI | null = null;
  private activeGame: GameHandle | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    await hydrateSaveFromPlayables();
    const directId = this.resolveDirectLaunchId();
    if (directId) {
      await this.launchGame(directId);
      return;
    }
    this.showHub();
  }

  private resolveDirectLaunchId(): string | null {
    if (isYouTubePlayablesRuntime()) return 'neon-pulse';

    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('game');
    if (fromUrl && isGamePlayable(fromUrl)) return fromUrl;

    return null;
  }

  private showHub(): void {
    this.clearContainer();
    document.body.classList.remove('gameplay-active');
    document.title = 'NEON ARCADE';
    this.hub = new HubUI(this.container, (gameId) => {
      void this.launchGame(gameId);
    });
  }

  private async launchGame(gameId: string): Promise<void> {
    const entry = getGameCatalogEntry(gameId);
    if (!entry || !isGamePlayable(gameId)) return;

    this.hub?.destroy();
    this.hub = null;
    this.clearContainer();

    const mod = await loadGameModule(gameId);
    if (!mod) {
      this.showHub();
      return;
    }

    try {
      this.activeGame = await mod.launch(this.container, {
        onExitToHub: () => this.exitToHub(),
      });
      localStorage.setItem(LAST_GAME_KEY, gameId);
      document.title = entry.title;
      this.bindPlayablesForActiveGame();
    } catch (error) {
      console.error(`Failed to launch ${gameId}:`, error);
      this.activeGame = null;
      this.container.innerHTML = `
        <div class="arcade-launch-error">
          <h1>${entry.title}</h1>
          <p>Failed to load. Please refresh or return to the arcade.</p>
          <button type="button" class="btn btn-primary" id="arcade-error-home">Back to Arcade</button>
        </div>
      `;
      const homeBtn = this.container.querySelector('#arcade-error-home');
      if (homeBtn) {
        homeBtn.addEventListener('click', () => this.exitToHub());
      }
    }
  }

  exitToHub(): void {
    if (this.activeGame) {
      this.activeGame.destroy();
      this.activeGame = null;
    }
    this.showHub();
  }

  private bindPlayablesForActiveGame(): void {
    if (!this.activeGame) return;
    bindPlayablesLifecycle({
      onPlatformPause: () => this.activeGame?.handlePlayablesPause(),
      onPlatformResume: () => this.activeGame?.handlePlayablesResume(),
      onPlatformAudioChange: (enabled) => this.activeGame?.handlePlayablesAudio(enabled),
    });
  }

  private clearContainer(): void {
    this.container.innerHTML = '';
    const live = document.getElementById('live-region');
    if (live && !this.container.contains(live)) {
      this.container.appendChild(live);
    }
  }

  destroy(): void {
    this.hub?.destroy();
    this.activeGame?.destroy();
    this.hub = null;
    this.activeGame = null;
  }
}

/** PWA cache bust — uses portal version from GAME.VERSION */
export async function bustStalePwaCache(): Promise<void> {
  const key = 'neon-pulse-sw-bust';
  if (localStorage.getItem(key) === GAME.VERSION) return;
  localStorage.setItem(key, GAME.VERSION);
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch {
    // Non-fatal
  }
}
