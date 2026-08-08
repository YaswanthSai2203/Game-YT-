import type { RunStats, ScoreBreakdown } from '@/games/catapult-chaos/types';

export class ScoreManager {
  stats: RunStats = {
    maxDistance: 0,
    objectsDestroyed: 0,
    flips: 0,
    secretsFound: 0,
    maxCombo: 0,
    perfectLaunch: false,
    coinsCollected: 0,
  };

  distanceScore = 0;
  destructionScore = 0;
  styleScore = 0;
  discoveryScore = 0;
  precisionScore = 0;
  comboScore = 0;

  reset(): void {
    this.stats = {
      maxDistance: 0,
      objectsDestroyed: 0,
      flips: 0,
      secretsFound: 0,
      maxCombo: 0,
      perfectLaunch: false,
      coinsCollected: 0,
    };
    this.distanceScore = 0;
    this.destructionScore = 0;
    this.styleScore = 0;
    this.discoveryScore = 0;
    this.precisionScore = 0;
    this.comboScore = 0;
  }

  updateDistance(meters: number): void {
    this.stats.maxDistance = Math.max(this.stats.maxDistance, meters);
    this.distanceScore = Math.round(this.stats.maxDistance * 1.2);
  }

  addDestruction(points: number): void {
    this.destructionScore += points;
    this.stats.objectsDestroyed += 1;
  }

  addStyle(points: number, flips = 0): void {
    this.styleScore += points;
    this.stats.flips += flips;
  }

  addDiscovery(points: number): void {
    this.discoveryScore += points;
    this.stats.secretsFound += 1;
  }

  setComboScore(score: number, maxCombo: number): void {
    this.comboScore = score;
    this.stats.maxCombo = maxCombo;
  }

  setPrecision(perfect: boolean, bonus: number): void {
    this.stats.perfectLaunch = perfect;
    this.precisionScore = bonus;
  }

  addCoin(): void {
    this.stats.coinsCollected += 1;
  }

  breakdown(): ScoreBreakdown {
    const total =
      this.distanceScore +
      this.destructionScore +
      this.styleScore +
      this.discoveryScore +
      this.comboScore +
      this.precisionScore;
    return {
      distance: this.distanceScore,
      destruction: this.destructionScore,
      style: this.styleScore,
      discovery: this.discoveryScore,
      combo: this.comboScore,
      precision: this.precisionScore,
      total,
    };
  }
}
