export const DESIGN_TOKENS = {
  colors: {
    void: '#0a0e1a',
    voidLight: '#121829',
    voidLighter: '#1a2236',
    neonCyan: '#00f0ff',
    neonMagenta: '#ff006e',
    neonViolet: '#8b5cf6',
    neonGold: '#ffd700',
    neonGreen: '#00ff88',
    textPrimary: '#e8edf5',
    textSecondary: '#8892a8',
    textMuted: '#4a5568',
  },
  fonts: {
    display: "'Orbitron', sans-serif",
    body: "'Rajdhani', sans-serif",
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },
  duration: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
  },
  zIndex: {
    hud: 10,
    overlay: 100,
    modal: 200,
    toast: 300,
  },
  glass: {
    panel: 'rgba(18, 24, 41, 0.94)',
    panelBorder: 'rgba(0, 240, 255, 0.35)',
    menuScrim: 'rgba(10, 14, 26, 0.86)',
    pausePill: 'rgba(10, 14, 26, 0.78)',
  },
  shadow: {
    ghostStat: '0 0 12px rgba(0, 240, 255, 0.35), 0 1px 3px rgba(0, 0, 0, 0.85)',
    panel: '0 12px 40px rgba(0, 0, 0, 0.5), 0 0 24px rgba(0, 240, 255, 0.06)',
  },
} as const;

/** Push design tokens to :root for CSS modules and tactical stylesheet. */
export function applyDesignTokensToRoot(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const { colors, glass, shadow, radius, duration } = DESIGN_TOKENS;
  Object.entries(colors).forEach(([k, v]) => {
    root.style.setProperty(`--color-${k}`, v);
  });
  root.style.setProperty('--ui-glass-panel', glass.panel);
  root.style.setProperty('--ui-glass-border', glass.panelBorder);
  root.style.setProperty('--ui-menu-scrim', glass.menuScrim);
  root.style.setProperty('--ui-pause-pill-bg', glass.pausePill);
  root.style.setProperty('--ui-ghost-stat-shadow', shadow.ghostStat);
  root.style.setProperty('--ui-glass-shadow', shadow.panel);
  root.style.setProperty('--ui-radius-lg', radius.lg);
  root.style.setProperty('--ui-duration-normal', duration.normal);
}

export function getColorBlindPalette(mode: string): Record<string, string> {
  const base = { ...DESIGN_TOKENS.colors };
  switch (mode) {
    case 'deuteranopia':
    case 'protanopia':
      return { ...base, neonCyan: '#0066ff', neonMagenta: '#ff8800' };
    case 'tritanopia':
      return { ...base, neonCyan: '#ff66aa', neonMagenta: '#00ccaa' };
    default:
      return base;
  }
}
