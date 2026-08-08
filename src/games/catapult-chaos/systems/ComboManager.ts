import type { PhysicsEvent } from '@/games/catapult-chaos/systems/PhysicsWorld';
import { OBJECT_TEMPLATES } from '@/games/catapult-chaos/config/objectDefs';

export class ComboManager {
  combo = 0;
  comboScore = 0;
  maxCombo = 0;
  timer = 0;
  readonly decayMs = 2200;
  lastLabels: string[] = [];

  reset(): void {
    this.combo = 0;
    this.comboScore = 0;
    this.maxCombo = 0;
    this.timer = 0;
    this.lastLabels = [];
  }

  tick(dt: number): void {
    if (this.combo <= 0) return;
    this.timer -= dt * 16.67;
    if (this.timer <= 0) {
      this.combo = 0;
      this.lastLabels = [];
    }
  }

  register(event: PhysicsEvent): { points: number; label: string; combo: number } | null {
    let base = 0;
    let label = event.label ?? event.objectType ?? 'Hit';

    if (event.kind === 'break' && event.objectType) {
      base = OBJECT_TEMPLATES[event.objectType as keyof typeof OBJECT_TEMPLATES]?.scoreOnBreak ?? 300;
      label = `${event.objectType} destroyed`;
    } else if (event.kind === 'bounce') {
      base = 400;
    } else if (event.kind === 'explode') {
      base = 1200;
      label = 'Barrel blast';
    } else if (event.kind === 'collect') {
      base = event.objectType === 'coin' ? 250 : 350;
      label = event.objectType === 'coin' ? 'Coin' : 'Balloon ride';
    } else if (event.kind === 'hit' && event.objectType) {
      base = OBJECT_TEMPLATES[event.objectType as keyof typeof OBJECT_TEMPLATES]?.scoreOnHit ?? 100;
    } else {
      return null;
    }

    this.combo = Math.min(99, this.combo + 1);
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.timer = this.decayMs;
    const mult = 1 + this.combo * 0.15;
    const points = Math.round(base * mult);
    this.comboScore += points;
    this.lastLabels.unshift(`+${points}  ${label}`);
    if (this.lastLabels.length > 4) this.lastLabels.pop();
    return { points, label, combo: this.combo };
  }

  registerStyle(kind: string, base: number): { points: number; combo: number } {
    this.combo = Math.min(99, this.combo + 1);
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.timer = this.decayMs;
    const mult = 1 + this.combo * 0.12;
    const points = Math.round(base * mult);
    this.comboScore += points;
    this.lastLabels.unshift(`+${points}  ${kind}`);
    if (this.lastLabels.length > 4) this.lastLabels.pop();
    return { points, combo: this.combo };
  }
}
