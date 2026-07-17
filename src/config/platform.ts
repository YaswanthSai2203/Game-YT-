/** True when built with `npm run build:playables` (YouTube Playables submission bundle). */
export const IS_PLAYABLES_BUILD = import.meta.env.VITE_PLAYABLES === 'true';

export function isYouTubePlayablesRuntime(): boolean {
  if (typeof window === 'undefined') return IS_PLAYABLES_BUILD;
  const yt = (window as Window & { ytgame?: { IN_PLAYABLES_ENV?: boolean } }).ytgame;
  return IS_PLAYABLES_BUILD || yt?.IN_PLAYABLES_ENV === true;
}
