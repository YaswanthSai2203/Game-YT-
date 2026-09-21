/** Strip HTML/control chars from leaderboard display names (client + API). */
export function sanitizeLeaderboardName(raw: unknown): string {
  const str = String(raw ?? 'Pilot')
    .replace(/[<>&"'`]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
    .slice(0, 24);
  return str || 'Pilot';
}
