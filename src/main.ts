import { Game } from '@/core/Game';
import {
  bindPlayablesLifecycle,
  hydrateSaveFromPlayables,
} from '@/platform/playables';

async function main(): Promise<void> {
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

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (game as unknown as { isPaused: boolean }).isPaused === false) {
      // Auto-pause handled via Game if needed
    }
  });
}

main();
