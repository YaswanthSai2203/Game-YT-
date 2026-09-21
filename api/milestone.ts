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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const redis = getRedis();
  if (!redis) {
    res.status(503).json({ ok: false, error: 'storage_unavailable', total: 0, goal: GOAL, label: LABEL });
    return;
  }

  try {
    const total = Number(await redis.get(KEY)) || 0;
    res.status(200).json({ ok: true, total, goal: GOAL, label: LABEL });
  } catch {
    res.status(500).json({ ok: false, error: 'server_error' });
  }
}
