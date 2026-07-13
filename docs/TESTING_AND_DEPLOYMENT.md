# NEON PULSE — Testing Strategy

## Unit Test Targets
- `ComboSystem`: multiplier calculation, timeout, break
- `SpawnerSystem`: seeded patterns, difficulty ramp
- `SaveManager`: schema migration, XP progression, streak logic
- `AchievementManager`: condition evaluation
- `math.ts`: collision detection, RNG reproducibility

## Integration Tests
- Boot → Menu → Game → GameOver → Menu flow
- Pause/resume during gameplay
- Settings persistence across sessions
- Daily challenge seed consistency

## Manual QA Checklist
- [ ] 60 FPS on mobile Chrome and Safari
- [ ] Touch controls responsive (< 16ms perceived latency)
- [ ] Keyboard and gamepad input functional
- [ ] All 5 game modes start and end correctly
- [ ] High score saves and displays on menu cards
- [ ] Achievements unlock with toast notification
- [ ] Settings apply immediately (volume, theme, accessibility)
- [ ] Reduced motion disables shake and reduces particles
- [ ] Color blind palettes apply correctly
- [ ] PWA installs and works offline
- [ ] Landscape and portrait layouts correct
- [ ] No console errors during 10-minute session
- [ ] Share score copies to clipboard

## Performance Checklist
- [ ] Bundle < 500KB gzipped (excluding PixiJS chunk)
- [ ] First paint < 2s on 3G
- [ ] No GC spikes during gameplay (Chrome DevTools)
- [ ] Memory stable over 30-minute session
- [ ] Object pools recycle correctly

## Accessibility Checklist
- [ ] Screen reader announces score changes
- [ ] All buttons have aria-labels
- [ ] Keyboard navigable menus
- [ ] Reduced motion respected
- [ ] High contrast mode visible
- [ ] Font scaling 80%–150% functional

## Browser Compatibility Matrix
| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| WebGL rendering | ✅ | ✅ | ✅ | ✅ |
| Web Audio | ✅ | ✅ | ✅ | ✅ |
| Touch events | ✅ | ✅ | ✅ | ✅ |
| Gamepad API | ✅ | ✅ | ⚠️ | ✅ |
| PWA install | ✅ | ✅ | ✅ | ✅ |
| Share API | ✅ | ❌ | ✅ | ✅ |

## Deployment Plan
1. `npm run build` → `dist/`
2. Deploy static files to CDN (Netlify, Vercel, Cloudflare Pages)
3. Verify service worker registers
4. Test on real mobile devices
5. Submit to CrazyGames / Poki if desired

## Future Expansion
- Multiplayer ghost runs (async leaderboards)
- Cloud save sync (Firebase/Supabase)
- Seasonal events with limited-time themes
- Additional game modes (Boss Rush, Zen)
- Social features (friend challenges)
- Cosmetic IAP store
- WebGPU renderer upgrade (PixiJS v8)
