"use client";

import { useEffect, useRef } from "react";

/**
 * Cinematic motion for the Command Center interior — the same GSAP + Lenis
 * engine the landing uses, scoped to any element with [data-app-motion].
 * Reveals panels / fields / inputs / buttons / cards with staggered
 * scroll-triggered animations and a soft parallax, so the inside of the app
 * feels as alive as the landing page. Mount once in the /app layout.
 */
export function AppMotion({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const media = window.matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)");

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
        if (media.matches) {
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
          destroySmooth = () => {
            gsap.ticker.remove(tick);
            lenis.destroy();
          };
        }

        // Staggered reveal for every panel + its children on scroll-in.
        const panels = gsap.utils.toArray<HTMLElement>("[data-app-motion] .panel", root);
        panels.forEach((panel) => {
          const kids = panel.querySelectorAll<HTMLElement>(
            ".panel__head, .field, .jobbar, .jobboard__sources, .jobfilters, .result-card, .modal__section, button, .chip",
          );
          gsap.from(panel, {
            y: 38,
            autoAlpha: 0,
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: { trigger: panel, start: "top 88%" },
          });
          if (kids.length) {
            gsap.from(kids, {
              y: 18,
              autoAlpha: 0,
              duration: 0.55,
              ease: "power2.out",
              stagger: 0.06,
              scrollTrigger: { trigger: panel, start: "top 84%" },
            });
          }
        });

        // Job cards / command-center cards: rise + fade as they enter.
        const cards = gsap.utils.toArray<HTMLElement>(
          "[data-app-motion] .jobcard, [data-app-motion] .cc-card, [data-app-motion] .joblist > *",
          root,
        );
        if (cards.length) {
          gsap.from(cards, {
            y: 26,
            autoAlpha: 0,
            duration: 0.5,
            ease: "power2.out",
            stagger: 0.05,
            scrollTrigger: { trigger: cards[0], start: "top 92%" },
          });
        }

        // Result cards: gentle pop when they appear after an action.
        const results = gsap.utils.toArray<HTMLElement>("[data-app-motion] .result-card", root);
        results.forEach((r) => {
          gsap.from(r, {
            scale: 0.98,
            autoAlpha: 0,
            duration: 0.45,
            ease: "power2.out",
            scrollTrigger: { trigger: r, start: "top 90%" },
          });
        });

        ScrollTrigger.refresh();
      }, root);

      dispose = () => {
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
