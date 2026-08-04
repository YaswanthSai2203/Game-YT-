import { msIcon } from '@/utils/icons';
import { bindTap } from '@/utils/tap';

export type ModalButton = {
  action: string;
  label: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
};

/** Sync Glass panel wrapper — shared modal / game-over shell. */
export function syncPanel(innerHtml: string, extraClass = ''): string {
  const cls = ['sync-panel', 'panel', 'animate-in', extraClass].filter(Boolean).join(' ');
  return `<div class="${cls}">${innerHtml}</div>`;
}

export function modalTitle(text: string, icon?: string): string {
  return `
    <header class="sync-modal-header">
      ${icon ? `<div class="sync-modal-icon" aria-hidden="true">${msIcon(icon)}</div>` : ''}
      <h2 class="modal-title">${text}</h2>
    </header>
  `;
}

export function modalActions(buttons: ModalButton[]): string {
  return `
    <div class="modal-actions sync-modal-actions">
      ${buttons.map((b) => `
        <button type="button" class="btn btn-${b.variant ?? 'primary'}" data-action="${b.action}">
          ${b.icon ? msIcon(b.icon) : ''}${b.label}
        </button>
      `).join('')}
    </div>
  `;
}

export function bindModalActions(
  root: ParentNode,
  handlers: Record<string, () => void>,
): void {
  Object.entries(handlers).forEach(([action, handler]) => {
    const btn = root.querySelector(`[data-action="${action}"]`);
    if (btn) bindTap(btn, handler);
  });
}

export function heroMetric(label: string, value: string, accent: 'cyan' | 'gold' | 'violet' = 'cyan'): string {
  return `
    <div class="hero-metric hero-metric-${accent}">
      <span class="hero-metric-label">${label}</span>
      <span class="hero-metric-value">${value}</span>
    </div>
  `;
}
