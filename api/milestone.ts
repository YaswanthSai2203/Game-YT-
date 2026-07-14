import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const KEY = 'community:shard_total';
const GOAL = 1_000_000;
const LABEL = 'Global Shard Sync';

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
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
    res.status(503).json({ ok: false, error: 'storage_unavailable', total: 0, goal: GOAL, label: LABEL });
    return;
  }

  try {
    if (req.method === 'GET') {
      const total = Number(await redis.get(KEY)) || 0;
      res.status(200).json({ ok: true, total, goal: GOAL, label: LABEL });
      return;
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const shards = Math.max(0, Math.min(500, Math.floor(Number(body?.shards ?? 1))));
      const total = await redis.incrby(KEY, shards);
      res.status(200).json({ ok: true, total, goal: GOAL, label: LABEL, added: shards });
      return;
    }

    res.status(405).json({ ok: false, error: 'method_not_allowed' });
  } catch {
    res.status(500).json({ ok: false, error: 'server_error' });
  }
}
