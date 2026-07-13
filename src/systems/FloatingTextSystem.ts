import { Container, Text, TextStyle } from 'pixi.js';
import { ObjectPool } from '@/utils/ObjectPool';

interface Floater {
  text: Text;
  vy: number;
  life: number;
  maxLife: number;
  active: boolean;
}

export class FloatingTextSystem {
  private container: Container;
  private pool: ObjectPool<Floater>;
  private active: Floater[] = [];

  constructor(parent: Container) {
    this.container = new Container();
    parent.addChild(this.container);

    this.pool = new ObjectPool<Floater>(
      () => ({
        text: new Text({ text: '', style: new TextStyle({ fontFamily: 'Orbitron', fontSize: 16, fontWeight: '700' }) }),
        vy: -80,
        life: 0,
        maxLife: 0,
        active: false,
      }),
      (f) => {
        f.active = false;
        f.text.visible = false;
        f.text.alpha = 1;
        f.text.scale.set(1);
      },
      24,
    );
  }

  spawn(x: number, y: number, label: string, color: number, size = 18): void {
    const f = this.pool.acquire();
    f.text.text = label;
    f.text.style.fontSize = size;
    f.text.style.fill = color;
    f.text.x = x;
    f.text.y = y;
    f.text.anchor.set(0.5);
    f.text.visible = true;
    f.text.alpha = 1;
    f.text.scale.set(0.6);
    f.vy = -90;
    f.life = 0.9;
    f.maxLife = 0.9;
    f.active = true;
    if (!f.text.parent) this.container.addChild(f.text);
    this.active.push(f);
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const f = this.active[i];
      f.life -= dt;
      f.text.y += f.vy * dt;
      f.vy *= 0.96;
      const t = 1 - f.life / f.maxLife;
      f.text.alpha = Math.max(0, 1 - t);
      f.text.scale.set(0.6 + t * 0.5);
      if (f.life <= 0) {
        this.container.removeChild(f.text);
        this.active.splice(i, 1);
        this.pool.release(f);
      }
    }
  }

  clear(): void {
    for (const f of this.active) {
      this.container.removeChild(f.text);
      this.pool.release(f);
    }
    this.active = [];
  }
}
