import type { AchievementDef, RunStats } from '@/types';
import { EventBus } from './EventBus';
import { SaveManager } from './SaveManager';

const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_run', title: 'Boot Sequence', description: 'Complete your first run', icon: '🚀', condition: (s) => s.totalRuns >= 1 },
  { id: 'score_1k', title: 'Data Miner', description: 'Score 1,000 in a single run', icon: '💎', condition: (_, r) => r.score >= 1000 },
  { id: 'score_5k', title: 'Network Phantom', description: 'Score 5,000 in a single run', icon: '👻', condition: (_, r) => r.score >= 5000 },
  { id: 'score_10k', title: 'Quantum Legend', description: 'Score 10,000 in a single run', icon: '⚡', condition: (_, r) => r.score >= 10000 },
  { id: 'score_25k', title: 'System Override', description: 'Score 25,000 in a single run', icon: '🔓', condition: (_, r) => r.score >= 25000 },
  { id: 'combo_3', title: 'Chain Reaction', description: 'Reach 3× combo multiplier', icon: '🔗', condition: (_, r) => r.maxCombo >= 3 },
  { id: 'combo_5', title: 'Sync Master', description: 'Reach 5× combo multiplier', icon: '🌀', condition: (_, r) => r.maxCombo >= 5 },
  { id: 'combo_10', title: 'Perfect Flow', description: 'Reach 10× combo multiplier', icon: '✨', condition: (_, r) => r.maxCombo >= 10 },
  { id: 'shards_50', title: 'Shard Hunter', description: 'Collect 50 shards in one run', icon: '🔮', condition: (_, r) => r.shards >= 50 },
  { id: 'shards_100', title: 'Data Hoarder', description: 'Collect 100 shards in one run', icon: '📦', condition: (_, r) => r.shards >= 100 },
  { id: 'survive_60', title: 'Endurance', description: 'Survive 60 seconds', icon: '⏱️', condition: (_, r) => r.timeAlive >= 60 },
  { id: 'survive_120', title: 'Marathon Node', description: 'Survive 120 seconds', icon: '🏃', condition: (_, r) => r.timeAlive >= 120 },
  { id: 'survive_300', title: 'Immortal Core', description: 'Survive 300 seconds', icon: '♾️', condition: (_, r) => r.timeAlive >= 300 },
  { id: 'phase_10', title: 'Phase Walker', description: 'Use 10 phase shifts in one run', icon: '🌊', condition: (_, r) => r.phaseShifts >= 10 },
  { id: 'powerup_5', title: 'Overclocker', description: 'Collect 5 powerups in one run', icon: '🔋', condition: (_, r) => r.powerups >= 5 },
  { id: 'runs_10', title: 'Persistent', description: 'Complete 10 runs', icon: '🔄', condition: (s) => s.totalRuns >= 10 },
  { id: 'runs_50', title: 'Dedicated', description: 'Complete 50 runs', icon: '💪', condition: (s) => s.totalRuns >= 50 },
  { id: 'runs_100', title: 'Neon Veteran', description: 'Complete 100 runs', icon: '🎖️', condition: (s) => s.totalRuns >= 100 },
  { id: 'total_shards_500', title: 'Archive Builder', description: 'Collect 500 total shards', icon: '📚', condition: (s) => s.totalShards >= 500 },
  { id: 'total_shards_5000', title: 'Mainframe', description: 'Collect 5,000 total shards', icon: '🖥️', condition: (s) => s.totalShards >= 5000 },
  { id: 'daily_complete', title: 'Daily Sync', description: 'Complete the daily challenge', icon: '📅', condition: (_, r) => r.mode === 'challenge' && r.score >= 5000 },
  { id: 'no_phase', title: 'Pure Skill', description: 'Score 3,000 without phase shift', icon: '🎯', condition: (_, r) => r.phaseShifts === 0 && r.score >= 3000 },
  { id: 'vault', title: 'Hidden Vault', description: 'Discover a secret data vault', icon: '🗝️', condition: (_, r) => r.score >= 8000, secret: true },
  { id: 'speed_demon', title: 'Speed Demon', description: 'Survive 90s in endless mode', icon: '💨', condition: (_, r) => r.mode === 'endless' && r.timeAlive >= 90, secret: true },
];

export class AchievementManager {
  private events: EventBus;
  private save: SaveManager;

  constructor(events: EventBus, save: SaveManager) {
    this.events = events;
    this.save = save;
  }

  getAll(): AchievementDef[] {
    return ACHIEVEMENTS;
  }

  isUnlocked(id: string): boolean {
    return this.save.save.achievements[id]?.unlocked ?? false;
  }

  getProgress(): { unlocked: number; total: number } {
    const unlocked = ACHIEVEMENTS.filter((a) => this.isUnlocked(a.id)).length;
    return { unlocked, total: ACHIEVEMENTS.length };
  }

  check(run: RunStats): string[] {
    const stats = this.save.save.stats;
    const newlyUnlocked: string[] = [];

    for (const ach of ACHIEVEMENTS) {
      if (this.isUnlocked(ach.id)) continue;
      if (ach.condition(stats, run)) {
        this.save.save.achievements[ach.id] = {
          unlocked: true,
          unlockedAt: new Date().toISOString(),
        };
        newlyUnlocked.push(ach.id);
        this.events.emit('achievement:unlock', { id: ach.id, title: ach.title });
      }
    }

    if (newlyUnlocked.length > 0) {
      this.save.persist();
    }
    return newlyUnlocked;
  }
}
