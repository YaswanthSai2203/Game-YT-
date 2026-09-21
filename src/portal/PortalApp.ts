import { GAME } from '@/config/constants';
import { ARCADE, getGameCatalogEntry, isGamePlayable } from '@/config/gamesRegistry';
import { loadGameModule } from '@/games/gameLoaders';
import type { GameHandle } from '@/games/types';
import { HubUI } from '@/portal/HubUI';
import { LegalPages, resolveLegalPageFromPath, type LegalPageId } from '@/portal/LegalPages';
import { isYouTubePlayablesRuntime } from '@/config/platform';
import {
  bindPlayablesLifecycle,
  hydrateSaveFromPlayables,
} from '@/platform/playables';

const LAST_GAME_KEY = 'neon-arcade-last-game';

export class PortalApp {
  private container: HTMLElement;
  private hub: HubUI | null = null;
  private legal: LegalPages | null = null;
  private activeGame: GameHandle | null = null;
  private popStateHandler = () => this.handleRouteChange();
  private loadNeonPulseFonts: (() => Promise<void>) | null = null;
  private visibilityHandler = (): void => {
    if (!this.activeGame) return;
    if (document.hidden) this.activeGame.handlePlayablesPause();
    else this.activeGame.handlePlayablesResume();
  };

  constructor(container: HTMLElement) {
    this.container = container;
    window.addEventListener('popstate', this.popStateHandler);
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  async init(onBeforeNeonPulse?: () => Promise<void>): Promise<void> {
    this.loadNeonPulseFonts = onBeforeNeonPulse ?? null;
    await hydrateSaveFromPlayables();
    const directId = this.resolveDirectLaunchId();
    if (directId) {
      await this.launchGame(directId);
      return;
    }
    this.handleRouteChange();
  }

  private handleRouteChange(): void {
    const legalPage = resolveLegalPageFromPath(window.location.pathname);
    if (legalPage) {
      this.showLegal(legalPage);
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

  private setPortalSurface(active: boolean): void {
    document.body.classList.toggle('portal-active', active);
    const theme = active ? '#F5F3EF' : '#0a0e1a';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme);
  }

  private showHub(): void {
    this.legal?.destroy();
    this.legal = null;
    this.clearContainer();
    document.body.classList.remove('gameplay-active');
    this.setPortalSurface(true);
    if (window.location.pathname !== '/') {
      window.history.replaceState({}, '', '/');
    }
    document.title = ARCADE.TITLE;
    this.hub = new HubUI(this.container, (gameId) => {
      void this.launchGame(gameId);
    });
  }

  private showLegal(pageId: LegalPageId): void {
    this.hub?.destroy();
    this.hub = null;
    this.clearContainer();
    document.body.classList.remove('gameplay-active');
    this.setPortalSurface(true);
    this.legal = new LegalPages(this.container, pageId, () => this.showHub());
  }

  private async launchGame(gameId: string): Promise<void> {
    const entry = getGameCatalogEntry(gameId);
    if (!entry || !isGamePlayable(gameId)) return;

    this.hub?.destroy();
    this.hub = null;
    this.legal?.destroy();
    this.legal = null;
    this.clearContainer();
    this.setPortalSurface(false);

    if (gameId === 'neon-pulse' && this.loadNeonPulseFonts) {
      await this.loadNeonPulseFonts();
    }

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
      document.body.classList.add('gameplay-active');
      this.bindPlayablesForActiveGame();
    } catch (error) {
      console.error(`Failed to launch ${gameId}:`, error);
      this.activeGame = null;
      this.setPortalSurface(true);
      this.container.innerHTML = `
        <div class="arcade-launch-error">
          <h1>${entry.title}</h1>
          <p>Failed to load. Refresh the page or return to the arcade.</p>
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
    window.removeEventListener('popstate', this.popStateHandler);
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.hub?.destroy();
    this.legal?.destroy();
    this.activeGame?.destroy();
    this.hub = null;
    this.legal = null;
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
