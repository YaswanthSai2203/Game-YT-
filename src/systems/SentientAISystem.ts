import { AI_COMMENTS, ADAPTIVE_PROTOCOL, GRID_SYNC } from '@/config/sentientConfig';
import { PERSONALITY_LINES, getPersonality, type PersonalityId } from '@/config/engagementConfig';
import { SaveManager } from '@/core/SaveManager';
import { EventBus } from '@/core/EventBus';

export class SentientAISystem {
  private events: EventBus;
  private save: SaveManager;
  private speakCooldown = 0;
  private runMovesLeft = 0;
  private runMovesRight = 0;
  private firstMoveDirection: number | null = null;
  private sameFirstMoveCount = 0;
  private lastFirstMove: number | null = null;
  private runStarted = false;

  constructor(events: EventBus, save: SaveManager) {
    this.events = events;
    this.save = save;
  }

  reset(): void {
    this.speakCooldown = 15 + Math.random() * 25;
    this.runMovesLeft = 0;
    this.runMovesRight = 0;
    this.firstMoveDirection = null;
    this.sameFirstMoveCount = 0;
    this.lastFirstMove = null;
    this.runStarted = false;
  }

  onRunStart(): void {
    this.runStarted = true;
    const mem = this.save.save.worldMemory;
    const runs = this.save.save.stats.totalRuns;
    const whispersEnabled = mem.gridSync >= GRID_SYNC.THRESHOLDS.WHISPERS;

    if (runs >= 5 && whispersEnabled) {
      const lines: string[] = [];
      if (mem.lastDeathSeconds > 0 && mem.lastDeathDate) {
        const days = Math.floor(
          (Date.now() - new Date(mem.lastDeathDate).getTime()) / 86400000,
        );
        if (days >= 3) {
          lines.push(`Last time you died at ${Math.floor(mem.lastDeathSeconds)}s.`);
        }
      }
      if (mem.longestRunSeconds > 30) {
        lines.push(`Longest sync: ${Math.floor(mem.longestRunSeconds)} seconds.`);
      }
      if (mem.firewallsDodged >= 100) {
        lines.push(`You've survived ${mem.firewallsDodged.toLocaleString()} firewalls.`);
      }
      for (const [dim, date] of Object.entries(mem.dimensionLastSeen)) {
        const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
        if (days >= 7) {
          lines.push(`You haven't entered ${dim.replace(/_/g, ' ')} in ${days} days.`);
          break;
        }
      }
      if (lines.length > 0 && Math.random() < 0.4) {
        this.events.emit('ai:memory', { text: lines[Math.floor(Math.random() * lines.length)] });
      }
    }

    if (runs >= 10 && whispersEnabled && Math.random() < 0.25) {
      this.speak(this.pickPersonality('early'), this.getPersonalityTone());
    }
  }

  update(dt: number, combo: number, timeAlive: number, nearDeath: boolean): void {
    if (!this.runStarted) return;
    const mem = this.save.save.worldMemory;
    if (mem.gridSync < GRID_SYNC.THRESHOLDS.WHISPERS) return;
    this.speakCooldown -= dt;
    if (this.speakCooldown > 0) return;

    const runs = this.save.save.stats.totalRuns;
    if (runs < 8) return;

    let spoke = false;

    if (combo >= 12 && Math.random() < 0.12) {
      this.speak(this.pickPersonality('combo'), this.getPersonalityTone());
      spoke = true;
    } else if (this.isLeftHeavy() && timeAlive > 20 && Math.random() < 0.08) {
      this.speak(this.pick(AI_COMMENTS.leftHabit), 'cold');
      spoke = true;
    } else if (this.isRightHeavy() && timeAlive > 20 && Math.random() < 0.08) {
      this.speak(this.pick(AI_COMMENTS.rightHabit), 'cold');
      spoke = true;
    } else if (this.sameFirstMoveCount >= 3 && Math.random() < 0.1) {
      this.speak(this.pick(AI_COMMENTS.predictable), 'cold');
      spoke = true;
    } else if (mem.behaviorAdapted && Math.random() < 0.06) {
      this.speak(this.pickPersonality('combo'), 'warm');
      spoke = true;
    } else if (runs >= 50 && Math.random() < 0.04) {
      this.speak(this.pickPersonality('veteran'), this.getPersonalityTone());
      spoke = true;
    } else if (nearDeath && Math.random() < 0.15) {
      this.speak(this.pickPersonality('struggle'), 'whisper');
      spoke = true;
    }

    if (spoke) {
      this.speakCooldown = 35 + Math.random() * 45;
    }
  }

  onLaneMove(direction: number): void {
    this.save.recordLaneMove(direction);
    if (direction < 0) this.runMovesLeft++;
    else if (direction > 0) this.runMovesRight++;

    if (this.firstMoveDirection === null) {
      this.firstMoveDirection = direction;
      if (this.lastFirstMove === direction) {
        this.sameFirstMoveCount++;
      } else {
        this.sameFirstMoveCount = 1;
      }
      this.lastFirstMove = direction;
    }

    this.checkAdaptation();
  }

  onComboHigh(combo: number): void {
    if (combo === 10) {
      this.events.emit('ai:speak', { text: 'Learning. Good.', tone: 'warm' });
    }
  }

  shouldPunishLeftHabit(): boolean {
    const mem = this.save.save.worldMemory;
    if (mem.behaviorAdapted) return false;
    const total = mem.laneMovesLeft + mem.laneMovesRight;
    return total >= ADAPTIVE_PROTOCOL.MIN_RUNS * 3
      && mem.laneMovesLeft / total > ADAPTIVE_PROTOCOL.HABIT_THRESHOLD;
  }

  shouldPunishRightHabit(): boolean {
    const mem = this.save.save.worldMemory;
    if (mem.behaviorAdapted) return false;
    const total = mem.laneMovesLeft + mem.laneMovesRight;
    return total >= ADAPTIVE_PROTOCOL.MIN_RUNS * 3
      && mem.laneMovesRight / total > ADAPTIVE_PROTOCOL.HABIT_THRESHOLD;
  }

  private isLeftHeavy(): boolean {
    const t = this.runMovesLeft + this.runMovesRight;
    return t >= 6 && this.runMovesLeft / t > 0.65;
  }

  private isRightHeavy(): boolean {
    const t = this.runMovesLeft + this.runMovesRight;
    return t >= 6 && this.runMovesRight / t > 0.65;
  }

  private checkAdaptation(): void {
    const mem = this.save.save.worldMemory;
    if (mem.adaptiveUnlocked) return;
    const total = mem.laneMovesLeft + mem.laneMovesRight;
    if (total < ADAPTIVE_PROTOCOL.MIN_RUNS * 4) return;

    const leftRatio = mem.laneMovesLeft / total;
    const hadHabit = leftRatio > ADAPTIVE_PROTOCOL.HABIT_THRESHOLD
      || leftRatio < (1 - ADAPTIVE_PROTOCOL.HABIT_THRESHOLD);
    if (!hadHabit) return;

    const recentTotal = mem.recentLaneLeft + mem.recentLaneRight;
    if (recentTotal < 8) return;
    const recentLeft = mem.recentLaneLeft / recentTotal;
    const balanced = recentLeft > ADAPTIVE_PROTOCOL.BALANCED_THRESHOLD
      && recentLeft < (1 - ADAPTIVE_PROTOCOL.BALANCED_THRESHOLD);

    if (balanced) {
      mem.behaviorAdapted = true;
      mem.adaptiveUnlocked = true;
      mem.aiTrust = Math.min(100, mem.aiTrust + 20);
      this.save.persist();
      this.speak('The Grid acknowledges your adaptation. Adaptive Protocol unlocked.', 'glitch');
      this.events.emit('ai:speak', {
        text: 'A fracture opens — because you learned.',
        tone: 'glitch',
      });
      this.events.emit('grid:habit_broken', {});
      this.events.emit('grid:adaptive_unlock', {});
    }
  }

  private speak(text: string, tone: 'whisper' | 'cold' | 'warm' | 'glitch' = 'whisper'): void {
    const mem = this.save.save.worldMemory;
    mem.aiCommentsHeard++;
    mem.aiTrust = Math.min(100, mem.aiTrust + 1);
    this.save.persist();
    this.events.emit('ai:speak', { text, tone });
  }

  private getPersonalityId(): PersonalityId {
    const id = this.save.save.unlocks.selectedPersonality ?? 'observer';
    return (['observer', 'architect', 'mystic', 'rival'].includes(id) ? id : 'observer') as PersonalityId;
  }

  private getPersonalityTone(): 'whisper' | 'cold' | 'warm' | 'glitch' {
    return getPersonality(this.getPersonalityId()).tone;
  }

  private pickPersonality(category: string): string {
    const pid = this.getPersonalityId();
    const pool = PERSONALITY_LINES[pid]?.[category]
      ?? PERSONALITY_LINES.observer[category]
      ?? AI_COMMENTS.early;
    return this.pick(pool as readonly string[]);
  }

  private pick(arr: readonly string[]): string {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  static computeWorldStage(totalRuns: number): number {
    void totalRuns;
    return 0;
  }
}
