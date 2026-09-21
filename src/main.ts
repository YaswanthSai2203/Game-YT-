import { applyDesignTokensToRoot } from '@/config/designTokens';
import { applyPortalTokensToRoot } from '@/config/portalTokens';
import { bustStalePwaCache, PortalApp } from '@/portal/PortalApp';
import '@/ui/styles/neonTactical.css';
import '@/ui/styles/phaseTwo.css';
import '@/ui/styles/hub.css';
import '@fontsource/orbitron/700.css';
import '@fontsource/orbitron/800.css';
import '@fontsource/orbitron/900.css';
import '@fontsource/rajdhani/400.css';
import '@fontsource/rajdhani/500.css';
import '@fontsource/rajdhani/600.css';
import '@fontsource/rajdhani/700.css';

async function main(): Promise<void> {
  applyDesignTokensToRoot();
  applyPortalTokensToRoot();
  document.body.classList.add('ui-neon-tactical');
  await bustStalePwaCache();

  const container = document.getElementById('game-container');
  if (!container) {
    throw new Error('Game container not found');
  }

  const portal = new PortalApp(container);

  try {
    await portal.init();
  } catch (error) {
    console.error('Failed to initialize NEON ARCADE:', error);
    container.innerHTML = `
      <div class="arcade-launch-error">
        <h1>NEON ARCADE</h1>
        <p>Failed to load. Refresh the page.</p>
      </div>
    `;
  }

  window.addEventListener('beforeunload', () => portal.destroy());
}

main();
