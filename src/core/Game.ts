import { Application } from 'pixi.js';
import type { GameConfig, GameMode, RunStats } from '@/types';
import { GAME } from '@/config/constants';
import { EventBus } from '@/core/EventBus';
import { SaveManager } from '@/core/SaveManager';
import { AchievementManager } from '@/core/AchievementManager';
import { UpgradeManager } from '@/core/UpgradeManager';
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
  private upgrades!: UpgradeManager;
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
    this.save = new SaveManager(this.events);
    this.upgrades = new UpgradeManager(this.save, this.events);

    this.ui = new UIManager(
      this.container,
      this.events,
      this.save,
      this.achievements = new AchievementManager(this.events, this.save),
      this.upgrades,
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
    this.gameScene = new GameScene(this.events, this.audio, this.save, this.achievements, this.upgrades);
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
    this.setCanvasVisible(false);

    await this.delay(400);
    this.ui.showScreen('splash');

    await Promise.race([
      this.delay(1200),
      this.waitForSplashSkip(),
    ]);

    this.goToMenu();
    this.running = true;
    this.lastTime = performance.now();
    this.app.ticker.add(this.gameLoop);
  }

  private waitForSplashSkip(): Promise<void> {
    return new Promise((resolve) => {
      const skip = (): void => {
        window.removeEventListener('keydown', skip);
        this.container.removeEventListener('click', skip);
        resolve();
      };
      window.addEventListener('keydown', skip, { once: true });
      this.container.addEventListener('click', skip, { once: true });
    });
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
    this.ui.updateHUD({
      score: this.gameScene.getScore(),
      timeAlive: this.gameScene.getTimeAlive(),
      timeLimit: this.gameScene.getTimeLimit(),
      combo: this.gameScene.getComboDisplay(),
      comboTimer: this.gameScene.getComboTimerRatio(),
      comboCount: this.gameScene.getComboCount(),
      phase: this.gameScene.getPhaseRatio(),
      powerups: this.gameScene.getPowerupTimers(),
      speed: this.gameScene.getSpeedMultiplier(),
      speedRatio: this.gameScene.getSpeedRatio(),
      targetScore: this.gameScene.getTargetScore(),
    });
  }

  private startGame(mode: GameMode): void {
    void this.startGameWithCountdown(mode);
  }

  private async startGameWithCountdown(mode: GameMode): Promise<void> {
    this.audio.resume();
    this.currentMode = mode;
    this.isPaused = false;
    this.input.setEnabled(false);
    this.setCanvasVisible(true);

    const config: GameConfig = { mode };
    if (mode === 'challenge') {
      config.seed = this.save.save.daily.todaySeed;
      config.targetScore = 5000;
    }

    this.ui.showScreen('hud');
    this.scenes.switchTo('game', config);

    this.app.canvas.setAttribute('tabindex', '0');
    this.app.canvas.style.outline = 'none';
    requestAnimationFrame(() => this.app.canvas.focus());

    this.input.setEnabled(false);
    this.gameScene.setCountdownActive(true);
    await this.ui.runCountdown();
    this.gameScene.setCountdownActive(false);
    this.input.setEnabled(true);
    requestAnimationFrame(() => this.app.canvas.focus());
  }

  private pauseGame(): void {
    this.isPaused = true;
    this.gameScene.setPaused(true);
    this.input.setEnabled(false);
    this.audio.setPaused(true);
    this.ui.showPause();
  }

  private resumeGame(): void {
    this.isPaused = false;
    this.gameScene.setPaused(false);
    this.input.setEnabled(true);
    this.audio.setPaused(false);
    requestAnimationFrame(() => this.app.canvas.focus());
  }

  private handleGameOver(stats: RunStats): void {
    this.input.setEnabled(false);
    this.setCanvasVisible(false);
    const { newHighScore, xpGained, creditsEarned, syncUnlocks } = this.save.recordRun(stats);
    this.ui.showScreen('gameover', { ...stats, newHighScore, xpGained, creditsEarned, syncUnlocks });
  }

  private goToMenu(): void {
    this.isPaused = false;
    this.audio.stopMusic();
    this.input.setEnabled(false);
    this.setCanvasVisible(false);
    this.scenes.leaveCurrent();
    this.ui.showScreen('menu');
    this.ui.showDailyBonusIfAvailable();
  }

  private setCanvasVisible(visible: boolean): void {
    this.app.canvas.style.visibility = visible ? 'visible' : 'hidden';
    this.gameScene.getContainer().visible = visible;
  }

  private onResize = (): void => {
    this.app.renderer.resize(window.innerWidth, window.innerHeight);
    if (this.scenes.getCurrentId() === 'game') {
      this.gameScene.onResize();
    }
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
