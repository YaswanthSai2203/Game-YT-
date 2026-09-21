import { COMMUNITY_MILESTONE } from '@/config/engagementConfig';
import { isYouTubePlayablesRuntime } from '@/config/platform';

export interface MilestoneStatus {
  total: number;
  goal: number;
  label: string;
  percent: number;
  available: boolean;
}

/** Read-only community milestone — increments happen server-side on validated score submit. */
export class CommunityMilestoneService {
  private baseUrl: string;

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async fetchStatus(): Promise<MilestoneStatus> {
    const fallback: MilestoneStatus = {
      total: 0,
      goal: COMMUNITY_MILESTONE.GOAL,
      label: COMMUNITY_MILESTONE.LABEL,
      percent: 0,
      available: false,
    };
    if (isYouTubePlayablesRuntime()) return fallback;
    try {
      const res = await fetch(`${this.baseUrl}/api/milestone`);
      if (!res.ok) return fallback;
      const data = await res.json() as { total?: number; goal?: number; label?: string };
      const total = data.total ?? 0;
      const goal = data.goal ?? COMMUNITY_MILESTONE.GOAL;
      return {
        total,
        goal,
        label: data.label ?? COMMUNITY_MILESTONE.LABEL,
        percent: Math.min(100, (total / goal) * 100),
        available: true,
      };
    } catch {
      return fallback;
    }
  }
}
