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
} as const;

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
