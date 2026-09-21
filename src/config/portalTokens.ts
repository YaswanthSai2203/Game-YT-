/** Portal / hub marketing surface — separate from in-game neon tactical tokens. */
export const PORTAL_TOKENS = {
  colors: {
    canvas: '#F5F3EF',
    canvasMuted: '#EBE8E3',
    ink: '#1A1A1A',
    inkSecondary: '#5C5C5C',
    inkMuted: '#8A8680',
    accent: '#006680',
    accentHover: '#004F66',
    border: '#E0DDD6',
    borderStrong: '#C8C4BC',
    surface: '#FAFAF8',
    focus: '#006680',
  },
  fonts: {
    display: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '40px',
    xxl: '64px',
  },
  radius: {
    sm: '2px',
    md: '4px',
    lg: '6px',
  },
  duration: {
    fast: '120ms',
    normal: '200ms',
  },
  layout: {
    maxWidth: '960px',
    narrowWidth: '680px',
  },
} as const;

export function applyPortalTokensToRoot(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const { colors, fonts, spacing, radius, duration, layout } = PORTAL_TOKENS;

  Object.entries(colors).forEach(([key, value]) => {
    root.style.setProperty(`--portal-${key}`, value);
  });
  root.style.setProperty('--portal-font-display', fonts.display);
  root.style.setProperty('--portal-font-body', fonts.body);
  Object.entries(spacing).forEach(([key, value]) => {
    root.style.setProperty(`--portal-space-${key}`, value);
  });
  Object.entries(radius).forEach(([key, value]) => {
    root.style.setProperty(`--portal-radius-${key}`, value);
  });
  Object.entries(duration).forEach(([key, value]) => {
    root.style.setProperty(`--portal-duration-${key}`, value);
  });
  root.style.setProperty('--portal-max-width', layout.maxWidth);
  root.style.setProperty('--portal-narrow-width', layout.narrowWidth);
}
