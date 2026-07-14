/** Global leaderboard API — set VITE_LEADERBOARD_API_URL when deploying the worker. */
export const LEADERBOARD = {
  /** Base URL e.g. https://neon-pulse-leaderboard.your-subdomain.workers.dev */
  API_URL: (import.meta.env.VITE_LEADERBOARD_API_URL as string | undefined)?.replace(/\/$/, '') ?? '',
  /** Docs link shown when global API is not configured */
  SETUP_URL: 'https://github.com/YaswanthSai2203/Game-YT-/blob/main/leaderboard-worker/README.md',
  GLOBAL_LIMIT: 25,
  SUBMIT_MIN_SCORE: 50,
} as const;

export function isGlobalLeaderboardEnabled(): boolean {
  return LEADERBOARD.API_URL.length > 0;
}
