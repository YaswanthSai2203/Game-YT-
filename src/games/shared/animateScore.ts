/** Animate a DOM element counting up to a target score. */
export function animateScoreElement(
  el: HTMLElement,
  target: number,
  opts?: { durationMs?: number; formatter?: (n: number) => string },
): () => void {
  const duration = opts?.durationMs ?? 900;
  const format = opts?.formatter ?? ((n: number) => n.toLocaleString());
  const start = performance.now();
  const from = 0;
  let raf = 0;

  const tick = (now: number): void => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const value = Math.round(from + (target - from) * eased);
    el.textContent = format(value);
    if (t < 1) {
      raf = requestAnimationFrame(tick);
    } else {
      el.textContent = format(target);
    }
  };

  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
