import { Application } from 'pixi.js';
import type { GameConfig, GameMode, RunStats } from '@/types';
import { GAME } from '@/config/constants';
import { EventBus } from '@/core/EventBus';
import { SaveManager } from '@/core/SaveManager';
import { AchievementManager } from '@/core/AchievementManager';
import { AnalyticsManager } from '@/core/AnalyticsManager';
import { InputManager } from '@/core/InputManager';
import { AudioManager } from '@/core/AudioManager';
import { SceneManager } from '@/core/SceneManager';
import { GameScene } from '@/scenes/GameScene';
import { UIManager } from '@/ui/UIManager';
import { clamp } from '@/utils/math';

export class Game {
  private app!: Application;
  private events = new EventBus();
  private save!: SaveManager;
  private achievements!: AchievementManager;
  private analytics!: AnalyticsManager;
  private input!: InputManager;
  private audio!: AudioManager;
  private scenes!: SceneManager;
  private ui!: UIManager;
  private gameScene!: GameScene;

  private currentMode: GameMode = 'endless';
  private isPaused = false;
  private running = false;
  private lastTime = 0;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.ui = new UIManager(
      this.container,
      this.events,
      this.save = new SaveManager(this.events),
      this.achievements = new AchievementManager(this.events, this.save),
      this.audio = new AudioManager(this.save),
    );

    this.ui.showScreen('loading');

    this.app = new Application();
    await this.app.init({
      resizeTo: window,
      backgroundColor: 0x0a0e1a,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
    });

    this.container.insertBefore(this.app.canvas, this.container.firstChild);

    this.analytics = new AnalyticsManager(this.events);
    this.input = new InputManager(this.events);
    this.input.setSensitivity(this.save.settings.controlSensitivity);

    this.scenes = new SceneManager(this.app, this.events);
    this.gameScene = new GameScene(this.events, this.audio, this.save, this.achievements);
    this.gameScene.setOnComplete((stats) => this.handleGameOver(stats));
    this.scenes.register(this.gameScene);

    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onPauseKey);

    this.ui.setCallbacks({
      onStartGame: (mode) => this.startGame(mode),
      onPause: () => this.pauseGame(),
      onResume: () => this.resumeGame(),
      onQuit: () => this.goToMenu(),
      onRetry: () => this.startGame(this.currentMode),
    });

    await this.bootSequence();
  }

  private async bootSequence(): Promise<void> {
    this.audio.init();

    await this.delay(800);
    this.ui.showScreen('splash');
    await this.delay(2000);

    this.goToMenu();
    this.running = true;
    this.lastTime = performance.now();
    this.app.ticker.add(this.gameLoop);
  }

  private gameLoop = (): void => {
    if (!this.running) return;
    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    dt = clamp(dt, 0, GAME.MAX_DELTA);

    this.input.update();

    if (this.scenes.getCurrentId() === 'game' && !this.isPaused) {
      this.scenes.update(dt);
      this.updateHUDFromGame();
    }
  };

  private updateHUDFromGame(): void {
    const combo = this.gameScene.getActivePowerups();
    this.ui.updateHUD({
      score: this.gameScene.getScore(),
      timeAlive: this.gameScene.getTimeAlive(),
      timeLimit: this.gameScene.getTimeLimit(),
      combo: this.gameScene.getComboDisplay(),
      phase: this.gameScene.getPhaseRatio(),
      powerups: combo.map((p) => p.type),
    });
  }

  private startGame(mode: GameMode): void {
    this.audio.resume();
    this.currentMode = mode;
    this.isPaused = false;
    this.input.setEnabled(true);

    const config: GameConfig = { mode };
    if (mode === 'challenge') {
      config.seed = this.save.save.daily.todaySeed;
      config.targetScore = 5000;
    }

    this.ui.showScreen('hud');
    this.scenes.switchTo('game', config);

    // Focus canvas so keyboard works immediately on desktop
    this.app.canvas.setAttribute('tabindex', '0');
    this.app.canvas.style.outline = 'none';
    requestAnimationFrame(() => this.app.canvas.focus());
  }

  private pauseGame(): void {
    this.isPaused = true;
    this.gameScene.setPaused(true);
    this.input.setEnabled(false);
    this.ui.showPause();
  }

  private resumeGame(): void {
    this.isPaused = false;
    this.gameScene.setPaused(false);
    this.input.setEnabled(true);
    requestAnimationFrame(() => this.app.canvas.focus());
  }

  private handleGameOver(stats: RunStats): void {
    this.input.setEnabled(false);
    const { newHighScore, xpGained } = this.save.recordRun(stats);
    this.ui.showScreen('gameover', { ...stats, newHighScore, xpGained });
  }

  private goToMenu(): void {
    this.isPaused = false;
    this.audio.stopMusic();
    this.input.setEnabled(false);

    if (this.scenes.getCurrentId() === 'game') {
      this.gameScene.exit();
      this.gameScene.getContainer().visible = false;
    }

    this.ui.showScreen('menu');
  }

  private onResize = (): void => {
    this.app.renderer.resize(window.innerWidth, window.innerHeight);
  };

  private onPauseKey = (e: KeyboardEvent): void => {
    if (e.code === 'Escape' && this.scenes.getCurrentId() === 'game' && !this.gameScene.isGameOver()) {
      if (this.isPaused) this.resumeGame();
      else this.pauseGame();
    }
  };

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  destroy(): void {
    this.running = false;
    this.app.ticker.remove(this.gameLoop);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onPauseKey);
    this.input.destroy();
    this.audio.destroy();
    this.analytics.destroy();
    this.scenes.destroy();
    this.ui.destroy();
    this.app.destroy(true);
  }
}
