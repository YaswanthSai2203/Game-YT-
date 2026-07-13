import { Container, Application } from 'pixi.js';
import type { SceneId } from '@/types';
import { EventBus } from './EventBus';

export interface Scene {
  id: SceneId;
  init(): void | Promise<void>;
  enter(data?: unknown): void;
  update(dt: number): void;
  exit(): void;
  destroy(): void;
  getContainer(): Container;
}

export class SceneManager {
  private app: Application;
  private events: EventBus;
  private scenes = new Map<SceneId, Scene>();
  private current: Scene | null = null;
  private currentId: SceneId | null = null;

  constructor(app: Application, events: EventBus) {
    this.app = app;
    this.events = events;
  }

  register(scene: Scene): void {
    this.scenes.set(scene.id, scene);
    scene.init();
    this.app.stage.addChild(scene.getContainer());
    scene.getContainer().visible = false;
  }

  async switchTo(id: SceneId, data?: unknown): Promise<void> {
    const next = this.scenes.get(id);
    if (!next) {
      console.error(`Scene "${id}" not registered`);
      return;
    }

    const prevId = this.currentId;
    if (this.current) {
      this.current.exit();
      this.current.getContainer().visible = false;
    }

    this.current = next;
    this.currentId = id;
    next.getContainer().visible = true;
    next.enter(data);

    if (prevId) {
      this.events.emit('scene:change', { from: prevId, to: id });
    }
  }

  leaveCurrent(): void {
    if (!this.current) return;
    this.current.exit();
    this.current.getContainer().visible = false;
    this.current = null;
    this.currentId = null;
  }

  update(dt: number): void {
    this.current?.update(dt);
  }

  getCurrentId(): SceneId | null {
    return this.currentId;
  }

  getScene<T extends Scene>(id: SceneId): T | undefined {
    return this.scenes.get(id) as T | undefined;
  }

  destroy(): void {
    this.scenes.forEach((s) => s.destroy());
    this.scenes.clear();
  }
}
