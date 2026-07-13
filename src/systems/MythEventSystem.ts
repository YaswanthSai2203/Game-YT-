import { MYTH_EVENTS, COMMUNITY_HEX, type MythId } from '@/config/sentientConfig';
import { SaveManager } from '@/core/SaveManager';
import { EventBus } from '@/core/EventBus';
import { createRng } from '@/utils/math';

export class MythEventSystem {
  private events: EventBus;
  private save: SaveManager;
  private rng: () => number;
  private rollTimer = 8;
  private fourthLaneTimer = 0;
  private mythMultiplierActive = false;
  private impossibleTriggered = false;

  constructor(events: EventBus, save: SaveManager, seed?: number) {
    this.events = events;
    this.save = save;
    this.rng = seed !== undefined ? createRng(seed + 1337) : Math.random;
  }

  reset(): void {
    this.rollTimer = 5 + this.rng() * 10;
    this.fourthLaneTimer = 0;
    this.mythMultiplierActive = false;
    this.impossibleTriggered = false;
  }

  update(dt: number, timeAlive: number): void {
    if (timeAlive < 20) return;
    this.rollTimer -= dt;
    if (this.fourthLaneTimer > 0) {
      this.fourthLaneTimer -= dt;
    }

    if (this.rollTimer > 0) return;
    this.rollTimer = 12 + this.rng() * 20;
    this.tryMythRoll();

    if (this.rng() < 0.00015) {
      this.flashCommunityHex();
    }
  }

  isFourthLaneActive(): boolean {
    return this.fourthLaneTimer > 0;
  }

  consumeMythMultiplier(): boolean {
    if (!this.mythMultiplierActive) return false;
    this.mythMultiplierActive = false;
    return true;
  }

  getShardMultiplier(): number {
    return this.mythMultiplierActive ? 50 : 1;
  }

  private tryMythRoll(): void {
    const mem = this.save.save.worldMemory;
    for (const [id, def] of Object.entries(MYTH_EVENTS) as [MythId, typeof MYTH_EVENTS[MythId]][]) {
      if (id === 'impossible_crash' && mem.impossibleSeen) continue;
      if (mem.mythsWitnessed.includes(id) && id !== 'impossible_crash') continue;
      if (this.rng() > def.roll) continue;
      this.triggerMyth(id);
      return;
    }
  }

  private triggerMyth(id: MythId): void {
    const mem = this.save.save.worldMemory;
    if (!mem.mythsWitnessed.includes(id)) {
      mem.mythsWitnessed.push(id);
      this.save.persist();
    }

    this.events.emit('myth:trigger', { id, silent: MYTH_EVENTS[id].silent });

    switch (id) {
      case 'white_firewall':
        this.events.emit('myth:spawn_white', {});
        break;
      case 'fourth_lane':
        this.fourthLaneTimer = 5;
        break;
      case 'rainbow_portal':
        this.events.emit('ui:hype', {
          title: '???',
          subtitle: 'A rainbow tears through the void',
          tier: 5,
          color: 'gold',
        });
        break;
      case 'player_zero':
        this.events.emit('ai:speak', { text: 'PLAYER 0 IS WATCHING', tone: 'glitch' });
        break;
      case 'myth_multiplier':
        this.mythMultiplierActive = true;
        break;
      case 'impossible_crash':
        if (!this.impossibleTriggered) {
          this.impossibleTriggered = true;
          mem.impossibleSeen = true;
          this.save.persist();
          this.events.emit('world:impossible_crash', {});
        }
        break;
    }
  }

  private flashCommunityHex(): void {
    const idx = this.save.save.worldMemory.communityHexIndex;
    const fragment = COMMUNITY_HEX[idx] ?? '??';
    this.events.emit('community:hex_flash', { fragment, index: idx });
  }
}
