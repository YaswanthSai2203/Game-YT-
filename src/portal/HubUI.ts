import { GAME } from '@/config/constants';
import { ARCADE, GAME_CATALOG, type GameCatalogEntry } from '@/config/gamesRegistry';
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
    this.root.setAttribute('role', 'main');
    this.root.setAttribute('aria-label', ARCADE.TITLE);
    container.appendChild(this.root);
    this.render();
  }

  private render(): void {
    const featured = GAME_CATALOG.find((g) => g.featured && g.status === 'available');
    const catalog = GAME_CATALOG.filter((g) => g.id !== featured?.id);
    const lastGameId = localStorage.getItem(LAST_GAME_KEY);
    const lastGame = lastGameId
      ? GAME_CATALOG.find((g) => g.id === lastGameId && g.status === 'available')
      : undefined;

    this.root.innerHTML = `
      <div class="arcade-hub-shell">
        <header class="arcade-site-header">
          <p class="arcade-brand-eyebrow">Browser arcade</p>
          <h1 class="arcade-brand-title">${ARCADE.TITLE}</h1>
          <p class="arcade-brand-lead">${ARCADE.SUBTITLE}</p>
        </header>

        ${lastGame ? this.continueHtml(lastGame) : ''}

        ${featured ? `
          <section class="arcade-spotlight" aria-labelledby="arcade-spotlight-heading">
            <div class="arcade-spotlight-head">
              <h2 id="arcade-spotlight-heading" class="arcade-section-label">Now playing</h2>
            </div>
            ${this.spotlightHtml(featured)}
          </section>
        ` : ''}

        <section class="arcade-catalog" aria-labelledby="arcade-catalog-heading">
          <div class="arcade-catalog-head">
            <h2 id="arcade-catalog-heading" class="arcade-section-label">${featured ? 'More games' : 'Games'}</h2>
          </div>
          <ul class="arcade-catalog-list">
            ${catalog.map((g) => this.rowHtml(g)).join('')}
          </ul>
        </section>

        <footer class="arcade-site-footer">
          <p class="arcade-site-note">${ARCADE.FOOTNOTE}</p>
          <nav class="arcade-legal-nav" aria-label="Legal">
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
          </nav>
          <p class="arcade-site-version">Version ${GAME.VERSION}</p>
        </footer>
      </div>
    `;

    this.root.querySelectorAll('[data-game-id]').forEach((btn) => {
      const id = (btn as HTMLElement).dataset.gameId!;
      const playable = (btn as HTMLElement).dataset.playable === 'true';
      if (!playable) return;
      bindTap(btn, () => this.onSelect(id));
    });

    this.root.querySelectorAll('a[href="/privacy"], a[href="/terms"]').forEach((link) => {
      bindTap(link, (e) => {
        e.preventDefault();
        const href = (link as HTMLAnchorElement).getAttribute('href');
        if (href) {
          window.history.pushState({}, '', href);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      });
    });
  }

  private continueHtml(game: GameCatalogEntry): string {
    return `
      <div class="arcade-resume-wrap">
        <button
          type="button"
          class="arcade-resume"
          data-game-id="${game.id}"
          data-playable="true"
          aria-label="Continue ${game.title}"
        >
          <span class="arcade-resume-label">Continue</span>
          <span class="arcade-resume-title">${game.title}</span>
        </button>
      </div>
    `;
  }

  private spotlightHtml(game: GameCatalogEntry): string {
    return `
      <button
        type="button"
        class="arcade-spotlight-card arcade-accent-${game.accent} arcade-cover-${game.id}"
        data-game-id="${game.id}"
        data-playable="true"
        aria-label="Play ${game.title}"
      >
        <div class="arcade-spotlight-visual" aria-hidden="true">
          <div class="arcade-cover-art"></div>
        </div>
        <div class="arcade-spotlight-copy">
          <span class="arcade-game-genre">${game.genre}</span>
          <span class="arcade-game-title">${game.title}</span>
          <span class="arcade-game-desc">${game.description}</span>
          <span class="arcade-btn-primary">Play ${game.title}</span>
        </div>
      </button>
    `;
  }

  private rowHtml(game: GameCatalogEntry): string {
    const playable = game.status === 'available';

    if (!playable) {
      return `
        <li class="arcade-catalog-item arcade-catalog-item-soon arcade-accent-${game.accent} arcade-cover-${game.id}">
          <div class="arcade-row-visual" aria-hidden="true">
            <div class="arcade-cover-art"></div>
          </div>
          <div class="arcade-row-copy">
            <span class="arcade-game-genre">${game.genre}</span>
            <span class="arcade-game-title">${game.title}</span>
            <span class="arcade-game-desc">${game.description}</span>
            <span class="arcade-row-status">Coming soon</span>
          </div>
        </li>
      `;
    }

    return `
      <li>
        <button
          type="button"
          class="arcade-catalog-item arcade-accent-${game.accent} arcade-cover-${game.id}"
          data-game-id="${game.id}"
          data-playable="true"
          aria-label="Play ${game.title}"
        >
          <div class="arcade-row-visual" aria-hidden="true">
            <div class="arcade-cover-art"></div>
          </div>
          <div class="arcade-row-copy">
            <span class="arcade-game-genre">${game.genre}</span>
            <span class="arcade-game-title">${game.title}</span>
            <span class="arcade-game-desc">${game.description}</span>
            <span class="arcade-btn-text">Play</span>
          </div>
        </button>
      </li>
    `;
  }

  destroy(): void {
    this.root.remove();
  }
}
