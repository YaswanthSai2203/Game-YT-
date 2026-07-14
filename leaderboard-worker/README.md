# Global Leaderboard Worker

Deploy this Cloudflare Worker to enable **global ranks** in NEON PULSE (all players, not just local saves).

## Deploy

1. Install [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
2. From this folder:

```bash
cd leaderboard-worker
npm install
npx wrangler kv namespace create LEADERBOARD
# Paste the id into wrangler.toml under [[kv_namespaces]]
npx wrangler deploy
```

3. Copy the worker URL (e.g. `https://neon-pulse-leaderboard.your-name.workers.dev`)

4. In the game repo root, create `.env`:

```
VITE_LEADERBOARD_API_URL=https://neon-pulse-leaderboard.your-name.workers.dev
```

5. Rebuild and deploy the game.

## API

- `GET /scores?mode=endless&limit=25` → `{ entries: [{ rank, score, name, date, mode }] }`
- `POST /scores` body `{ mode, score, name }` → `{ ok, rank, totalPlayers }`

Modes: `endless`, `timeAttack60`, `timeAttack120`, `challenge` (not `practice`).
