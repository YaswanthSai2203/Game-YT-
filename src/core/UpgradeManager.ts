import type { UpgradeId, UpgradeLevels } from '@/types';
import { UPGRADES } from '@/config/constants';
import { SaveManager } from './SaveManager';
import { EventBus } from './EventBus';

export class UpgradeManager {
  private save: SaveManager;

  constructor(save: SaveManager, _events: EventBus) {
    this.save = save;
  }

  getLevels(): UpgradeLevels {
    return { ...this.save.save.upgrades };
  }

  getLevel(id: UpgradeId): number {
    return this.save.save.upgrades[id];
  }

  getCost(id: UpgradeId): number {
    const def = UPGRADES[id];
    const level = this.getLevel(id);
    if (level >= def.maxLevel) return 0;
    return Math.floor(def.costBase * Math.pow(def.costScale, level));
  }

  canAfford(id: UpgradeId): boolean {
    return this.save.save.dataCredits >= this.getCost(id) && !this.isMaxed(id);
  }

  isMaxed(id: UpgradeId): boolean {
    return this.getLevel(id) >= UPGRADES[id].maxLevel;
  }

  purchase(id: UpgradeId): boolean {
    if (!this.canAfford(id)) return false;
    const cost = this.getCost(id);
    this.save.save.dataCredits -= cost;
    this.save.save.upgrades[id]++;
    this.save.persist();
    return true;
  }

  /** Multiplier applied to shard base value (e.g. 1.24 at level 2 shardBoost) */
  getShardMultiplier(): number {
    return 1 + this.getLevel('shardBoost') * UPGRADES.shardBoost.effectPerLevel;
  }

  /** Factor applied to phase cooldown (e.g. 0.8 = 20% faster at level 2 phaseSync) */
  getPhaseCooldownFactor(): number {
    return Math.max(0.5, 1 - this.getLevel('phaseSync') * UPGRADES.phaseSync.effectPerLevel);
  }

  /** Extra magnet range multiplier */
  getMagnetRangeMultiplier(): number {
    return 1 + this.getLevel('magnetField') * UPGRADES.magnetField.effectPerLevel;
  }

  hasStartShield(): boolean {
    return this.getLevel('coreShield') >= 1;
  }

  getCredits(): number {
    return this.save.save.dataCredits;
  }

  /** Credits needed for the cheapest unmaxed upgrade, or null if all maxed. */
  getCreditsToNextUpgrade(): number | null {
    const credits = this.save.save.dataCredits;
    let minDeficit = Infinity;
    for (const id of Object.keys(UPGRADES) as UpgradeId[]) {
      if (this.isMaxed(id)) continue;
      const deficit = this.getCost(id) - credits;
      if (deficit < minDeficit) minDeficit = deficit;
    }
    return minDeficit === Infinity ? null : Math.max(0, minDeficit);
  }

  addCredits(amount: number): void {
    this.save.save.dataCredits += amount;
    this.save.persist();
  }
}
