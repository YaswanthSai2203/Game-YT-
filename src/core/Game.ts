import { Application } from 'pixi.js';
import type { GameConfig, GameMode, RunStats } from '@/types';
import { GAME, WEEKLY } from '@/config/constants';
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
import { FAKE_ENDING_SCORE } from '@/config/sentientConfig';
import { GlobalLeaderboardService } from '@/core/GlobalLeaderboardService';

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
  private globalLb = new GlobalLeaderboardService();

  private currentMode: GameMode = 'endless';
  private isPaused = false;
  private manualPauseActive = false;
  private autoPausedForBackground = false;
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
      this.globalLb,
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
    this.gameScene.setOnComplete((stats, syncCompleted) => this.handleGameOver(stats, syncCompleted));
    this.scenes.register(this.gameScene);

    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onPauseKey);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pagehide', this.onPageHide);
    window.addEventListener('pageshow', this.onPageShow);

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
      scoreBoostRatio: this.gameScene.getScoreBoostRatio(),
      scoreBoostActive: this.gameScene.hasScoreBoost(),
    });
  }

  private startGame(mode: GameMode): void {
    void this.startGameWithCountdown(mode);
  }

  private async startGameWithCountdown(mode: GameMode): Promise<void> {
    if (mode === 'practice') {
      this.save.markPracticeCalloutSeen();
    }
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
    if (mode === 'weekly') {
      config.seed = this.save.save.weekly.seed;
      config.targetScore = WEEKLY.TARGET_SCORE;
    }

    this.gameScene.setCountdownActive(true);
    this.ui.showScreen('hud');
    this.scenes.switchTo('game', config);

    if (!this.save.save.tutorialCompleted) {
      this.gameScene.setTutorialBlocking(true);
      await this.ui.waitForTutorialDismiss();
      this.gameScene.setTutorialBlocking(false);
    }

    this.app.canvas.setAttribute('tabindex', '0');
    this.app.canvas.style.outline = 'none';
    requestAnimationFrame(() => this.app.canvas.focus());

    this.input.setEnabled(false);
    await this.ui.runCountdown();
    this.gameScene.setCountdownActive(false);
    this.input.flushAfterPause();
    this.input.setEnabled(true);
    requestAnimationFrame(() => this.app.canvas.focus());
  }

  private pauseCore(): void {
    this.isPaused = true;
    this.gameScene.setPaused(true);
    this.input.setEnabled(false);
    this.audio.setPaused(true);
  }

  private pauseGame(): void {
    if (this.isPaused || this.scenes.getCurrentId() !== 'game') return;
    this.manualPauseActive = true;
    this.autoPausedForBackground = false;
    this.pauseCore();
    this.ui.showPause();
  }

  private resumeGame(): void {
    this.isPaused = false;
    this.manualPauseActive = false;
    this.autoPausedForBackground = false;
    this.gameScene.setPaused(false);
    this.input.flushAfterPause();
    this.input.setEnabled(true);
    this.audio.setPaused(false);
    this.ui.dismissPauseModal();
    requestAnimationFrame(() => this.app.canvas.focus());
  }

  private handleGameOver(stats: RunStats, syncCompleted = false): void {
    this.input.setEnabled(false);
    this.setCanvasVisible(false);
    const { newHighScore, xpGained, creditsEarned, syncUnlocks, signalFragments } = this.save.recordRun(stats);
    if (stats.shards > 0) this.ui.contributeToMilestone(stats.shards);
    const mem = this.save.save.worldMemory;

    const showOver = (globalRank?: number, globalTotal?: number): void => {
      this.ui.showScreen('gameover', {
        ...stats,
        newHighScore,
        xpGained,
        creditsEarned,
        syncUnlocks,
        signalFragments,
        globalRank,
        globalTotal,
        creditsToNext: this.upgrades.getCreditsToNextUpgrade(),
      });
    };

    if (syncCompleted) {
      void this.ui.playGridSyncComplete().then(() => this.goToMenu());
      return;
    }

    const afterGlobal = (globalRank?: number, globalTotal?: number): void => {
      if (stats.score >= FAKE_ENDING_SCORE && !mem.fakeEndingSeen) {
        void this.ui.playFakeEnding(stats.score).then(() => {
          this.save.markFakeEndingSeen();
          showOver(globalRank, globalTotal);
        });
      } else {
        showOver(globalRank, globalTotal);
      }
    };

    if (stats.mode !== 'practice' && this.globalLb.isEnabled()) {
      void this.globalLb.submit(stats.mode, stats.score, mem.playerTitle || 'Pilot').then((result) => {
        afterGlobal(result.rank, result.totalPlayers);
      }).catch(() => afterGlobal());
    } else {
      afterGlobal();
    }
  }

  private goToMenu(): void {
    if (this.scenes.getCurrentId() === 'game' && !this.gameScene.isGameOver()) {
      this.gameScene.abandonRunEarly();
    }
    this.isPaused = false;
    this.manualPauseActive = false;
    this.autoPausedForBackground = false;
    this.ui.dismissPauseModal();
    this.audio.stopMusic();
    this.input.setEnabled(false);
    this.setCanvasVisible(false);
    this.scenes.leaveCurrent();
    this.ui.showScreen('menu');
    this.ui.showDailyBonusIfAvailable();
  }

  private setCanvasVisible(visible: boolean): void {
    this.app.canvas.style.visibility = visible ? 'visible' : 'hidden';
    // Input is handled on window — canvas must never steal menu/HUD clicks.
    this.app.canvas.style.pointerEvents = 'none';
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
      if (this.isPaused && this.manualPauseActive) this.resumeGame();
      else if (!this.isPaused) this.pauseGame();
    }
  };

  private isRunEligibleForBackgroundPause(): boolean {
    return this.scenes.getCurrentId() === 'game' && !this.gameScene.isGameOver();
  }

  private onVisibilityChange = (): void => {
    this.syncBackgroundPauseState();
  };

  private onPageHide = (): void => {
    this.syncBackgroundPauseState();
  };

  private onPageShow = (): void => {
    this.syncBackgroundPauseState();
  };

  private syncBackgroundPauseState(): void {
    const hidden = document.visibilityState === 'hidden' || document.hidden;

    if (hidden) {
      if (!this.isRunEligibleForBackgroundPause() || this.isPaused) return;
      this.autoPausedForBackground = true;
      this.manualPauseActive = false;
      this.pauseCore();
      return;
    }

    if (!this.autoPausedForBackground) return;
    if (!this.isRunEligibleForBackgroundPause()) {
      this.autoPausedForBackground = false;
      return;
    }
    if (!this.isPaused) {
      this.autoPausedForBackground = false;
      return;
    }
    this.ui.showBackgroundReturnModal();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  destroy(): void {
    this.running = false;
    this.app.ticker.remove(this.gameLoop);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onPauseKey);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('pageshow', this.onPageShow);
    this.input.destroy();
    this.audio.destroy();
    this.analytics.destroy();
    this.scenes.destroy();
    this.ui.destroy();
    this.app.destroy(true);
  }
}
