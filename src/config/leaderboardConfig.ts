/** Global leaderboard API configuration */
export const LEADERBOARD = {
  /** Docs link shown when global API is unavailable */
  SETUP_URL: 'https://github.com/YaswanthSai2203/Game-YT-/blob/main/docs/VERCEL_LEADERBOARD.md',
  GLOBAL_LIMIT: 25,
  SUBMIT_MIN_SCORE: 50,
} as const;

/** API base URL — env override, or same-origin /api on Vercel */
export function getLeaderboardApiBase(): string {
  const env = (import.meta.env.VITE_LEADERBOARD_API_URL as string | undefined)?.replace(/\/$/, '');
  if (env) return env;
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api`;
  }
  return '';
}

export function isGlobalLeaderboardEnabled(): boolean {
  if (import.meta.env.VITE_PLAYABLES === 'true') return false;
  return typeof window !== 'undefined' && getLeaderboardApiBase().length > 0;
}
