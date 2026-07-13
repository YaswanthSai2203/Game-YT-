import { Container } from 'pixi.js';
import type { GameMode } from '@/types';
import type { GhostRecording } from '@/types';
import { DIRECTOR } from '@/config/directorConfig';
import { createGhostCore } from '@/graphics/ProceduralAssets';
import { PLAYER } from '@/config/constants';

/** Records and plays back the player's best-run lane path as a racing ghost. */
export class GhostReplaySystem {
  private recording: GhostRecording | null = null;
  private playback: GhostRecording | null = null;
  private ghostContainer: Container | null = null;
  private parent: Container | null = null;
  private laneCenters: number[] = [];
  private playerY = 0;
  private active = false;

  setLaneCenters(centers: number[], playerY: number): void {
    this.laneCenters = centers;
    this.playerY = playerY;
  }

  loadPlayback(data: GhostRecording | null, parent: Container): void {
    this.playback = data;
    this.parent = parent;
    this.active = !!data && data.frames.length > 2;

    if (this.ghostContainer) {
      this.parent?.removeChild(this.ghostContainer);
      this.ghostContainer.destroy({ children: true });
      this.ghostContainer = null;
    }

    if (this.active && this.parent) {
      this.ghostContainer = createGhostCore(PLAYER.RADIUS * 0.85);
      this.ghostContainer.alpha = 0.4;
      this.parent.addChild(this.ghostContainer);
    }
  }

  startRecording(mode: GameMode): void {
    this.recording = { mode, score: 0, duration: 0, frames: [] };
  }

  record(timeAlive: number, lane: number): void {
    if (!this.recording) return;
    const last = this.recording.frames[this.recording.frames.length - 1];
    if (last && timeAlive - last.t < DIRECTOR.GHOST_RECORD_INTERVAL * 0.85) return;

    this.recording.frames.push({ t: timeAlive, lane });
    if (this.recording.frames.length > DIRECTOR.GHOST_MAX_FRAMES) {
      this.recording.frames.shift();
    }
    this.recording.duration = timeAlive;
  }

  finalize(score: number, bestScore: number): GhostRecording | null {
    if (!this.recording || this.recording.frames.length < 10) {
      this.recording = null;
      return null;
    }
    this.recording.score = score;
    const ratio = bestScore > 0 ? score / bestScore : 1;
    if (ratio < DIRECTOR.GHOST_MIN_SCORE_RATIO && bestScore > 500) {
      this.recording = null;
      return null;
    }
    const result = this.recording;
    this.recording = null;
    return result;
  }

  update(_dt: number, timeAlive: number): { ahead: boolean; behind: boolean } {
    const result = { ahead: false, behind: false };
    if (!this.active || !this.playback || !this.ghostContainer) return result;

    const frames = this.playback.frames;
    let lane = frames[0]?.lane ?? 1;

    for (let i = 0; i < frames.length - 1; i++) {
      if (frames[i].t <= timeAlive && frames[i + 1].t >= timeAlive) {
        lane = frames[i].lane;
        break;
      }
      if (frames[i].t <= timeAlive) lane = frames[i].lane;
    }

    const ghostT = frames[frames.length - 1]?.t ?? 0;
    if (timeAlive > ghostT + 2) result.ahead = true;
    if (timeAlive < ghostT - 5 && frames.length > 20) {
      const ghostLaneAtNow = frames.find((f) => f.t >= timeAlive)?.lane;
      if (ghostLaneAtNow !== undefined) result.behind = ghostLaneAtNow !== lane;
    }

    const x = this.laneCenters[lane] ?? this.laneCenters[1];
    this.ghostContainer.x = x;
    this.ghostContainer.y = this.playerY - 120 + Math.sin(timeAlive * 3) * 6;
    this.ghostContainer.alpha = 0.35 + Math.sin(timeAlive * 2) * 0.1;

    return result;
  }

  destroy(): void {
    if (this.ghostContainer && this.parent) {
      this.parent.removeChild(this.ghostContainer);
      this.ghostContainer.destroy({ children: true });
    }
    this.ghostContainer = null;
    this.active = false;
  }
}
