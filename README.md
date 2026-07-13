# NEON PULSE

High-tech cyberpunk arcade browser game — dodge firewalls, collect data shards, master quantum phase shifts.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Build

```bash
npm run build
npm run preview
```

## Tech Stack

- **TypeScript** + **Vite 6**
- **PixiJS 8** (WebGL canvas rendering)
- **Web Audio API** (procedural sound synthesis)
- **PWA** ready (offline support via service worker)

## Game Modes

| Mode | Description |
|------|-------------|
| Endless | Survive as long as possible |
| Time Attack | Max score in 60 seconds |
| Time Attack+ | Max score in 120 seconds |
| Challenge | Daily seeded run — beat 5,000 points |
| Practice | No death — train reflexes |

## Controls

- **Mobile**: Tap left/right thirds to switch lanes, tap center to phase shift, swipe to move
- **Desktop**: Arrow keys / A/D to move, Space/W to phase shift, Escape to pause
- **Gamepad**: D-pad / left stick + A button

## Documentation

- [Game Design Document](docs/GDD.md)
- [Technical Architecture](docs/TECHNICAL_ARCHITECTURE.md)
- [Design System](docs/DESIGN_SYSTEM.md)

## Features

- 60 FPS canvas rendering with particle effects and screen shake
- Combo multiplier system (up to 10×)
- 4 powerups: Shield, Magnet, Overclock, Chronos
- Quantum phase shift risk/reward mechanic
- 24 achievements (including secret achievements)
- Sync level progression with unlockables
- Daily challenge with streak tracking
- Local leaderboard (top 10 per mode)
- Full accessibility: reduced motion, high contrast, color blind modes, font scaling
- Privacy-first analytics (local only, no external telemetry)
- Autosave via localStorage

## Browser Support

Chrome 90+, Firefox 90+, Safari 15+, Edge 90+

## License

MIT
