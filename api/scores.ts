import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { sanitizeLeaderboardName } from '../src/utils/sanitizeLeaderboardName';

const MODES = new Set(['endless', 'timeAttack60', 'timeAttack120', 'challenge']);
const MAX_ENTRIES = 500;
const RATE_LIMIT = 8;
const RATE_WINDOW_SEC = 60;

/** Plausible upper bounds per mode — rejects obvious cheats. */
const SCORE_CAPS: Record<string, number> = {
  endless: 500_000,
  timeAttack60: 120_000,
  timeAttack120: 250_000,
  challenge: 80_000,
};

interface ScoreMember {
  name: string;
  date: string;
  score: number;
  mode: string;
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function clientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() || 'unknown';
  if (Array.isArray(forwarded)) return forwarded[0] ?? 'unknown';
  return 'unknown';
}

/** Higher game score wins; ties broken by newer submission. */
function rankScore(score: number, isoDate: string): number {
  const ts = Date.parse(isoDate) || Date.now();
  return score * 1e13 + ts;
}

function parseMember(raw: string, fallbackRank: number): ScoreMember & { rank: number } {
  try {
    const parsed = JSON.parse(raw) as ScoreMember;
    return {
      rank: fallbackRank,
      score: Math.floor(Number(parsed.score)) || 0,
      name: sanitizeLeaderboardName(parsed.name),
      date: parsed.date || new Date().toISOString(),
      mode: parsed.mode || 'endless',
    };
  } catch {
    return {
      rank: fallbackRank,
      score: 0,
      name: 'Pilot',
      date: new Date().toISOString(),
      mode: 'endless',
    };
  }
}

async function checkRateLimit(redis: Redis, key: string): Promise<boolean> {
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, RATE_WINDOW_SEC);
  return count <= RATE_LIMIT;
}

async function contributeMilestone(redis: Redis, shards: number): Promise<void> {
  const capped = Math.max(0, Math.min(50, Math.floor(shards)));
  if (capped <= 0) return;
  await redis.incrby('community:shard_total', capped);
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
      hint: 'Connect Upstash Redis to this project, then redeploy.',
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

      const raw = await redis.zrange(`lb:${mode}`, 0, limit - 1, { rev: true });
      const entries = (raw as string[]).map((member, i) => {
        const parsed = parseMember(member, i + 1);
        return { ...parsed, rank: i + 1 };
      });

      res.status(200).json({ entries });
      return;
    }

    if (req.method === 'POST') {
      const ip = clientIp(req);
      const allowed = await checkRateLimit(redis, `rate:scores:${ip}`);
      if (!allowed) {
        res.status(429).json({ ok: false, error: 'rate_limited' });
        return;
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const mode = String(body?.mode ?? '');
      const score = Math.floor(Number(body?.score));
      const name = sanitizeLeaderboardName(body?.name);

      if (!MODES.has(mode) || !Number.isFinite(score) || score < 0) {
        res.status(400).json({ ok: false, error: 'invalid_payload' });
        return;
      }

      const cap = SCORE_CAPS[mode] ?? 100_000;
      if (score > cap) {
        res.status(400).json({ ok: false, error: 'score_exceeds_cap' });
        return;
      }

      const minScore = 50;
      if (score < minScore) {
        res.status(400).json({ ok: false, error: 'score_too_low' });
        return;
      }

      const date = new Date().toISOString();
      const member: ScoreMember = { score, name, date, mode };
      const memberJson = JSON.stringify(member);

      await redis.zadd(`lb:${mode}`, { score: rankScore(score, date), member: memberJson });
      await redis.zremrangebyrank(`lb:${mode}`, 0, -(MAX_ENTRIES + 1));

      const shardContribution = Math.min(50, Math.floor(score / 200));
      await contributeMilestone(redis, shardContribution);

      const rankIndex = await redis.zrevrank(`lb:${mode}`, memberJson);
      const total = await redis.zcard(`lb:${mode}`);

      res.status(200).json({
        ok: true,
        rank: rankIndex !== null ? rankIndex + 1 : total,
        totalPlayers: total,
      });
      return;
    }

    res.status(405).json({ ok: false, error: 'method_not_allowed' });
  } catch (err) {
    console.error('[leaderboard]', err);
    res.status(503).json({ ok: false, error: 'storage_unavailable' });
  }
}
