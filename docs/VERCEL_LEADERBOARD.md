# Global Leaderboard on Vercel

Your game uses **`/api/scores` on the same Vercel URL** — no separate server or env var needed.

## Setup (about 2 minutes)

### 1. Deploy the latest code

Your repo must include:
- `api/scores.ts` — leaderboard API
- `vercel.json` — routes `/api/*` to the API and everything else to the game

Push to GitHub (or merge PR #11) so Vercel redeploys.

### 2. Add Redis storage (Upstash)

Vercel KV was replaced by **Upstash Redis**:

1. Open [vercel.com/dashboard](https://vercel.com/dashboard) → your game project  
2. **Storage** tab → **Create Database** / **Browse Marketplace**  
3. Add **Upstash Redis** (free tier is fine)  
4. **Connect to Project** → select your NEON PULSE project  

Vercel adds these automatically:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### 3. Redeploy

**Deployments** → **⋯** on the latest build → **Redeploy**

Environment variables only apply after a new deployment.

### 4. Test

| Check | URL / action |
|-------|----------------|
| API alive | `https://YOUR-APP.vercel.app/api/scores?mode=endless` → JSON `{ "entries": [] }` |
| In game | Menu → **Global Ranks** → subtitle says *"All pilots on the network"* |
| Submit score | Play Endless, score ≥ 50, finish run → game over shows *Global rank #N* |

## How it works

```
Player finishes run
    → POST https://your-app.vercel.app/api/scores
    → Stored in Upstash Redis (key: lb:endless, etc.)
    → Global Ranks fetches GET /api/scores?mode=endless
```

- **Practice** runs are not submitted  
- Minimum score to submit: **50**  
- No `VITE_LEADERBOARD_API_URL` needed on Vercel (uses same domain)

## Optional: separate API server

Only if you host the leaderboard elsewhere (e.g. Cloudflare Worker):

| Vercel env var | Example |
|----------------|---------|
| `VITE_LEADERBOARD_API_URL` | `https://your-worker.workers.dev` |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Setup link still shown in Global Ranks | Redeploy after connecting Redis |
| API returns 503 + `storage_unavailable` | Upstash not linked to project |
| Empty worldwide list | No one has scored 50+ yet — play a run |
| Works on Vercel, not on `localhost` | Expected — API routes exist only when deployed |

## Alternative: Cloudflare Worker

See `leaderboard-worker/README.md` for a standalone worker + `VITE_LEADERBOARD_API_URL`.
