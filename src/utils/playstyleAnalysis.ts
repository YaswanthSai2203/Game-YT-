import type { GameStats, WorldMemory } from '@/types';

export interface PlaystyleProfile {
  title: string;
  laneBias: 'left' | 'right' | 'center' | 'balanced';
  laneBiasLabel: string;
  riskLevel: 'cautious' | 'balanced' | 'aggressive';
  riskLabel: string;
  specialties: string[];
  ghostScore: number | null;
  mythsCount: number;
  dimensionsCount: number;
  nearMisses: number;
  longestRun: number;
  totalRuns: number;
}

export function analyzePlaystyle(mem: WorldMemory, stats: GameStats): PlaystyleProfile {
  const left = mem.laneMovesLeft + mem.recentLaneLeft;
  const right = mem.laneMovesRight + mem.recentLaneRight;
  const total = left + right || 1;

  let laneBias: PlaystyleProfile['laneBias'] = 'balanced';
  let laneBiasLabel = 'Balanced lane usage';
  if (left / total > 0.58) {
    laneBias = 'left';
    laneBiasLabel = 'Favors left lanes';
  } else if (right / total > 0.58) {
    laneBias = 'right';
    laneBiasLabel = 'Favors right lanes';
  } else if (Math.abs(left - right) / total < 0.12) {
    laneBias = 'center';
    laneBiasLabel = 'Center-focused pilot';
  }

  let riskLevel: PlaystyleProfile['riskLevel'] = 'balanced';
  let riskLabel = 'Adaptive risk taker';
  if (mem.riskProfile > 0.35) {
    riskLevel = 'aggressive';
    riskLabel = 'High-risk, high-reward';
  } else if (mem.riskProfile < -0.25) {
    riskLevel = 'cautious';
    riskLabel = 'Calculated and careful';
  }

  const specialties: string[] = [];
  if (mem.nearMissLifetime >= 20) specialties.push('Edge Runner');
  if (stats.phaseShiftsUsed > stats.totalRuns * 6) specialties.push('Phase Addict');
  if (mem.dimensionsEntered.length >= 3) specialties.push('Dimension Walker');
  if (mem.mythsWitnessed.length >= 1) specialties.push('Myth Witness');
  if (mem.longestRunSeconds >= 120) specialties.push('Marathon Sync');
  if (mem.gridSync >= 40) specialties.push('Grid Attuned');
  if (specialties.length === 0) specialties.push('Still discovering your rhythm');

  return {
    title: mem.playerTitle || 'Pilot',
    laneBias,
    laneBiasLabel,
    riskLevel,
    riskLabel,
    specialties,
    ghostScore: mem.ghostReplay?.score ?? null,
    mythsCount: mem.mythsWitnessed.length,
    dimensionsCount: mem.dimensionsEntered.length,
    nearMisses: mem.nearMissLifetime,
    longestRun: mem.longestRunSeconds,
    totalRuns: stats.totalRuns,
  };
}
