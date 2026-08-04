import { isCompactUI } from '@/utils/uiMode';

/** Backdrop blur is desktop-only — avoids Android compositor jank during WebGL play. */
export function canUseBackdropBlur(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(min-width: 769px) and (pointer: fine)').matches;
}

/** Edge vignette on high combo — Ghost HUD keeps the playfield clean on mobile. */
export function canShowHypeVignette(reducedMotion: boolean): boolean {
  return !reducedMotion && !isCompactUI();
}

/** Full-screen hype callouts during runs — tier 4+ only on compact mobile. */
export function canShowHypeCallout(opts: {
  tier: number;
  reducedMotion: boolean;
  inActiveRun: boolean;
}): boolean {
  if (opts.reducedMotion && opts.inActiveRun && isCompactUI()) {
    return false;
  }
  if (opts.inActiveRun && isCompactUI() && opts.tier < 4) {
    return false;
  }
  return true;
}

/** Prefer toast instead of animated hype when motion is reduced mid-run. */
export function shouldUseHypeToast(reducedMotion: boolean, inActiveRun: boolean): boolean {
  return reducedMotion && (!inActiveRun || !isCompactUI());
}
