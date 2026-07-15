import {
  SIGNAL_CASES,
  SIGNAL_NODES,
  type SignalNodeDef,
} from '@/config/signalDetectiveConfig';
import type { InvestigationState, RunStats, SaveData, WorldMemory } from '@/types';

export type NodeStatus = 'locked' | 'available' | 'decoded';

export interface SignalNodeView {
  def: SignalNodeDef;
  status: NodeStatus;
  chosenLabel?: string;
}

export class InvestigationService {
  /** Signal fragments earned from a harvest run */
  static fragmentsFromRun(stats: RunStats, _mem: WorldMemory): number {
    if (stats.mode === 'practice') return 0;
    const base = Math.floor(stats.shards / 2) + Math.floor(stats.score / 400);
    const timeBonus = Math.min(8, Math.floor(stats.timeAlive / 8));
    const discovery = (stats.realitiesDiscovered?.length ?? 0) * 3;
    const nearMiss = Math.min(4, Math.floor((stats.nearMisses ?? 0) / 2));
    return Math.max(1, base + timeBonus + discovery + nearMiss);
  }

  static getNodeStatus(
    node: SignalNodeDef,
    inv: InvestigationState,
    mem: WorldMemory,
    totalRuns: number,
  ): NodeStatus {
    if (inv.decodedIds.includes(node.id)) return 'decoded';
    if (this.meetsRequirements(node, inv, mem, totalRuns)) return 'available';
    return 'locked';
  }

  static meetsRequirements(
    node: SignalNodeDef,
    inv: InvestigationState,
    mem: WorldMemory,
    totalRuns: number,
  ): boolean {
    const req = node.requires;
    if (!req) return true;
    if (req.decoded?.some((id) => !inv.decodedIds.includes(id))) return false;
    if (req.gridSyncMin !== undefined && mem.gridSync < req.gridSyncMin) return false;
    if (req.minRuns !== undefined && totalRuns < req.minRuns) return false;
    if (req.myths?.length && !req.myths.some((m) => mem.mythsWitnessed.includes(m))) return false;
    if (req.dimensions?.length && !req.dimensions.some((d) => mem.dimensionsEntered.includes(d))) return false;
    if (req.choice) {
      const picked = inv.choices[req.choice.nodeId];
      if (picked !== req.choice.choiceId) return false;
    }
    return true;
  }

  static getNodesForCase(caseId: string, save: SaveData): SignalNodeView[] {
    return SIGNAL_NODES
      .filter((n) => n.caseId === caseId)
      .map((def) => ({
        def,
        status: this.getNodeStatus(def, save.investigation, save.worldMemory, save.stats.totalRuns),
        chosenLabel: def.choices?.find((c) => c.id === save.investigation.choices[def.id])?.label,
      }));
  }

  static getActiveCase(save: SaveData): string {
    const case02Unlocked = SIGNAL_NODES.some(
      (n) => n.caseId === 'case02'
        && this.getNodeStatus(n, save.investigation, save.worldMemory, save.stats.totalRuns) !== 'locked',
    );
    if (case02Unlocked) return 'case02';
    return 'case01';
  }

  static countAvailable(save: SaveData): number {
    return SIGNAL_NODES.filter(
      (n) => this.getNodeStatus(n, save.investigation, save.worldMemory, save.stats.totalRuns) === 'available',
    ).length;
  }

  static canDecode(nodeId: string, save: SaveData): boolean {
    const node = SIGNAL_NODES.find((n) => n.id === nodeId);
    if (!node) return false;
    if (save.investigation.decodedIds.includes(nodeId)) return false;
    if (this.getNodeStatus(node, save.investigation, save.worldMemory, save.stats.totalRuns) !== 'available') {
      return false;
    }
    return save.investigation.signalFragments >= node.fragmentCost;
  }

  static decode(nodeId: string, save: SaveData): { ok: boolean; node?: SignalNodeDef } {
    const node = SIGNAL_NODES.find((n) => n.id === nodeId);
    if (!node || !this.canDecode(nodeId, save)) return { ok: false };
    save.investigation.signalFragments -= node.fragmentCost;
    save.investigation.decodedIds.push(nodeId);
    return { ok: true, node };
  }

  static setChoice(nodeId: string, choiceId: string, save: SaveData): boolean {
    const node = SIGNAL_NODES.find((n) => n.id === nodeId);
    if (!node?.choices?.some((c) => c.id === choiceId)) return false;
    if (!save.investigation.decodedIds.includes(nodeId)) return false;
    save.investigation.choices[nodeId] = choiceId;
    return true;
  }

  static getChoiceLog(nodeId: string, save: SaveData): string | null {
    const node = SIGNAL_NODES.find((n) => n.id === nodeId);
    const choiceId = save.investigation.choices[nodeId];
    if (!node?.choices || !choiceId) return null;
    return node.choices.find((c) => c.id === choiceId)?.log ?? null;
  }

  static caseProgress(caseId: string, save: SaveData): { decoded: number; total: number } {
    const nodes = SIGNAL_NODES.filter((n) => n.caseId === caseId);
    const decoded = nodes.filter((n) => save.investigation.decodedIds.includes(n.id)).length;
    return { decoded, total: nodes.length };
  }

  static allCases(): typeof SIGNAL_CASES {
    return SIGNAL_CASES;
  }
}
