import { Game } from '@/core/Game';
import { GAME } from '@/config/constants';
import { applyDesignTokensToRoot } from '@/config/designTokens';
import {
  bindPlayablesLifecycle,
  hydrateSaveFromPlayables,
} from '@/platform/playables';
import '@/ui/styles/neonTactical.css';
import '@/ui/styles/phaseTwo.css';
import '@fontsource/orbitron/700.css';
import '@fontsource/orbitron/800.css';
import '@fontsource/orbitron/900.css';
import '@fontsource/rajdhani/400.css';
import '@fontsource/rajdhani/500.css';
import '@fontsource/rajdhani/600.css';
import '@fontsource/rajdhani/700.css';

/** One-time PWA cache bust when version changes — fixes phones stuck on old bundles. */
async function bustStalePwaCache(): Promise<void> {
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
    // Non-fatal — continue boot
  }
}

async function main(): Promise<void> {
  applyDesignTokensToRoot();
  document.body.classList.add('ui-neon-tactical');
  await bustStalePwaCache();
  await hydrateSaveFromPlayables();

  const container = document.getElementById('game-container');
  if (!container) {
    throw new Error('Game container not found');
  }

  const game = new Game(container);

  bindPlayablesLifecycle({
    onPlatformPause: () => game.handlePlayablesPause(),
    onPlatformResume: () => game.handlePlayablesResume(),
    onPlatformAudioChange: (enabled) => game.handlePlayablesAudio(enabled),
  });

  try {
    await game.init();
  } catch (error) {
    console.error('Failed to initialize NEON PULSE:', error);
    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#00f0ff;font-family:Orbitron,sans-serif;text-align:center;padding:24px;">
        <div>
          <h1 style="margin-bottom:12px;">NEON PULSE</h1>
          <p style="color:#8892a8;">Failed to load. Please refresh the page.</p>
        </div>
      </div>
    `;
  }

  window.addEventListener('beforeunload', () => game.destroy());
}

main();
