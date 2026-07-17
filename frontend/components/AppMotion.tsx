"use client";

import { useEffect, useRef } from "react";
import { registerLenis } from "@/lib/smoothScroll";

/**
 * Cinematic motion for the Command Center interior — the same GSAP + Lenis
 * engine the landing uses, scoped to any element with [data-app-motion].
 * Reveals panels / fields / inputs / buttons / cards with staggered
 * scroll-triggered animations, so the inside of the app feels as alive as
 * the landing page. Mount once in the /app layout.
 *
 * Robustness notes (why this isn't a naive gsap.from):
 *  - Reveals use `once: true` + `invalidateOnRefresh` so they never re-hide
 *    and recompute when layout shifts.
 *  - A MutationObserver + timed refresh keeps ScrollTrigger positions correct
 *    after async content (job list, tracker rows, analytics) loads — otherwise
 *    lower cards can get stuck hidden and scrolling feels broken.
 */
export function AppMotion({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const smooth = window.matchMedia(
      "(pointer: fine) and (prefers-reduced-motion: no-preference)",
    ).matches;

    let cancelled = false;
    let dispose = () => undefined;

    const init = async () => {
      await document.fonts?.ready;
      const [{ gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
        import("lenis"),
      ]);
      if (cancelled) return;

      gsap.registerPlugin(ScrollTrigger);

      let destroySmooth = () => undefined;
      const ctx = gsap.context(() => {
        // Smooth scroll (desktop only)
        if (smooth) {
          const lenis = new Lenis({
            duration: 1.05,
            easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
            wheelMultiplier: 0.9,
            touchMultiplier: 1,
          });
          const tick = (time: number) => lenis.raf(time * 1000);
          lenis.on("scroll", ScrollTrigger.update);
          gsap.ticker.add(tick);
          registerLenis(lenis);
          destroySmooth = () => {
            gsap.ticker.remove(tick);
            lenis.destroy();
            registerLenis(null);
          };
        }

        const reveal = (
          targets: gsap.DOMTarget,
          vars: gsap.TweenVars,
          st: ScrollTrigger.Vars,
        ) => {
          gsap.from(targets, {
            ...vars,
            scrollTrigger: { ...st, once: true, invalidateOnRefresh: true },
          });
        };

        // Panels rise + fade; their children cascade in.
        const panels = gsap.utils.toArray<HTMLElement>("[data-app-motion] .panel", root);
        panels.forEach((panel) => {
          const kids = panel.querySelectorAll<HTMLElement>(
            ".panel__head, .field, .jobbar, .jobboard__sources, .jobfilters, .result-card, .modal__section, button, .chip",
          );
          reveal(panel, { y: 38, autoAlpha: 0, duration: 0.7, ease: "power3.out" },
            { trigger: panel, start: "top 88%" });
          if (kids.length) {
            reveal(kids, { y: 18, autoAlpha: 0, duration: 0.55, ease: "power2.out", stagger: 0.06 },
              { trigger: panel, start: "top 84%" });
          }
        });

        // Job / command-center cards rise + fade as they enter.
        const cards = gsap.utils.toArray<HTMLElement>(
          "[data-app-motion] .jobcard, [data-app-motion] .cc-card, [data-app-motion] .joblist > *",
          root,
        );
        if (cards.length) {
          reveal(cards, { y: 26, autoAlpha: 0, duration: 0.5, ease: "power2.out", stagger: 0.05 },
            { trigger: cards[0], start: "top 92%" });
        }

        // Result cards pop when they appear after an action.
        gsap.utils.toArray<HTMLElement>("[data-app-motion] .result-card", root).forEach((r) => {
          reveal(r, { scale: 0.98, autoAlpha: 0, duration: 0.45, ease: "power2.out" },
            { trigger: r, start: "top 90%" });
        });

        // Keep trigger positions correct as async content changes height.
        ScrollTrigger.refresh();
      }, root);

      // Refresh after the async job/data lists load and on route/content change.
      const refreshSoon = () => ScrollTrigger.refresh();
      const timers = [300, 800, 1600, 2800].map((ms) => window.setTimeout(refreshSoon, ms));
      window.addEventListener("load", refreshSoon);

      const mo = new MutationObserver(() => ScrollTrigger.refresh());
      mo.observe(root, { childList: true, subtree: true, attributes: false });

      dispose = () => {
        timers.forEach((t) => window.clearTimeout(t));
        window.removeEventListener("load", refreshSoon);
        mo.disconnect();
        ctx.revert();
        destroySmooth();
      };
    };

    void init();
    return () => {
      cancelled = true;
      dispose();
    };
  }, []);

  return <div ref={rootRef} data-app-motion>{children}</div>;
}
