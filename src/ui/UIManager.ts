import type { GameMode, GameSettings, RunStats } from '@/types';
import { getColorBlindPalette } from '@/config/designTokens';
import { MODE_CONFIG, SYNC, GAME } from '@/config/constants';
import { formatScore, formatTime } from '@/utils/math';
import { SaveManager } from '@/core/SaveManager';
import { AchievementManager } from '@/core/AchievementManager';
import { UpgradeManager } from '@/core/UpgradeManager';
import { EventBus } from '@/core/EventBus';
import { AudioManager } from '@/core/AudioManager';
import type { UpgradeId } from '@/types';
import { UPGRADES } from '@/config/constants';

type ScreenId = 'loading' | 'splash' | 'menu' | 'hud' | 'pause' | 'gameover' | 'settings' | 'achievements' | 'leaderboard' | 'daily' | 'upgrades' | 'toast';

export class UIManager {
  private root: HTMLElement;
  private overlay: HTMLElement;
  private events: EventBus;
  private save: SaveManager;
  private achievements: AchievementManager;
  private upgrades: UpgradeManager;
  private audio: AudioManager;
  private callbacks: {
    onStartGame?: (mode: GameMode) => void;
    onResume?: () => void;
    onPause?: () => void;
    onQuit?: () => void;
    onRetry?: () => void;
    onMenuReady?: () => void;
  } = {};

  constructor(
    container: HTMLElement,
    events: EventBus,
    save: SaveManager,
    achievements: AchievementManager,
    upgrades: UpgradeManager,
    audio: AudioManager,
  ) {
    this.root = container;
    this.events = events;
    this.save = save;
    this.achievements = achievements;
    this.upgrades = upgrades;
    this.audio = audio;

    this.overlay = document.createElement('div');
    this.overlay.id = 'ui-overlay';
    this.root.appendChild(this.overlay);
    this.applyTheme();
    this.injectStyles();

    this.events.on('achievement:unlock', (d) => {
      this.showToast(`🏆 ${d.title}`, 'achievement');
      this.audio.playAchievement();
    });

    this.events.on('ui:toast', (d) => this.showToast(d.message, d.type ?? 'info'));
    this.events.on('ui:tutorial', (d) => {
      if (d.step < 0) this.hideTutorial();
      else this.showTutorial();
    });

    this.events.on('settings:change', () => this.applyTheme());
  }

  setCallbacks(cb: typeof this.callbacks): void {
    this.callbacks = cb;
  }

  private applyTheme(): void {
    const s = this.save.settings;
    const palette = getColorBlindPalette(s.colorBlindMode);
    const root = document.documentElement;
    Object.entries(palette).forEach(([k, v]) => {
      root.style.setProperty(`--color-${k}`, v);
    });
    root.style.setProperty('--font-scale', String(s.fontScale));
    root.style.setProperty('--reduced-motion', s.reducedMotion ? '1' : '0');
    document.body.classList.toggle('light-theme', s.theme === 'light');
    document.body.classList.toggle('high-contrast', s.highContrast);
  }

  showScreen(id: ScreenId, data?: unknown): void {
    switch (id) {
      case 'loading': this.renderLoading(); break;
      case 'splash': this.renderSplash(); break;
      case 'menu': this.renderMenu(); break;
      case 'hud': this.renderHUD(); break;
      case 'pause': this.showPause(); break;
      case 'gameover': this.renderGameOver(data as RunStats & { newHighScore?: boolean; xpGained?: number }); break;
      case 'settings': this.renderSettings(); break;
      case 'achievements': this.renderAchievements(); break;
      case 'leaderboard': this.renderLeaderboard(); break;
      case 'daily': this.renderDaily(); break;
      case 'upgrades': this.renderUpgrades(); break;
    }
  }

  /** Show daily bonus popup if unclaimed; call after menu renders */
  showDailyBonusIfAvailable(): void {
    if (!this.save.canClaimDailyBonus()) return;
    const streak = this.save.save.daily.streak;
    const bonusPreview = 25 + Math.min(streak, 7) * 10;
    const modal = document.createElement('div');
    modal.className = 'screen modal-overlay daily-bonus-modal';
    modal.innerHTML = `
      <div class="modal panel animate-in">
        <h2 class="modal-title">DAILY SYNC BONUS</h2>
        <p class="daily-bonus-amount">+${bonusPreview} DATA CREDITS</p>
        <p class="daily-bonus-streak">🔥 ${Math.max(streak, 1)} day streak</p>
        <button class="btn btn-primary" data-action="claim">CLAIM</button>
      </div>
    `;
    this.root.appendChild(modal);
    modal.querySelector('[data-action="claim"]')?.addEventListener('click', () => {
      this.audio.playMenuConfirm();
      const bonus = this.save.claimDailyBonus();
      this.showToast(`+${bonus} Data Credits claimed!`, 'achievement');
      modal.remove();
      this.showScreen('menu');
    });
  }

  updateHUD(stats: { score: number; timeAlive: number; timeLimit: number; combo: string; phase: number; powerups: string[] }): void {
    const scoreEl = this.overlay.querySelector('#hud-score');
    const timeEl = this.overlay.querySelector('#hud-time');
    const comboEl = this.overlay.querySelector('#hud-combo');
    const phaseEl = this.overlay.querySelector('#hud-phase-fill') as HTMLElement;
    const powerupsEl = this.overlay.querySelector('#hud-powerups');

    if (scoreEl) scoreEl.textContent = formatScore(stats.score);
    if (timeEl) {
      if (stats.timeLimit > 0) {
        const remaining = Math.max(0, stats.timeLimit - stats.timeAlive);
        timeEl.textContent = formatTime(remaining);
      } else {
        timeEl.textContent = formatTime(stats.timeAlive);
      }
    }
    if (comboEl) comboEl.textContent = stats.combo;
    if (phaseEl) phaseEl.style.width = `${stats.phase * 100}%`;
    if (powerupsEl) {
      powerupsEl.innerHTML = stats.powerups.map((p) =>
        `<span class="powerup-badge" aria-label="${p} powerup active">${p[0].toUpperCase()}</span>`,
      ).join('');
    }
  }

  hideOverlay(): void {
    this.overlay.innerHTML = '';
    this.overlay.className = '';
  }

  private showToast(message: string, type = 'info'): void {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'alert');
    this.root.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  private renderLoading(): void {
    this.overlay.className = 'screen screen-loading';
    this.overlay.innerHTML = `
      <div class="loading-content">
        <div class="loading-logo">${GAME.TITLE}</div>
        <div class="loading-bar"><div class="loading-bar-fill"></div></div>
        <p class="loading-text">Initializing quantum core...</p>
      </div>
    `;
  }

  private renderSplash(): void {
    this.overlay.className = 'screen screen-splash';
    this.overlay.innerHTML = `
      <div class="splash-content animate-in">
        <div class="splash-glow"></div>
        <h1 class="splash-title">${GAME.TITLE}</h1>
        <p class="splash-subtitle">${GAME.SUBTITLE}</p>
        <div class="splash-pulse"></div>
      </div>
    `;
  }

  private renderMenu(): void {
    const save = this.save.save;
    const xpNext = SYNC.XP_PER_LEVEL[save.profile.syncLevel] ?? 99999;
    const xpPrev = SYNC.XP_PER_LEVEL[save.profile.syncLevel - 1] ?? 0;
    const xpProgress = ((save.profile.syncXP - xpPrev) / (xpNext - xpPrev)) * 100;

    this.overlay.className = 'screen screen-menu';
    this.overlay.innerHTML = `
      <div class="menu-content animate-in">
        <header class="menu-header">
          <h1 class="menu-title">${GAME.TITLE}</h1>
          <p class="menu-subtitle">${GAME.SUBTITLE}</p>
        </header>

        <div class="mode-grid">
          ${(['endless', 'timeAttack60', 'timeAttack120', 'challenge', 'practice'] as GameMode[]).map((mode) => {
            const conf = MODE_CONFIG[mode];
            const best = mode === 'timeAttack60' ? save.highScores.timeAttack60
              : mode === 'timeAttack120' ? save.highScores.timeAttack120
              : mode === 'challenge' ? save.highScores.challenge
              : save.highScores.endless;
            return `
              <button class="mode-card" data-mode="${mode}" aria-label="Start ${conf.label} mode">
                <span class="mode-label">${conf.label}</span>
                <span class="mode-desc">${conf.description}</span>
                ${best > 0 ? `<span class="mode-best">BEST: ${formatScore(best)}</span>` : ''}
              </button>
            `;
          }).join('')}
        </div>

        <nav class="menu-nav">
          <button class="btn btn-secondary" data-action="upgrades" aria-label="Upgrades">⚡ Upgrades <span class="credits-badge">${save.dataCredits}◈</span></button>
          <button class="btn btn-secondary" data-action="daily" aria-label="Daily Challenge">📅 Daily</button>
          <button class="btn btn-secondary" data-action="achievements" aria-label="Achievements">🏆 Achievements</button>
          <button class="btn btn-secondary" data-action="leaderboard" aria-label="Leaderboard">📊 Ranks</button>
          <button class="btn btn-secondary" data-action="settings" aria-label="Settings">⚙️ Settings</button>
        </nav>

        <div class="sync-bar">
          <span class="sync-label">SYNC Lv.${save.profile.syncLevel}</span>
          <div class="progress-bar"><div class="progress-fill" style="width:${xpProgress}%"></div></div>
          <span class="sync-xp">${save.profile.syncXP} XP</span>
        </div>
      </div>
    `;

    this.bindMenuEvents();
  }

  private bindMenuEvents(): void {
    this.overlay.querySelectorAll('.mode-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.audio.playMenuConfirm();
        const mode = (btn as HTMLElement).dataset.mode as GameMode;
        this.callbacks.onStartGame?.(mode);
      });
      btn.addEventListener('mouseenter', () => this.audio.playMenuHover());
    });

    this.overlay.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.audio.playMenuConfirm();
        const action = (btn as HTMLElement).dataset.action;
        if (action === 'settings') this.showScreen('settings');
        else if (action === 'achievements') this.showScreen('achievements');
        else if (action === 'leaderboard') this.showScreen('leaderboard');
        else if (action === 'daily') this.showScreen('daily');
        else if (action === 'upgrades') this.showScreen('upgrades');
      });
      btn.addEventListener('mouseenter', () => this.audio.playMenuHover());
    });
  }

  private renderHUD(): void {
    this.overlay.className = 'screen screen-hud';
    this.overlay.innerHTML = `
      <div class="hud-top">
        <div class="hud-score-group">
          <span class="hud-label">SCORE</span>
          <span id="hud-score" class="hud-score" aria-live="polite">0</span>
        </div>
        <div class="hud-time-group">
          <span id="hud-time" class="hud-time">0:00</span>
        </div>
        <button id="hud-pause" class="hud-pause btn-icon" aria-label="Pause game">⏸</button>
      </div>
      <div class="hud-bottom">
        <span id="hud-combo" class="hud-combo" aria-live="polite"></span>
        <div class="hud-phase">
          <span class="hud-label-sm">PHASE</span>
          <div class="phase-bar"><div id="hud-phase-fill" class="phase-fill"></div></div>
        </div>
        <div id="hud-powerups" class="hud-powerups"></div>
      </div>
      <div class="hud-hint">◄ A / ← · D / → ► · SPACE / W = PHASE · ESC = PAUSE</div>
      <div id="tutorial-overlay" class="tutorial-overlay hidden" aria-live="polite">
        <div class="tutorial-panel">
          <h3>FIRST SYNC</h3>
          <p>◄ ► Move between lanes to collect cyan shards</p>
          <p>Avoid red firewalls — they destroy your core</p>
          <p>SPACE / W = Phase shift through one firewall</p>
          <p class="tutorial-dismiss">Move once to begin</p>
        </div>
      </div>
    `;

    this.overlay.querySelector('#hud-pause')?.addEventListener('click', () => {
      this.audio.playMenuConfirm();
      this.callbacks.onPause?.();
    });

    if (!this.save.save.tutorialCompleted) {
      this.showTutorial();
    }
  }

  private showTutorial(): void {
    const el = this.overlay.querySelector('#tutorial-overlay');
    el?.classList.remove('hidden');
  }

  private hideTutorial(): void {
    const el = this.overlay.querySelector('#tutorial-overlay');
    el?.classList.add('hidden');
  }

  private renderUpgrades(): void {
    const credits = this.upgrades.getCredits();
    const ids = Object.keys(UPGRADES) as UpgradeId[];

    this.overlay.className = 'screen screen-upgrades modal-overlay';
    this.overlay.innerHTML = `
      <div class="modal panel panel-scroll animate-in">
        <h2 class="modal-title">UPGRADES</h2>
        <p class="upgrade-credits">◈ ${credits} Data Credits</p>
        <p class="upgrade-hint">Earn credits by collecting shards each run</p>
        <div class="upgrade-list">
          ${ids.map((id) => {
            const def = UPGRADES[id];
            const level = this.upgrades.getLevel(id);
            const maxed = this.upgrades.isMaxed(id);
            const cost = this.upgrades.getCost(id);
            const canBuy = this.upgrades.canAfford(id);
            return `
              <div class="upgrade-item ${maxed ? 'maxed' : ''}">
                <span class="upgrade-icon">${def.icon}</span>
                <div class="upgrade-info">
                  <span class="upgrade-name">${def.name} ${maxed ? '(MAX)' : `Lv.${level}/${def.maxLevel}`}</span>
                  <span class="upgrade-desc">${def.description}</span>
                </div>
                <button class="btn btn-primary btn-sm" data-upgrade="${id}" ${!canBuy ? 'disabled' : ''} aria-label="Buy ${def.name}">
                  ${maxed ? '✓' : `${cost}◈`}
                </button>
              </div>
            `;
          }).join('')}
        </div>
        <button class="btn btn-secondary" data-action="back">← BACK</button>
      </div>
    `;

    this.overlay.querySelectorAll('[data-upgrade]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.upgrade as UpgradeId;
        if (this.upgrades.purchase(id)) {
          this.audio.playMenuConfirm();
          this.showToast(`${UPGRADES[id].name} upgraded!`, 'achievement');
          this.renderUpgrades();
        }
      });
    });

    this.overlay.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      this.audio.playMenuConfirm();
      this.showScreen('menu');
    });
  }

  showPause(): void {
    const pauseEl = document.createElement('div');
    pauseEl.className = 'screen screen-pause modal-overlay';
    pauseEl.innerHTML = `
      <div class="modal panel animate-in">
        <h2 class="modal-title">PAUSED</h2>
        <div class="modal-actions">
          <button class="btn btn-primary" data-action="resume">▶ RESUME</button>
          <button class="btn btn-secondary" data-action="quit">✕ QUIT</button>
        </div>
      </div>
    `;
    this.overlay.appendChild(pauseEl);

    pauseEl.querySelector('[data-action="resume"]')?.addEventListener('click', () => {
      this.audio.playMenuConfirm();
      pauseEl.remove();
      this.callbacks.onResume?.();
    });
    pauseEl.querySelector('[data-action="quit"]')?.addEventListener('click', () => {
      this.audio.playMenuConfirm();
      this.callbacks.onQuit?.();
    });
  }

  private renderGameOver(data: RunStats & { newHighScore?: boolean; xpGained?: number; creditsEarned?: number }): void {
    const rank = data.rankPercentile ?? 0;
    const rankMsg = rank >= 90 ? 'ELITE PILOT' : rank >= 70 ? 'SKILLED RUNNER' : rank >= 40 ? 'RISING SYNC' : 'KEEP TRAINING';
    this.overlay.className = 'screen screen-gameover modal-overlay';
    this.overlay.innerHTML = `
      <div class="modal panel animate-in gameover-panel">
        <h2 class="modal-title">${data.score > 0 ? 'RUN COMPLETE' : 'SYSTEM FAILURE'}</h2>
        ${data.newHighScore ? '<div class="new-high-score">★ NEW HIGH SCORE ★</div>' : ''}
        <div class="rank-badge">TOP ${rank}% · ${rankMsg}</div>
        <div class="stats-grid">
          <div class="stat-item"><span class="stat-label">SCORE</span><span class="stat-value">${formatScore(data.score)}</span></div>
          <div class="stat-item"><span class="stat-label">SHARDS</span><span class="stat-value">${data.shards}</span></div>
          <div class="stat-item"><span class="stat-label">MAX COMBO</span><span class="stat-value">×${(1 + (data.maxCombo - 1) * 0.5).toFixed(1)}</span></div>
          <div class="stat-item"><span class="stat-label">NEAR MISSES</span><span class="stat-value">${data.nearMisses ?? 0}</span></div>
          <div class="stat-item"><span class="stat-label">TIME</span><span class="stat-value">${formatTime(data.timeAlive)}</span></div>
          <div class="stat-item"><span class="stat-label">CREDITS</span><span class="stat-value">+${data.creditsEarned ?? 0}◈</span></div>
          <div class="stat-item"><span class="stat-label">XP</span><span class="stat-value">+${data.xpGained ?? 0}</span></div>
          <div class="stat-item"><span class="stat-label">DISTANCE</span><span class="stat-value">${Math.floor(data.distance)}m</span></div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" data-action="retry">↻ RETRY</button>
          <button class="btn btn-secondary" data-action="menu">⌂ MENU</button>
          <button class="btn btn-ghost" data-action="share">↗ SHARE</button>
        </div>
      </div>
    `;

    this.overlay.querySelector('[data-action="retry"]')?.addEventListener('click', () => {
      this.audio.playMenuConfirm();
      this.callbacks.onRetry?.();
    });
    this.overlay.querySelector('[data-action="menu"]')?.addEventListener('click', () => {
      this.audio.playMenuConfirm();
      this.callbacks.onQuit?.();
    });
    this.overlay.querySelector('[data-action="share"]')?.addEventListener('click', () => {
      const text = `I scored ${formatScore(data.score)} in NEON PULSE! Can you beat me?`;
      if (navigator.share) {
        navigator.share({ title: 'NEON PULSE', text }).catch(() => {});
      } else {
        navigator.clipboard?.writeText(text);
        this.showToast('Score copied to clipboard!');
      }
    });
  }

  private renderSettings(): void {
    const s = this.save.settings;
    this.overlay.className = 'screen screen-settings modal-overlay';
    this.overlay.innerHTML = `
      <div class="modal panel panel-scroll animate-in">
        <h2 class="modal-title">SETTINGS</h2>
        <div class="settings-group">
          ${this.sliderRow('Master Volume', 'masterVolume', s.masterVolume)}
          ${this.sliderRow('SFX Volume', 'sfxVolume', s.sfxVolume)}
          ${this.sliderRow('Music Volume', 'musicVolume', s.musicVolume)}
          ${this.sliderRow('Font Scale', 'fontScale', s.fontScale, 0.8, 1.5, 0.1)}
          ${this.sliderRow('Control Sensitivity', 'controlSensitivity', s.controlSensitivity, 0.5, 2, 0.1)}
          ${this.toggleRow('Reduced Motion', 'reducedMotion', s.reducedMotion)}
          ${this.toggleRow('High Contrast', 'highContrast', s.highContrast)}
          ${this.selectRow('Color Blind Mode', 'colorBlindMode', s.colorBlindMode, [
            ['none', 'None'], ['deuteranopia', 'Deuteranopia'], ['protanopia', 'Protanopia'], ['tritanopia', 'Tritanopia'],
          ])}
          ${this.selectRow('Theme', 'theme', s.theme, [['dark', 'Dark'], ['light', 'Light']])}
        </div>
        <button class="btn btn-primary" data-action="back">← BACK</button>
      </div>
    `;

    this.bindSettingsEvents();
  }

  private sliderRow(label: string, key: string, value: number, min = 0, max = 1, step = 0.05): string {
    return `
      <label class="setting-row">
        <span>${label}</span>
        <input type="range" data-setting="${key}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}" />
        <span class="setting-value" data-value-for="${key}">${value.toFixed(1)}</span>
      </label>
    `;
  }

  private toggleRow(label: string, key: string, value: boolean): string {
    return `
      <label class="setting-row toggle-row">
        <span>${label}</span>
        <input type="checkbox" data-setting="${key}" ${value ? 'checked' : ''} aria-label="${label}" />
      </label>
    `;
  }

  private selectRow(label: string, key: string, value: string, options: string[][]): string {
    return `
      <label class="setting-row">
        <span>${label}</span>
        <select data-setting="${key}" aria-label="${label}">
          ${options.map(([v, l]) => `<option value="${v}" ${v === value ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </label>
    `;
  }

  private bindSettingsEvents(): void {
    this.overlay.querySelectorAll('[data-setting]').forEach((el) => {
      el.addEventListener('input', () => {
        const key = (el as HTMLElement).dataset.setting!;
        let value: string | number | boolean;
        if (el instanceof HTMLInputElement && el.type === 'checkbox') {
          value = el.checked;
        } else if (el instanceof HTMLInputElement && el.type === 'range') {
          value = parseFloat(el.value);
          const valEl = this.overlay.querySelector(`[data-value-for="${key}"]`);
          if (valEl) valEl.textContent = value.toFixed(1);
        } else {
          value = (el as HTMLSelectElement).value;
        }
        this.save.updateSettings({ [key]: value } as Partial<GameSettings>);
        this.audio.refresh();
      });
    });

    this.overlay.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      this.audio.playMenuConfirm();
      this.showScreen('menu');
    });
  }

  private renderAchievements(): void {
    const all = this.achievements.getAll();
    const progress = this.achievements.getProgress();

    this.overlay.className = 'screen screen-achievements modal-overlay';
    this.overlay.innerHTML = `
      <div class="modal panel panel-scroll animate-in">
        <h2 class="modal-title">ACHIEVEMENTS</h2>
        <p class="ach-progress">${progress.unlocked} / ${progress.total} unlocked</p>
        <div class="ach-list">
          ${all.map((a) => {
            const unlocked = this.achievements.isUnlocked(a.id);
            const hidden = a.secret && !unlocked;
            return `
              <div class="ach-item ${unlocked ? 'unlocked' : 'locked'}" aria-label="${hidden ? 'Secret achievement' : a.title}">
                <span class="ach-icon">${hidden ? '❓' : a.icon}</span>
                <div class="ach-info">
                  <span class="ach-title">${hidden ? '???' : a.title}</span>
                  <span class="ach-desc">${hidden ? 'Hidden achievement' : a.description}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <button class="btn btn-primary" data-action="back">← BACK</button>
      </div>
    `;

    this.overlay.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      this.audio.playMenuConfirm();
      this.showScreen('menu');
    });
  }

  private renderLeaderboard(): void {
    const save = this.save.save;
    this.overlay.className = 'screen screen-leaderboard modal-overlay';
    this.overlay.innerHTML = `
      <div class="modal panel panel-scroll animate-in">
        <h2 class="modal-title">LEADERBOARD</h2>
        ${(['endless', 'timeAttack60', 'timeAttack120', 'challenge'] as const).map((mode) => {
          const entries = save.leaderboard[mode] ?? [];
          const label = MODE_CONFIG[mode === 'timeAttack60' ? 'timeAttack60' : mode === 'timeAttack120' ? 'timeAttack120' : mode].label;
          return `
            <div class="lb-section">
              <h3 class="lb-mode">${label}</h3>
              ${entries.length === 0 ? '<p class="lb-empty">No entries yet</p>' : `
                <ol class="lb-list">
                  ${entries.map((e, i) => `
                    <li class="lb-entry">
                      <span class="lb-rank">#${i + 1}</span>
                      <span class="lb-score">${formatScore(e.score)}</span>
                      <span class="lb-date">${new Date(e.date).toLocaleDateString()}</span>
                    </li>
                  `).join('')}
                </ol>
              `}
            </div>
          `;
        }).join('')}
        <button class="btn btn-primary" data-action="back">← BACK</button>
      </div>
    `;

    this.overlay.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      this.audio.playMenuConfirm();
      this.showScreen('menu');
    });
  }

  private renderDaily(): void {
    const daily = this.save.save.daily;
    this.overlay.className = 'screen screen-daily modal-overlay';
    this.overlay.innerHTML = `
      <div class="modal panel animate-in">
        <h2 class="modal-title">DAILY CHALLENGE</h2>
        <div class="daily-info">
          <p>🔥 Streak: <strong>${daily.streak} days</strong></p>
          <p>🎯 Target Score: <strong>5,000</strong></p>
          <p>⭐ Today Best: <strong>${formatScore(daily.todayBest)}</strong></p>
          ${daily.completedToday ? '<p class="daily-complete">✅ Completed today!</p>' : ''}
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" data-action="start-daily">▶ START CHALLENGE</button>
          <button class="btn btn-secondary" data-action="back">← BACK</button>
        </div>
      </div>
    `;

    this.overlay.querySelector('[data-action="start-daily"]')?.addEventListener('click', () => {
      this.audio.playMenuConfirm();
      this.callbacks.onStartGame?.('challenge');
    });
    this.overlay.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      this.audio.playMenuConfirm();
      this.showScreen('menu');
    });
  }

  private injectStyles(): void {
    if (document.getElementById('neon-pulse-styles')) return;
    const style = document.createElement('style');
    style.id = 'neon-pulse-styles';
    style.textContent = `
      :root {
        --color-void: #0a0e1a;
        --color-voidLight: #121829;
        --color-neonCyan: #00f0ff;
        --color-neonMagenta: #ff006e;
        --color-neonViolet: #8b5cf6;
        --color-neonGold: #ffd700;
        --color-neonGreen: #00ff88;
        --color-textPrimary: #e8edf5;
        --color-textSecondary: #8892a8;
        --font-scale: 1;
        --reduced-motion: 0;
      }

      #ui-overlay {
        position: absolute; inset: 0; pointer-events: none; z-index: 10;
        font-family: 'Rajdhani', sans-serif; color: var(--color-textPrimary);
        font-size: calc(16px * var(--font-scale));
      }
      #ui-overlay * { pointer-events: auto; }

      .screen { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
      .screen-hud { pointer-events: none; flex-direction: column; justify-content: space-between; padding: env(safe-area-inset-top) 16px env(safe-area-inset-bottom); }
      .screen-hud .hud-pause { pointer-events: auto; }

      .animate-in { animation: ${'var(--reduced-motion)'} == 1 ? none : fadeScaleIn 0.4s ease-out; }
      @keyframes fadeScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

      /* Loading */
      .loading-logo { font-family: 'Orbitron', sans-serif; font-size: 2rem; font-weight: 900; color: var(--color-neonCyan); text-shadow: 0 0 30px rgba(0,240,255,0.5); margin-bottom: 24px; }
      .loading-bar { width: 200px; height: 4px; background: var(--color-voidLight); border-radius: 2px; overflow: hidden; }
      .loading-bar-fill { height: 100%; width: 0; background: var(--color-neonCyan); animation: loadFill 1.5s ease-in-out forwards; box-shadow: 0 0 10px var(--color-neonCyan); }
      @keyframes loadFill { to { width: 100%; } }
      .loading-text { margin-top: 12px; color: var(--color-textSecondary); font-size: 0.85rem; }

      /* Splash */
      .splash-title { font-family: 'Orbitron', sans-serif; font-size: 3rem; font-weight: 900; background: linear-gradient(135deg, var(--color-neonCyan), var(--color-neonMagenta)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
      .splash-subtitle { font-family: 'Orbitron', sans-serif; letter-spacing: 0.5em; color: var(--color-textSecondary); margin-top: 8px; }
      .splash-pulse { width: 60px; height: 60px; border: 2px solid var(--color-neonCyan); border-radius: 50%; margin: 32px auto 0; animation: pulse 1.5s ease-in-out infinite; }
      @keyframes pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.3); opacity: 0.5; } }

      /* Menu */
      .menu-content { width: 100%; max-width: 480px; padding: 24px; text-align: center; }
      .menu-title { font-family: 'Orbitron', sans-serif; font-size: 2.2rem; font-weight: 900; color: var(--color-neonCyan); text-shadow: 0 0 20px rgba(0,240,255,0.4); }
      .menu-subtitle { font-family: 'Orbitron', sans-serif; letter-spacing: 0.4em; font-size: 0.75rem; color: var(--color-textSecondary); margin-bottom: 24px; }

      .mode-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
      .mode-card {
        background: rgba(18,24,41,0.85); border: 1px solid rgba(0,240,255,0.15); border-radius: 12px;
        padding: 16px 12px; cursor: pointer; transition: all 0.2s; text-align: left;
        backdrop-filter: blur(8px);
      }
      .mode-card:hover, .mode-card:focus { border-color: var(--color-neonCyan); box-shadow: 0 0 20px rgba(0,240,255,0.2); transform: translateY(-2px); }
      .mode-card:nth-child(5) { grid-column: 1 / -1; }
      .mode-label { display: block; font-family: 'Orbitron', sans-serif; font-weight: 700; font-size: 0.9rem; color: var(--color-neonCyan); }
      .mode-desc { display: block; font-size: 0.75rem; color: var(--color-textSecondary); margin-top: 4px; }
      .mode-best { display: block; font-size: 0.7rem; color: var(--color-neonGold); margin-top: 6px; }

      .menu-nav { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-bottom: 20px; }

      .sync-bar { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; }
      .sync-label { font-family: 'Orbitron', sans-serif; color: var(--color-neonViolet); white-space: nowrap; }
      .progress-bar { flex: 1; height: 6px; background: var(--color-voidLight); border-radius: 3px; overflow: hidden; }
      .progress-fill { height: 100%; background: linear-gradient(90deg, var(--color-neonViolet), var(--color-neonCyan)); transition: width 0.5s; }
      .sync-xp { color: var(--color-textSecondary); white-space: nowrap; }

      /* Buttons */
      .btn {
        font-family: 'Orbitron', sans-serif; font-weight: 600; font-size: 0.8rem;
        padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer;
        transition: all 0.15s; letter-spacing: 0.05em;
      }
      .btn-primary { background: var(--color-neonCyan); color: var(--color-void); }
      .btn-primary:hover { box-shadow: 0 0 20px rgba(0,240,255,0.4); transform: translateY(-1px); }
      .btn-secondary { background: transparent; color: var(--color-textPrimary); border: 1px solid rgba(255,255,255,0.15); }
      .btn-secondary:hover { border-color: var(--color-neonCyan); color: var(--color-neonCyan); }
      .btn-ghost { background: transparent; color: var(--color-textSecondary); }
      .btn-icon { background: rgba(18,24,41,0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px 12px; color: var(--color-textPrimary); cursor: pointer; font-size: 1rem; }

      /* HUD */
      .hud-top { display: flex; align-items: flex-start; justify-content: space-between; width: 100%; padding-top: env(safe-area-inset-top, 8px); }
      .hud-label { font-size: 0.65rem; color: var(--color-textSecondary); letter-spacing: 0.15em; }
      .hud-score { font-family: 'Orbitron', sans-serif; font-size: 1.6rem; font-weight: 800; display: block; }
      .hud-time { font-family: 'Orbitron', sans-serif; font-size: 1.2rem; font-weight: 600; }
      .hud-bottom { width: 100%; padding-bottom: env(safe-area-inset-bottom, 8px); }
      .hud-combo { font-family: 'Orbitron', sans-serif; font-size: 1.1rem; color: var(--color-neonGold); font-weight: 700; display: block; margin-bottom: 8px; }
      .hud-phase { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
      .hud-label-sm { font-size: 0.6rem; color: var(--color-textSecondary); letter-spacing: 0.1em; }
      .phase-bar { flex: 1; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; max-width: 120px; }
      .phase-fill { height: 100%; background: var(--color-neonViolet); border-radius: 2px; transition: width 0.1s; box-shadow: 0 0 8px var(--color-neonViolet); }
      .hud-powerups { display: flex; gap: 6px; }
      .powerup-badge { width: 24px; height: 24px; border-radius: 50%; background: var(--color-neonViolet); display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; }
      .hud-hint { text-align: center; font-size: 0.65rem; color: var(--color-textSecondary); opacity: 0.5; pointer-events: none; padding-bottom: 4px; }

      /* Modals */
      .modal-overlay { background: rgba(10,14,26,0.75); backdrop-filter: blur(4px); }
      .panel {
        background: rgba(18,24,41,0.95); border: 1px solid rgba(0,240,255,0.2);
        border-radius: 16px; padding: 32px 24px; max-width: 420px; width: 90%;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 40px rgba(0,240,255,0.05);
      }
      .panel-scroll { max-height: 80vh; overflow-y: auto; }
      .modal-title { font-family: 'Orbitron', sans-serif; font-size: 1.4rem; font-weight: 800; text-align: center; margin-bottom: 20px; color: var(--color-neonCyan); }
      .modal-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 20px; }

      .new-high-score { text-align: center; color: var(--color-neonGold); font-family: 'Orbitron', sans-serif; font-weight: 700; margin-bottom: 16px; animation: pulse 1s ease-in-out infinite; }
      .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .stat-item { text-align: center; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 8px; }
      .stat-label { display: block; font-size: 0.65rem; color: var(--color-textSecondary); letter-spacing: 0.1em; margin-bottom: 4px; }
      .stat-value { font-family: 'Orbitron', sans-serif; font-size: 1.1rem; font-weight: 700; }

      /* Settings */
      .settings-group { display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px; }
      .setting-row { display: flex; align-items: center; gap: 12px; justify-content: space-between; }
      .setting-row input[type="range"] { flex: 1; accent-color: var(--color-neonCyan); }
      .setting-row select { background: var(--color-voidLight); color: var(--color-textPrimary); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 6px 10px; }
      .setting-value { font-family: 'Orbitron', sans-serif; font-size: 0.8rem; min-width: 32px; text-align: right; }

      /* Achievements */
      .ach-progress { text-align: center; color: var(--color-textSecondary); margin-bottom: 16px; }
      .ach-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
      .ach-item { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.02); }
      .ach-item.unlocked { border-left: 3px solid var(--color-neonGold); }
      .ach-item.locked { opacity: 0.4; }
      .ach-icon { font-size: 1.5rem; }
      .ach-title { font-family: 'Orbitron', sans-serif; font-weight: 600; font-size: 0.85rem; display: block; }
      .ach-desc { font-size: 0.75rem; color: var(--color-textSecondary); }

      /* Leaderboard */
      .lb-section { margin-bottom: 16px; }
      .lb-mode { font-family: 'Orbitron', sans-serif; font-size: 0.85rem; color: var(--color-neonCyan); margin-bottom: 8px; }
      .lb-list { list-style: none; }
      .lb-entry { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.85rem; }
      .lb-rank { color: var(--color-neonGold); font-weight: 700; min-width: 28px; }
      .lb-score { font-family: 'Orbitron', sans-serif; font-weight: 600; flex: 1; }
      .lb-date { color: var(--color-textSecondary); font-size: 0.75rem; }
      .lb-empty { color: var(--color-textSecondary); font-size: 0.8rem; }

      /* Daily */
      .daily-info { text-align: center; line-height: 2; margin-bottom: 16px; }
      .daily-complete { color: var(--color-neonGreen); font-weight: 600; }

      /* Toast */
      .toast {
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%) translateY(-20px);
        background: rgba(18,24,41,0.95); border: 1px solid var(--color-neonGold);
        padding: 12px 24px; border-radius: 8px; z-index: 300;
        font-family: 'Orbitron', sans-serif; font-size: 0.85rem; color: var(--color-neonGold);
        opacity: 0; transition: all 0.3s; pointer-events: none;
      }
      .toast.visible { opacity: 1; transform: translateX(-50%) translateY(0); }
      .toast-bonus { border-color: var(--color-neonGold); color: var(--color-neonGold); }
      .toast-milestone { border-color: var(--color-neonViolet); color: var(--color-neonViolet); }
      .toast-combo { border-color: var(--color-neonCyan); color: var(--color-neonCyan); }

      .credits-badge { color: var(--color-neonGold); font-weight: 700; margin-left: 4px; }
      .rank-badge { text-align: center; font-family: 'Orbitron', sans-serif; color: var(--color-neonViolet); font-size: 0.85rem; margin-bottom: 12px; font-weight: 600; }

      .tutorial-overlay { position: absolute; inset: 0; background: rgba(10,14,26,0.75); display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 20; }
      .tutorial-overlay.hidden { display: none; }
      .tutorial-panel { background: rgba(18,24,41,0.95); border: 1px solid var(--color-neonCyan); border-radius: 12px; padding: 24px; max-width: 320px; text-align: center; }
      .tutorial-panel h3 { font-family: 'Orbitron', sans-serif; color: var(--color-neonCyan); margin-bottom: 12px; }
      .tutorial-panel p { margin: 8px 0; font-size: 0.9rem; color: var(--color-textSecondary); }
      .tutorial-dismiss { color: var(--color-neonGold) !important; margin-top: 16px !important; font-weight: 600; }

      .upgrade-credits { text-align: center; font-family: 'Orbitron', sans-serif; color: var(--color-neonGold); font-size: 1.2rem; margin-bottom: 4px; }
      .upgrade-hint { text-align: center; color: var(--color-textSecondary); font-size: 0.8rem; margin-bottom: 16px; }
      .upgrade-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
      .upgrade-item { display: flex; align-items: center; gap: 12px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); }
      .upgrade-item.maxed { border-color: var(--color-neonGold); opacity: 0.85; }
      .upgrade-icon { font-size: 1.5rem; }
      .upgrade-info { flex: 1; }
      .upgrade-name { font-family: 'Orbitron', sans-serif; font-size: 0.8rem; display: block; }
      .upgrade-desc { font-size: 0.72rem; color: var(--color-textSecondary); }
      .btn-sm { padding: 6px 12px !important; font-size: 0.75rem !important; min-width: 56px; }
      .btn-sm:disabled { opacity: 0.35; cursor: not-allowed; }

      .daily-bonus-amount { text-align: center; font-family: 'Orbitron', sans-serif; font-size: 1.8rem; color: var(--color-neonGold); margin: 16px 0 8px; }
      .daily-bonus-streak { text-align: center; color: var(--color-textSecondary); margin-bottom: 16px; }

      /* Light theme */
      body.light-theme { background: #f0f4f8; }
      body.light-theme .panel { background: rgba(255,255,255,0.95); color: #0a0e1a; }
      body.high-contrast .mode-card { border-width: 2px; }
      body.high-contrast .btn-primary { border: 2px solid #fff; }

      @media (min-width: 768px) {
        .mode-grid { grid-template-columns: repeat(3, 1fr); }
        .mode-card:nth-child(5) { grid-column: auto; }
        .menu-title { font-size: 2.8rem; }
      }
      @media (orientation: landscape) and (max-height: 500px) {
        .menu-content { padding: 12px; }
        .menu-title { font-size: 1.6rem; }
        .mode-grid { grid-template-columns: repeat(5, 1fr); }
        .mode-card:nth-child(5) { grid-column: auto; }
      }
    `;
    document.head.appendChild(style);
  }

  destroy(): void {
    this.overlay.remove();
  }
}
