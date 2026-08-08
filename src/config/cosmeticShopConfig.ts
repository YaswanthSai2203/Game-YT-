export type CosmeticCategory = 'core' | 'trail' | 'theme' | 'hud' | 'music';

export interface CosmeticShopItem {
  category: CosmeticCategory;
  id: string;
  name: string;
  price: number;
  blurb: string;
}

/** Spend Data Credits on visuals — alternative to sync-level unlocks. */
export const COSMETIC_SHOP: CosmeticShopItem[] = [
  { category: 'core', id: 'magenta', name: 'Magenta Core', price: 120, blurb: 'Hot pink quantum heart' },
  { category: 'core', id: 'violet', name: 'Violet Core', price: 200, blurb: 'Deep lattice violet' },
  { category: 'core', id: 'quantum', name: 'Quantum Core', price: 450, blurb: 'Animated gold-cyan pulse' },
  { category: 'trail', id: 'gold', name: 'Gold Trail', price: 180, blurb: 'Vault-class particle wake' },
  { category: 'trail', id: 'glitch', name: 'Glitch Trail', price: 320, blurb: 'Corrupted signal streak' },
  { category: 'theme', id: 'matrix', name: 'Matrix Grid', price: 150, blurb: 'Frosted green lattice' },
  { category: 'theme', id: 'inferno', name: 'Inferno Grid', price: 250, blurb: 'Burning red geometry' },
  { category: 'theme', id: 'quantum', name: 'Quantum Ocean', price: 350, blurb: 'Deep blue dimension' },
  { category: 'theme', id: 'ghost', name: 'Echo Chamber', price: 300, blurb: 'Pale ghost biome' },
  { category: 'theme', id: 'gold', name: 'Vault Dimension', price: 500, blurb: 'Golden vault geometry' },
  { category: 'hud', id: 'minimal', name: 'Minimal HUD', price: 100, blurb: 'Cleaner run stats' },
  { category: 'hud', id: 'arcade', name: 'Arcade HUD', price: 220, blurb: 'Retro score frame' },
  { category: 'hud', id: 'ghost', name: 'Ghost Signal HUD', price: 400, blurb: 'Spectral readouts' },
  { category: 'hud', id: 'titan', name: 'Titan Frame HUD', price: 600, blurb: 'Heavy combat overlay' },
  { category: 'music', id: 'industrial', name: 'Industrial Pack', price: 280, blurb: 'Square-wave pressure' },
  { category: 'music', id: 'ambient', name: 'Ambient Void', price: 350, blurb: 'Wide low-pass pads' },
  { category: 'music', id: 'chiptune', name: 'Chiptune Pack', price: 420, blurb: 'Fast triangle ticks' },
];

export function getCosmeticUnlockKey(category: CosmeticCategory): keyof import('@/types').Unlocks {
  switch (category) {
    case 'core': return 'cores';
    case 'trail': return 'trails';
    case 'theme': return 'themes';
    case 'hud': return 'hudSkins';
    case 'music': return 'musicPacks';
  }
}
