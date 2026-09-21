/** Boot sequence with progress bar — avoids blank-to-game jump. */
export function runGameBoot(
  root: HTMLElement,
  opts: { title: string; subtitle?: string; minMs?: number },
): Promise<void> {
  const minMs = opts.minMs ?? 950;
  const boot = document.createElement('div');
  boot.className = 'mg-boot-overlay';
  boot.innerHTML = `
    <div class="mg-boot-panel">
      <div class="mg-boot-spinner" aria-hidden="true"></div>
      <p class="mg-boot-title">${opts.title}</p>
      ${opts.subtitle ? `<p class="mg-boot-sub">${opts.subtitle}</p>` : ''}
      <div class="mg-boot-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <div class="mg-boot-bar-fill"></div>
      </div>
    </div>
  `;
  root.appendChild(boot);

  const fill = boot.querySelector('.mg-boot-bar-fill') as HTMLElement;
  const bar = boot.querySelector('.mg-boot-bar') as HTMLElement;
  const start = performance.now();

  return new Promise((resolve) => {
    const tick = (now: number): void => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / minMs);
      const pct = Math.round(t * 100);
      if (fill) fill.style.width = `${pct}%`;
      if (bar) bar.setAttribute('aria-valuenow', String(pct));
      if (t >= 1) {
        boot.classList.add('mg-boot-done');
        setTimeout(() => {
          boot.remove();
          resolve();
        }, 300);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
