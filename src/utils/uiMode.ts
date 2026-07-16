/** Touch-first / narrow viewports — tighter HUD and fewer overlays during play. */
export function isCompactUI(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
}
