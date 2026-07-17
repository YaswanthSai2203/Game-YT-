import { STORAGE_KEY } from '@/config/constants';
import { isYouTubePlayablesRuntime } from '@/config/platform';

type PlayablesGameApi = {
  firstFrameReady?: () => void;
  gameReady?: () => void;
  loadData?: () => Promise<string>;
  saveData?: (payload: string) => void;
};

type PlayablesSystemApi = {
  onPause?: (handler: () => void) => void;
  onResume?: (handler: () => void) => void;
};

type PlayablesAudioApi = {
  isAudioEnabled?: () => boolean;
  onAudioEnabledChange?: (handler: (enabled: boolean) => void) => void;
};

export type PlayablesHost = {
  IN_PLAYABLES_ENV?: boolean;
  game?: PlayablesGameApi;
  system?: PlayablesSystemApi;
  audio?: PlayablesAudioApi;
};

export type PlayablesLifecycle = {
  onPlatformPause: () => void;
  onPlatformResume: () => void;
  onPlatformAudioChange: (enabled: boolean) => void;
};

function getHost(): PlayablesHost | undefined {
  return (window as Window & { ytgame?: PlayablesHost }).ytgame;
}

/** Wait briefly for the SDK script (portal injects it before game code in production). */
export async function waitForPlayablesSdk(timeoutMs = 4000): Promise<PlayablesHost | null> {
  if (!isYouTubePlayablesRuntime()) return null;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const host = getHost();
    if (host?.game?.firstFrameReady) return host;
    await new Promise((r) => setTimeout(r, 50));
  }
  return getHost() ?? null;
}

export function notifyFirstFrameReady(): void {
  if (!isYouTubePlayablesRuntime()) return;
  getHost()?.game?.firstFrameReady?.();
}

export function notifyGameReady(): void {
  if (!isYouTubePlayablesRuntime()) return;
  getHost()?.game?.gameReady?.();
}

/** Apply cloud save from YouTube before local boot (must complete before first saveData). */
export async function hydrateSaveFromPlayables(): Promise<void> {
  if (!isYouTubePlayablesRuntime()) return;
  const host = await waitForPlayablesSdk();
  const loadData = host?.game?.loadData;
  if (!loadData) return;
  try {
    const raw = await loadData();
    if (!raw || !String(raw).trim()) return;
    JSON.parse(raw);
    localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Fall back to empty / local save
  }
}

export function pushSaveToPlayables(): void {
  if (!isYouTubePlayablesRuntime()) return;
  const saveData = getHost()?.game?.saveData;
  if (!saveData) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    if (raw.length > 3_000_000) return;
    saveData(raw);
  } catch {
    // ignore quota / SDK errors
  }
}

export function bindPlayablesLifecycle(lifecycle: PlayablesLifecycle): void {
  if (!isYouTubePlayablesRuntime()) return;
  void waitForPlayablesSdk().then((host) => {
    if (!host) return;
    host.system?.onPause?.(() => lifecycle.onPlatformPause());
    host.system?.onResume?.(() => lifecycle.onPlatformResume());
    const audioEnabled = host.audio?.isAudioEnabled?.();
    if (typeof audioEnabled === 'boolean') {
      lifecycle.onPlatformAudioChange(audioEnabled);
    }
    host.audio?.onAudioEnabledChange?.((enabled) => lifecycle.onPlatformAudioChange(enabled));
  });
}
