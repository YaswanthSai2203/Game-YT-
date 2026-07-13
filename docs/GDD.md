# NEON PULSE — Game Design Document

## Game Title
**NEON PULSE**

## Genre
High-tech Endless Arcade / Skill Runner

## Core Fantasy
You are a quantum energy core racing through a living cybernetic data grid — dodging firewalls, harvesting data shards, and bending reality with phase shifts to achieve the highest sync score in the network.

## Target Audience
- Ages 13–35
- Fans of hyper-casual arcade, rhythm-action, and cyberpunk aesthetics
- Mobile-first players seeking 30-second to 5-minute sessions
- Competitive players who chase high scores and daily challenges

## Platform
- Mobile browsers (iOS Safari, Chrome Android) — primary
- Desktop browsers (Chrome, Firefox, Safari, Edge)
- PWA installable
- Portrait and landscape orientations

## Controls
| Input | Action |
|-------|--------|
| Tap left / Swipe left / A / ← | Move to left lane |
| Tap right / Swipe right / D / → | Move to right lane |
| Tap center / Space / W / ↑ | Quantum Phase Shift (hold) |
| Tap / Space (menu) | Confirm |
| Escape / Back | Pause |
| Gamepad D-pad / Left stick | Lane movement |
| Gamepad A / X | Phase shift |

## Gameplay Loop
1. **Enter** — Instant action; player spawns on neon grid with scrolling obstacles
2. **Collect** — Gather data shards for points and combo multiplier
3. **Dodge** — Avoid firewalls (instant death unless shielded/phasing)
4. **Risk** — Phase through one obstacle for bonus points but drains phase meter
5. **Escalate** — Speed and obstacle density increase over time
6. **Power Up** — Grab overclock, shield, magnet, chronos drops
7. **Die or Complete** — Review stats, unlock achievements, retry

## Session Length
- Quick run: 30–90 seconds
- Average session: 3–5 minutes (multiple runs)
- Daily challenge: 2–4 minutes

## Difficulty Curve
- **0–30s**: Tutorial pace, wide gaps, single-lane obstacles
- **30–60s**: Dual obstacles, faster scroll, combo rewards emphasized
- **60–120s**: Triple patterns, narrow windows, powerup scarcity
- **120s+**: Expert patterns, glitch events, maximum speed cap at 2.5×

## Win Conditions
| Mode | Win Condition |
|------|---------------|
| Endless | Survive as long as possible; beat personal best |
| Time Attack | Maximize score within time limit |
| Challenge | Complete seeded objective (score target / shard count) |
| Practice | No win — skill training |

## Lose Conditions
- Collision with firewall (unless shield active)
- Time Attack timer expires (soft end — score still counts)

## Progression
- **Sync Level** — XP from total shards collected across all runs
- **Unlockables** — Core skins, trail effects, grid themes at sync milestones
- **Achievements** — 24 achievements across skill, exploration, and mastery
- **Daily/Weekly Challenges** — Seeded runs with bonus XP

## Retention Mechanics
- Daily challenge with bonus rewards
- Weekly challenge with exclusive unlock progress
- Streak tracking for consecutive daily plays
- Personal best per mode
- Local leaderboard (top 10 per mode)
- Achievement collection
- Sync level progression with visible unlock bar

## Unlockables
| Sync Level | Unlock |
|------------|--------|
| 1 | Default Core (Cyan) |
| 3 | Magenta Core |
| 5 | Grid Theme: Matrix |
| 8 | Gold Trail |
| 12 | Violet Core |
| 15 | Grid Theme: Inferno |
| 20 | Glitch Trail |
| 30 | Quantum Core (animated) |

## Replayability
- Procedural obstacle patterns with seeded daily/weekly runs
- 5 game modes with distinct scoring rules
- Combo mastery ceiling (10× multiplier)
- Secret bonus zones (hidden data vaults)
- Risk/reward phase shift timing
- Multiple unlock paths

## Accessibility
- Keyboard, touch, and gamepad support
- Reduced motion mode (disables screen shake, particles)
- High contrast mode
- Color blind palettes (Deuteranopia, Protanopia, Tritanopia)
- Font scaling (100%–150%)
- Screen reader live region for score/combo announcements
- Configurable control sensitivity
- Pause anytime

## Visual Identity
Cyberpunk minimalism — deep void backgrounds, neon cyan/magenta/violet accents, grid perspective, bloom-style glow, scanline subtlety, holographic UI panels.

## Audio Style
Synthesized electronic soundtrack with adaptive layers (intensity increases with speed). Punchy SFX: laser zaps, digital chimes, bass impacts. All procedurally generated via Web Audio API — zero external audio files.

## Art Direction
- **Palette**: Void black (#0a0e1a), neon cyan (#00f0ff), hot magenta (#ff006e), electric violet (#8b5cf6), gold accent (#ffd700)
- **Typography**: Orbitron (display), Rajdhani (UI body)
- **Shapes**: Hexagons, rounded rects, thin grid lines, particle bursts
- **Depth**: Parallax grid layers, glow halos, subtle vignette

## Technical Stack
- **Language**: TypeScript (strict)
- **Bundler**: Vite 6
- **Renderer**: PixiJS 8 (WebGL/WebGPU canvas)
- **Architecture**: Scene manager, entity-component-lite, event bus, save manager
- **Audio**: Web Audio API procedural synthesis
- **Storage**: localStorage with schema versioning
- **PWA**: vite-plugin-pwa, offline cache
- **Analytics**: Privacy-first event hooks (local only, no external telemetry)
