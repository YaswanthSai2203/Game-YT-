/** Shared visual tokens for canvas mini-games — cohesive palette + motion. */
export const MINI_GAME_TOKENS = {
  fonts: {
    display: "'Syne', sans-serif",
    body: "'Plus Jakarta Sans', sans-serif",
  },
  colors: {
    void: '#070a12',
    voidMid: '#101828',
    voidLight: '#1a2236',
    cyan: '#00d4e8',
    cyanDeep: '#0099b0',
    magenta: '#e8367a',
    violet: '#9b6dff',
    gold: '#ffc940',
    text: '#eef2f8',
    textMuted: '#8b95a8',
    border: 'rgba(255, 255, 255, 0.1)',
    glass: 'rgba(12, 16, 28, 0.88)',
  },
  motion: {
    fastMs: 150,
    normalMs: 220,
    easeOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

export const MINI_GAME_PALETTE = MINI_GAME_TOKENS.colors;
