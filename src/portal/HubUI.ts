import { GAME } from '@/config/constants';
import { ARCADE, GAME_CATALOG, type GameCatalogEntry } from '@/config/gamesRegistry';
import { msIcon } from '@/utils/icons';
import { bindTap } from '@/utils/tap';

const LAST_GAME_KEY = 'neon-arcade-last-game';

export class HubUI {
  private root: HTMLElement;
  private onSelect: (gameId: string) => void;

  constructor(container: HTMLElement, onSelect: (gameId: string) => void) {
    this.onSelect = onSelect;
    this.root = document.createElement('div');
    this.root.id = 'arcade-hub';
    this.root.className = 'arcade-hub';
    this.root.setAttribute('role', 'application');
    this.root.setAttribute('aria-label', ARCADE.TITLE);
    container.appendChild(this.root);
    this.render();
  }

  private render(): void {
    const liveCount = GAME_CATALOG.filter((g) => g.status === 'available').length;
    const featured = GAME_CATALOG.find((g) => g.featured && g.status === 'available');
    const rest = GAME_CATALOG.filter((g) => g.id !== featured?.id);
    const lastGameId = localStorage.getItem(LAST_GAME_KEY);
    const lastGame = lastGameId ? GAME_CATALOG.find((g) => g.id === lastGameId && g.status === 'available') : undefined;

    this.root.innerHTML = `
      <div class="arcade-hub-bg" aria-hidden="true">
        <div class="arcade-hub-aurora">
          <div class="arcade-aurora-blob arcade-aurora-cyan"></div>
          <div class="arcade-aurora-blob arcade-aurora-violet"></div>
          <div class="arcade-aurora-blob arcade-aurora-magenta"></div>
        </div>
        <div class="sync-grid-bg"></div>
        <div class="arcade-hub-scanlines"></div>
      </div>

      <div class="arcade-hub-shell">
        <header class="arcade-hub-hero">
          <div class="arcade-logo-wrap">
            <span class="arcade-version-pill">v${GAME.VERSION}</span>
            <h1 class="arcade-logo" aria-label="${ARCADE.TITLE}">
              <span class="arcade-logo-neon">NEON</span>
              <span class="arcade-logo-arcade">ARCADE</span>
            </h1>
          </div>
          <p class="arcade-hero-tagline">${ARCADE.SUBTITLE}</p>
          <div class="arcade-hub-stats" role="list">
            <span class="arcade-stat-pill arcade-stat-live" role="listitem">
              <span class="arcade-stat-dot" aria-hidden="true"></span>
              ${liveCount} live now
            </span>
            <span class="arcade-stat-pill" role="listitem">${msIcon('bolt')} Instant play</span>
            <span class="arcade-stat-pill" role="listitem">${msIcon('devices')} Any device</span>
          </div>
        </header>

        ${lastGame ? this.continueHtml(lastGame) : ''}

        ${featured ? `
          <section class="arcade-section arcade-section-featured" aria-labelledby="arcade-featured-heading">
            <div class="arcade-section-head">
              <h2 id="arcade-featured-heading" class="arcade-section-title">Spotlight</h2>
              <span class="arcade-section-badge">Featured</span>
            </div>
            ${this.cardHtml(featured, true)}
          </section>
        ` : ''}

        <section class="arcade-section" aria-labelledby="arcade-games-heading">
          <div class="arcade-section-head">
            <h2 id="arcade-games-heading" class="arcade-section-title">${featured ? 'More games' : 'All games'}</h2>
          </div>
          <div class="arcade-game-grid">
            ${rest.map((g) => this.cardHtml(g, false)).join('')}
          </div>
        </section>

        <div class="arcade-ticker" aria-hidden="true">
          <div class="arcade-ticker-track">
            ${this.tickerContent()}
            ${this.tickerContent()}
          </div>
        </div>

        <footer class="arcade-hub-foot">
          <p>New worlds drop here first — same neon style, zero friction.</p>
        </footer>
      </div>
    `;

    this.root.querySelectorAll('[data-game-id]').forEach((btn) => {
      const id = (btn as HTMLElement).dataset.gameId!;
      const playable = (btn as HTMLElement).dataset.playable === 'true';
      if (!playable) return;
      bindTap(btn, () => this.onSelect(id));
    });
  }

  private tickerContent(): string {
    const live = GAME_CATALOG.filter((g) => g.status === 'available');
    const items = live.map((g) => `<span class="arcade-ticker-item">${g.title} · ${g.tagline}</span>`).join('');
    const soon = GAME_CATALOG.filter((g) => g.status === 'coming_soon')
      .map((g) => `<span class="arcade-ticker-item arcade-ticker-soon">${g.title} incoming</span>`)
      .join('');
    return items + soon;
  }

  private continueHtml(game: GameCatalogEntry): string {
    return `
      <button
        type="button"
        class="arcade-continue-card arcade-accent-${game.accent}"
        data-game-id="${game.id}"
        data-playable="true"
        aria-label="Continue playing ${game.title}"
      >
        <span class="arcade-continue-icon" aria-hidden="true">${msIcon('play_arrow')}</span>
        <span class="arcade-continue-copy">
          <span class="arcade-continue-label">Continue</span>
          <span class="arcade-continue-title">${game.title}</span>
        </span>
        <span class="arcade-continue-arrow" aria-hidden="true">→</span>
      </button>
    `;
  }

  private cardHtml(game: GameCatalogEntry, featured: boolean): string {
    const playable = game.status === 'available';
    const classes = [
      'arcade-game-card',
      `arcade-accent-${game.accent}`,
      `arcade-cover-${game.id}`,
      featured ? 'arcade-game-featured' : '',
      playable ? '' : 'arcade-game-soon',
    ].filter(Boolean).join(' ');

    return `
      <button
        type="button"
        class="${classes}"
        data-game-id="${game.id}"
        data-playable="${playable}"
        ${playable ? '' : 'disabled'}
        aria-label="${playable ? `Play ${game.title}` : `${game.title} — coming soon`}"
      >
        <div class="arcade-card-cover" aria-hidden="true">
          <div class="arcade-cover-art"></div>
          <div class="arcade-cover-glow"></div>
          <span class="arcade-cover-icon">${msIcon(game.icon)}</span>
          ${!playable ? '<span class="arcade-cover-lock">' + msIcon('lock') + '</span>' : ''}
        </div>
        <div class="arcade-card-body">
          <div class="arcade-card-meta">
            <span class="arcade-game-genre">${game.genre}</span>
            ${playable ? '<span class="arcade-game-live">Live</span>' : '<span class="arcade-game-soon-badge">Soon</span>'}
          </div>
          <span class="arcade-game-title">${game.title}</span>
          <span class="arcade-game-tagline">${game.tagline}</span>
          <span class="arcade-game-desc">${game.description}</span>
          ${playable
            ? `<span class="arcade-game-cta">${featured ? 'Play now' : 'Play'} ${msIcon('arrow_forward')}</span>`
            : '<span class="arcade-game-cta arcade-game-cta-soon">Coming soon</span>'}
        </div>
      </button>
    `;
  }

  destroy(): void {
    this.root.remove();
  }
}
