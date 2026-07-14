import type { GameMode } from '@/types';
import { LEADERBOARD, getLeaderboardApiBase, isGlobalLeaderboardEnabled } from '@/config/leaderboardConfig';

export interface GlobalLeaderboardEntry {
  rank: number;
  score: number;
  name: string;
  date: string;
  mode: GameMode;
}

export interface SubmitResult {
  ok: boolean;
  rank?: number;
  totalPlayers?: number;
  error?: string;
}

/** Fetches and submits scores to the shared global leaderboard API. */
export class GlobalLeaderboardService {
  private cache = new Map<string, { at: number; entries: GlobalLeaderboardEntry[] }>();
  private readonly CACHE_MS = 45_000;

  isEnabled(): boolean {
    return isGlobalLeaderboardEnabled();
  }

  getSetupUrl(): string {
    return LEADERBOARD.SETUP_URL;
  }

  async fetchTop(mode: GameMode, limit = LEADERBOARD.GLOBAL_LIMIT): Promise<GlobalLeaderboardEntry[]> {
    if (!this.isEnabled() || mode === 'practice') return [];

    const cacheKey = `${mode}:${limit}`;
    const hit = this.cache.get(cacheKey);
    if (hit && Date.now() - hit.at < this.CACHE_MS) return hit.entries;

    try {
      const url = `${getLeaderboardApiBase()}/scores?mode=${encodeURIComponent(mode)}&limit=${limit}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return [];
      const data = (await res.json()) as { entries?: GlobalLeaderboardEntry[] };
      const entries = data.entries ?? [];
      this.cache.set(cacheKey, { at: Date.now(), entries });
      return entries;
    } catch {
      return [];
    }
  }

  async submit(mode: GameMode, score: number, name: string): Promise<SubmitResult> {
    if (!this.isEnabled() || mode === 'practice') {
      return { ok: false, error: 'disabled' };
    }
    if (score < LEADERBOARD.SUBMIT_MIN_SCORE) {
      return { ok: false, error: 'score_too_low' };
    }

    try {
      const res = await fetch(`${getLeaderboardApiBase()}/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ mode, score, name: name.slice(0, 24) || 'Pilot' }),
      });
      if (!res.ok) {
        return { ok: false, error: `http_${res.status}` };
      }
      const data = (await res.json()) as SubmitResult;
      this.cache.clear();
      return { ok: true, rank: data.rank, totalPlayers: data.totalPlayers };
    } catch {
      return { ok: false, error: 'network' };
    }
  }
}
