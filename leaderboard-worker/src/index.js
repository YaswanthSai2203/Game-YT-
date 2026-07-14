const MODES = new Set(['endless', 'timeAttack60', 'timeAttack120', 'challenge']);
const MAX = 500;

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    const url = new URL(request.url);

    if (url.pathname === '/scores' && request.method === 'GET') {
      const mode = url.searchParams.get('mode') || 'endless';
      const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '25', 10)));
      if (!MODES.has(mode)) {
        return json({ entries: [] }, cors, 400);
      }
      const entries = await loadMode(env, mode);
      return json({ entries: entries.slice(0, limit).map((e, i) => ({ ...e, rank: i + 1 })) }, cors);
    }

    if (url.pathname === '/scores' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, error: 'invalid_json' }, cors, 400);
      }
      const mode = body.mode;
      const score = Math.floor(Number(body.score));
      const name = String(body.name || 'Pilot').slice(0, 24).trim() || 'Pilot';
      if (!MODES.has(mode) || !Number.isFinite(score) || score < 0) {
        return json({ ok: false, error: 'invalid_payload' }, cors, 400);
      }

      const entry = { score, name, date: new Date().toISOString(), mode };
      const entries = await loadMode(env, mode);
      entries.push(entry);
      entries.sort((a, b) => b.score - a.score || new Date(a.date).getTime() - new Date(b.date).getTime());
      const trimmed = entries.slice(0, MAX);
      await env.LEADERBOARD.put(`lb:${mode}`, JSON.stringify(trimmed));

      const rank = trimmed.findIndex((e) => e.date === entry.date) + 1;

      return json({
        ok: true,
        rank: rank > 0 ? rank : trimmed.length,
        totalPlayers: trimmed.length,
      }, cors);
    }

    return json({ ok: true, service: 'neon-pulse-leaderboard' }, cors);
  },
};

async function loadMode(env, mode) {
  const raw = await env.LEADERBOARD.get(`lb:${mode}`);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function json(data, cors, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
