import type Lenis from "lenis";

// Shared handle to the active Lenis instance so non-AppMotion components
// (e.g. modals) can pause/resume page scroll without prop drilling.
let instance: Lenis | null = null;

export function registerLenis(l: Lenis | null) {
  instance = l;
}

export function stopScroll() {
  instance?.stop();
}

export function startScroll() {
  instance?.start();
}
