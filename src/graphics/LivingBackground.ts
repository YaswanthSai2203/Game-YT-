import { Container } from 'pixi.js';
import type { BackgroundBiomeId } from '@/config/backgroundConfig';
import { buildBackgroundBiome } from '@/graphics/BackgroundBiomes';

export interface LivingBackgroundOptions {
  biome: BackgroundBiomeId;
  totalRuns: number;
  seed: number;
  reducedMotion: boolean;
}

export function createLivingBackground(
  width: number,
  height: number,
  options: LivingBackgroundOptions,
): Container {
  return buildBackgroundBiome(width, height, {
    biome: options.biome,
    totalRuns: options.totalRuns,
    seed: options.seed,
  });
}

export { getBiomeLabel } from '@/graphics/BackgroundBiomes';
