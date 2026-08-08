import { ARCADE, GAME_CATALOG, type GameCatalogEntry } from '@/config/gamesRegistry';
import { msIcon } from '@/utils/icons';
import { bindTap } from '@/utils/tap';

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
    const featured = GAME_CATALOG.filter((g) => g.featured);
    const rest = GAME_CATALOG.filter((g) => !g.featured);

    this.root.innerHTML = `
      <div class="sync-grid-bg" aria-hidden="true"></div>
      <div class="arcade-hub-shell">
        <header class="arcade-hub-hero">
          <p class="menu-eyebrow">Game portal</p>
          <h1 class="menu-title-hero">${ARCADE.TITLE}</h1>
          <p class="menu-tagline">${ARCADE.SUBTITLE}</p>
        </header>
        <div class="arcade-game-grid">
          ${featured.map((g) => this.cardHtml(g, true)).join('')}
          ${rest.map((g) => this.cardHtml(g, false)).join('')}
        </div>
        <p class="arcade-hub-foot">More games loading soon — same account, same style.</p>
      </div>
    `;

    this.root.querySelectorAll('[data-game-id]').forEach((btn) => {
      const id = (btn as HTMLElement).dataset.gameId!;
      const playable = (btn as HTMLElement).dataset.playable === 'true';
      if (!playable) return;
      bindTap(btn, () => this.onSelect(id));
    });
  }

  private cardHtml(game: GameCatalogEntry, featured: boolean): string {
    const playable = game.status === 'available';
    const classes = [
      'arcade-game-card',
      `arcade-accent-${game.accent}`,
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
        <span class="arcade-game-icon" aria-hidden="true">${msIcon(game.icon)}</span>
        <span class="arcade-game-title">${game.title}</span>
        <span class="arcade-game-tagline">${game.tagline}</span>
        <span class="arcade-game-desc">${game.description}</span>
        ${playable
          ? '<span class="arcade-game-cta">Play</span>'
          : '<span class="arcade-game-cta arcade-game-cta-soon">Coming soon</span>'}
      </button>
    `;
  }

  destroy(): void {
    this.root.remove();
  }
}
