import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const MODES = new Set(['endless', 'timeAttack60', 'timeAttack120', 'challenge']);
const MAX = 500;

interface ScoreEntry {
  score: number;
  name: string;
  date: string;
  mode: string;
}

function getRedis(): Redis | null {
  // Vercel Upstash integration may use UPSTASH_* or KV_REST_API_* names
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

async function loadMode(redis: Redis, mode: string): Promise<ScoreEntry[]> {
  const raw = await redis.get<ScoreEntry[]>(`lb:${mode}`);
  return Array.isArray(raw) ? raw : [];
}

async function saveMode(redis: Redis, mode: string, entries: ScoreEntry[]): Promise<void> {
  await redis.set(`lb:${mode}`, entries);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const redis = getRedis();
  if (!redis) {
    res.status(503).json({
      ok: false,
      error: 'storage_unavailable',
      hint: 'Add Upstash Redis from Vercel Storage (see docs/VERCEL_LEADERBOARD.md)',
    });
    return;
  }

  try {
    if (req.method === 'GET') {
      const mode = String(req.query.mode ?? 'endless');
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '25'), 10)));
      if (!MODES.has(mode)) {
        res.status(400).json({ entries: [] });
        return;
      }
      const entries = await loadMode(redis, mode);
      entries.sort((a, b) => b.score - a.score || new Date(b.date).getTime() - new Date(a.date).getTime());
      res.status(200).json({
        entries: entries.slice(0, limit).map((e, i) => ({ ...e, rank: i + 1 })),
      });
      return;
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const mode = String(body?.mode ?? '');
      const score = Math.floor(Number(body?.score));
      const name = String(body?.name ?? 'Pilot').slice(0, 24).trim() || 'Pilot';

      if (!MODES.has(mode) || !Number.isFinite(score) || score < 0) {
        res.status(400).json({ ok: false, error: 'invalid_payload' });
        return;
      }

      const entry: ScoreEntry = { score, name, date: new Date().toISOString(), mode };
      const entries = await loadMode(redis, mode);
      entries.push(entry);
      entries.sort((a, b) => b.score - a.score || new Date(b.date).getTime() - new Date(a.date).getTime());
      const trimmed = entries.slice(0, MAX);
      await saveMode(redis, mode, trimmed);

      const rank = trimmed.findIndex((e) => e.date === entry.date) + 1;
      res.status(200).json({
        ok: true,
        rank: rank > 0 ? rank : trimmed.length,
        totalPlayers: trimmed.length,
      });
      return;
    }

    res.status(405).json({ ok: false, error: 'method_not_allowed' });
  } catch (err) {
    console.error('[leaderboard]', err);
    res.status(503).json({
      ok: false,
      error: 'storage_unavailable',
      hint: 'Check Upstash Redis connection in Vercel project settings',
    });
  }
}
