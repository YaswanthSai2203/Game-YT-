/** Reliable tap/click for mobile menus (iOS can miss delayed click after touch-action: none). */
export function bindTap(element: Element, handler: (e: Event) => void): void {
  let lastFireAt = 0;

  const run = (e: Event): void => {
    const now = Date.now();
    if (now - lastFireAt < 300) return;
    lastFireAt = now;
    e.stopPropagation();
    handler(e);
  };

  element.addEventListener(
    'pointerup',
    (e) => {
      if (!(e instanceof PointerEvent)) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      run(e);
    },
    { passive: true },
  );
  element.addEventListener('click', run);
}

/** Pause / critical controls — run on touchstart before touchend lane logic. */
export function bindImmediatePress(
  element: Element,
  handler: (e: Event) => void,
): void {
  const run = (e: Event): void => {
    e.stopPropagation();
    if ('preventDefault' in e) e.preventDefault();
    handler(e);
  };

  element.addEventListener('touchstart', run, { passive: false, capture: true });
  element.addEventListener('touchend', (e) => e.stopPropagation(), { capture: true });
  element.addEventListener('pointerdown', run, { capture: true });
}
