# YouTube Playables — next steps after interest form

You applied to [YouTube Playables](https://developers.google.com/youtube/gaming/playables). While Google reviews your application, use this checklist so you are ready to upload on day one.

## Timeline (what to expect)

| Phase | What happens | Your action |
|--------|----------------|-------------|
| **Now (waiting)** | Google reviews interest form (days to weeks; no public SLA) | Prep build + certification self-test |
| **Accepted** | Email / portal access to **developer console** | Create game entry, get **SDK URL** and test tools |
| **Integration** | Wire SDK, fix cert failures | Run official **test suite**, iterate |
| **Submission** | Upload zip, certification review | Respond to feedback |
| **Live** | Playable appears in YouTube surfaces | Marketing, Shorts with link |

If you hear nothing in **2–3 weeks**, reply to any Google contact or re-check spam; you can submit an updated form only if their policy allows duplicates.

---

## Do now (before portal access)

### 1. Product slice for YouTube

Playables work best with **instant play** and **short sessions**.

- Default hook: **60 SEC** or **Endless** with simple HUD (`UI.SIMPLE_MODE` is already on).
- First run: tutorial → **Start Run** → countdown (already pauses world).
- Avoid relying on **global leaderboard** or **community milestone API** in the Playables build (disabled when `VITE_PLAYABLES=true`).

### 2. Build the Playables bundle locally

```bash
npm run build:playables
```

This produces `dist/` from `index.playables.html`:

- No PWA / service worker
- No Google Fonts CDN (system fonts in HTML; UI still references Orbitron in CSS — self-host fonts before final submit if cert flags it)
- `VITE_PLAYABLES=true` disables outbound leaderboard/milestone calls

Zip contents of `dist/` for upload (portal will specify exact layout).

### 3. Code already wired (this repo)

| Item | Location |
|------|-----------|
| `firstFrameReady` | Loading screen (`Game.init`) |
| `gameReady` | Main menu after boot |
| `onPause` / `onResume` | `Game.handlePlayablesPause/Resume` (stops ticker; no Page Visibility in Playables mode) |
| YouTube mute | `AudioManager.setPlatformMuted` |
| Cloud save | `hydrateSaveFromPlayables` / `pushSaveToPlayables` via `localStorage` + SDK `loadData`/`saveData` |
| Adapter | `src/platform/playables.ts` |

When the portal gives you the SDK script URL, uncomment and set it in **`index.playables.html`** **above** your game module script.

### 4. Certification prep (read once)

- [Integration requirements](https://developers.google.com/youtube/gaming/playables/certification/requirements_integration)
- [Stability & performance](https://developers.google.com/youtube/gaming/playables/certification/requirements_stability)
- [SDK reference](https://developers.google.com/youtube/gaming/playables/reference/sdk)

Key limits: initial load **&lt; 30 MB**, total bundle **&lt; 250 MB**, save string **&lt; 3 MB**, interactable within **~5 s**, **no external network** in playable.

### 5. Assets to prepare in parallel

- **Icon** 512×512
- **Cover / thumbnail** per portal spec
- **15–30 s gameplay video** (phone capture)
- **Description** (use the copy from our earlier “Describe your game” message)
- **Privacy policy URL** (even for no-login games — state local/YouTube save only)

### 6. QA matrix (your phone + desktop)

- [ ] Cold load → menu in &lt; 5 s on mid-range Android
- [ ] Pause from YouTube UI (when SDK test harness available) freezes gameplay and audio
- [ ] Mute in YouTube mutes game
- [ ] Rotate portrait / landscape
- [ ] No crashes after 10 consecutive runs
- [ ] Memory stable (avoid huge tab leaks)

---

## When portal access arrives

1. Create **NEON PULSE** title in console.
2. Paste SDK `<script>` into `index.playables.html`, rebuild, zip `dist/`.
3. Run **Playables SDK test suite** (linked from portal/docs).
4. Upload build → fix cert notes → resubmit.
5. Set **default mode** and metadata to match Shorts marketing (60 SEC challenge).

---

## Optional (not blocking application)

- Self-host **Orbitron / Rajdhani / Material Symbols** under `public/fonts/` and point CSS at them for pixel-perfect parity with web.
- Add `?playables=1` dev flag to test lifecycle on Vercel without full portal (set `VITE_PLAYABLES=true` only in CI for zip builds).
- Strip or hide menu entries that do not work offline (investigation, external docs links).

---

## Marketing when live

1. One **YouTube Short** = 60 SEC score challenge + “Play in the feed”.
2. Pin **Playable** on channel **Games** or featured tab (per current YouTube layout).
3. Cross-post same clip to TikTok with link to channel.

Questions or cert failure messages from Google can be pasted into a follow-up task; map each failure to a file in this repo.
