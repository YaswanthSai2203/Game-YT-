import type { AnalyticsEvent } from '@/types';
import { EventBus } from './EventBus';

const MAX_EVENTS = 500;

export class AnalyticsManager {
  private events: AnalyticsEvent[] = [];
  private bus: EventBus;
  private sessionStart = Date.now();
  private unsubscribers: (() => void)[] = [];

  constructor(bus: EventBus) {
    this.bus = bus;
    this.setupListeners();
  }

  private setupListeners(): void {
    this.unsubscribers.push(
      this.bus.on('game:start', (d) => this.track('game_start', { mode: d.mode })),
      this.bus.on('game:over', (d) => this.track('game_over', {
        mode: d.stats.mode,
        score: d.stats.score,
        timeAlive: d.stats.timeAlive,
        maxCombo: d.stats.maxCombo,
      })),
      this.bus.on('shard:collect', (d) => this.track('shard_collect', { combo: d.combo })),
      this.bus.on('obstacle:hit', (d) => this.track('obstacle_hit', { type: d.type })),
      this.bus.on('powerup:activate', (d) => this.track('powerup_activate', { type: d.type })),
      this.bus.on('achievement:unlock', (d) => this.track('achievement_unlock', { id: d.id })),
      this.bus.on('scene:change', (d) => this.track('scene_change', { from: d.from, to: d.to })),
    );
  }

  track(name: string, data?: Record<string, unknown>): void {
    const event: AnalyticsEvent = { name, timestamp: Date.now(), data };
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) {
      this.events.shift();
    }
    this.bus.emit('analytics:track', event);
  }

  getSessionDuration(): number {
    return (Date.now() - this.sessionStart) / 1000;
  }

  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  getSummary(): Record<string, number> {
    const summary: Record<string, number> = {};
    for (const e of this.events) {
      summary[e.name] = (summary[e.name] ?? 0) + 1;
    }
    return summary;
  }

  destroy(): void {
    this.unsubscribers.forEach((u) => u());
  }
}
