# NEON PULSE — Design System

## Color Palette

### Primary (Dark Mode — Default)
| Token | Hex | Usage |
|-------|-----|-------|
| `--void` | `#0a0e1a` | Background |
| `--void-light` | `#121829` | Panels |
| `--void-lighter` | `#1a2236` | Elevated surfaces |
| `--neon-cyan` | `#00f0ff` | Primary accent, player |
| `--neon-magenta` | `#ff006e` | Secondary accent, danger |
| `--neon-violet` | `#8b5cf6` | Tertiary, powerups |
| `--neon-gold` | `#ffd700` | Rewards, combos |
| `--neon-green` | `#00ff88` | Success, shields |
| `--text-primary` | `#e8edf5` | Headings |
| `--text-secondary` | `#8892a8` | Body text |
| `--text-muted` | `#4a5568` | Disabled |

### Light Mode
| Token | Hex |
|-------|-----|
| `--void` | `#f0f4f8` |
| `--void-light` | `#ffffff` |
| `--text-primary` | `#0a0e1a` |

### Color Blind Palettes
- **Deuteranopia**: Cyan → Blue (#0066ff), Magenta → Orange (#ff8800)
- **Protanopia**: Same as deuteranopia mapping
- **Tritanopia**: Cyan → Pink (#ff66aa), Magenta → Teal (#00ccaa)

## Typography
| Role | Font | Weight | Size Range |
|------|------|--------|------------|
| Display | Orbitron | 700–900 | 24–48px |
| Heading | Orbitron | 600 | 18–24px |
| Body | Rajdhani | 500 | 14–16px |
| Score | Orbitron | 800 | 28–36px |
| Caption | Rajdhani | 400 | 11–12px |

## Spacing Grid
Base unit: 4px. Scale: 4, 8, 12, 16, 24, 32, 48, 64.

## Border Radius
- Small: 4px (tags)
- Medium: 8px (buttons)
- Large: 12px (panels)
- XL: 16px (modals)
- Full: 9999px (pills)

## Shadows & Glow
```css
--glow-cyan: 0 0 20px rgba(0, 240, 255, 0.4);
--glow-magenta: 0 0 20px rgba(255, 0, 110, 0.4);
--panel-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
```

## Animation Tokens
| Token | Duration | Easing |
|-------|----------|--------|
| `--duration-fast` | 150ms | ease-out |
| `--duration-normal` | 300ms | cubic-bezier(0.4, 0, 0.2, 1) |
| `--duration-slow` | 500ms | cubic-bezier(0.4, 0, 0.2, 1) |
| `--duration-splash` | 2000ms | ease-in-out |

## Component Library
- **Button**: Primary (cyan glow), Secondary (outline), Ghost, Danger
- **Panel**: Glass-morphism with backdrop blur
- **Card**: Mode selection cards with hover glow
- **ProgressBar**: Sync XP bar with gradient fill
- **Toggle**: iOS-style switch
- **Slider**: Volume/sensitivity with neon thumb
- **Badge**: Achievement/combo badges
- **Modal**: Centered overlay with scale-in animation
- **HUD**: Score, combo, phase meter, powerup indicator
- **Toast**: Floating notification for achievements

## Wireframes (ASCII)

### Main Menu
```
┌──────────────────────────────┐
│         NEON PULSE           │
│      ▓▓▓ QUANTUM RUN ▓▓▓     │
│                              │
│  ┌────────┐  ┌────────┐     │
│  │ENDLESS │  │  TIME  │     │
│  │        │  │ ATTACK │     │
│  └────────┘  └────────┘     │
│  ┌────────┐  ┌────────┐     │
│  │CHALLENGE│  │PRACTICE│     │
│  └────────┘  └────────┘     │
│                              │
│  [Daily] [Achieve] [Settings]│
│  Sync Lv.5 ████░░ 2,400 XP  │
└──────────────────────────────┘
```

### Game HUD
```
┌──────────────────────────────┐
│ SCORE: 12,450    ⏸          │
│ COMBO x4.5  ████░░ PHASE     │
│                              │
│         [ GAME CANVAS ]      │
│                              │
│  ◄ SWIPE / TAP LANES ►      │
└──────────────────────────────┘
```

## Asset List (Procedural)
All assets generated at runtime via PixiJS Graphics:
- Player core (hexagon, 6 variants)
- Firewall bar (red gradient rect)
- Data shard (diamond crystal)
- Powerup icons (4 types)
- Particle sprites (circle, star, ring)
- Grid lines (horizontal parallax)
- Background star field
- Trail segments

## Audio Specification
| Event | Sound Character |
|-------|----------------|
| Menu hover | Soft blip (800Hz, 50ms) |
| Menu confirm | Ascending triad (C5-E5-G5) |
| Lane switch | Whoosh (filtered noise sweep) |
| Shard collect | Crystal ping (random pentatonic) |
| Combo up | Rising arpeggio layer |
| Phase shift | Deep bass drop + shimmer |
| Powerup | Power chord stinger |
| Hit/death | Crashing noise burst + silence |
| Achievement | Fanfare (4-note victory) |
| Background | Adaptive synth pad + arpeggiator |

## Production Roadmap
1. ✅ Core engine & boot flow
2. ✅ Gameplay loop & collision
3. ✅ UI screens & navigation
4. ✅ Save/achievements/leaderboard
5. ✅ Audio synthesis
6. ✅ Accessibility & settings
7. ✅ PWA & build optimization
8. 🔲 Multiplayer ghost runs (future)
9. 🔲 Cloud save sync (future)
10. 🔲 Seasonal events (future)
