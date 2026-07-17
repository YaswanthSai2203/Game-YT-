import { EventBus } from './EventBus';

export class InputManager {
  private bus: EventBus;
  private keys = new Set<string>();
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;
  private phaseActive = false;
  private enabled = false;
  private sensitivity = 1.0;
  private gamepadIndex: number | null = null;
  private lastLaneInput = 0;
  private readonly LANE_DEBOUNCE = 120;
  private ignoreInputUntil = 0;
  private readonly gameplayKeys = new Set([
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space',
  ]);

  constructor(bus: EventBus) {
    this.bus = bus;
    this.bindEvents();
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
  }

  setSensitivity(value: number): void {
    this.sensitivity = value;
  }

  isPhaseActive(): boolean {
    return this.phaseActive;
  }

  flushAfterPause(): void {
    this.keys.clear();
    this.phaseActive = false;
    this.lastLaneInput = Date.now();
    this.ignoreInputUntil = Date.now() + 280;
  }

  private shouldIgnoreInput(): boolean {
    return Date.now() < this.ignoreInputUntil;
  }

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('keyup', this.onKeyUp, true);
    document.addEventListener('keydown', this.onKeyDown, true);
    document.addEventListener('keyup', this.onKeyUp, true);
    window.addEventListener('touchstart', this.onTouchStart, { passive: true });
    window.addEventListener('touchend', this.onTouchEnd, { passive: true });
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
  }

  update(): void {
    this.pollGamepad();
  }

  private pollGamepad(): void {
    const pads = navigator.getGamepads?.();
    if (!pads) return;

    const pad = this.gamepadIndex !== null ? pads[this.gamepadIndex] : pads[0];
    if (!pad) return;

    const now = Date.now();
    if (now - this.lastLaneInput < this.LANE_DEBOUNCE / this.sensitivity) return;

    if (pad.buttons[14]?.pressed || pad.axes[0] < -0.5) {
      this.emitLane(-1);
      this.lastLaneInput = now;
    } else if (pad.buttons[15]?.pressed || pad.axes[0] > 0.5) {
      this.emitLane(1);
      this.lastLaneInput = now;
    }

    if (pad.buttons[0]?.pressed) {
      this.phaseActive = true;
      this.bus.emit('player:phase', { active: true });
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.enabled) return;
    if (!this.gameplayKeys.has(e.code)) return;

    this.keys.add(e.code);
    e.preventDefault();
    e.stopPropagation();

    const now = Date.now();

    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        if (now - this.lastLaneInput >= this.LANE_DEBOUNCE / this.sensitivity) {
          this.emitLane(-1);
          this.lastLaneInput = now;
        }
        break;
      case 'ArrowRight':
      case 'KeyD':
        if (now - this.lastLaneInput >= this.LANE_DEBOUNCE / this.sensitivity) {
          this.emitLane(1);
          this.lastLaneInput = now;
        }
        break;
      case 'Space':
      case 'KeyW':
      case 'ArrowUp':
        if (!this.phaseActive) {
          this.phaseActive = true;
          this.bus.emit('player:phase', { active: true });
        }
        break;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    if (['Space', 'KeyW', 'ArrowUp'].includes(e.code)) {
      this.phaseActive = false;
      this.bus.emit('player:phase', { active: false });
    }
  };

  private onTouchStart = (e: TouchEvent): void => {
    if (!this.enabled || e.touches.length === 0) return;
    const touch = e.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchStartTime = Date.now();
  };

  private onTouchEnd = (e: TouchEvent): void => {
    if (!this.enabled || e.changedTouches.length === 0 || this.shouldIgnoreInput()) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - this.touchStartX;
    const dy = touch.clientY - this.touchStartY;
    const dt = Date.now() - this.touchStartTime;
    const threshold = 30 * this.sensitivity;

    if (dt < 300 && Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
      const screenThird = window.innerWidth / 3;
      if (touch.clientX < screenThird) {
        this.emitLane(-1);
      } else if (touch.clientX > screenThird * 2) {
        this.emitLane(1);
      } else {
        this.phaseActive = true;
        this.bus.emit('player:phase', { active: true });
        setTimeout(() => {
          this.phaseActive = false;
          this.bus.emit('player:phase', { active: false });
        }, 300);
      }
      return;
    }

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
      this.emitLane(dx > 0 ? 1 : -1);
    }
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (!this.enabled || e.pointerType === 'touch' || this.shouldIgnoreInput()) return;
    if (e.button === 0) {
      const screenThird = window.innerWidth / 3;
      if (e.clientX < screenThird) this.emitLane(-1);
      else if (e.clientX > screenThird * 2) this.emitLane(1);
    }
  };

  private onPointerUp = (): void => {
    // handled by keyboard for phase on desktop
  };

  private emitLane(direction: number): void {
    if (this.shouldIgnoreInput()) return;
    this.bus.emit('player:move', { lane: direction });
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown, true);
    window.removeEventListener('keyup', this.onKeyUp, true);
    document.removeEventListener('keydown', this.onKeyDown, true);
    document.removeEventListener('keyup', this.onKeyUp, true);
    window.removeEventListener('touchstart', this.onTouchStart);
    window.removeEventListener('touchend', this.onTouchEnd);
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
  }
}
