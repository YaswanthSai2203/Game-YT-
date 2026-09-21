import { GAME } from '@/config/constants';
import { ARCADE } from '@/config/gamesRegistry';
import { bindTap } from '@/utils/tap';

export type LegalPageId = 'privacy' | 'terms';

const LEGAL_CONTACT = '[DRAFT: add contact email]';

function shell(title: string, bodyHtml: string): string {
  return `
    <div class="portal-legal" role="document">
      <div class="portal-legal-shell">
        <header class="portal-legal-header">
          <a href="/" class="portal-legal-back" data-nav-home>Back to ${ARCADE.TITLE}</a>
          <h1 class="portal-legal-title">${title}</h1>
          <p class="portal-legal-meta">Last updated: September 21, 2026 · Draft for review</p>
        </header>
        <div class="portal-legal-body">
          ${bodyHtml}
        </div>
        <footer class="portal-legal-foot">
          <nav class="portal-legal-nav" aria-label="Legal">
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
          </nav>
          <p class="portal-legal-version">${ARCADE.TITLE} v${GAME.VERSION}</p>
        </footer>
      </div>
    </div>
  `;
}

const PRIVACY_HTML = `
  <section>
    <h2>Overview</h2>
    <p>${ARCADE.TITLE} is a browser arcade. Games run locally in your browser. This policy describes what data the site stores or sends.</p>
  </section>
  <section>
    <h2>Data stored on your device</h2>
    <p>Game progress, settings, achievements, and local leaderboard entries are saved in your browser using localStorage. This data stays on your device unless you clear site data.</p>
    <p>We store your most recently played game so the hub can show a Continue option.</p>
  </section>
  <section>
    <h2>Analytics</h2>
    <p>Gameplay events are recorded in memory during your session for debugging and session summaries. They are not sent to external analytics services.</p>
  </section>
  <section>
    <h2>Global leaderboard (optional)</h2>
    <p>When the global leaderboard is enabled on a deployment, submitting a score sends your display name, score, game mode, and date to the leaderboard API. No account is required.</p>
    <p><strong>Draft:</strong> Confirm the hosting provider, retention period, and whether IP addresses are logged for ${LEGAL_CONTACT}.</p>
  </section>
  <section>
    <h2>YouTube Playables</h2>
    <p>When launched inside YouTube Playables, save data may sync through YouTube's platform APIs according to YouTube's policies.</p>
  </section>
  <section>
    <h2>Your choices</h2>
    <p>Clear site data in your browser to remove local saves. Disable global leaderboard submissions by not entering a name or by using a deployment where the feature is off.</p>
  </section>
  <section>
    <h2>Contact</h2>
    <p>Questions about this policy: ${LEGAL_CONTACT}</p>
  </section>
`;

const TERMS_HTML = `
  <section>
    <h2>Agreement</h2>
    <p>By using ${ARCADE.TITLE}, you agree to these terms. If you do not agree, do not use the site.</p>
  </section>
  <section>
    <h2>Service</h2>
    <p>${ARCADE.TITLE} provides browser-based mini games at no charge. Games and features may change, move, or be removed without notice.</p>
  </section>
  <section>
    <h2>Acceptable use</h2>
    <p>Do not attempt to disrupt the service, reverse engineer server infrastructure, or submit abusive content through optional leaderboard name fields.</p>
  </section>
  <section>
    <h2>Accounts</h2>
    <p>No account is required to play. Optional leaderboard names are display labels only and do not create an account.</p>
  </section>
  <section>
    <h2>Intellectual property</h2>
    <p>Game code, art, audio, and branding in ${ARCADE.TITLE} are owned by the project licensors unless otherwise noted. The project is released under the MIT license for source code where applicable.</p>
  </section>
  <section>
    <h2>Disclaimer</h2>
    <p>The service is provided "as is" without warranties of any kind. We do not guarantee uninterrupted availability or error-free gameplay.</p>
  </section>
  <section>
    <h2>Limitation of liability</h2>
    <p><strong>Draft:</strong> Add jurisdiction-specific liability limits with legal review for ${LEGAL_CONTACT}.</p>
  </section>
  <section>
    <h2>Changes</h2>
    <p>We may update these terms. Continued use after changes are posted means you accept the updated terms.</p>
  </section>
  <section>
    <h2>Contact</h2>
    <p>Questions about these terms: ${LEGAL_CONTACT}</p>
  </section>
`;

export class LegalPages {
  private root: HTMLElement;
  private onNavigateHome: () => void;

  constructor(container: HTMLElement, pageId: LegalPageId, onNavigateHome: () => void) {
    this.onNavigateHome = onNavigateHome;
    this.root = document.createElement('div');
    this.root.id = 'portal-legal-root';
    container.appendChild(this.root);
    this.render(pageId);
  }

  private render(pageId: LegalPageId): void {
    const content = pageId === 'privacy'
      ? shell('Privacy Policy', PRIVACY_HTML)
      : shell('Terms of Service', TERMS_HTML);

    this.root.innerHTML = content;
    document.title = pageId === 'privacy'
      ? `Privacy Policy · ${ARCADE.TITLE}`
      : `Terms of Service · ${ARCADE.TITLE}`;

    const homeLink = this.root.querySelector('[data-nav-home]');
    if (homeLink) {
      bindTap(homeLink, (e) => {
        e.preventDefault();
        this.onNavigateHome();
      });
    }

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

  destroy(): void {
    this.root.remove();
  }
}

export function resolveLegalPageFromPath(pathname: string): LegalPageId | null {
  const path = pathname.replace(/\/$/, '') || '/';
  if (path === '/privacy') return 'privacy';
  if (path === '/terms') return 'terms';
  return null;
}
