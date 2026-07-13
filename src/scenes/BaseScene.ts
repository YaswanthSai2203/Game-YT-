import { Container, Text, TextStyle } from 'pixi.js';
import type { SceneId } from '@/types';
import type { Scene } from '@/core/SceneManager';
import { EventBus } from '@/core/EventBus';
import { AudioManager } from '@/core/AudioManager';

export abstract class BaseScene implements Scene {
  abstract id: SceneId;
  protected container = new Container();
  protected events: EventBus;
  protected audio: AudioManager;

  constructor(events: EventBus, audio: AudioManager) {
    this.events = events;
    this.audio = audio;
  }

  async init(): Promise<void> { /* override */ }

  enter(_data?: unknown): void { /* override */ }
  update(_dt: number): void { /* override */ }
  exit(): void { /* override */ }

  destroy(): void {
    this.container.destroy({ children: true });
  }

  getContainer(): Container {
    return this.container;
  }

  protected createText(content: string, size: number, color = 0xe8edf5, font = 'Orbitron'): Text {
    return new Text({
      text: content,
      style: new TextStyle({
        fontFamily: font,
        fontSize: size,
        fill: color,
        fontWeight: '700',
      }),
    });
  }
}
